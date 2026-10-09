import { FastifyRequest, FastifyReply } from 'fastify';
import { Pool } from 'pg';
import { hashToken, findSession } from '../repositories/auth/sessions';

const pg = new Pool({ host: process.env.PG_HOST || 'localhost', port: parseInt(process.env.PG_PORT || '5433', 10), user: process.env.PG_USER || 'postgres', password: process.env.PG_PASSWORD || 'password', database: process.env.PG_DATABASE || 'cdp_crm' });

export interface AuthenticatedPlatformRequest extends FastifyRequest {
  platformUser?: { id: string; email: string };
  platformTenantId?: string;
  platformRole?: string;
}

export async function requirePlatformSession(req: AuthenticatedPlatformRequest, reply: FastifyReply): Promise<void> {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return reply.code(401).send({ error: 'Unauthorized', message: 'Missing session token' });
  const tokenHash = hashToken(auth.slice(7));
  const session = await findSession(pg, tokenHash);
  if (!session || session.revoked_at || session.expires_at < new Date()) {
    return reply.code(401).send({ error: 'Unauthorized', message: 'Invalid or expired session' });
  }
  const u = await pg.query('SELECT id, email FROM platform_users WHERE id = $1', [session.user_id]);
  if (u.rows.length === 0) return reply.code(401).send({ error: 'Unauthorized', message: 'Invalid session' });
  req.platformUser = { id: u.rows[0].id, email: u.rows[0].email };
}
