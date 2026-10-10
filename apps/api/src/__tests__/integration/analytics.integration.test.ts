import { buildApp } from '../../server';
import { FastifyInstance } from 'fastify';
import { Pool } from 'pg';
import * as crypto from 'crypto';
import { randomUUID } from 'crypto';

describe('Analytics Integration', () => {
  let app: FastifyInstance;
  let pg: Pool;

  const TENANT = randomUUID();
  const OTHER_TENANT = randomUUID();
  const PROJECT = randomUUID();
  const OTHER_PROJECT = randomUUID();
  const ENV = randomUUID();
  const OTHER_ENV = randomUUID();
  const WS = randomUUID();
  const OTHER_WS = randomUUID();
  const KEY = 'sk_pc2cfx_' + randomUUID();
  const OTHER_KEY = 'sk_pc2cfx_' + randomUUID();
  const TOKEN = 'valid_session_token_' + randomUUID();

  beforeAll(async () => {
    pg = new Pool({ host: 'localhost', port: 5433, user: 'postgres', password: 'password', database: 'cdp_crm' });
    app = buildApp(); await app.ready();

    // Main tenant topology
    await pg.query('INSERT INTO tenants (id, name) VALUES ($1,$2) ON CONFLICT DO NOTHING', [TENANT, 'analytics-test']);
    await pg.query('INSERT INTO workspaces (id, tenant_id, name, slug) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING', [WS, TENANT, 'analytics-ws', 'analytics-ws']);
    await pg.query('INSERT INTO projects (id, workspace_id, name, slug) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING', [PROJECT, WS, 'analytics-proj', 'analytics-proj']);
    await pg.query('INSERT INTO environments (id, project_id, name, key, type) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING', [ENV, PROJECT, 'analytics-env', 'analytics-env', 'development']);
    await pg.query('INSERT INTO api_keys (tenant_id, environment_id, name, key_hash, prefix, key_type) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING', [TENANT, ENV, 'test-key', crypto.createHash('sha256').update(KEY).digest('hex'), 'sk_pc2cfx_', 'secret']);

    // Separate tenant (for isolation tests)
    await pg.query('INSERT INTO tenants (id, name) VALUES ($1,$2) ON CONFLICT DO NOTHING', [OTHER_TENANT, 'analytics-other']);
    await pg.query('INSERT INTO workspaces (id, tenant_id, name, slug) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING', [OTHER_WS, OTHER_TENANT, 'analytics-other-ws', 'analytics-other-ws']);
    await pg.query('INSERT INTO projects (id, workspace_id, name, slug) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING', [OTHER_PROJECT, OTHER_WS, 'analytics-other-proj', 'analytics-other-proj']);
    await pg.query('INSERT INTO environments (id, project_id, name, key, type) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING', [OTHER_ENV, OTHER_PROJECT, 'analytics-other-env', 'analytics-other-env', 'development']);
    await pg.query('INSERT INTO api_keys (tenant_id, environment_id, name, key_hash, prefix, key_type) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING', [OTHER_TENANT, OTHER_ENV, 'other-key', crypto.createHash('sha256').update(OTHER_KEY).digest('hex'), 'sk_pc2cfx_', 'secret']);

    // Setup platform user and session
    const USER = randomUUID();
    await pg.query('INSERT INTO platform_users (id, email, password_hash) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [USER, crypto.randomUUID() + '@analytics-test.local', 'fake_hash']);
    // Seed users table to satisfy user_memberships FK (legacy migration quirk)
    await pg.query('INSERT INTO users (id, tenant_id, email) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [USER, TENANT, 'analytics@test.local']);
    await pg.query('INSERT INTO user_memberships (user_id, workspace_id, role) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [USER, WS, 'OWNER']);
    const tokHash = crypto.createHash('sha256').update(TOKEN).digest('hex');
    await pg.query('INSERT INTO platform_sessions (user_id, token_hash, expires_at) VALUES ($1,$2, CURRENT_TIMESTAMP + interval \'1 day\') ON CONFLICT DO NOTHING', [USER, tokHash]);

    // Seeded analytics events for trends / DAU
    const events = [
      { tenantId: TENANT, eventId: randomUUID(), type: 'track', event: 'login', timestamp: new Date('2026-10-10T01:00:00Z').toISOString(), userId: 'u1' },
      { tenantId: TENANT, eventId: randomUUID(), type: 'track', event: 'login', timestamp: new Date('2026-10-10T02:00:00Z').toISOString(), userId: 'u1' },
      { tenantId: TENANT, eventId: randomUUID(), type: 'track', event: 'view', timestamp: new Date('2026-10-10T02:30:00Z').toISOString(), userId: 'u2' },
      { tenantId: TENANT, eventId: randomUUID(), type: 'track', event: 'checkout', timestamp: new Date('2026-10-12T01:00:00Z').toISOString(), userId: 'u1' }
    ];

    for (const e of events) {
      await app.inject({ method: 'POST', url: '/v1/track', headers: { authorization: `Bearer ${KEY}` }, payload: e });
    }

    // Duplicate event id — must NOT double-count
    const dupEventId = randomUUID();
    await app.inject({
      method: 'POST',
      url: '/v1/track',
      headers: { authorization: `Bearer ${KEY}` },
      payload: { tenantId: TENANT, eventId: dupEventId, timestamp: new Date('2026-10-11T01:00:00Z').toISOString(), type: 'track', event: 'duplicate_test' }
    });
    // Re-insert same eventId (ClickHouse ReplacingMergeTree dedups it)
    await app.inject({
      method: 'POST',
      url: '/v1/track',
      headers: { authorization: `Bearer ${KEY}` },
      payload: { tenantId: TENANT, eventId: dupEventId, timestamp: new Date('2026-10-11T01:00:00Z').toISOString(), type: 'track', event: 'duplicate_test' }
    });

    // Event belonging to OTHER tenant (must not leak into main tenant analytics)
    await app.inject({
      method: 'POST',
      url: '/v1/track',
      headers: { authorization: `Bearer ${OTHER_KEY}` },
      payload: { tenantId: OTHER_TENANT, eventId: randomUUID(), timestamp: new Date('2026-10-10T03:00:00Z').toISOString(), type: 'track', event: 'login' }
    });

    await new Promise(r => setTimeout(r, 1500)); // ClickHouse flush
  });

  afterAll(async () => { await app.close(); await pg.end(); });

  it('rejects without session', async () => {
    const r = await app.inject({ method: 'GET', url: `/v1/control/analytics/trends?workspaceId=${WS}&startDate=2026-10-09T00:00:00.000Z&endDate=2026-10-15T00:00:00.000Z&interval=day` });
    expect(r.statusCode).toBe(401);
  });

  it('rejects invalid date ranges', async () => {
    const r = await app.inject({
      method: 'GET',
      url: `/v1/control/analytics/trends?workspaceId=${WS}&startDate=not-a-date&endDate=2026-10-15T00:00:00.000Z&interval=day`,
      headers: { authorization: `Bearer ${TOKEN}` }
    });
    expect(r.statusCode).toBe(400);
  });

  it('gets trends matching seeded events exactly', async () => {
    const r = await app.inject({
      method: 'GET',
      url: `/v1/control/analytics/trends?workspaceId=${WS}&startDate=2026-10-09T00:00:00.000Z&endDate=2026-10-15T00:00:00.000Z&interval=day`,
      headers: { authorization: `Bearer ${TOKEN}` }
    });
    expect(r.statusCode).toBe(200);
    const p = JSON.parse(r.payload);
    expect(p.trends).toBeDefined();
    const total = p.trends.reduce((s: any, b: any) => s + parseInt(b.event_count || '0', 10), 0);
    // 4 seeded + 1 duplicate_test (idempotent) = 5. The other tenant's event must not be counted.
    expect(total).toBe(5);
  });

  it('does not double-count duplicate event IDs', async () => {
    const r = await app.inject({
      method: 'GET',
      url: `/v1/control/analytics/trends?workspaceId=${WS}&startDate=2026-10-09T00:00:00.000Z&endDate=2026-10-15T00:00:00.000Z&interval=day&eventName=duplicate_test`,
      headers: { authorization: `Bearer ${TOKEN}` }
    });
    expect(r.statusCode).toBe(200);
    const p = JSON.parse(r.payload);
    const total = p.trends.reduce((s: any, b: any) => s + parseInt(b.event_count || '0', 10), 0);
    expect(total).toBe(1); // only 1, despite double insertion
  });

  it('gets active users with correct distinct identities (DAU)', async () => {
    const r = await app.inject({
      method: 'GET',
      url: `/v1/control/analytics/active-users?workspaceId=${WS}&startDate=2026-10-10T00:00:00.000Z&endDate=2026-10-10T23:59:59.000Z&period=day`,
      headers: { authorization: `Bearer ${TOKEN}` }
    });
    expect(r.statusCode).toBe(200);
    const p = JSON.parse(r.payload);
    expect(p.activeUsers).toBeDefined();
    // 2026-10-10 bucket should have 2 distinct users: u1 and u2
    const dayBucket = p.activeUsers.find((b: any) => String(b.time_bucket).startsWith('2026-10-10'));
    expect(dayBucket).toBeDefined();
    expect(parseInt(dayBucket.unique_users, 10)).toBe(2);
  });

  it('gets funnels correctly ordered', async () => {
    const r = await app.inject({
      method: 'POST',
      url: `/v1/control/analytics/funnels?workspaceId=${WS}`,
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: {
        startDate: '2026-10-09T00:00:00.000Z',
        endDate: '2026-10-15T00:00:00.000Z',
        steps: ['login', 'checkout']
      }
    });
    expect(r.statusCode).toBe(200);
    const p = JSON.parse(r.payload);
    expect(p.funnel).toBeDefined();
  });

  it('rejects funnels with too many steps', async () => {
    const r = await app.inject({
      method: 'POST',
      url: `/v1/control/analytics/funnels?workspaceId=${WS}`,
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: {
        startDate: '2026-10-09T00:00:00.000Z',
        endDate: '2026-10-15T00:00:00.000Z',
        steps: ['a', 'b', 'c', 'd', 'e', 'f']
      }
    });
    expect(r.statusCode).toBe(400);
  });

  it('gets retention cohorts', async () => {
    const r = await app.inject({
      method: 'POST',
      url: `/v1/control/analytics/retention?workspaceId=${WS}`,
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: {
        startDate: '2026-10-09T00:00:00.000Z',
        endDate: '2026-10-15T00:00:00.000Z',
        entryEvent: 'login',
        returningEvent: 'checkout'
      }
    });
    expect(r.statusCode).toBe(200);
    const p = JSON.parse(r.payload);
    expect(p.retention).toBeDefined();
  });

  it('never leaks events across tenants', async () => {
    // Request trends for the main workspace; the OTHER tenant's "login" event
    // on 2026-10-10 must not be counted (main tenant has 2 logins on that day).
    const r = await app.inject({
      method: 'GET',
      url: `/v1/control/analytics/trends?workspaceId=${WS}&startDate=2026-10-10T00:00:00.000Z&endDate=2026-10-10T23:59:59.000Z&interval=day&eventName=login`,
      headers: { authorization: `Bearer ${TOKEN}` }
    });
    expect(r.statusCode).toBe(200);
    const p = JSON.parse(r.payload);
    const total = p.trends.reduce((s: any, b: any) => s + parseInt(b.event_count || '0', 10), 0);
    expect(total).toBe(2); // u1 twice; the OTHER tenant's login is excluded
  });

  it('rejects analytics for a workspace the user does not belong to', async () => {
    // User is only a member of WS, not OTHER_WS
    const r = await app.inject({
      method: 'GET',
      url: `/v1/control/analytics/trends?workspaceId=${OTHER_WS}&startDate=2026-10-09T00:00:00.000Z&endDate=2026-10-15T00:00:00.000Z&interval=day`,
      headers: { authorization: `Bearer ${TOKEN}` }
    });
    expect([403, 404]).toContain(r.statusCode);
  });
});
