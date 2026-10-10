import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { buildApp } from '../../server';
import { Pool } from 'pg';
import crypto from 'crypto';

const pg = new Pool({ host: process.env.PG_HOST||'localhost', port: parseInt(process.env.PG_PORT||'5433'), user: process.env.PG_USER||'postgres', password: process.env.PG_PASSWORD||'password', database: process.env.PG_DATABASE||'cdp_crm' });

describe('Real HTTP Segments CRUD', () => {
  let app: any;
  let tenantId: string;
  let workspaceId: string;
  let tokenHash: string;
  let tokenRaw = 'seg_test_token';
  
  beforeAll(async () => {
    app = buildApp();
    await app.ready();
    
    tenantId = crypto.randomUUID();
    workspaceId = crypto.randomUUID();
    const projectId = crypto.randomUUID();
    const envId = crypto.randomUUID();
    const platformId = crypto.randomUUID();
    tokenHash = crypto.createHash('sha256').update(tokenRaw).digest('hex');
    
    await pg.query('BEGIN');
    await pg.query('INSERT INTO tenants (id, name, created_at) VALUES ($1,$2,CURRENT_TIMESTAMP)', [tenantId, 'Seg Tenant']);
    await pg.query("INSERT INTO workspaces (id, tenant_id, name, slug) VALUES ($1,$2,$3,'test-slug')", [workspaceId, tenantId, 'Seg WS']);
    await pg.query('INSERT INTO projects (id, workspace_id, name, slug) VALUES ($1,$2,$3,'proj-slug')', [projectId, tenantId, 'Seg Proj']);
    await pg.query('INSERT INTO environments (id, project_id, name, key, type) VALUES ($1,$2,$3,'env-key','development')', [envId, projectId, 'Seg Env']);
    await pg.query('INSERT INTO platform_users (id, email, password_hash) VALUES ($1,$2,$3)', [platformId, `${crypto.randomUUID()}@seg.local`, 'xxx']);
    await pg.query('INSERT INTO user_memberships (user_id, workspace_id, role) VALUES ($1,$2,$3)', [platformId, workspaceId, 'OWNER']);
    await pg.query("INSERT INTO platform_sessions (token_hash, user_id, expires_at) VALUES ($1,$2, CURRENT_TIMESTAMP + interval '1 hour')", [tokenHash, platformId]);
    await pg.query('COMMIT');
  });

  afterAll(async () => {
    await pg.query('DELETE FROM tenants WHERE id = $1', [tenantId]);
    await pg.end();
    await app.close();
  });

  let segmentId: string;

  it('create and retrieve segment via HTTP', async () => {
    // 1. Create
    const resCreate = await app.inject({
      method: 'POST',
      url: `/v1/control/segments?workspaceId=${workspaceId}`,
      headers: { Authorization: `Bearer ${tokenRaw}` },
      payload: {
        name: 'High Rollers',
        description: 'Users who bought > 3',
        definition: {
          definition_version: 1,
          operator: 'AND',
          conditions: [{ kind: 'property_trait', field: 'purchase_count', operator: 'greater_than', value: 3 }] // invalid kind to test zod
        }
      }
    });
    expect(resCreate.statusCode).toBe(400); // Should fail Zod schema (property_trait vs profile_trait)

    const resCreateValid = await app.inject({
      method: 'POST',
      url: `/v1/control/segments?workspaceId=${workspaceId}`,
      headers: { Authorization: `Bearer ${tokenRaw}` },
      payload: {
        name: 'High Rollers',
        definition: {
          definition_version: 1,
          operator: 'AND',
          conditions: [{ kind: 'profile_trait', field: 'purchase_count', operator: 'greater_than', value: 3 }]
        }
      }
    });
    expect(resCreateValid.statusCode).toBe(201);
    const body = JSON.parse(resCreateValid.body);
    segmentId = body.segment.id;
    expect(segmentId).toBeDefined();

    // 2. Retrieve
    const resGet = await app.inject({
      method: 'GET',
      url: `/v1/control/segments/${segmentId}?workspaceId=${workspaceId}`,
      headers: { Authorization: `Bearer ${tokenRaw}` },
    });
    expect(resGet.statusCode).toBe(200);
    const gBody = JSON.parse(resGet.body);
    expect(gBody.segment.name).toBe('High Rollers');
  });

  it('rejects cross-tenant preview', async () => {
    const fakeWs = crypto.randomUUID();
    const resPreview = await app.inject({
      method: 'POST',
      url: `/v1/control/segments/${segmentId}/preview?workspaceId=${fakeWs}`,
      headers: { Authorization: `Bearer ${tokenRaw}` },
    });
    // Unauthorized access (not member of fakeWs)
    expect(resPreview.statusCode).toBe(403);
  });
});
