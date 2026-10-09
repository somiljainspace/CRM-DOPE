import { buildApp } from '../../server';
import { randomUUID } from 'crypto';
import { FastifyInstance } from 'fastify';
import { Pool } from 'pg';

describe('security regression — full fixtures', () => {
  let app: FastifyInstance;
  let pg: Pool;
  
  // Real valid ingestion api-key from DB setup
  const FIX_TENANT = 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  
  // New fixtures for session & workspace access
  const U_VIEWER = 'ffffffff-0000-0000-0000-111111111111';
  const U_ADMIN = 'ffffffff-0000-0000-0000-222222222222';
  const WS_MAIN = 'ffffffff-0000-1111-0000-000000000000';
  const WS_OTHER = 'ffffffff-0000-2222-0000-000000000000';
  
  const TOK_VAL = 'b5ef94bc44e3bb1c5c711decb33209a07db520234806d1fe5309cade622e5c10';
  const HASH_VAL = 'a369d1cac1a8d5a5167473b2019ad3be916729500dee593a704cffbef84ea2c4';
  const TOK_REV = 'a0e22c5ed46b32da8ea34f30b2747b137b96934061fd3f88c0c8cd4bd60ffe15';
  const HASH_REV = '6d611f475f7933bfb6a3d9a2ea222d49ad7aca5759bf0c42c476c88610501795';
  const TOK_EXP = '7c502ec08a4b96a00c04e57d571d1fb44c7658f22f6a10003b004f04fdf3d08c';
  const HASH_EXP = '00bf0bc26846d36afe952ee9547bcc9c186d8decea3dc9dc563db45b1d53961b';

  beforeAll(async () => {
    pg = new Pool({ host: 'localhost', port: 5433, user: 'postgres', password: 'password', database: 'cdp_crm' });
    app = buildApp(); await app.ready();
    
    // Seed test users
    await pg.query(`INSERT INTO platform_users (id, email, password_hash) VALUES ($1, 'viewer@test.local', 'dummy') ON CONFLICT DO NOTHING`, [U_VIEWER]);
    await pg.query(`INSERT INTO platform_users (id, email, password_hash) VALUES ($1, 'admin@test.local', 'dummy') ON CONFLICT DO NOTHING`, [U_ADMIN]);
    
    // Seed sessions
    await pg.query(`INSERT INTO platform_sessions (user_id, token_hash, expires_at, revoked_at) VALUES ($1, $2, CURRENT_TIMESTAMP + interval '1 day', NULL) ON CONFLICT DO NOTHING`, [U_VIEWER, HASH_VAL]);
    await pg.query(`INSERT INTO platform_sessions (user_id, token_hash, expires_at, revoked_at) VALUES ($1, $2, CURRENT_TIMESTAMP + interval '1 day', CURRENT_TIMESTAMP) ON CONFLICT DO NOTHING`, [U_VIEWER, HASH_REV]);
    await pg.query(`INSERT INTO platform_sessions (user_id, token_hash, expires_at, revoked_at) VALUES ($1, $2, CURRENT_TIMESTAMP - interval '1 day', NULL) ON CONFLICT DO NOTHING`, [U_VIEWER, HASH_EXP]);
    
    // Seed workspaces + memberships
    await pg.query(`INSERT INTO workspaces (id, tenant_id, name, slug) VALUES ($1, $2, 'main', 'main') ON CONFLICT DO NOTHING`, [WS_MAIN, FIX_TENANT]);
    await pg.query(`INSERT INTO workspaces (id, tenant_id, name, slug) VALUES ($1, $2, 'other', 'other') ON CONFLICT DO NOTHING`, [WS_OTHER, FIX_TENANT]);
    await pg.query(`INSERT INTO workspaces (id, tenant_id, name, slug) VALUES ($1, $2, 'main', 'main') ON CONFLICT DO NOTHING`, [WS_MAIN, FIX_TENANT]);
    
    await pg.query(`INSERT INTO user_memberships (user_id, workspace_id, role) VALUES ($1, $2, 'VIEWER') ON CONFLICT DO NOTHING`, [U_VIEWER, WS_MAIN]);
    await pg.query(`INSERT INTO user_memberships (user_id, workspace_id, role) VALUES ($1, $2, 'ADMIN') ON CONFLICT DO NOTHING`, [U_ADMIN, WS_MAIN]);
  });
  
  afterAll(async () => { await app.close(); await pg.end(); });

  it('missing session rejected', async () => { const r = await app.inject({method:'GET',url:`/v1/control/workspaces/${WS_MAIN}/members`}); expect(r.statusCode).toBe(401); });
  it('invalid token rejected', async () => { const r = await app.inject({method:'GET',url:'/v1/auth/me',headers:{authorization:'Bearer bad'}}); expect(r.statusCode).toBe(401); });
  it('revoked session rejected', async () => { const r = await app.inject({method:'GET',url:'/v1/auth/me',headers:{authorization:`Bearer ${TOK_REV}`}}); expect(r.statusCode).toBe(401); });
  it('expired session rejected', async () => { const r = await app.inject({method:'GET',url:'/v1/auth/me',headers:{authorization:`Bearer ${TOK_EXP}`}}); expect(r.statusCode).toBe(401); });
  
  it('valid session accepted', async () => {
    const r = await app.inject({method:'GET',url:'/v1/auth/me',headers:{authorization:`Bearer ${TOK_VAL}`}});
    expect(r.statusCode).toBe(200);
    expect(JSON.parse(r.payload).user.email).toBe('viewer@test.local');
  });

  it('viewer cannot perform administrative action (invite)', async () => {
    const r = await app.inject({method:'POST',url:'/v1/control/invitations',headers:{authorization:`Bearer ${TOK_VAL}`},payload:{workspaceId:WS_MAIN, email:'new@test.local', role:'VIEWER'}});
    expect(r.statusCode).toBe(403);
  });

  it('cross-tenant/workspace access blocked', async () => {
    // VIEWER is only in WS_MAIN, not WS_OTHER
    const r = await app.inject({method:'GET',url:`/v1/control/workspaces/${WS_OTHER}/members`,headers:{authorization:`Bearer ${TOK_VAL}`}});
    expect(r.statusCode).toBe(403);
  });

  it('platform token rejected by ingestion', async () => {
    const r = await app.inject({method:'POST',url:'/v1/track',headers:{authorization:`Bearer ${TOK_VAL}`},payload:{tenantId:FIX_TENANT,eventId:'11111111-e111-4111-a111-111111111111',timestamp:new Date().toISOString(),type:'track',event:'t'}});
    expect(r.statusCode).toBe(401);
  });

  it('valid ingestion key still works', async () => {
    const r = await app.inject({method:'POST',url:'/v1/track',headers:{authorization:'Bearer sk_pc2cfx_2026'},payload:{tenantId:FIX_TENANT,eventId: randomUUID(),timestamp:new Date().toISOString(),type:'track',event:'fixture_t'}});
    expect(r.statusCode).toBe(202);
  });
});
