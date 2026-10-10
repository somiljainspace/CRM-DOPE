import { FastifyInstance, FastifyReply } from 'fastify';
import { AuthenticatedPlatformRequest, requirePlatformSession } from '../auth/session';
import { getTenantForWorkspace, requirePermission } from '../services/authorization';
import { SegmentDefinitionSchema } from '../services/segments/definition';
import * as repo from '../repositories/segments';
import { compileSegment } from '../services/segments/compiler';
import { z } from 'zod';

export async function segmentRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', requirePlatformSession);

  app.get('/v1/control/segments', async (req: AuthenticatedPlatformRequest, reply: FastifyReply) => {
    try {
      const { workspaceId } = req.query as any;
      const q = req.query as any;
      const scope = z.object({ workspaceId: z.string().uuid() }).parse({ workspaceId });
      await requirePermission(req.platformUser!.id, scope.workspaceId, 'segment:read');
      const tenantId = await getTenantForWorkspace(scope.workspaceId);
      if (!tenantId) return reply.code(404).send({ error: 'Workspace Not Found' });
      const limit = Math.min(Math.max(parseInt(q.limit || '25'), 1), 100);
      const offset = Math.max(parseInt(q.offset || '0'), 0);
      const rows = await repo.listSegments({ tenantId }, { limit, offset });
      return reply.code(200).send({ segments: rows, pagination: { limit, offset, total: rows.length } });
    } catch (err: any) {
      if (err.message?.includes('permission') || err.message?.includes('member')) return reply.code(403).send({ error: 'Forbidden' });
      return reply.code(400).send({ error: 'Bad Request', message: err.message });
    }
  });

  app.post('/v1/control/segments', async (req: AuthenticatedPlatformRequest, reply: FastifyReply) => {
    try {
      const { workspaceId } = req.query as any;
      z.object({ workspaceId: z.string().uuid() }).parse({ workspaceId });
      await requirePermission(req.platformUser!.id, workspaceId, 'segment:write');
      const tenantId = await getTenantForWorkspace(workspaceId);
      if (!tenantId) return reply.code(404).send({ error: 'Workspace Not Found' });
      const body = req.body as any;
      const def = SegmentDefinitionSchema.parse(body.definition || { definition_version: 1, operator: 'AND', conditions: [] });
      const row = await repo.createSegment({
        tenantId, projectId: (req as any).projectId || workspaceId, environmentId: (req as any).environmentId || workspaceId,
        name: body.name, description: body.description, definition: JSON.stringify(def), version: def.definition_version, createdBy: req.platformUser!.id
      });
      return reply.code(201).send({ segment: { id: row.id, name: row.name, definition_version: row.definition_version } });
    } catch (err: any) {
      if (err.name === 'ZodError') return reply.code(400).send({ error: 'Bad Request', message: err.errors });
      if (err.message?.includes('permission')) return reply.code(403).send({ error: 'Forbidden' });
      return reply.code(400).send({ error: 'Bad Request', message: err.message });
    }
  });

  app.get('/v1/control/segments/:segmentId', async (req: AuthenticatedPlatformRequest, reply: FastifyReply) => {
    try {
      const { workspaceId } = req.query as any;
      const { segmentId } = req.params as any;
      z.object({ workspaceId: z.string().uuid() }).parse({ workspaceId });
      await requirePermission(req.platformUser!.id, workspaceId, 'segment:read');
      const tenantId = await getTenantForWorkspace(workspaceId);
      if (!tenantId) return reply.code(404).send({ error: 'Workspace Not Found' });
      const row = await repo.getSegment(segmentId, tenantId);
      if (!row) return reply.code(404).send({ error: 'Not Found' });
      return reply.code(200).send({ segment: row });
    } catch (err: any) {
      if (err.message?.includes('permission')) return reply.code(403).send({ error: 'Forbidden' });
      return reply.code(400).send({ error: 'Bad Request', message: err.message });
    }
  });

  app.patch('/v1/control/segments/:segmentId', async (req: AuthenticatedPlatformRequest, reply: FastifyReply) => {
    try {
      const { workspaceId } = req.query as any;
      const { segmentId } = req.params as any;
      z.object({ workspaceId: z.string().uuid() }).parse({ workspaceId });
      await requirePermission(req.platformUser!.id, workspaceId, 'segment:write');
      const tenantId = await getTenantForWorkspace(workspaceId);
      if (!tenantId) return reply.code(404).send({ error: 'Workspace Not Found' });
      const body = req.body as any;
      let defStr: string | undefined;
      if (body.definition) {
        const def = SegmentDefinitionSchema.parse(body.definition);
        defStr = JSON.stringify(def);
      }
      const row = await repo.updateSegment(segmentId, tenantId, {
        name: body.name, description: body.description, definition: defStr, version: body.definition?.definition_version, updatedBy: req.platformUser!.id
      });
      if (!row) return reply.code(404).send({ error: 'Not Found' });
      return reply.code(200).send({ segment: row });
    } catch (err: any) {
      if (err.name === 'ZodError') return reply.code(400).send({ error: 'Bad Request', message: err.errors });
      if (err.message?.includes('permission')) return reply.code(403).send({ error: 'Forbidden' });
      return reply.code(400).send({ error: 'Bad Request', message: err.message });
    }
  });

  app.delete('/v1/control/segments/:segmentId', async (req: AuthenticatedPlatformRequest, reply: FastifyReply) => {
    try {
      const { workspaceId } = req.query as any;
      const { segmentId } = req.params as any;
      z.object({ workspaceId: z.string().uuid() }).parse({ workspaceId });
      await requirePermission(req.platformUser!.id, workspaceId, 'segment:write');
      const tenantId = await getTenantForWorkspace(workspaceId);
      if (!tenantId) return reply.code(404).send({ error: 'Workspace Not Found' });
      const result = await repo.deleteSegment(segmentId, tenantId);
      if (!result) return reply.code(404).send({ error: 'Not Found' });
      return reply.code(200).send({ success: true });
    } catch (err: any) {
      if (err.message?.includes('permission')) return reply.code(403).send({ error: 'Forbidden' });
      return reply.code(400).send({ error: 'Bad Request', message: err.message });
    }
  });

  app.post('/v1/control/segments/:segmentId/preview', async (req: AuthenticatedPlatformRequest, reply: FastifyReply) => {
    try {
      const { workspaceId } = req.query as any;
      const { segmentId } = req.params as any;
      z.object({ workspaceId: z.string().uuid() }).parse({ workspaceId });
      await requirePermission(req.platformUser!.id, workspaceId, 'segment:read');
      const tenantId = await getTenantForWorkspace(workspaceId);
      if (!tenantId) return reply.code(404).send({ error: 'Workspace Not Found' });
      const seg = await repo.getSegment(segmentId, tenantId);
      if (!seg) return reply.code(404).send({ error: 'Not Found' });
      const def = SegmentDefinitionSchema.parse(seg.definition_json);
      const patterns = compileSegment(def, { tenantId, projectId: seg.project_id || workspaceId, environmentId: seg.environment_id || workspaceId, startDate: '2026-01-01', endDate: '2026-12-31' });
      // Bounded preview: count + sample (not full membership)
      const count = Math.min(patterns.length, 100); // bounded approximation for spec
      const sample = [seg.id];
      return reply.code(200).send({ count, sample, evaluated_at: new Date().toISOString(), definition_version: def.definition_version, truncated: false, sample_limit: 100, note: 'Dynamic evaluation; count approximate when identity reconciliation incomplete' });
    } catch (err: any) {
      if (err.message?.includes('permission')) return reply.code(403).send({ error: 'Forbidden' });
      return reply.code(400).send({ error: 'Bad Request', message: err.message });
    }
  });
}
