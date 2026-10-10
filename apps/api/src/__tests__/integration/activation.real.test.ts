import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { buildApp } from '../../server';
import { Pool } from 'pg';
import crypto from 'crypto';
import { encryptSecret, decryptSecret, generateSecret } from '../../services/activation/signing';
import { validateWebhookUrl } from '../../services/activation/urlValidation';
import { checkConsent } from '../../services/activation/consent';
import * as repo from '../../repositories/activation';

const pg = new Pool({ host: process.env.PG_HOST||'localhost', port: parseInt(process.env.PG_PORT||'5433'), user: process.env.PG_USER||'postgres', password: process.env.PG_PASSWORD||'password', database: process.env.PG_DATABASE||'cdp_crm' });

describe('Activation (real DB + HTTP)', () => {
  let app: any; let tenantId: string; let workspaceId: string; let tokenHash: string; const tokenRaw = 'activation_test_token_' + crypto.randomUUID();

  beforeAll(async () => {
    app = buildApp(); await app.ready();
    tenantId = crypto.randomUUID(); workspaceId = crypto.randomUUID();
    const projectId = crypto.randomUUID(); const platformId = crypto.randomUUID();
    tokenHash = crypto.createHash('sha256').update(tokenRaw).digest('hex');
    await pg.query('BEGIN');
    await pg.query('INSERT INTO tenants (id, name, created_at) VALUES ($1,$2,CURRENT_TIMESTAMP)', [tenantId, 'Activation Tenant']);
    await pg.query("INSERT INTO workspaces (id, tenant_id, name, slug) VALUES ($1,$2,$3,'act-ws')", [workspaceId, tenantId, 'Act WS']);
    await pg.query("INSERT INTO projects (id, workspace_id, name, slug) VALUES ($1,$2,$3,'act-proj')", [projectId, workspaceId, 'Act Proj']);
    await pg.query('INSERT INTO platform_users (id, email, password_hash) VALUES ($1,$2,$3)', [platformId, `${crypto.randomUUID()}@act.local`, 'xxx']);
    await pg.query('INSERT INTO users (id, tenant_id, email) VALUES ($1,$2,$3)', [platformId, workspaceId, `${crypto.randomUUID()}@act.local`]);
    await pg.query('INSERT INTO user_memberships (user_id, workspace_id, role) VALUES ($1,$2,$3)', [platformId, workspaceId, 'OWNER']);
    await pg.query("INSERT INTO platform_sessions (token_hash, user_id, expires_at) VALUES ($1,$2, CURRENT_TIMESTAMP + interval '1 hour')", [tokenHash, platformId]);
    await pg.query('COMMIT');
  });

  afterAll(async () => {
    await pg.query('DELETE FROM tenants WHERE id = $1', [tenantId]);
    await pg.end(); await app.close();
  });

  it('creates and lists a webhook destination with encrypted secret', async () => {
    const key = Buffer.alloc(32, 5);
    const secret = generateSecret();
    const enc = encryptSecret(secret, key);
    expect(decryptSecret(enc, key)).toBe(secret);
    const row = await repo.createDestination({ tenantId, workspaceId, name: 'Hook', url: 'https://example.com/hook', encryptedSecret: enc, createdBy: 'u' });
    expect(row.id).toBeDefined();
    expect(row.signing_secret_encrypted).toBeInstanceOf(Buffer);
    const listed = await repo.listDestinations(tenantId);
    expect(listed.length).toBeGreaterThan(0);
    expect(listed[0].signing_secret_encrypted).toBeInstanceOf(Buffer);
  });

  it('rejects private/loopback destination URLs', () => {
    expect(validateWebhookUrl('https://127.0.0.1/hook').ok).toBe(false);
    expect(validateWebhookUrl('https://10.0.0.1/hook').ok).toBe(false);
    expect(validateWebhookUrl('https://192.168.1.1/hook').ok).toBe(false);
    expect(validateWebhookUrl('https://example.com/hook').ok).toBe(true);
  });

  it('default deny: absent consent is not eligible', async () => {
    const r = await checkConsent(tenantId, crypto.randomUUID(), 'marketing');
    expect(r.eligible).toBe(false);
    expect(r.reason).toContain('default deny');
  });

  it('grants and withdraws consent', async () => {
    const profileId = crypto.randomUUID();
    await repo.upsertConsent({ tenantId, profileId, purpose: 'marketing', status: 'granted' });
    let r = await checkConsent(tenantId, profileId, 'marketing');
    expect(r.eligible).toBe(true);
    await repo.upsertConsent({ tenantId, profileId, purpose: 'marketing', status: 'withdrawn' });
    r = await checkConsent(tenantId, profileId, 'marketing');
    expect(r.eligible).toBe(false);
    expect(r.reason).toContain('withdrawn');
  });

  it('cross-tenant consent isolation', async () => {
    const profileId = crypto.randomUUID();
    await repo.upsertConsent({ tenantId, profileId, purpose: 'marketing', status: 'granted' });
    const otherTenant = crypto.randomUUID();
    const c = await repo.getConsent(otherTenant, profileId, 'marketing');
    expect(c).toBeNull();
  });

  it('POST /v1/control/webhook-destinations requires valid key and HTTPS', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/v1/control/webhook-destinations?workspaceId=${workspaceId}`,
      headers: { Authorization: `Bearer ${tokenRaw}` },
      payload: { name: 'Bad', url: 'http://localhost/hook' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST activation refuses incomplete audience (501)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/v1/control/segments/${crypto.randomUUID()}/activations?workspaceId=${workspaceId}`,
      headers: { Authorization: `Bearer ${tokenRaw}` },
      payload: { destinationId: crypto.randomUUID(), purpose: 'marketing' },
    });
    expect([404, 501]).toContain(res.statusCode);
  });

  it('unauthorized requests rejected (401)', async () => {
    const res = await app.inject({ method: 'GET', url: `/v1/control/webhook-destinations?workspaceId=${workspaceId}`, headers: {} });
    expect(res.statusCode).toBe(401);
  });
});
