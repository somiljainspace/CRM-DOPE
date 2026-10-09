import { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { Pool } from 'pg';
import { AuthenticatedPlatformRequest, requirePlatformSession } from '../../auth/session';

const pg = new Pool({ host: process.env.PG_HOST || 'localhost', port: parseInt(process.env.PG_PORT || '5433', 10), user: process.env.PG_USER || 'postgres', password: process.env.PG_PASSWORD || 'password', database: process.env.PG_DATABASE || 'cdp_crm' });

export async function membershipRoutes(app: FastifyInstance) {
  app.addHook('onRequest', requirePlatformSession);

  app.get('/v1/control/members', async (req: AuthenticatedPlatformRequest, reply: FastifyReply) => {
    // Only return memberships for workspaces the user has access to
    const r = await pg.query('SELECT workspace_id, role FROM user_memberships WHERE user_id = $1', [req.platformUser!.id]);
    return reply.code(200).send({ memberships: r.rows });
  });

  app.post('/v1/control/invitations', async (req: AuthenticatedPlatformRequest, reply: FastifyReply) => {
    return reply.code(501).send({ error: 'Not Implemented', message: 'Invitation sending requires email provider setup' });
  });

  app.post('/v1/control/invitations/accept', async (req: AuthenticatedPlatformRequest, reply: FastifyReply) => {
    return reply.code(501).send({ error: 'Not Implemented', message: 'Not yet implemented' });
  });

  app.patch('/v1/control/members/:membershipId/role', async (req: AuthenticatedPlatformRequest, reply: FastifyReply) => {
    return reply.code(501).send({ error: 'Not Implemented', message: 'Role update requires full permission check' });
  });

  app.delete('/v1/control/members/:membershipId', async (req: AuthenticatedPlatformRequest, reply: FastifyReply) => {
    return reply.code(501).send({ error: 'Not Implemented', message: 'Requires OWNER protection safe-delete' });
  });
}
