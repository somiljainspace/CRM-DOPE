import { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { AuthenticatedPlatformRequest, requirePlatformSession } from '../auth/session';
import { getTenantForWorkspace, requirePermission } from '../services/authorization';
import * as analytics from '../repositories/analytics';

const ScopeSchema = z.object({
  workspaceId: z.string().uuid(),
});

const DateRangeSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
});

const TrendsSchema = DateRangeSchema.extend({
  interval: z.enum(['hour', 'day']),
  eventName: z.string().optional(),
});

const ActiveUsersSchema = DateRangeSchema.extend({
  period: z.enum(['day', 'week', 'month']),
});

const ExplorerSchema = DateRangeSchema.extend({
  limit: z.coerce.number().min(1).max(100).default(25),
  offset: z.coerce.number().min(0).default(0),
  eventName: z.string().optional(),
});

const FunnelSchema = DateRangeSchema.extend({
  steps: z.array(z.string()).min(2).max(5),
});

const RetentionSchema = DateRangeSchema.extend({
  entryEvent: z.string(),
  returningEvent: z.string(),
});

export async function analyticsRoutes(app: FastifyInstance) {
  app.addHook('onRequest', requirePlatformSession);

  app.get('/v1/control/analytics/trends', async (req: AuthenticatedPlatformRequest, reply: FastifyReply) => {
    try {
      const { workspaceId, startDate, endDate, interval, eventName } = { ...req.query as any };
      ScopeSchema.parse({ workspaceId });
      TrendsSchema.parse({ startDate, endDate, interval, eventName });
      
      await requirePermission(req.platformUser!.id, workspaceId, 'member:read');
      const tenantId = await getTenantForWorkspace(workspaceId);
      if (!tenantId) return reply.code(404).send({ error: 'Workspace Not Found' }); 

      const data = await analytics.getEventTrends({ tenantId, startDate, endDate, eventName }, interval);
      return reply.code(200).send({ trends: data });
    } catch (err: any) {
      if (err.message.includes('permission') || err.message.includes('member')) return reply.code(403).send({ error: 'Forbidden' });
      return reply.code(400).send({ error: 'Bad Request', message: err.message });
    }
  });

  app.get('/v1/control/analytics/active-users', async (req: AuthenticatedPlatformRequest, reply: FastifyReply) => {
    try {
      const { workspaceId, startDate, endDate, period } = { ...req.query as any };
      ScopeSchema.parse({ workspaceId });
      ActiveUsersSchema.parse({ startDate, endDate, period });

      await requirePermission(req.platformUser!.id, workspaceId, 'member:read');
      const tenantId = await getTenantForWorkspace(workspaceId);
      if (!tenantId) return reply.code(404).send({ error: 'Workspace Not Found' });

      const data = await analytics.getActiveUsers({ tenantId, startDate, endDate }, period);
      return reply.code(200).send({ activeUsers: data });
    } catch (err: any) {
      if (err.message.includes('permission') || err.message.includes('member')) return reply.code(403).send({ error: 'Forbidden' });
      return reply.code(400).send({ error: 'Bad Request', message: err.message });
    }
  });

  app.get('/v1/control/analytics/events', async (req: AuthenticatedPlatformRequest, reply: FastifyReply) => {
    try {
      // Use query string
      const { workspaceId, startDate, endDate, limit, offset, eventName } = { ...req.query as any };
      ScopeSchema.parse({ workspaceId });
      const parsed = ExplorerSchema.parse({ startDate, endDate, limit, offset, eventName });

      await requirePermission(req.platformUser!.id, workspaceId, 'member:read');
      const tenantId = await getTenantForWorkspace(workspaceId);
      if (!tenantId) return reply.code(404).send({ error: 'Workspace Not Found' });

      const data = await analytics.getEventExplorer({ tenantId, startDate, endDate, eventName: parsed.eventName }, parsed.limit, parsed.offset);
      return reply.code(200).send({ events: data });
    } catch (err: any) {
      if (err.message.includes('permission') || err.message.includes('member')) return reply.code(403).send({ error: 'Forbidden' });
      return reply.code(400).send({ error: 'Bad Request', message: err.message });
    }
  });

  app.post('/v1/control/analytics/funnels', async (req: AuthenticatedPlatformRequest, reply: FastifyReply) => {
    try {
      const { workspaceId } = { ...req.query as any };
      const body = { ...req.body as any };
      ScopeSchema.parse({ workspaceId });
      const parsed = FunnelSchema.parse(body);

      await requirePermission(req.platformUser!.id, workspaceId, 'member:read');
      const tenantId = await getTenantForWorkspace(workspaceId);
      if (!tenantId) return reply.code(404).send({ error: 'Workspace Not Found' });

      const data = await analytics.getFunnel({ tenantId, startDate: parsed.startDate, endDate: parsed.endDate }, parsed.steps);
      return reply.code(200).send({ funnel: data });
    } catch (err: any) {
      if (err.message.includes('permission') || err.message.includes('member')) return reply.code(403).send({ error: 'Forbidden' });
      return reply.code(400).send({ error: 'Bad Request', message: err.message });
    }
  });

  app.post('/v1/control/analytics/retention', async (req: AuthenticatedPlatformRequest, reply: FastifyReply) => {
    try {
      const { workspaceId } = { ...req.query as any };
      const body = { ...req.body as any };
      ScopeSchema.parse({ workspaceId });
      const parsed = RetentionSchema.parse(body);

      await requirePermission(req.platformUser!.id, workspaceId, 'member:read');
      const tenantId = await getTenantForWorkspace(workspaceId);
      if (!tenantId) return reply.code(404).send({ error: 'Workspace Not Found' });

      const data = await analytics.getRetention({ tenantId, startDate: parsed.startDate, endDate: parsed.endDate }, parsed.entryEvent, parsed.returningEvent);
      return reply.code(200).send({ retention: data });
    } catch (err: any) {
      if (err.message.includes('permission') || err.message.includes('member')) return reply.code(403).send({ error: 'Forbidden' });
      return reply.code(400).send({ error: 'Bad Request', message: err.message });
    }
  });
}
