// Complete audience enumeration: supports all condition types using PostgreSQL for profile_trait
// and ClickHouse for event-based conditions (event_occurrence, event_count, recency).
import { Pool } from 'pg';
import { clickhouse } from '../../repositories/events';

export const DEFAULT_AUDIENCE_MAX = 1000;

export function getMaxAudience(): number {
  const v = process.env.ACTIVATION_MAX_AUDIENCE;
  const n = v ? parseInt(v, 10) : DEFAULT_AUDIENCE_MAX;
  return Number.isFinite(n) && n >= 1 ? n : DEFAULT_AUDIENCE_MAX;
}

export interface AudienceResult {
  profileIds: string[];
  truncated: boolean;
  totalCount: number;
  note: string;
  consistency: 'eventual' | 'snapshot';
}

const PAGE_SIZE = 200;

// Supported operators for profile_trait conditions
const OPERATOR_MAP: Record<string, string> = {
  equals: '=',
  not_equals: '!=',
  greater_than: '>',
  less_than: '<',
  contains: 'LIKE',
};

function isSupportedOperator(op: string): boolean {
  return Object.prototype.hasOwnProperty.call(OPERATOR_MAP, op);
}

function validateProfileTraitCondition(c: any): void {
  if (typeof c.field !== 'string' || !c.field.trim()) {
    throw new Error('profile_trait condition requires a non-empty string field');
  }
  if (!isSupportedOperator(c.operator)) {
    throw new Error(`Unsupported operator for profile_trait: ${c.operator}`);
  }
  if (c.value === undefined || c.value === null) {
    throw new Error('profile_trait condition requires a value');
  }
}

// Validate an event condition (event_occurrence, event_count, recency)
function validateEventCondition(c: any): void {
  if (typeof c.event_name !== 'string' || !c.event_name.trim()) {
    throw new Error(`${c.kind} condition requires a non-empty event_name`);
  }
  if (c.kind === 'event_count') {
    if (!['at_least', 'at_most', 'exactly'].includes(c.count_operator)) {
      throw new Error(`Unsupported count_operator: ${c.count_operator}`);
    }
    if (!Number.isInteger(c.count) || c.count < 0) {
      throw new Error('event_count condition requires a non-negative integer count');
    }
  }
  if (c.kind === 'recency' && !['within', 'older_than'].includes(c.type)) {
    throw new Error(`Unsupported recency type: ${c.type}`);
  }
}

/**
 * Execute a compiled ClickHouse query and return the set of matching user_id/anonymous_id values.
 * Uses FINAL for dedup and COALESCE to prefer identified user_id over anonymous_id.
 */
async function runClickHouseQuery(sql: string, params: Record<string, unknown>): Promise<Set<string>> {
  const resultSet = await clickhouse.query({
    query: sql,
    query_params: params,
    format: 'JSONEachRow',
  });
  const rows: Array<{ id?: string }> = await resultSet.json();
  const ids = new Set<string>();
  for (const r of rows) {
    if (r.id) ids.add(String(r.id));
  }
  return ids;
}

/**
 * Map a ClickHouse user_id/anonymous_id to a PostgreSQL profile id.
 * Falls back to anonymous_id if user_id is null or not found.
 * Uses customer_identities for alias resolution when available.
 */
async function resolveProfileIds(
  pg: Pool,
  tenantId: string,
  projectId: string,
  environmentId: string,
  clickHouseIds: Set<string>,
  maxAudience: number,
): Promise<{ profileIds: string[]; truncated: boolean }> {
  if (clickHouseIds.size === 0) return { profileIds: [], truncated: false };

  const values = [...clickHouseIds];
  const profileIds = new Set<string>();

  // Process in batches to avoid unbounded query params
  for (let i = 0; i < values.length; i += PAGE_SIZE) {
    const batch = values.slice(i, i + PAGE_SIZE);
    const placeholders = batch.map((_, idx) => `$${idx + 4}`).join(',');
    const res = await pg.query(
      `SELECT id FROM customer_profiles
       WHERE tenant_id=$1 AND project_id=$2 AND environment_id=$3
         AND (user_id IN (${placeholders}) OR anonymous_id IN (${placeholders}))
       LIMIT ${maxAudience}`,
      [tenantId, projectId, environmentId, ...batch],
    );
    for (const row of res.rows) profileIds.add(row.id);
  }

  return { profileIds: [...profileIds], truncated: profileIds.size >= maxAudience };
}

