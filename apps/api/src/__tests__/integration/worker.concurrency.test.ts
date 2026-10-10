import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Pool } from 'pg';
import crypto from 'crypto';
import { claimJobs } from '../../services/activation/worker';


const pg = new Pool({ host: process.env.PG_HOST||'localhost', port: parseInt(process.env.PG_PORT||'5433'), user: process.env.PG_USER||'postgres', password: process.env.PG_PASSWORD||'password', database: process.env.PG_DATABASE||'cdp_crm' });

describe('Worker Concurrency (FOR UPDATE SKIP LOCKED)', () => {
  let tenantId: string;
  let workspaceId: string;
  let destinationId: string;

  beforeAll(async () => {
    tenantId = crypto.randomUUID();
    workspaceId = crypto.randomUUID();
    
    await pg.query('INSERT INTO tenants (id, name) VALUES ($1, $2)', [tenantId, 'Concurrency Tenant']);
    await pg.query("INSERT INTO workspaces (id, tenant_id, name, slug) VALUES ($1,$2,$3,'conc-ws')", [workspaceId, tenantId, 'Conc WS']);
    
    const dest = await pg.query(
      `INSERT INTO webhook_destinations (tenant_id, workspace_id, name, url, enabled, signing_secret_encrypted, signature_version)
       VALUES ($1,$2,'Dest','https://example.com/hook',true,'\\x00'::bytea,1) RETURNING id`,
      [tenantId, workspaceId]
    );
    destinationId = dest.rows[0].id;
  });

  afterAll(async () => {
    await pg.query('DELETE FROM tenants WHERE id = $1', [tenantId]);
    await pg.end();
  });

  it('claims pending jobs non-blockingly and exclusively', async () => {
    // 1. Stage an activation request
    const ar = await pg.query(
      `INSERT INTO activation_requests (tenant_id, workspace_id, segment_id, destination_id, purpose, status, audience_size)
       VALUES ($1,$2,$3,$4,$5,'pending',5) RETURNING id`,
      [tenantId, workspaceId, crypto.randomUUID(), destinationId, 'marketing']
    );
    const activationId = ar.rows[0].id;

    // 2. Insert 5 delivery jobs
    const jobIds: string[] = [];
    for (let i = 0; i < 5; i++) {
        const j = await pg.query(
            `INSERT INTO delivery_jobs (activation_request_id, tenant_id, destination_id, profile_id, delivery_id, status)
             VALUES ($1,$2,$3,$4,$5,'pending') RETURNING id`,
            [activationId, tenantId, destinationId, crypto.randomUUID(), crypto.randomUUID()]
        );
        jobIds.push(j.rows[0].id);
    } // Job IDs are sorted by created_at, id implicitly
    
    // 3. Worker A opens a transaction and claims limit=2
    const clientA = await pg.connect();
    await clientA.query('BEGIN');
    const jobsA = await claimJobs(clientA, 'Worker-A', 2);
    expect(jobsA.length).toBe(2);
    expect(jobsA[0].status).toBe('processing');
    expect(jobsA[0].claimed_by).toBe('Worker-A');

    // 4. Worker B concurrently claims limit=5
    // It should skip the 2 locked by A and instantly get the remaining 3
    const clientB = await pg.connect();
    await clientB.query('BEGIN');
    const jobsB = await claimJobs(clientB, 'Worker-B', 5);
    expect(jobsB.length).toBe(3);
    
    // Verify disjoint sets
    const idsA = jobsA.map((j: any) => j.id);
    const idsB = jobsB.map((j: any) => j.id);
    const intersection = idsA.filter((x: string) => idsB.includes(x));
    expect(intersection.length).toBe(0);

    // 5. Worker C concurrently claims (should get 0, not block)
    const jobsC = await claimJobs(pg, 'Worker-C', 5);
    expect(jobsC.length).toBe(0);

    // Commit A and B to release locks
    await clientA.query('COMMIT');
    await clientB.query('COMMIT');
    clientA.release();
    clientB.release();
    
    // 6. Test lease expiration recovery
    // Update one job to have an expired lease
    await pg.query(`UPDATE delivery_jobs SET claimed_by='Worker-A', claim_expires_at=NOW() - interval '1 second' WHERE id=$1`, [idsA[0]]);
    // Claim again
    const jobsD = await claimJobs(pg, 'Worker-D', 5);
    expect(jobsD.length).toBe(1); // the expired one
    expect(jobsD[0].id).toBe(idsA[0]);
    expect(jobsD[0].claimed_by).toBe('Worker-D');
  });
});
