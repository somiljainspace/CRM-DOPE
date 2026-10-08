import { FastifyReply } from 'fastify';

export function sendError(
  reply: FastifyReply,
  statusCode: number,
  error: string,
  message: string,
  details?: unknown
): FastifyReply {
  const payload: Record<string, unknown> = {
    error,
    message,
  };

  if (details !== undefined) {
    payload.details = details;
  }

  return reply.code(statusCode).send(payload);
}
