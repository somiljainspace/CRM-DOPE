import { buildApp } from '../server';
import { FastifyInstance } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import * as apiKeyRepo from '../repositories/apiKeys';
import * as eventRepo from '../repositories/events';

jest.mock('../../repositories/apiKeys');
jest.mock('../../repositories/events');

const mockGetApiKeyRecord = apiKeyRepo.getApiKeyRecord as jest.Mock;
const mockInsertEvents = eventRepo.insertEvents as jest.Mock;

describe('Track Ingestion API (unit)', () => {
  let app: FastifyInstance;

  const validTenantId = uuidv4();
  const validApiKey = 'sk_live_12345';

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetApiKeyRecord.mockResolvedValue({ tenant_id: validTenantId });
    mockInsertEvents.mockResolvedValue(undefined);
  });

  const createEvent = (overrides: Record<string, unknown> = {}) => ({
    tenantId: validTenantId,
    eventId: uuidv4(),
    timestamp: new Date().toISOString(),
    type: 'track',
    event: 'test_event',
    properties: { foo: 'bar' },
    ...overrides,
  });

  const authHeaders = { authorization: `Bearer ${validApiKey}` };

  it('accepts a valid /v1/track request', async () => {
    const event = createEvent();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/track',
      headers: authHeaders,
      payload: event,
    });

    expect(response.statusCode).toBe(202);
    expect(JSON.parse(response.payload)).toHaveProperty('success', true);
    expect(mockInsertEvents).toHaveBeenCalledTimes(1);
    expect(mockInsertEvents.mock.calls[0][0][0].eventId).toBe(event.eventId);
  });

  it('rejects an invalid event payload', async () => {
    const event = createEvent();
    delete (event as Record<string, unknown>).eventId;

    const response = await app.inject({
      method: 'POST',
      url: '/v1/track',
      headers: authHeaders,
      payload: event,
    });

    expect(response.statusCode).toBe(400);
    expect(mockInsertEvents).not.toHaveBeenCalled();
  });

  it('rejects missing API key', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/track',
      payload: createEvent(),
    });

    expect(response.statusCode).toBe(401);
  });

  it('rejects invalid API key', async () => {
    mockGetApiKeyRecord.mockResolvedValue(null);

    const response = await app.inject({
      method: 'POST',
      url: '/v1/track',
      headers: { authorization: 'Bearer wrong_key' },
      payload: createEvent(),
    });

    expect(response.statusCode).toBe(401);
    expect(mockInsertEvents).not.toHaveBeenCalled();
  });

  it('rejects tenant mismatch (tenant isolation)', async () => {
    const spoofedTenantId = uuidv4();
    const event = createEvent({ tenantId: spoofedTenantId });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/track',
      headers: authHeaders,
      payload: event,
    });

    expect(response.statusCode).toBe(403);
    const body = JSON.parse(response.payload);
    expect(body.message).toContain('Tenant mismatch');
    expect(mockInsertEvents).not.toHaveBeenCalled();
  });

  it('handles duplicate event_id appropriately', async () => {
    const event = createEvent();
    mockInsertEvents.mockRejectedValue(new Error('duplicate key value'));

    const response = await app.inject({
      method: 'POST',
      url: '/v1/track',
      headers: authHeaders,
      payload: event,
    });

    expect(response.statusCode).toBe(409);
    expect(JSON.parse(response.payload).error).toBe('Conflict');
  });

  it('accepts a valid batch request', async () => {
    const batch = { batch: [createEvent(), createEvent()] };

    const response = await app.inject({
      method: 'POST',
      url: '/v1/track/batch',
      headers: authHeaders,
      payload: batch,
    });

    expect(response.statusCode).toBe(202);
    expect(JSON.parse(response.payload).processed).toBe(2);
    expect(mockInsertEvents).toHaveBeenCalledTimes(1);
    expect(mockInsertEvents.mock.calls[0][0].length).toBe(2);
  });

  it('rejects malformed batch payload', async () => {
    const batch = { batch: [createEvent(), { foo: 'invalid' }] };

    const response = await app.inject({
      method: 'POST',
      url: '/v1/track/batch',
      headers: authHeaders,
      payload: batch,
    });

    expect(response.statusCode).toBe(400);
    expect(mockInsertEvents).not.toHaveBeenCalled();
  });

  it('rejects batch exceeding size limit', async () => {
    const events = Array.from({ length: 501 }, () => createEvent());
    const batch = { batch: events };

    const response = await app.inject({
      method: 'POST',
      url: '/v1/track/batch',
      headers: authHeaders,
      payload: batch,
    });

    expect(response.statusCode).toBe(413);
    expect(mockInsertEvents).not.toHaveBeenCalled();
  });

  it('rejects malformed /v1/track request (non-JSON)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/track',
      headers: { ...authHeaders, 'content-type': 'application/json' },
      payload: '{not json',
    });

    expect(response.statusCode).toBe(400);
  });

  it('handles ClickHouse write failure safely', async () => {
    const event = createEvent();
    mockInsertEvents.mockRejectedValue(new Error('ClickHouse went away'));

    const response = await app.inject({
      method: 'POST',
      url: '/v1/track',
      headers: authHeaders,
      payload: event,
    });

    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.payload);
    expect(body.error).toBe('Internal Server Error');
    expect(body.message).toBe('Failed to process event');
  });

  it('GET /health returns ok', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toHaveProperty('status', 'ok');
  });

  it('GET /ready returns ready when ClickHouse is reachable', async () => {
    (eventRepo.clickhouse as unknown as { ping: jest.Mock }).ping.mockResolvedValue(undefined);

    const response = await app.inject({
      method: 'GET',
      url: '/ready',
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toHaveProperty('status', 'ready');
  });

  it('GET /ready returns 503 when ClickHouse is unreachable', async () => {
    (eventRepo.clickhouse as unknown as { ping: jest.Mock }).ping.mockRejectedValue(new Error('down'));

    const response = await app.inject({
      method: 'GET',
      url: '/ready',
    });

    expect(response.statusCode).toBe(503);
  });
});
