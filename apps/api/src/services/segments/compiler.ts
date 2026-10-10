import { SegmentDefinition } from './definition';

/**
 * Real query compiler: converts validated definition into safe ClickHouse
 * query strings using ONLY allowlisted patterns and parameterized bindings.
 * Never accepts SQL/identifiers from client.
 */
export interface CompiledQuery {
  sql: string;
  params: Record<string, unknown>;
  description: string;
}

export function compileSegment(
  def: SegmentDefinition,
  scope: { tenantId: string; projectId?: string; environmentId?: string; startDate?: string; endDate?: string },
): CompiledQuery[] {
  const out: CompiledQuery[] = [];
  for (const c of def.conditions) {
    switch (c.kind) {
      case 'profile_trait': {
        out.push({
          sql: `SELECT id FROM customer_profiles WHERE tenant_id={t:UUID} AND project_id={p:UUID} AND environment_id={e:UUID} AND JSONExtractString(traits,{f:String}) {op} {v:String}`,
          params: { t: scope.tenantId, p: scope.projectId || scope.tenantId, e: scope.environmentId || scope.tenantId, f: c.field, op: mapOp(c.operator), v: String(c.value) },
          description: `profile_trait:${c.field} ${c.operator} ${c.value}`,
        });
        break;
      }
      case 'event_occurrence': {
        const windowDays = Math.min(Math.max(c.window_days, 1), 90);
        const start = scope.startDate || new Date(Date.now() - windowDays * 86400000).toISOString().slice(0, 10);
        out.push({
          sql: `SELECT DISTINCT COALESCE(user_id, anonymous_id) AS id FROM analytics_events FINAL WHERE tenant_id={t:UUID} AND event_name={n:String} AND timestamp >= toDateTime({start:String}) AND timestamp <= toDateTime({end:String})`,
          params: { t: scope.tenantId, n: c.event_name, start, end: scope.endDate || new Date().toISOString().slice(0, 10) },
          description: `event_occurrence:${c.event_name} ${c.performed ? 'performed' : 'not'} ${windowDays}d`,
        });
        break;
      }
      case 'event_count': {
        const windowDays = Math.min(Math.max(c.window_days, 1), 90);
        const start = scope.startDate || new Date(Date.now() - windowDays * 86400000).toISOString().slice(0, 10);
        const op = c.count_operator === 'at_least' ? '>=' : c.count_operator === 'at_most' ? '<=' : '=';
        out.push({
          sql: `SELECT COALESCE(user_id, anonymous_id) AS id FROM analytics_events FINAL WHERE tenant_id={t:UUID} AND event_name={n:String} AND timestamp >= toDateTime({start:String}) GROUP BY id HAVING count() {op} {cnt:UInt64}`,
          params: { t: scope.tenantId, n: c.event_name, start, end: scope.endDate || new Date().toISOString().slice(0, 10), op, cnt: c.count },
          description: `event_count:${c.event_name} ${c.count_operator} ${c.count} over ${windowDays}d`,
        });
        break;
      }
      case 'recency': {
        const days = Math.min(Math.max(c.days, 1), 90);
        const start = scope.startDate || new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
        out.push({
          sql: `SELECT DISTINCT COALESCE(user_id, anonymous_id) AS id FROM analytics_events FINAL WHERE tenant_id={t:UUID} AND timestamp >= toDateTime({start:String})`,
          params: { t: scope.tenantId, start, end: scope.endDate || new Date().toISOString().slice(0, 10) },
          description: `recency:${c.type} ${days}d`,
        });
        break;
      }
    }
  }
  return out;
}

function mapOp(op: string): string {
  const m: Record<string, string> = {
    equals: '=', not_equals: '!=', greater_than: '>', less_than: '<', contains: 'LIKE',
  };
  return m[op] || '=';
}
