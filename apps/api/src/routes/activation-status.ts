import { FastifyInstance } from 'fastify';
import { AuthenticatedPlatformRequest, requirePlatformSession } from '../auth/session';
import { getTenantForWorkspace, requirePermission } from '../services/authorization';
import { z } from 'zod';
import { Pool } from 'pg';

const pg = new Pool({ host: process.env.PG_HOST||'localhost', port: parseInt(process.env.PG_PORT||'5433',10), user: process.env.PG_USER||'postgres', password: process.env.PG_PASSWORD||'password', database: process.env.PG_DATABASE||'cdp_crm' });

export async function statusRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', requirePlatformSession);

  app.get('/v1/control/activations/:activationId/status', async (req: AuthenticatedPlatformRequest, reply) => {
    try {
      const { workspaceId } = req.query as any;
      const { activationId } = req.params as any;
      z.object({ workspaceId: z.string().uuid() }).parse({ workspaceId });
      await requirePermission(req.platformUser!.id, workspaceId, 'segment:read');
      const tenantId = await getTenantForWorkspace(workspaceId);
      const ar = await pg.query('SELECT * FROM activation_requests WHERE id=$1 AND tenant_id=$2', [activationId, tenantId]);
      if (!ar.rows[0]) return reply.code(404).send({ error: 'Not Found' });
      const counts = await pg.query(
        "SELECT status, COUNT(*) as c FROM delivery_jobs WHERE activation_request_id=$1 GROUP BY status",
        [activationId]);
      return reply.code(200).send({ activation: ar.rows[0], delivery_counts: counts.rows });
    } catch (e: any) { return reply.code(403).send({ error: 'Forbidden' }); }
  });

  app.get('/v1/control/activations/:activationId/jobs', async (req: AuthenticatedPlatformRequest, reply) => {
    try {
      const { workspaceId, limit='25', offset='0' } = req.query as any;
      const { activationId } = req.params as any;
      z.object({ workspaceId: z.string().uuid() }).parse({ workspaceId });
      await requirePermission(req.platformUser!.id, workspaceId, 'segment:read');
      const tenantId = await getTenantForWorkspace(workspaceId);
      const lim = Math.min(Math.max(parseInt(limit,10),1),100);
      const off = Math.max(parseInt(offset,10),0);
      const jobs = await pg.query(
        'SELECT id, profile_id, status, delivery_id, attempt_count, next_attempt_at FROM delivery_jobs WHERE activation_request_id=$1 ORDER BY created_at ASC LIMIT $2 OFFSET $3', [activationId, lim, off]);
      return reply.code(200).send({ jobs: jobs.rows, pagination: { limit: lim, offset: off } });
    } catch (e: any) { return reply.code(403).send({ error: 'Forbidden' }); }
  });

  app.get('/v1/control/activations/:activationId/attempts', async (req: AuthenticatedPlatformRequest, reply) => {
    try {
      const { workspaceId, limit='25', offset='0', delivery_job_id } = req.query as any;
      const { activationId } = req.params as any;
      z.object({ workspaceId: z.string().uuid() }).parse({ workspaceId });
      await requirePermission(req.platformUser!.id, workspaceId, 'segment:read');
      const tenantId = await getTenantForWorkspace(workspaceId);
      const lim = Math.min(Math.max(parseInt(limit,10),1),100);
      const off = Math.max(parseInt(offset,10),0);
      const q = delivery_job_id
        ? 'SELECT * FROM delivery_attempts WHERE activation_request_id=$1 AND delivery_job_id=$2 ORDER BY attempted_at DESC LIMIT $3 OFFSET $4'
        : 'SELECT * FROM delivery_attempts WHERE activation_request_id=$1 ORDER BY attempted_at DESC LIMIT $2 OFFSET $3';
      const params = delivery_job_id ? [activationId, delivery_job_id, lim, off] : [activationId, lim, off];
      const attempts = await pg.query(q, params);
      return reply.code(200).send({ attempts: attempts.rows.map((a:any)=>({ id:a.id, attempt_number:a.attempt_number, delivery_id:a.delivery_id, status:a.status, http_status:a.http_status, error_reason:a.error_reason, attempted_at:a.attempted_at })), pagination: { limit: lim, offset: off } });
    } catch (e: any) { return reply.code(403).send({ error: 'Forbidden' }); }
  });

  app.post('/v1/control/activations/:activationId/cancel', async (req: AuthenticatedPlatformRequest, reply) => {
    try {
      const { workspaceId } = req.query as any;
      const { activationId } = req.params as any;
      z.object({ workspaceId: z.string().uuid() }).parse({ workspaceId });
      await requirePermission(req.platformUser!.id, workspaceId, 'segment:write');
      const tenantId = await getTenantForWorkspace(workspaceId);
      const ar = await pg.query('SELECT * FROM activation_requests WHERE id=$1 AND tenant_id=$2', [activationId, tenantId]);
      if (!ar.rows[0]) return reply.code(404).send({ error: 'Not Found' });
      if (ar.rows[0].status === 'cancelled') return reply.code(200).send({ cancelled: true });
      const client = await pg.connect();
      try {
        await client.query('BEGIN');
        await client.query('UPDATE activation_requests SET status=$1, cancelled_at=NOW(), updated_at=NOW() WHERE id=$2', ['cancelled', activationId]);
        await client.query('UPDATE delivery_jobs SET status=$1 WHERE activation_request_id=$2', ['cancelled', activationId]);
        await client.query('COMMIT');
      } catch { await client.query('ROLLBACK'); throw new Error('Cancel transaction failed'); } finally { client.release(); }
      return reply.code(200).send({ cancelled: true, activation_id: activationId });
    } catch (e: any) { return reply.code(403).send({ error: 'Forbidden' }); }
  });
}
