import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { v4 as uuidv4 } from 'uuid';
import { config } from './config';
import { authenticateApiKey } from './auth';
import { trackRoutes } from './routes/track';
import { identifyRoutes } from './routes/identify';
import { profileRoutes } from './routes/profiles';
import { analyticsRoutes } from './routes/analytics';
import { segmentRoutes } from './routes/segments';
import { activationRoutes } from './routes/activation';
import { healthRoutes } from './routes/health';
import { authRoutes } from './routes/auth';
import { membershipRoutes } from './routes/control/members';

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
    if (request.url === '/health' || request.url === '/ready' || request.url.startsWith('/v1/auth/') || request.url.startsWith('/v1/control/')) return;
    return authenticateApiKey(request, reply);
  });

  app.register(healthRoutes);
  app.register(authRoutes);
  app.register(membershipRoutes);
  app.register(trackRoutes);
  app.register(identifyRoutes);
  app.register(profileRoutes);
  app.register(analyticsRoutes);
  app.register(segmentRoutes);

  return app;
}
