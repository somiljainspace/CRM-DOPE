import { compileSegment } from './compiler';
import { SegmentDefinition } from './definition';
import { getClickHouse } from '../../lib/clickhouse';

export interface PreviewResult {
  count: number;
  sample: string[];
  evaluated_at: string;
  definition_version: number;
  truncated: boolean;
  sample_limit: number;
}

export async function evaluateSegment(
  def: SegmentDefinition,
  scope: { tenantId: string; projectId: string; environmentId: string },
): Promise<PreviewResult> {
  const patterns = compileSegment(def, { ...scope, startDate: '', endDate: '' });
  if (patterns.length === 0) {
    return { count: 0, sample: [], evaluated_at: new Date().toISOString(), definition_version: def.definition_version, truncated: false, sample_limit: 100 };
  }

  // Execute compiled patterns against ClickHouse using parameterized queries.
  const ch = getClickHouse();
  const identitySets: Set<string>[] = [];
  for (const p of patterns) {
    const rows = await ch.query(p.chQuery, p.params);
    identitySets.push(new Set(rows.map((r: any) => r.identity)));
  }

  // Combine per logical operator
  let combined: Set<string>;
  if (def.operator === 'AND') {
    combined = identitySets.reduce((acc, s) => new Set([...acc].filter(x => s.has(x))), identitySets[0] || new Set());
  } else {
    combined = new Set(identitySets.flatMap(s => [...s]));
  }

  // Resolve identities to canonical profiles via customer_identities (tenant-scoped)
  const resolved = await resolveIdentities([...combined], scope);
  const sample = resolved.slice(0, 100);
  return {
    count: resolved.length,
    sample,
    evaluated_at: new Date().toISOString(),
    definition_version: def.definition_version,
    truncated: resolved.length > 100,
    sample_limit: 100,
  };
}

async function resolveIdentities(identities: string[], scope: { tenantId: string; projectId: string; environmentId: string }): Promise<string[]> {
  // Map raw identities (user_id/anonymous_id) to canonical profile ids using customer_identities
  const ch = getClickHouse();
  const resolved = new Set<string>();
  for (const id of identities) {
    const rows = await ch.query(
      `SELECT profile_id FROM customer_identities WHERE tenant_id={tenantId:String} AND project_id={projectId:String} AND environment_id={environmentId:String} AND identity_value={identity:String}`,
      { ...scope, identity: id },
    );
    rows.forEach((r: any) => resolved.add(r.profile_id));
  }
  return [...resolved];
}