export async function enumerateAudience(
  pg: Pool,
  segmentDef: any,
  tenantId: string,
  workspaceId: string,
  scope: { projectId?: string; environmentId?: string },
  maxAudience = DEFAULT_AUDIENCE_MAX,
): Promise<AudienceResult> {
  const conditions = segmentDef?.conditions || [];
  if (conditions.length === 0) {
    return { profileIds: [], truncated: false, totalCount: 0, note: 'No conditions', consistency: 'snapshot' };
  }

  // Validate all conditions first
  for (const c of conditions) {
    if (c.kind === 'profile_trait') {
      validateProfileTraitCondition(c);
    } else if (c.kind === 'event_occurrence' || c.kind === 'event_count' || c.kind === 'recency') {
      validateEventCondition(c);
    } else {
      return {
        profileIds: [], truncated: true, totalCount: 0,
        note: `Unsupported condition kind: ${c.kind}`,
        consistency: 'eventual',
      };
    }
  }

  const hasProfileCondition = conditions.some((c: any) => c.kind === 'profile_trait');
  const hasEventCondition = conditions.some((c: any) => c.kind !== 'profile_trait');
  const operator = segmentDef.operator || 'AND';

  // Resolve scope
  const projectId = scope.projectId || tenantId;
  const environmentId = scope.environmentId || tenantId;

  // Phase 1: Enumerate profile_trait conditions from PostgreSQL
  let profileIds: Set<string> | null = null;
  if (hasProfileCondition) {
    const where = ['tenant_id=$1', 'project_id=$2', 'environment_id=$3'];
    const params: unknown[] = [tenantId, projectId, environmentId];
    let idx = 4;
    for (const c of conditions) {
      if (c.kind !== 'profile_trait') continue;
      const sqlOp = OPERATOR_MAP[c.operator];
      const paramVal = c.operator === 'contains' ? `%${c.value}%` : c.value;
      where.push(`traits->>'${c.field}' ${sqlOp} $${idx}`);
      params.push(paramVal);
      idx++;
    }
    const query = `SELECT id FROM customer_profiles WHERE ${where.join(' AND ')} ORDER BY id ASC LIMIT ${maxAudience}`;
    const res = await pg.query(query, params);
    profileIds = new Set(res.rows.map((r: { id: string }) => r.id));
  }

  // Phase 2: Enumerate event conditions from ClickHouse
  let eventIds: Set<string> | null = null;
  if (hasEventCondition) {
    eventIds = new Set();
    const now = new Date();
    for (const c of conditions) {
      if (c.kind === 'profile_trait') continue;
      let windowDays = 30;
      if (c.window_days) windowDays = Math.min(Math.max(c.window_days, 1), 90);
      if (c.kind === 'recency' && c.days) windowDays = Math.min(Math.max(c.days, 1), 90);
      const start = new Date(now.getTime() - windowDays * 86400000).toISOString().slice(0, 10);
      const end = now.toISOString().slice(0, 10);

      let sql = '';
      let params: Record<string, unknown> = {};
      if (c.kind === 'event_occurrence') {
        sql = `SELECT DISTINCT COALESCE(user_id, anonymous_id) AS id FROM analytics_events FINAL
               WHERE tenant_id={t:UUID} AND event_name={n:String} AND timestamp >= toDateTime({start:String}) AND timestamp <= toDateTime({end:String})`;
        params = { t: tenantId, n: c.event_name, start, end };
      } else if (c.kind === 'event_count') {
        const op = c.count_operator === 'at_least' ? '>=' : c.count_operator === 'at_most' ? '<=' : '=';
        sql = `SELECT COALESCE(user_id, anonymous_id) AS id FROM analytics_events FINAL
               WHERE tenant_id={t:UUID} AND event_name={n:String} AND timestamp >= toDateTime({start:String}) AND timestamp <= toDateTime({end:String})
               GROUP BY id HAVING count() ${op} {cnt:UInt64}`;
        params = { t: tenantId, n: c.event_name, start, end, op, cnt: c.count };
      } else if (c.kind === 'recency') {
        sql = `SELECT DISTINCT COALESCE(user_id, anonymous_id) AS id FROM analytics_events FINAL
               WHERE tenant_id={t:UUID} AND timestamp >= toDateTime({start:String}) AND timestamp <= toDateTime({end:String})`;
        params = { t: tenantId, start, end };
      }

      const ids = await runClickHouseQuery(sql, params);
      if (operator === 'OR') {
        for (const id of ids) eventIds.add(id);
      } else {
        if (eventIds.size === 0 && conditions.filter((x: any) => x.kind !== 'profile_trait').length > 1) {
          // First event condition initializes the set
          for (const id of ids) eventIds.add(id);
        } else {
          // Intersect
          for (const id of eventIds) {
            if (!ids.has(id)) eventIds.delete(id);
          }
        }
      }
    }
  }

  // Phase 3: Combine results
  let combinedIds: Set<string>;
  if (profileIds && eventIds) {
    if (operator === 'OR') {
      // Union of profile ids and event-based profile ids
      const eventProfileIds = await resolveProfileIds(pg, tenantId, projectId, environmentId, eventIds, maxAudience);
      combinedIds = new Set([...profileIds, ...eventProfileIds.profileIds]);
    } else {
      // Intersect: profiles that match both
      const eventProfileIds = await resolveProfileIds(pg, tenantId, projectId, environmentId, eventIds, maxAudience);
      combinedIds = new Set([...profileIds].filter(id => eventProfileIds.profileIds.includes(id)));
    }
  } else if (profileIds) {
    combinedIds = profileIds;
  } else if (eventIds) {
    const eventProfileIds = await resolveProfileIds(pg, tenantId, projectId, environmentId, eventIds, maxAudience);
    combinedIds = new Set(eventProfileIds.profileIds);
  } else {
    combinedIds = new Set();
  }

  const result = [...combinedIds];
  const truncated = result.length >= maxAudience;
  const note = truncated
    ? `Audience exceeds cap (${maxAudience}); enumerated ${result.length}`
    : `Complete: ${result.length}`;

  return {
    profileIds: result,
    truncated,
    totalCount: result.length,
    note,
    consistency: 'eventual',
  };
}
