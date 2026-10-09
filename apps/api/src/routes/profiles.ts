import { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { Pool } from 'pg';
import { AuthenticatedPlatformRequest, requirePlatformSession } from '../auth/session';
import { requirePermission } from '../services/authorization';

const pg = new Pool({ host: process.env.PG_HOST || 'localhost', port: parseInt(process.env.PG_PORT || '5433', 10), user: process.env.PG_USER || 'postgres', password: process.env.PG_PASSWORD || 'password', database: process.env.PG_DATABASE || 'cdp_crm' });

const IdSchema = z.object({ profileId: z.string().uuid() });

export async function profileRoutes(app: FastifyInstance) {
  app.addHook('onRequest', requirePlatformSession);
  // List with pagination
  app.get('/v1/control/profiles', async (req: AuthenticatedPlatformRequest, reply: FastifyReply) => {
    try {
      await requirePermission(req.platformUser!.id, (req.query as any).workspaceId || '', 'member:read');
      const r = await pg.query('SELECT p.id, p.tenant_id, p.project_id, p.environment_id, p.user_id, p.anonymous_id, p.first_seen_at FROM customer_profiles p WHERE p.tenant_id = $1 LIMIT 50', [(req as any).tenantId]);
      return reply.code(200).send({ profiles: r.rows });
    } catch (e: any) { return reply.code(403).send({ error: 'Forbidden' }); }
  });
  app.get('/v1/control/profiles/:profileId', async (req, reply) => {
    try {
      const { profileId } = req.params as any;
      const r = await pg.query('SELECT id, tenant_id, user_id, anonymous_id, first_seen_at FROM customer_profiles WHERE id = $1', [profileId]);
      if (r.rows.length === 0) return reply.code(404).send({ error: 'Not Found' });
      return reply.code(200).send({ profile: r.rows[0] });
    } catch { return reply.code(500).send({ error: 'Internal' }); }
  });
  app.get('/v1/control/profiles/:profileId/events', async (req, reply) => {
    return reply.code(501).send({ error: 'Not Implemented', message: 'ClickHouse query for profile events requires FINAL/argMax; implemented at query layer' });
  });
  app.get('/v1/control/profiles/:profileId/sessions', async (req, reply) => {
    return reply.code(501).send({ error: 'Not Implemented', message: 'Session aggregation derived from ClickHouse events; implemented at query layer' });
  });
}
