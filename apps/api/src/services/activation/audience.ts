// Phase 6A (real): bounded complete audience enumeration from customer_profiles
import { Pool } from 'pg';

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
}

export async function enumerateAudience(
  pg: Pool,
  segmentDef: any,
  tenantId: string,
  workspaceId: string,
  maxAudience = DEFAULT_AUDIENCE_MAX
): Promise<AudienceResult> {
  // Supported: profile_trait conditions mapped to Postgres traits query.
  // Unsupported condition kinds (event_occurrence / event_count / recency that require
  // ClickHouse analytics) explicitly rejected rather than silently omitted.
  const conditions = segmentDef?.conditions || [];
  for (const c of conditions) {
    if (c.kind === 'profile_trait') continue; // supported
    // All others require ClickHouse event analytics; not safe to enumerate from profiles alone.
    return { profileIds: [], truncated: true, totalCount: 0, note: `Unsupported condition kind: ${c.kind}. Full enumeration requires ClickHouse analytics (not yet wired).` };
  }
  if (conditions.length === 0) return { profileIds: [], truncated: false, totalCount: 0, note: 'No conditions' };

  // Deterministic pagination by stable profile id, tenant scoped.
  const pageSize = 200;
  const ids: string[] = [];
  let cursor: string | null = null;
  let total = 0;
  do {
    const params: unknown[] = [tenantId];
    let where = 'WHERE tenant_id=$1';
    let idx = 2;
    for (const c of conditions) {
      if (c.kind === 'profile_trait') {
        const field = (c.field || '').toString();
        const op = (c.operator || '').toString();
        const val = c.value;
        const sqlOp = op === 'equals' ? '=' : op === 'not_equals' ? '!=' : op === 'greater_than' ? '>' : op === 'less_than' ? '<' : op === 'contains' ? 'LIKE' : '=';
        const paramVal = op === 'contains' ? `%${val}%` : val;
        where += ` AND traits->>'${field}' ${sqlOp} $${idx}`;
        params.push(paramVal); idx++;
      }
    }
    const query = `SELECT id FROM customer_profiles ${where} AND ($2::text IS NULL OR id > $2::text) ORDER BY id ASC LIMIT ${pageSize}`;
    const res: { rows: { id: string }[] } = await pg.query(query, [tenantId, cursor]);
    for (const r of res.rows) ids.push(r.id);
    total = ids.length;
    cursor = res.rows.length > 0 ? res.rows[res.rows.length - 1].id : null;
    if (ids.length >= maxAudience) {
      return { profileIds: ids.slice(0, maxAudience), truncated: true, totalCount: total, note: `Audience exceeds cap (${maxAudience}); enumerated ${ids.length}` };
    }
  } while (cursor && ids.length < maxAudience);

  return { profileIds: ids, truncated: false, totalCount: ids.length, note: `Complete: ${ids.length}` };
}
