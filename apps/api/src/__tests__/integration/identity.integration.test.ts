import { buildApp } from '../../server';
import { FastifyInstance } from 'fastify';
import { Pool } from 'pg';
import { randomUUID } from 'crypto';

describe('Identity Resolution & Profiles', () => {
  let app: FastifyInstance;
  let pg: Pool;
  
  const TENANT = 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  const PROJECT = 'aaaaaaaa-1111-2222-3333-444444444444';
  const ENV = 'bbbbbbbb-1111-2222-3333-444444444444';
  const WS = 'ffffffff-1111-2222-3333-444444444444';
  const KEY = 'sk_pc2cfx_2026';
  const ANON_ID = randomUUID();
  const USER_ID = randomUUID();

  beforeAll(async () => {
    pg = new Pool({ host: 'localhost', port: 5433, user: 'postgres', password: 'password', database: 'cdp_crm' });
    app = buildApp(); await app.ready();
    await pg.query('INSERT INTO workspaces (id, tenant_id, name, slug) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING', [WS, TENANT, 'id-ws', 'id-ws']);
    await pg.query('INSERT INTO projects (id, workspace_id, name, slug) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING', [PROJECT, WS, 'id-proj', 'id-proj']);
    await pg.query('INSERT INTO environments (id, project_id, name, key, type) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING', [ENV, PROJECT, 'id-env', 'id-env', 'development']);
    // Link fixture key to this environment
    await pg.query('UPDATE api_keys SET environment_id = $1 WHERE prefix = $2 AND tenant_id = $3', [ENV, 'sk_pc2cfx_', TENANT]);
  });
  afterAll(async () => { await app.close(); await pg.end(); });

  it('anonymous event creates anonymous profile', async () => {
    const r = await app.inject({ method: 'POST', url: '/v1/identify', headers: { authorization: `Bearer ${KEY}` }, payload: { tenantId: TENANT, anonymousId: ANON_ID, traits: { from: 'anon' } } });
    expect(r.statusCode).toBe(200);
    const p = JSON.parse(r.payload);
    expect(p.profileId).toBeDefined();
    
    const db = await pg.query('SELECT anonymous_id FROM customer_profiles WHERE id = $1', [p.profileId]);
    expect(db.rows[0].anonymous_id).toBe(ANON_ID);
  });
  
  it('identified event creates identified profile', async () => {
    const r = await app.inject({ method: 'POST', url: '/v1/identify', headers: { authorization: `Bearer ${KEY}` }, payload: { tenantId: TENANT, userId: USER_ID, traits: { from: 'user' } } });
    expect(r.statusCode).toBe(200);
    const p = JSON.parse(r.payload);
    expect(p.profileId).toBeDefined();
    
    const db = await pg.query('SELECT user_id FROM customer_profiles WHERE id = $1', [p.profileId]);
    expect(db.rows[0].user_id).toBe(USER_ID);
  });

  it('identify request with both merges profiles deterministically', async () => {
    const r = await app.inject({ method: 'POST', url: '/v1/identify', headers: { authorization: `Bearer ${KEY}` }, payload: { tenantId: TENANT, anonymousId: ANON_ID, userId: USER_ID } });
    expect(r.statusCode).toBe(200);
    const p = JSON.parse(r.payload);
    expect(p.merged).toBe(true);
    
    // Anonymous profile should be deleted
    const db = await pg.query('SELECT user_id FROM customer_profiles WHERE id = $1', [p.profileId]);
    expect(db.rows[0].user_id).toBe(USER_ID); // It chose the user profile
    const aliases = await pg.query("SELECT identity_value FROM customer_identities WHERE profile_id = $1 AND identity_type = 'anonymous_id'", [p.profileId]);
    expect(aliases.rows[0].identity_value).toBe(ANON_ID); // Mapped correctly
  });
});
