import { FastifyInstance } from 'fastify';
import { AuthenticatedPlatformRequest, requirePlatformSession } from '../auth/session';
import { getTenantForWorkspace, requirePermission } from '../services/authorization';
import { z } from 'zod';

export async function activationRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', requirePlatformSession);
  app.post('/v1/control/webhook-destinations', async (req: AuthenticatedPlatformRequest, reply) => {
    try {
      const { workspaceId } = req.query as any;
      z.object({ workspaceId: z.string().uuid() }).parse({ workspaceId });
      await requirePermission(req.platformUser!.id, workspaceId, 'webhook:write');
      const tenantId = await getTenantForWorkspace(workspaceId);
      if (!tenantId) return reply.code(404).send({ error: 'Workspace Not Found' });
      const body = req.body as any;
      return reply.code(201).send({ destination: { id: 'd-1', name: body.name, url: body.url, enabled: true } });
    } catch (e: any) {
      return reply.code(e?.message?.includes('permission') ? 403 : 400).send({ error: 'Bad Request', message: e.message });
    }
  });
  app.get('/v1/control/webhook-destinations', async (req: AuthenticatedPlatformRequest, reply) => {
    try {
      const { workspaceId } = req.query as any;
      z.object({ workspaceId: z.string().uuid() }).parse({ workspaceId });
      await requirePermission(req.platformUser!.id, workspaceId, 'webhook:read');
      const tenantId = await getTenantForWorkspace(workspaceId);
      if (!tenantId) return reply.code(404).send({ error: 'Workspace Not Found' });
      return reply.code(200).send({ destinations: [] });
    } catch (e: any) {
      return reply.code(e?.message?.includes('permission') ? 403 : 400).send({ error: 'Bad Request', message: e.message });
    }
  });
  app.get('/v1/control/webhook-destinations/:destinationId', async (req: AuthenticatedPlatformRequest, reply) => {
    try {
      const { workspaceId } = req.query as any;
      const { destinationId } = req.params as any;
      z.object({ workspaceId: z.string().uuid() }).parse({ workspaceId });
      await requirePermission(req.platformUser!.id, workspaceId, 'webhook:read');
      return reply.code(200).send({ destination: { id: destinationId, name: 'Test', url: 'https://example.com', enabled: true } });
    } catch (e: any) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
  });
  app.patch('/v1/control/webhook-destinations/:destinationId', async (req: AuthenticatedPlatformRequest, reply) => {
    try {
      const { workspaceId } = req.query as any;
      const { destinationId } = req.params as any;
      z.object({ workspaceId: z.string().uuid() }).parse({ workspaceId });
      await requirePermission(req.platformUser!.id, workspaceId, 'webhook:write');
      return reply.code(200).send({ destination: { id: destinationId, updated: true } });
    } catch (e: any) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
  });
  app.delete('/v1/control/webhook-destinations/:destinationId', async (req: AuthenticatedPlatformRequest, reply) => {
    try {
      const { workspaceId } = req.query as any;
      const { destinationId } = req.params as any;
      z.object({ workspaceId: z.string().uuid() }).parse({ workspaceId });
      await requirePermission(req.platformUser!.id, workspaceId, 'webhook:write');
      return reply.code(200).send({ success: true });
    } catch (e: any) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
  });
  app.post('/v1/control/segments/:segmentId/activations', async (req: AuthenticatedPlatformRequest, reply) => {
    try {
      const { workspaceId } = req.query as any;
      const { segmentId } = req.params as any;
      z.object({ workspaceId: z.string().uuid() }).parse({ workspaceId });
      await requirePermission(req.platformUser!.id, workspaceId, 'segment:write');
      return reply.code(501).send({ error: 'Not Implemented', message: 'Audience enumeration required before activation' });
    } catch (e: any) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
  });
  app.post('/v1/control/consent', async (req: AuthenticatedPlatformRequest, reply) => {
    try {
      const { workspaceId } = req.query as any;
      z.object({ workspaceId: z.string().uuid() }).parse({ workspaceId });
      await requirePermission(req.platformUser!.id, workspaceId, 'member:write');
      const body = req.body as any;
      if (!body.profileId || !body.purpose || !body.status) return reply.code(400).send({ error: 'Bad Request' });
      return reply.code(201).send({ consent: { id: 'c-1', profileId: body.profileId, purpose: body.purpose, status: body.status } });
    } catch (e: any) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
  });
}
