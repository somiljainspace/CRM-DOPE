#!/usr/bin/env node

const crypto = require('node:crypto');
const { Pool } = require('pg');

const DEFAULT_WORKSPACE_ID = 'ffffffff-1111-2222-3333-444444444444';
// PostgreSQL UUID values in older local fixtures use valid 8-4-4-4-12
// hexadecimal formatting without RFC 4122 version/variant bits.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fail(message) { throw new Error(message); }

function envInt(name, fallback, min, max) {
  const raw = process.env[name];
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) fail(`${name} must be an integer from ${min} to ${max}`);
  return value;
}

function stableUuid(seed) {
  const bytes = crypto.createHash('sha256').update(seed).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function createPool() {
  return new Pool({
    host: process.env.PG_HOST || 'localhost',
    port: Number(process.env.PG_PORT || 5433),
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || 'password',
    database: process.env.PG_DATABASE || 'cdp_crm',
  });
}

function clickhouseConfig() {
  return {
    url: (process.env.CLICKHOUSE_URL || 'http://localhost:8123').replace(/\/$/, ''),
    user: process.env.CLICKHOUSE_USER || 'default',
    password: process.env.CLICKHOUSE_PASSWORD || '',
  };
}

async function clickhouseQuery(query) {
  const cfg = clickhouseConfig();
  const response = await fetch(`${cfg.url}/?query=${encodeURIComponent(query)}`, {
    headers: { Authorization: `Basic ${Buffer.from(`${cfg.user}:${cfg.password}`).toString('base64')}` },
  });
  if (!response.ok) fail(`ClickHouse query failed with HTTP ${response.status}`);
  return response.text();
}

async function apiPost(baseUrl, path, apiKey, body) {
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let payload = {};
  try { payload = text ? JSON.parse(text) : {}; } catch { /* status below is still useful */ }
  if (!response.ok) fail(`API ${path} failed with HTTP ${response.status}: ${payload.message || payload.error || 'request failed'}`);
  return payload;
}

function parseArgs() {
  const args = new Set(process.argv.slice(2));
  if (args.has('--help')) {
    console.log('Usage: npm run seed:synthetic -- [--dry-run]');
    console.log('Required: CRM_DOPE_DEMO_MODE=true DEMO_INGESTION_KEY=sk_...');
    console.log('Optional: DEMO_WORKSPACE_ID, SYNTHETIC_SEED, SYNTHETIC_DAYS, SYNTHETIC_USERS, API_BASE_URL');
    process.exit(0);
  }
  return { dryRun: args.has('--dry-run') };
}

function assertSafeEnvironment() {
  const environment = [process.env.NODE_ENV, process.env.APP_ENV, process.env.DEPLOYMENT_ENV, process.env.ENVIRONMENT]
    .filter(Boolean).map((value) => value.toLowerCase());
  if (environment.includes('production') || environment.includes('prod')) fail('Synthetic seeding is refused in a production environment');
  if (process.env.CRM_DOPE_DEMO_MODE !== 'true') fail('Set CRM_DOPE_DEMO_MODE=true to authorize synthetic demo writes');
  if (!process.env.DEMO_INGESTION_KEY) fail('Set DEMO_INGESTION_KEY explicitly; the seeder never creates or prints a default API key');
}

function makeDataset({ tenantId, seed, users, days }) {
  const start = Date.now() - (days - 1) * 86400000;
  const events = [];
  const identities = [];
  const countries = ['US', 'CA', 'GB', 'DE', 'AU', 'IN'];
  const plans = ['free', 'pro', 'enterprise'];
  const stages = ['trial', 'active', 'returning', 'power'];

  const add = (index, event, timestamp, identity, properties, session) => {
    events.push({
      tenantId,
      eventId: stableUuid(`${seed}:event:${index}`),
      timestamp: new Date(timestamp).toISOString(),
      type: 'track',
      event,
      properties: { ...properties, synthetic_dataset: seed },
      anonymousId: identity.anonymousId,
      ...(identity.userId ? { userId: identity.userId } : {}),
      sessionId: session,
      context: { library: { name: 'crm-dope-synthetic-seeder', version: '1' } },
    });
  };

  for (let i = 0; i < users; i += 1) {
    const anonymousId = `synthetic_${seed}_anon_${String(i).padStart(3, '0')}`;
    const identified = i % 5 !== 0;
    const userId = identified ? `synthetic_${seed}_user_${String(i).padStart(3, '0')}` : undefined;
    const traits = {
      country: countries[i % countries.length],
      plan: plans[i % plans.length],
      purchase_count: i % 6,
      email_domain: 'synthetic.example',
      lifecycle_stage: stages[i % stages.length],
      synthetic_dataset: seed,
    };
    identities.push({ anonymousId, userId, traits });

    const userStart = start + (i % Math.max(1, days - 8)) * 86400000;
    const session = `synthetic_${seed}_session_${String(i).padStart(3, '0')}`;
    if (identified) add(`${i}:prelogin`, 'page_viewed', userStart + 30 * 60000, { anonymousId }, { page: '/pricing' }, `${session}_anon`);

    const identity = { anonymousId, userId };
    const sequenceStart = userStart + 86400000;
    add(`${i}:signup`, 'signup_completed', sequenceStart, identity, { source: i % 2 ? 'organic' : 'marketplace' }, session);
    add(`${i}:page`, 'page_viewed', sequenceStart + 2 * 60000, identity, { page: '/catalog' }, session);
    add(`${i}:product`, 'product_viewed', sequenceStart + 4 * 60000, identity, { product_id: `product_${i % 8}`, category: ['books', 'home', 'outdoor', 'tech'][i % 4] }, session);
    add(`${i}:cart`, 'item_added_to_cart', sequenceStart + 7 * 60000, identity, { product_id: `product_${i % 8}`, quantity: (i % 3) + 1 }, session);
    add(`${i}:checkout`, 'checkout_started', sequenceStart + 10 * 60000, identity, { cart_value: 25 + (i % 8) * 15, currency: 'USD' }, session);
    if (i % 4 !== 0) add(`${i}:order`, 'order_completed', sequenceStart + 14 * 60000, identity, { order_id: `synthetic_order_${seed}_${i}`, value: 25 + (i % 8) * 15, currency: 'USD' }, session);

    for (const offset of [3, 7, 14, 21]) {
      if (offset >= days) continue;
      const repeat = userStart + offset * 86400000 + 3 * 60000;
      add(`${i}:repeat:${offset}`, 'page_viewed', repeat, identity, { page: offset % 2 ? '/catalog' : '/account' }, `${session}_${offset}`);
      if ((i + offset) % 3 !== 0) add(`${i}:repeat-product:${offset}`, 'product_viewed', repeat + 2 * 60000, identity, { product_id: `product_${(i + offset) % 8}`, category: ['books', 'home', 'outdoor', 'tech'][(i + offset) % 4] }, `${session}_${offset}`);
    }
  }
  return { identities, events };
}

async function existingEventIds(tenantId, events) {
  const found = new Set();
  for (let offset = 0; offset < events.length; offset += 500) {
    const batch = events.slice(offset, offset + 500);
    const ids = batch.map((event) => `toUUID('${event.eventId}')`).join(',');
    const text = await clickhouseQuery(`SELECT toString(event_id) AS event_id_text FROM events.analytics_events WHERE tenant_id = toUUID('${tenantId}') AND event_id IN (${ids}) FORMAT JSONEachRow`);
    for (const line of text.split('\n').filter(Boolean)) found.add(JSON.parse(line).event_id_text);
  }
  return found;
}

async function main() {
  const { dryRun } = parseArgs();
  assertSafeEnvironment();
  const workspaceId = process.env.DEMO_WORKSPACE_ID || DEFAULT_WORKSPACE_ID;
  if (!UUID_RE.test(workspaceId)) fail('DEMO_WORKSPACE_ID must be a UUID');
  const seed = process.env.SYNTHETIC_SEED || 'crm-dope-demo-v1';
  const days = envInt('SYNTHETIC_DAYS', 30, 7, 90);
  const users = envInt('SYNTHETIC_USERS', 32, 1, 250);
  const apiBase = process.env.API_BASE_URL || 'http://localhost:3000';
  const apiKey = process.env.DEMO_INGESTION_KEY;
  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
  const dataset = makeDataset({ tenantId: undefined, seed, users, days });
  const database = createPool();
  let scope;
  let existingIdentities = new Set();

  try {
    const result = await database.query(
      `SELECT w.id AS workspace_id, w.tenant_id, p.id AS project_id, e.id AS environment_id, e.type AS environment_type
       FROM workspaces w JOIN projects p ON p.workspace_id = w.id JOIN environments e ON e.project_id = p.id
       WHERE w.id = $1 ORDER BY e.created_at LIMIT 1`,
      [workspaceId],
    );
    if (result.rows.length === 0) fail(`Workspace ${workspaceId} is missing a project/environment; run bootstrap-demo first`);
    scope = result.rows[0];
    if (scope.environment_type === 'production') fail('Synthetic seeding is refused for a production environment');
    dataset.events.forEach((event) => { event.tenantId = scope.tenant_id; });

    const key = await database.query('SELECT tenant_id, environment_id, revoked_at FROM api_keys WHERE key_hash = $1', [keyHash]);
    if (key.rows.length === 0) {
      if (dryRun) console.log('Dry run: the supplied ingestion key would be registered for the selected development environment.');
      else {
        await database.query(
          `INSERT INTO api_keys (id, tenant_id, key_hash, prefix, name, key_type, environment_id)
           VALUES ($1, $2, $3, $4, $5, 'secret', $6)`,
          [crypto.randomUUID(), scope.tenant_id, keyHash, apiKey.slice(0, 10), `synthetic-${seed}`, scope.environment_id],
        );
        console.log(`Registered the supplied ingestion key for environment ${scope.environment_id}.`);
      }
    } else if (key.rows[0].tenant_id !== scope.tenant_id || key.rows[0].environment_id !== scope.environment_id || key.rows[0].revoked_at) {
      fail('DEMO_INGESTION_KEY is revoked or belongs to a different tenant/environment');
    }

    const identityRows = await database.query(
      `SELECT identity_type, identity_value FROM customer_identities
       WHERE tenant_id = $1 AND project_id = $2 AND environment_id = $3
       AND identity_value LIKE $4`,
      [scope.tenant_id, scope.project_id, scope.environment_id, `synthetic_${seed}_%`],
    );
    existingIdentities = new Set(identityRows.rows.map((row) => `${row.identity_type}:${row.identity_value}`));
  } finally {
    await database.end();
  }

  console.log(`Synthetic plan: ${users} identities, ${dataset.events.length} events, ${days} days, seed ${seed}.`);
  console.log(`Target: workspace ${scope.workspace_id}, project ${scope.project_id}, environment ${scope.environment_id}.`);
  if (dryRun) return console.log('Dry run complete; no profiles or events were written.');

  let profileCalls = 0;
  for (const identity of dataset.identities) {
    const anonymousExists = existingIdentities.has(`anonymous_id:${identity.anonymousId}`);
    const userExists = identity.userId && existingIdentities.has(`user_id:${identity.userId}`);
    if (anonymousExists && (!identity.userId || userExists)) continue;
    if (identity.userId && !anonymousExists) {
      await apiPost(apiBase, '/v1/identify', apiKey, { tenantId: scope.tenant_id, anonymousId: identity.anonymousId, traits: identity.traits });
      profileCalls += 1;
    }
    if (identity.userId && !userExists) {
      await apiPost(apiBase, '/v1/identify', apiKey, { tenantId: scope.tenant_id, anonymousId: identity.anonymousId, userId: identity.userId, traits: identity.traits });
      profileCalls += 1;
    } else if (!identity.userId && !anonymousExists) {
      await apiPost(apiBase, '/v1/identify', apiKey, { tenantId: scope.tenant_id, anonymousId: identity.anonymousId, traits: identity.traits });
      profileCalls += 1;
    }
  }

  const found = await existingEventIds(scope.tenant_id, dataset.events);
  const missing = dataset.events.filter((event) => !found.has(event.eventId));
  let processed = 0;
  for (let offset = 0; offset < missing.length; offset += 500) {
    const response = await apiPost(apiBase, '/v1/track/batch', apiKey, { batch: missing.slice(offset, offset + 500) });
    processed += Number(response.processed || 0);
  }

  const verificationPool = createPool();
  try {
    const profiles = await verificationPool.query(
      `SELECT count(*)::int AS count FROM customer_profiles
       WHERE tenant_id = $1 AND project_id = $2 AND environment_id = $3
       AND (anonymous_id LIKE $4 OR user_id LIKE $5)`,
      [scope.tenant_id, scope.project_id, scope.environment_id, `synthetic_${seed}_%`, `synthetic_${seed}_%`],
    );
    console.log(`Complete: profile calls ${profileCalls}; new events accepted ${processed}; existing events skipped ${found.size}; synthetic profiles ${profiles.rows[0].count}.`);
    console.log('Rerunning with the same seed and key is safe: deterministic event IDs are skipped after the ClickHouse check.');
  } finally {
    await verificationPool.end();
  }
}

main().catch((error) => {
  console.error(`Synthetic seed failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
