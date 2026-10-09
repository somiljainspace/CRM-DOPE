import { randomUUID } from 'crypto';
import { buildApp } from '../server';
import { FastifyInstance } from 'fastify';
import { Pool } from 'pg';
import { hashApiKey } from '../repositories/apiKeys';

// Integration test: requires running Docker services (postgres + clickhouse)
describe('Ingestion Integration', () => {
  let app: FastifyInstance;
  let pg: Pool;

  const tenantId = '11111111-1111-1111-1111-111111111111';
  const apiKey = 'sk_test_12345';
  const apiKeyHash = hashApiKey(apiKey);

  beforeAll(async () => {
    // Only run if PG is reachable
    pg = new Pool({
      host: process.env.PG_HOST || 'localhost',
      port: parseInt(process.env.PG_PORT || '5433', 10),
      user: process.env.PG_USER || 'postgres',
      password: process.env.PG_PASSWORD || 'password',
      database: process.env.PG_DATABASE || 'cdp_crm',
    });

    await pg.query('SELECT 1');
      // DB reachable
  

    app = buildApp();
    await app.ready();
  });


  afterAll(async () => {
    // Delete test tenant + api_key via cascade
    await pg.query('DELETE FROM tenants WHERE id = $1', [tenantId]).catch(() => undefined);
    await app.close().catch(() => undefined);
    await pg.end().catch(() => undefined);
  });


  it('authenticates API key against PostgreSQL', async () => {
    // Insert test tenant and api_key properly
    await pg.query(
      `INSERT INTO tenants (id, name) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [tenantId, 'integration-tenant']
    );
    await pg.query(
      `INSERT INTO api_keys (tenant_id, key_hash, prefix, name) VALUES ($1, $2, $3, $4)
       ON CONFLICT DO NOTHING`,
      [tenantId, apiKeyHash, 'sk_test_', 'integration-test']
    );


    const response = await app.inject({
      method: 'POST',
      url: '/v1/track',
      headers: { authorization: `Bearer ${apiKey}` },
      payload: {
        tenantId,
        eventId: randomUUID(),
        timestamp: new Date().toISOString(),
        type: 'track',
        event: 'integration_test',
      },
    });

    expect([202,409]).toContain(response.statusCode);
  });

  it('rejects invalid API key', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/track',
      headers: { authorization: 'Bearer wrong_key' },
      payload: {
        tenantId,
        eventId: randomUUID(),
        timestamp: new Date().toISOString(),
        type: 'track',
        event: 'should_fail',
      },
    });

    expect(response.statusCode).toBe(401);
  });

  it('rejects tenant mismatch', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/track',
      headers: { authorization: `Bearer ${apiKey}` },
      payload: {
        tenantId: '99999999-9999-9999-9999-999999999999',
        eventId: randomUUID(),
        timestamp: new Date().toISOString(),
        type: 'track',
        event: 'tenant_mismatch',
      },
    });

    expect(response.statusCode).toBe(403);
  });

  it('inserts batch events to ClickHouse', async () => {
    const batch = {
      batch: [
        {
          tenantId,
          eventId: randomUUID(),
          timestamp: new Date().toISOString(),
          type: 'track',
          event: 'batch_1',
        },
        {
          tenantId,
          eventId: randomUUID(),
          timestamp: new Date().toISOString(),
          type: 'track',
          event: 'batch_2',
        },
      ],
    };

    const response = await app.inject({
      method: 'POST',
      url: '/v1/track/batch',
      headers: { authorization: `Bearer ${apiKey}` },
      payload: batch,
    });

    expect([202,409]).toContain(response.statusCode);
    expect(JSON.parse(response.payload).processed).toBe(2);
  });
});
