import { FastifyInstance, FastifyReply } from 'fastify';

import { Pool } from 'pg';
import { AuthenticatedPlatformRequest, requirePlatformSession } from '../auth/session';
import { requirePermission } from '../services/authorization';
import { clickhouse } from '../repositories/events';

const pg = new Pool({ host: process.env.PG_HOST || 'localhost', port: parseInt(process.env.PG_PORT || '5433', 10), user: process.env.PG_USER || 'postgres', password: process.env.PG_PASSWORD || 'password', database: process.env.PG_DATABASE || 'cdp_crm' });
const MAX_PAGE = 100;

function parsePage(q: any): { limit: number; offset: number } {
  const limit = Math.min(Math.max(parseInt(q?.limit || '25', 10), 1), MAX_PAGE);
  const offset = Math.max(parseInt(q?.offset || '0', 10), 0);
  return { limit, offset };
}

export async function profileRoutes(app: FastifyInstance) {
  app.addHook('onRequest', requirePlatformSession);

  app.get('/v1/control/profiles', async (req: AuthenticatedPlatformRequest, reply: FastifyReply) => {
    try {
      await requirePermission(req.platformUser!.id, (req.query as any).workspaceId || '', 'member:read');
      const { limit, offset } = parsePage(req.query);
      const r = await pg.query(
        'SELECT id, tenant_id, project_id, environment_id, user_id, anonymous_id, first_seen_at, last_seen_at FROM customer_profiles WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
        [(req as any).tenantId, limit, offset]
      );
      return reply.code(200).send({ profiles: r.rows });
    } catch { return reply.code(403).send({ error: 'Forbidden' }); }
  });

  app.get('/v1/control/profiles/:profileId', async (req: AuthenticatedPlatformRequest, reply: FastifyReply) => {
    try {
      const { profileId } = req.params as { profileId: string };
      await requirePermission(req.platformUser!.id, (req.query as any).workspaceId || '', 'member:read');
      const r = await pg.query(
        'SELECT id, tenant_id, project_id, environment_id, user_id, anonymous_id, traits, first_seen_at, last_seen_at FROM customer_profiles WHERE id = $1',
        [profileId]
      );
      if (r.rows.length === 0) return reply.code(404).send({ error: 'Not Found' });
      return reply.code(200).send({ profile: r.rows[0] });
    } catch { return reply.code(403).send({ error: 'Forbidden' }); }
  });

  app.get('/v1/control/profiles/:profileId/events', async (req: AuthenticatedPlatformRequest, reply: FastifyReply) => {
    try {
      const { profileId } = req.params as { profileId: string };
      await requirePermission(req.platformUser!.id, (req.query as any).workspaceId || '', 'member:read');
      // Resolve profile within tenant scope
      const prof = await pg.query(
        'SELECT tenant_id, project_id, environment_id, user_id, anonymous_id FROM customer_profiles WHERE id = $1',
        [profileId]
      );
      if (prof.rows.length === 0) return reply.code(404).send({ error: 'Not Found' });
      const p = prof.rows[0];
      // Load all identity aliases merged into canonical profile
      const ids = await pg.query(
        `SELECT identity_type, identity_value FROM customer_identities
         WHERE tenant_id = $1 AND profile_id = $2`,
        [p.tenant_id, profileId]
      );
      // Build identity values from profile + aliases
      const anonValues: string[] = [];
      const userValues: string[] = [];
      if (p.anonymous_id) anonValues.push(p.anonymous_id);
      if (p.user_id) userValues.push(p.user_id);
      for (const row of ids.rows) {
        if (row.identity_type === 'anonymous_id' && row.identity_value) anonValues.push(row.identity_value);
        if (row.identity_type === 'user_id' && row.identity_value) userValues.push(row.identity_value);
      }
      // Query ClickHouse with FINAL dedup; use parameterized query with tuple
      const { limit, offset } = parsePage(req.query);
      // Build safe parameterized query using array params
      const params: Record<string, string> = { tenantId: p.tenant_id };
      anonValues.forEach((v, i) => { params[`anon${i}`] = v; });
      userValues.forEach((v, i) => { params[`usr${i}`] = v; });
      let where = 'tenant_id = {tenantId:UUID}';
      if (anonValues.length > 0) where += ' AND anonymous_id IN (' + anonValues.map((_,i)=>'anon'+i).join(',') + ')';
      if (userValues.length > 0) where += ' AND user_id IN (' + userValues.map((_,i)=>'usr'+i).join(',') + ')';
      const rows = await clickhouse.query({
        query: `SELECT event_id, event_type, event_name, timestamp, user_id, anonymous_id, session_id, properties
                FROM events.analytics_events FINAL
                WHERE ${where}
                ORDER BY timestamp ASC, event_id ASC
                LIMIT {limit:UInt32} OFFSET {offset:UInt32}`,
        query_params: { ...params, limit: limit.toString(), offset: offset.toString() },
        format: 'JSONEachRow',
      });
      const events = await rows.json();
      return reply.code(200).send({ events });
    } catch (e: any) {
      return reply.code(500).send({ error: 'Internal Server Error', message: e.message });
    }
  });

  app.get('/v1/control/profiles/:profileId/sessions', async (req: AuthenticatedPlatformRequest, reply: FastifyReply) => {
    try {
      const { profileId } = req.params as { profileId: string };
      await requirePermission(req.platformUser!.id, (req.query as any).workspaceId || '', 'member:read');
      const prof = await pg.query('SELECT tenant_id, user_id, anonymous_id FROM customer_profiles WHERE id = $1', [profileId]);
      if (prof.rows.length === 0) return reply.code(404).send({ error: 'Not Found' });
      const p = prof.rows[0];
      const ids = await pg.query('SELECT identity_type, identity_value FROM customer_identities WHERE tenant_id = $1 AND profile_id = $2', [p.tenant_id, profileId]);
      const anonValues: string[] = []; const userValues: string[] = [];
      if (p.anonymous_id) anonValues.push(p.anonymous_id);
      if (p.user_id) userValues.push(p.user_id);
      for (const row of ids.rows) {
        if (row.identity_type === 'anonymous_id') anonValues.push(row.identity_value);
        if (row.identity_type === 'user_id') userValues.push(row.identity_value);
      }
      const { limit, offset } = parsePage(req.query);
      const params: Record<string, string> = { tenantId: p.tenant_id };
      anonValues.forEach((v, i) => { params[`anon${i}`] = v; });
      userValues.forEach((v, i) => { params[`usr${i}`] = v; });
      let where = 'tenant_id = {tenantId:UUID}';
      if (anonValues.length > 0) where += ` AND anonymous_id IN (${anonValues.map((_,i)=>'anon'+i).join(',')})`;
      if (userValues.length > 0) where += ` AND user_id IN (${userValues.map((_,i)=>'usr'+i).join(',')})`;
      // Sessions require session_id not empty; group by session_id
      const rows = await clickhouse.query({
        query: `SELECT session_id,
                       min(timestamp) AS session_start,
                       max(timestamp) AS last_activity,
                       count() AS event_count
                FROM events.analytics_events FINAL
                WHERE ${where} AND session_id != ''
                GROUP BY session_id
                ORDER BY session_start DESC
                LIMIT {limit:UInt32} OFFSET {offset:UInt32}`,
        query_params: { ...params, limit: limit.toString(), offset: offset.toString() },
        format: 'JSONEachRow',
      });
      const sessions = await rows.json();
      return reply.code(200).send({ sessions });
    } catch (e: any) {
      return reply.code(500).send({ error: 'Internal Server Error', message: e.message });
    }
  });
}

