import { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { resolveProfile } from '../services/identity';

const IdentifySchema = z.object({
  tenantId: z.string().uuid(),
  anonymousId: z.string().max(255).optional(),
  userId: z.string().max(255).optional(),
  traits: z.record(z.any()).default({}),
});

export async function identifyRoutes(app: FastifyInstance) {
  app.post('/v1/identify', async (req, reply: FastifyReply) => {
    try {
      const body = IdentifySchema.parse(req.body);
      const auth = (req.headers.authorization || '') as string;
      const tenantId = (req as any).tenantId;
      if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
      // Server-derived tenant; ignore body.tenantId for authorization
      const result = await resolveProfile({ tenantId, projectId: '', environmentId: '', anonymousId: body.anonymousId, userId: body.userId, traits: body.traits });
      return reply.code(200).send({ profileId: result.profileId, merged: !!result.merged });
    } catch (err: any) {
      return reply.code(400).send({ error: 'Bad Request', message: err.message });
    }
  });
}
