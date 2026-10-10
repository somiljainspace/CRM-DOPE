import { SegmentDefinition } from './definition';

/**
 * Server-side segment compiler.
 * Converts validated segment definitions into predefined ClickHouse query
 * patterns. NEVER accepts SQL from the client.
 */
export interface CompiledQuery {
  pattern: 'traits' | 'events' | 'count' | 'recency' | 'hybrid';
  chQuery: string;
  params: Record<string, unknown>;
}

export function compileSegment(
  def: SegmentDefinition,
  scope: { tenantId: string; projectId: string; environmentId: string; startDate: string; endDate: string },
): CompiledQuery[] {
  const patterns: CompiledQuery[] = [];
  for (const cond of def.conditions) {
    switch (cond.kind) {
      case 'profile_trait':
        patterns.push({ pattern: 'traits', chQuery: `SELECT id FROM customer_profiles_final WHERE tenant_id={tenantId:String} AND project_id={projectId:String} AND environment_id={environmentId:String} AND JSONExtractString(traits, {field:String}) {op} {value:String}`, params: { field: cond.field, op: mapOp(cond.operator), value: String(cond.value), ...scope } });
        break;
      case 'event_occurrence':
        patterns.push({ pattern: 'events', chQuery: `SELECT DISTINCT COALESCE(user_id, anonymous_id) AS identity FROM events.analytics_events FINAL WHERE tenant_id={tenantId:String} AND event_name={eventName:String} AND timestamp >= {start:String} AND timestamp <= {end:String}`, params: { eventName: cond.event_name, start: isoStart(cond.window_days), end: scope.endDate, ...scope } });
        break;
      case 'event_count':
        patterns.push({ pattern: 'count', chQuery: `SELECT identity, count() as c FROM (SELECT DISTINCT COALESCE(user_id, anonymous_id) AS identity, event_id FROM events.analytics_events FINAL WHERE tenant_id={tenantId:String} AND event_name={eventName:String} AND timestamp >= {start:String} AND timestamp <= {end:String}) GROUP BY identity HAVING c {op} {count:UInt64}`, params: { eventName: cond.event_name, op: mapCountOp(cond.count_operator), count: cond.count, start: isoStart(cond.window_days), end: scope.endDate, ...scope } });
        break;
      case 'recency':
        patterns.push({ pattern: 'recency', chQuery: `SELECT DISTINCT COALESCE(user_id, anonymous_id) AS identity FROM events.analytics_events FINAL WHERE tenant_id={tenantId:String} AND timestamp >= {start:String} AND timestamp <= {end:String}`, params: { start: isoStart(cond.days), end: scope.endDate, ...scope } });
        break;
    }
  }
  return patterns;
}

function mapOp(op: string): string {
  switch (op) {
    case 'equals': return '=';
    case 'not_equals': return '!=';
    case 'greater_than': return '>';
    case 'less_than': return '<';
    case 'contains': return 'ILIKE';
    default: return '=';
  }
}
function mapCountOp(op: string): string {
  switch (op) {
    case 'at_least': return '>=';
    case 'at_most': return '<=';
    case 'exactly': return '=';
    default: return '>=';
  }
}
function isoStart(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString();
}
