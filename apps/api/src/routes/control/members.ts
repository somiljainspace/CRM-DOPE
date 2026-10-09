import { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { Pool } from 'pg';
import { AuthenticatedPlatformRequest, requirePlatformSession } from '../../auth/session';
import { requirePermission } from '../../services/authorization';
import { generateToken, hashToken } from '../../repositories/auth/sessions';

const pg = new Pool({ host: process.env.PG_HOST || 'localhost', port: parseInt(process.env.PG_PORT || '5433', 10), user: process.env.PG_USER || 'postgres', password: process.env.PG_PASSWORD || 'password', database: process.env.PG_DATABASE || 'cdp_crm' });

const InviteSchema = z.object({ workspaceId: z.string().uuid(), email: z.string().email(), role: z.enum(['ADMIN','ANALYST','DEVELOPER','VIEWER']) });
const AcceptSchema = z.object({ token: z.string() });
const RoleSchema = z.object({ role: z.enum(['ADMIN','ANALYST','DEVELOPER','VIEWER']) });

export async function membershipRoutes(app: FastifyInstance) {
  app.addHook('onRequest', requirePlatformSession);

  app.get('/v1/control/workspaces/:workspaceId/members', async (req: AuthenticatedPlatformRequest, reply: FastifyReply) => {
    try {
      const { workspaceId } = req.params as { workspaceId: string };
      await requirePermission(req.platformUser!.id, workspaceId, 'member:read');
      const r = await pg.query('SELECT m.id, m.role, m.created_at, u.email FROM user_memberships m JOIN platform_users u ON m.user_id = u.id WHERE m.workspace_id = $1', [workspaceId]);
      return reply.code(200).send({ members: r.rows });
    } catch (err: any) {
      if (err.message.includes('permission')) return reply.code(403).send({ error: 'Forbidden', message: err.message });
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  app.post('/v1/control/invitations', async (req: AuthenticatedPlatformRequest, reply: FastifyReply) => {
    try {
      const body = InviteSchema.parse(req.body);
      const myRole = await requirePermission(req.platformUser!.id, body.workspaceId, 'invitation:write');
      if (myRole !== 'OWNER' && body.role === 'ADMIN') return reply.code(403).send({ error: 'Forbidden', message: 'Only OWNER can invite ADMIN' });
      
      const t = await pg.query('SELECT tenant_id FROM workspaces WHERE id = $1', [body.workspaceId]);
      if (t.rows.length === 0) return reply.code(404).send({ error: 'Not Found' });

      const e = await pg.query('SELECT id FROM platform_users WHERE email = $1', [body.email]);
      if (e.rows.length > 0) {
        const m = await pg.query('SELECT id FROM user_memberships WHERE user_id = $1 AND workspace_id = $2', [e.rows[0].id, body.workspaceId]);
        if (m.rows.length > 0) return reply.code(409).send({ error: 'Conflict', message: 'User already in workspace' });
      }

      const token = generateToken();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await pg.query('INSERT INTO invitations (tenant_id, workspace_id, email, role, token_hash, invited_by, expires_at) VALUES ($1,$2,$3,$4,$5,$6,$7)', [t.rows[0].tenant_id, body.workspaceId, body.email, body.role, hashToken(token), req.platformUser!.id, expiresAt]);
      return reply.code(200).send({ success: true, message: 'Invitation created. Manual delivery required.', secret: token });
    } catch (err: any) {
      if (err.message.includes('permission')) return reply.code(403).send({ error: 'Forbidden', message: err.message });
      return reply.code(400).send({ error: 'Bad Request', message: err.message });
    }
  });

  app.post('/v1/control/invitations/accept', async (req: AuthenticatedPlatformRequest, reply: FastifyReply) => {
    try {
      const { token } = AcceptSchema.parse(req.body);
      const r = await pg.query('SELECT id, workspace_id, email, role, expires_at, accepted_at, revoked_at FROM invitations WHERE token_hash = $1', [hashToken(token)]);
      if (r.rows.length === 0) return reply.code(401).send({ error: 'Unauthorized', message: 'Invalid token' });
      const inv = r.rows[0];
      if (inv.accepted_at || inv.revoked_at || inv.expires_at < new Date() || inv.email !== req.platformUser!.email) {
        return reply.code(401).send({ error: 'Unauthorized', message: 'Invalid, expired, or mismatched invitation' });
      }
      
      const client = await pg.connect();
      try {
        await client.query('BEGIN');
        await client.query('UPDATE invitations SET accepted_at = CURRENT_TIMESTAMP WHERE id = $1', [inv.id]);
        await client.query('INSERT INTO user_memberships (user_id, workspace_id, role) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [req.platformUser!.id, inv.workspace_id, inv.role]);
        await client.query('COMMIT');
        return reply.code(200).send({ success: true, message: 'Invitation accepted' });
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    } catch (err: any) {
      return reply.code(400).send({ error: 'Bad Request', message: err.message });
    }
  });

  app.patch('/v1/control/workspaces/:workspaceId/members/:membershipId/role', async (req: AuthenticatedPlatformRequest, reply: FastifyReply) => {
    try {
      const { workspaceId, membershipId } = req.params as any;
      const { role } = RoleSchema.parse(req.body);
      await requirePermission(req.platformUser!.id, workspaceId, 'role:change'); // Only OWNER
      
      const tgt = await pg.query('SELECT role FROM user_memberships WHERE id = $1 AND workspace_id = $2', [membershipId, workspaceId]);
      if (tgt.rows.length === 0) return reply.code(404).send({ error: 'Not Found' });
      if (tgt.rows[0].role === 'OWNER') {
        const owners = await pg.query('SELECT id FROM user_memberships WHERE workspace_id = $1 AND role = $2', [workspaceId, 'OWNER']);
        if (owners.rows.length <= 1) return reply.code(403).send({ error: 'Forbidden', message: 'Cannot demote the last OWNER' });
      }
      await pg.query('UPDATE user_memberships SET role = $1 WHERE id = $2', [role, membershipId]);
      return reply.code(200).send({ success: true });
    } catch (err: any) {
      if (err.message.includes('permission')) return reply.code(403).send({ error: 'Forbidden' });
      return reply.code(400).send({ error: 'Bad Request' });
    }
  });

  app.delete('/v1/control/workspaces/:workspaceId/members/:membershipId', async (req: AuthenticatedPlatformRequest, reply: FastifyReply) => {
    try {
      const { workspaceId, membershipId } = req.params as any;
      await requirePermission(req.platformUser!.id, workspaceId, 'member:write');
      
      const tgt = await pg.query('SELECT role, user_id FROM user_memberships WHERE id = $1 AND workspace_id = $2', [membershipId, workspaceId]);
      if (tgt.rows.length === 0) return reply.code(404).send({ error: 'Not Found' });
      if (tgt.rows[0].role === 'OWNER') {
        const owners = await pg.query('SELECT id FROM user_memberships WHERE workspace_id = $1 AND role = $2', [workspaceId, 'OWNER']);
        if (owners.rows.length <= 1) return reply.code(403).send({ error: 'Forbidden', message: 'Cannot remove the last OWNER' });
      }
      await pg.query('DELETE FROM user_memberships WHERE id = $1', [membershipId]);
      return reply.code(200).send({ success: true });
    } catch (err: any) {
      if (err.message.includes('permission')) return reply.code(403).send({ error: 'Forbidden' });
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });
}
