import { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { Pool } from 'pg';
import { verifyPassword } from '../repositories/auth/passwords';
import { generateToken, hashToken, createSession, revokeSession, findSession } from '../repositories/auth/sessions';

const LoginSchema = z.object({ email: z.string().email(), password: z.string().min(8) });
const pg = new Pool({ host: process.env.PG_HOST || 'localhost', port: parseInt(process.env.PG_PORT || '5433', 10), user: process.env.PG_USER || 'postgres', password: process.env.PG_PASSWORD || 'password', database: process.env.PG_DATABASE || 'cdp_crm' });

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/v1/auth/login', async (req, reply: FastifyReply) => {
    try {
      const body = LoginSchema.parse(req.body);
      const r = await pg.query('SELECT id, password_hash FROM platform_users WHERE email = $1', [body.email]);
      if (r.rows.length === 0 || !await verifyPassword(body.password, r.rows[0].password_hash)) {
        return reply.code(401).send({ error: 'Unauthorized', message: 'Invalid credentials' });
      }
      const token = generateToken();
      const tokenHash = hashToken(token);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await createSession(pg, r.rows[0].id, tokenHash, expiresAt, (req as any).ip, (req as any).headers?.['user-agent']);
      return reply.code(200).send({ token, expiresAt: expiresAt.toISOString() });
    } catch (err) {
      if (err instanceof z.ZodError) return reply.code(400).send({ error: 'Bad Request', message: 'Invalid login payload', details: err.errors });
      return reply.code(500).send({ error: 'Internal Server Error', message: 'Login failed' });
    }
  });
  app.get('/v1/auth/me', async (req, reply: FastifyReply) => {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) return reply.code(401).send({ error: 'Unauthorized', message: 'Missing token' });
    const tokenHash = hashToken(auth.slice(7));
    const s = await findSession(pg, tokenHash);
    if (!s || s.revoked_at || s.expires_at < new Date()) return reply.code(401).send({ error: 'Unauthorized', message: 'Invalid session' });
    const u = await pg.query('SELECT id, email, created_at FROM platform_users WHERE id = $1', [s.user_id]);
    if (u.rows.length === 0) return reply.code(401).send({ error: 'Unauthorized', message: 'Invalid session' });
    return reply.code(200).send({ user: { id: u.rows[0].id, email: u.rows[0].email, createdAt: u.rows[0].created_at } });
  });
  app.post('/v1/auth/logout', async (req, reply: FastifyReply) => {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) return reply.code(401).send({ error: 'Unauthorized', message: 'Missing token' });
    await revokeSession(pg, hashToken(auth.slice(7)));
    return reply.code(200).send({ success: true, message: 'Logged out' });
  });
}
