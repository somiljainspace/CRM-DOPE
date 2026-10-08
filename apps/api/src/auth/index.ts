import { getApiKeyRecord } from '../repositories/apiKeys';
import { FastifyReply, FastifyRequest } from 'fastify';

export interface AuthenticatedRequest extends FastifyRequest {
  tenantId?: string;
}

export async function authenticateApiKey(
  request: AuthenticatedRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.code(401).send({
      error: 'Unauthorized',
      message: 'Missing or invalid Authorization header',
    });
  }

  const apiKey = authHeader.substring(7).trim();
  if (!apiKey) {
    return reply.code(401).send({
      error: 'Unauthorized',
      message: 'Empty API key',
    });
  }

  const record = await getApiKeyRecord(apiKey);
  if (!record) {
    return reply.code(401).send({
      error: 'Unauthorized',
      message: 'Invalid API key',
    });
  }

  // Attach authenticated tenant to request; this is the ONLY authority for tenant identity
  request.tenantId = record.tenant_id;
}
