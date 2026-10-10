import { FastifyInstance } from 'fastify';
import { AuthenticatedPlatformRequest, requirePlatformSession } from '../auth/session';
import { getTenantForWorkspace, requirePermission } from '../services/authorization';
import { z } from 'zod';
import * as repo from '../repositories/activation';
import crypto from 'crypto';
import { validateWebhookUrl } from '../services/activation/urlValidation';
import { encryptSecret, generateSecret } from '../services/activation/signing';
import { checkConsent, upsertConsent } from '../services/activation/consent';
import { createActivation } from '../services/activation/scheduler';

const ENCRYPTION_KEY = (() => {
  const k = process.env.WEBHOOK_ENCRYPTION_KEY;
  if (!k) return null;
  const buf = Buffer.from(k, 'utf8');
  if (buf.length !== 32) return null;
  return buf;
})();

function requireKey(): Buffer {
  if (!ENCRYPTION_KEY) throw new Error('WEBHOOK_ENCRYPTION_KEY must be 32 bytes');
  return ENCRYPTION_KEY;
}

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
      if (!body.name || !body.url) return reply.code(400).send({ error: 'Bad Request', message: 'name and url required' });
      const v = validateWebhookUrl(body.url);
      if (!v.ok) return reply.code(400).send({ error: 'Bad Request', message: v.error });
      const key = requireKey();
      const secret = generateSecret();
      const encrypted = encryptSecret(secret, key);
      const row = await repo.createDestination({ tenantId, workspaceId, name: body.name, url: body.url, encryptedSecret: encrypted, createdBy: req.platformUser!.id });
      return reply.code(201).send({ destination: { id: row.id, name: row.name, url: row.url, enabled: row.enabled, created_at: row.created_at } });
    } catch (e: any) {
      if (e?.message?.includes('permission') || e?.message?.includes('member')) return reply.code(403).send({ error: 'Forbidden' });
      if (e?.message?.includes('WEBHOOK')) return reply.code(500).send({ error: 'Configuration Error', message: e.message });
      return reply.code(400).send({ error: 'Bad Request', message: e.message });
    }
  });

  app.get('/v1/control/webhook-destinations', async (req: AuthenticatedPlatformRequest, reply) => {
    try {
      const { workspaceId } = req.query as any;
      z.object({ workspaceId: z.string().uuid() }).parse({ workspaceId });
      await requirePermission(req.platformUser!.id, workspaceId, 'webhook:read');
      const tenantId = await getTenantForWorkspace(workspaceId);
      if (!tenantId) return reply.code(404).send({ error: 'Workspace Not Found' });
      const limit = Math.min(Math.max(parseInt((req.query as any).limit || '25'), 1), 100);
      const offset = Math.max(parseInt((req.query as any).offset || '0'), 0);
      const rows = await repo.listDestinations(tenantId, limit, offset);
      const safe = rows.map((r) => ({ id: r.id, name: r.name, url: r.url, enabled: r.enabled, created_at: r.created_at, updated_at: r.updated_at }));
      return reply.code(200).send({ destinations: safe, pagination: { limit, offset, total: safe.length } });
    } catch (e: any) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
  });

  app.get('/v1/control/webhook-destinations/:destinationId', async (req: AuthenticatedPlatformRequest, reply) => {
    try {
      const { workspaceId } = req.query as any;
      const { destinationId } = req.params as any;
      z.object({ workspaceId: z.string().uuid() }).parse({ workspaceId });
      await requirePermission(req.platformUser!.id, workspaceId, 'webhook:read');
      const tenantId = await getTenantForWorkspace(workspaceId);
      if (!tenantId) return reply.code(404).send({ error: 'Workspace Not Found' });
      const row = await repo.getDestination(destinationId, tenantId);
      if (!row) return reply.code(404).send({ error: 'Not Found' });
      return reply.code(200).send({ destination: { id: row.id, name: row.name, url: row.url, enabled: row.enabled, created_at: row.created_at, updated_at: row.updated_at } });
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
      const tenantId = await getTenantForWorkspace(workspaceId);
      if (!tenantId) return reply.code(404).send({ error: 'Workspace Not Found' });
      const body = req.body as any;
      const fields: Partial<{ name: string; url: string; enabled: boolean; encryptedSecret: Buffer }> = {};
      if (body.name !== undefined) fields.name = body.name;
      if (body.url !== undefined) { const v = validateWebhookUrl(body.url); if (!v.ok) return reply.code(400).send({ error: 'Bad Request', message: v.error }); fields.url = body.url; }
      if (body.enabled !== undefined) fields.enabled = !!body.enabled;
      if (body.rotate_secret === true) { const key = requireKey(); fields.encryptedSecret = encryptSecret(generateSecret(), key); }
      const row = await repo.updateDestination(destinationId, tenantId, fields);
      if (!row) return reply.code(404).send({ error: 'Not Found' });
      return reply.code(200).send({ destination: { id: row.id, name: row.name, url: row.url, enabled: row.enabled, updated_at: row.updated_at } });
    } catch (e: any) {
      if (e?.message?.includes('WEBHOOK')) return reply.code(500).send({ error: 'Configuration Error', message: e.message });
      return reply.code(403).send({ error: 'Forbidden' });
    }
  });

  app.delete('/v1/control/webhook-destinations/:destinationId', async (req: AuthenticatedPlatformRequest, reply) => {
    try {
      const { workspaceId } = req.query as any;
      const { destinationId } = req.params as any;
      z.object({ workspaceId: z.string().uuid() }).parse({ workspaceId });
      await requirePermission(req.platformUser!.id, workspaceId, 'webhook:write');
      const tenantId = await getTenantForWorkspace(workspaceId);
      if (!tenantId) return reply.code(404).send({ error: 'Workspace Not Found' });
      const ok = await repo.deleteDestination(destinationId, tenantId);
      if (!ok) return reply.code(404).send({ error: 'Not Found' });
      return reply.code(200).send({ success: true });
    } catch (e: any) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
  });

  app.post('/v1/control/consent', async (req: AuthenticatedPlatformRequest, reply) => {
    try {
      const { workspaceId } = req.query as any;
      z.object({ workspaceId: z.string().uuid() }).parse({ workspaceId });
      await requirePermission(req.platformUser!.id, workspaceId, 'member:write');
      const tenantId = await getTenantForWorkspace(workspaceId);
      if (!tenantId) return reply.code(404).send({ error: 'Workspace Not Found' });
      const body = req.body as any;
      if (!body.profileId || !body.purpose || !body.status) return reply.code(400).send({ error: 'Bad Request', message: 'profileId, purpose, status required' });
      if (!['granted', 'withdrawn'].includes(body.status)) return reply.code(400).send({ error: 'Bad Request', message: 'status must be granted or withdrawn' });
      const row = await upsertConsent({ tenantId, profileId: body.profileId, purpose: body.purpose, status: body.status, source: body.source || null, policyVersion: body.policyVersion || null, createdBy: req.platformUser!.id });
      return reply.code(201).send({ consent: { id: row.id, profileId: row.profile_id, purpose: row.purpose, status: row.status, granted_at: row.granted_at, withdrawn_at: row.withdrawn_at } });
    } catch (e: any) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
  });

  app.get('/v1/control/consent', async (req: AuthenticatedPlatformRequest, reply) => {
    try {
      const { workspaceId } = req.query as any;
      const { profileId, purpose } = req.query as any;
      z.object({ workspaceId: z.string().uuid(), profileId: z.string(), purpose: z.string() }).parse({ workspaceId, profileId, purpose });
      await requirePermission(req.platformUser!.id, workspaceId, 'member:read');
      const tenantId = await getTenantForWorkspace(workspaceId);
      if (!tenantId) return reply.code(404).send({ error: 'Workspace Not Found' });
      const c = await repo.getConsent(tenantId, profileId, purpose);
      if (!c) return reply.code(200).send({ consent: null, eligible: false, reason: 'No consent record' });
      return reply.code(200).send({ consent: { id: c.id, profileId: c.profile_id, purpose: c.purpose, status: c.status, granted_at: c.granted_at, withdrawn_at: c.withdrawn_at }, eligible: c.status === 'granted' });
    } catch (e: any) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
  });

  // Activation creation: safe refusal until complete audience enumeration is available
  app.post('/v1/control/segments/:segmentId/activations', async (req: AuthenticatedPlatformRequest, reply) => {
    try {
      const { workspaceId } = req.query as any;
      const { segmentId } = req.params as any;
      z.object({ workspaceId: z.string().uuid() }).parse({ workspaceId });
      await requirePermission(req.platformUser!.id, workspaceId, 'segment:write');
      const tenantId = await getTenantForWorkspace(workspaceId);
      if (!tenantId) return reply.code(404).send({ error: 'Workspace Not Found' });
      const body = req.body as any;
      if (!body.destinationId || !body.purpose) return reply.code(400).send({ error: 'Bad Request', message: 'destinationId and purpose required' });
      const dest = await repo.getDestination(body.destinationId, tenantId);
      if (!dest) return reply.code(404).send({ error: 'Destination Not Found' });
      if (!dest.enabled) return reply.code(409).send({ error: 'Conflict', message: 'Destination disabled' });
      // Load segment definition (authoritative scope: tenant-scoped segment repository)
      const pgRepo = new (await import('pg')).Pool({ host: process.env.PG_HOST || 'localhost', port: parseInt(process.env.PG_PORT || '5433',10), user: process.env.PG_USER || 'postgres', password: process.env.PG_PASSWORD || 'password', database: process.env.PG_DATABASE || 'cdp_crm' });
      const segRes = await pgRepo.query('SELECT definition_json FROM segments WHERE id=$1 AND tenant_id=$2', [segmentId, tenantId]);
      if (!segRes.rows[0]) return reply.code(404).send({ error: 'Not Found', message: 'Segment Not Found' });
      let def; try { def = typeof segRes.rows[0].definition_json === 'string' ? JSON.parse(segRes.rows[0].definition_json) : segRes.rows[0].definition_json; } catch { return reply.code(400).send({ error: 'Bad Request', message: 'Invalid segment definition' }); }
      // Complete bounded audience enumeration + durable job staging.
      const idempotencyKey = (body.idempotency_key || crypto.randomUUID()).toString();
      const pgPool = new (await import('pg')).Pool({ host: process.env.PG_HOST || 'localhost', port: parseInt(process.env.PG_PORT || '5433',10), user: process.env.PG_USER || 'postgres', password: process.env.PG_PASSWORD || 'password', database: process.env.PG_DATABASE || 'cdp_crm' });
      const result = await createActivation(pgPool, { tenantId, workspaceId, segmentId, segmentDefinition: def, destinationId: body.destinationId, purpose: body.purpose, createdBy: req.platformUser!.id, idempotencyKey });
      if (result.status === 'failed') return reply.code(422).send({ error: 'Unprocessable Entity', message: result.note, audience_size: result.audienceSize });
      return reply.code(202).send({ activation: { id: result.id, status: result.status, audience_size: result.audienceSize, note: result.note } });
    } catch (e: any) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
  });
}
