import { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { Pool } from 'pg';
import { AuthenticatedPlatformRequest, requirePlatformSession } from '../auth/session';
import { requirePermission } from '../services/authorization';
import { generateToken, hashToken } from '../repositories/auth/sessions';

const pg = new Pool({ host: process.env.PG_HOST || 'localhost', port: parseInt(process.env.PG_PORT || '5433', 10), user: process.env.PG_USER || 'postgres', password: process.env.PG_PASSWORD || 'password', database: process.env.PG_DATABASE || 'cdp_crm' });

const CreateSchema = z.object({
  tenantId: z.string().uuid(),
  workspaceId: z.string().uuid(),
  environmentId: z.string().uuid().optional(),
  name: z.string().optional().default('browser-key'),
  allowedOrigins: z.array(z.string().url()).optional(),
});

export async function browserKeyRoutes(app: FastifyInstance) {
  app.addHook('onRequest', requirePlatformSession);
  app.post('/v1/control/browser-keys', async (req: AuthenticatedPlatformRequest, reply: FastifyReply) => {
    try {
      const body = CreateSchema.parse(req.body);
      await requirePermission(req.platformUser!.id, body.workspaceId, 'apikey:write');
      // Resolve tenant from workspace (not client-supplied tenant)
      const ws = await pg.query('SELECT tenant_id FROM workspaces WHERE id = $1', [body.workspaceId]);
      if (ws.rows.length === 0) return reply.code(404).send({ error: 'Not Found' });
      const tenantId = ws.rows[0].tenant_id;
      if (tenantId !== body.tenantId) return reply.code(403).send({ error: 'Forbidden', message: 'Tenant mismatch' });
      const raw = 'pk_test_' + generateToken().slice(0, 24);
      const hash = hashToken(raw);
      await pg.query('INSERT INTO api_keys (tenant_id, key_hash, prefix, name, key_type, environment_id) VALUES ($1,$2,$3,$4,$5,$6)', [tenantId, hash, raw.slice(0, 10), body.name, 'browser', body.environmentId || null]);
      return reply.code(200).send({ success: true, secret: raw });
    } catch (err: any) {
      if (err.message?.includes('permission')) return reply.code(403).send({ error: 'Forbidden' });
      return reply.code(400).send({ error: 'Bad Request', message: err.message });
    }
  });
}
