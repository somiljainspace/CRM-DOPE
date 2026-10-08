import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { v4 as uuidv4 } from 'uuid';
import { config } from './config';
import { authenticateApiKey } from './auth';
import { trackRoutes } from './routes/track';
import { healthRoutes } from './routes/health';

export function buildApp() {
  const app = Fastify({
    logger: true,
    genReqId: () => uuidv4(),
    bodyLimit: config.bodyLimitBytes,
  });

  app.register(cors);

  app.register(rateLimit, {
    max: config.rateLimitMax,
    timeWindow: config.rateLimitWindowMs,
  });

  // Apply auth only to ingestion routes; health/ready open
  app.addHook('onRequest', async (request, reply) => {
    if (request.url === '/health' || request.url === '/ready') return;
    return authenticateApiKey(request, reply);
  });

  app.register(healthRoutes);
  app.register(trackRoutes);

  return app;
}
