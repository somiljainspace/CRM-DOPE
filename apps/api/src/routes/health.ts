import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { sendError } from '../lib/errors';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.code(200).send({ status: 'ok' });
  });

  app.get('/ready', async (_request: FastifyRequest, reply: FastifyReply) => {
    // Readiness: check that ClickHouse is reachable
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { clickhouse } = require('../repositories/events');
      await clickhouse.ping();
      return reply.code(200).send({ status: 'ready' });
    } catch (err: unknown) {
      return sendError(reply, 503, 'Service Unavailable', 'ClickHouse not reachable');
    }
  });
}
