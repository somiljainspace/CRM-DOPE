import { FastifyInstance, FastifyReply } from 'fastify';
import { AuthenticatedRequest } from '../auth';
import { AnalyticsEventSchema, AnalyticsEvent } from '@cdp/event-schema';
import { z } from 'zod';
import { insertEvents, checkEventExists } from '../repositories/events';
import {
  enforceTenantOwnership,
  validateEventBatch,
  TenantMismatchError,
  BatchTooLargeError,
} from '../services/events';
import { sendError } from '../lib/errors';
import { config } from '../config';

const BatchSchema = z.object({
  batch: z.array(AnalyticsEventSchema).max(config.maxBatchSize),
});

export async function trackRoutes(app: FastifyInstance): Promise<void> {
  app.post('/v1/track', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const tenantId = request.tenantId as string;

    let event: AnalyticsEvent;
    try {
      event = AnalyticsEventSchema.parse(request.body);
    } catch (err: unknown) {
      return sendError(
        reply,
        400,
        'Bad Request',
        'Invalid event payload',
        err instanceof z.ZodError ? err.errors : err
      );
    }

    try {
      enforceTenantOwnership(tenantId, event);
    } catch (err: unknown) {
      if (err instanceof TenantMismatchError) {
        return sendError(reply, 403, 'Forbidden', err.message);
      }
      throw err;
    }

    try {
      // Best-effort check (not concurrency-safe); actual dedup is storage-level via ReplacingMergeTree
      const exists = await checkEventExists(tenantId, event.eventId);
      if (exists) {
        return reply.code(409).send({ error: 'Conflict', message: 'Duplicate event_id' });
      }
      await insertEvents([event]);
      return reply.code(202).send({ success: true, eventId: event.eventId });
    } catch (err: unknown) {
      request.log.error({ err }, 'Failed to insert event into ClickHouse');

      const errorMsg = (err as Error).message || '';
      if (errorMsg.includes('duplicate')) {
        return sendError(reply, 409, 'Conflict', 'Duplicate event_id');
      }

      return sendError(reply, 500, 'Internal Server Error', 'Failed to process event');
    }
  });

  app.post('/v1/track/batch', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const tenantId = request.tenantId as string;

    let batchReq;
    try {
      batchReq = BatchSchema.parse(request.body);
    } catch (err: unknown) {
      return sendError(
        reply,
        400,
        'Bad Request',
        'Invalid batch payload',
        err instanceof z.ZodError ? err.errors : err
      );
    }

    const events = batchReq.batch;

    try {
      validateEventBatch(tenantId, events, config.maxBatchSize);
    } catch (err: unknown) {
      if (err instanceof TenantMismatchError) {
        return sendError(reply, 403, 'Forbidden', err.message);
      }
      if (err instanceof BatchTooLargeError) {
        return sendError(reply, 413, 'Payload Too Large', err.message);
      }
      throw err;
    }

    if (events.length === 0) {
      return reply.code(200).send({ success: true, processed: 0 });
    }

    try {
      await insertEvents(events);
      return reply.code(202).send({ success: true, processed: events.length });
    } catch (err: unknown) {
      request.log.error({ err }, 'Failed to insert batch events into ClickHouse');
      return sendError(reply, 500, 'Internal Server Error', 'Failed to process batch events');
    }
  });
}
