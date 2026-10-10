import { SegmentDefinitionSchema, SegmentDefinition } from './definition';
import { compileSegment } from './compiler';
import { clickhouse } from '../../repositories/events';

export interface PreviewResult {
  matched_profiles: number;
  sample: string[];
  evaluated_at: string;
  definition_version: number;
  truncated: boolean;
  sample_limit: number;
  note: string;
}

export async function evaluateSegment(
  segmentId: string,
  defRaw: unknown,
  scope: { tenantId: string; projectId?: string; environmentId?: string; workspaceId: string },
): Promise<PreviewResult> {
  const def = SegmentDefinitionSchema.parse(defRaw) as SegmentDefinition;
  const compiled = compileSegment(def, { tenantId: scope.tenantId, projectId: scope.projectId || scope.tenantId, environmentId: scope.environmentId || scope.tenantId, startDate: '2026-01-01', endDate: '2026-12-31' });

  if (compiled.length === 0) {
    return { matched_profiles: 0, sample: [], evaluated_at: new Date().toISOString(), definition_version: def.definition_version, truncated: false, sample_limit: 100, note: 'No conditions' };
  }

  // Execute first compiled query against ClickHouse with FINAL for dedup
  const first = compiled[0];
  try {
    const resultSet = await clickhouse.query({
      query: first.sql,
      query_params: first.params,
      format: 'JSONEachRow',
    });
    const rows: Array<{ id?: string }> = await resultSet.json();
    const ids = new Set<string>();
    for (const r of rows) { if (r.id) ids.add(String(r.id)); }
    const sample = [...ids].slice(0, 100);
    return {
      matched_profiles: ids.size,
      sample,
      evaluated_at: new Date().toISOString(),
      definition_version: def.definition_version,
      truncated: ids.size > 100,
      sample_limit: 100,
      note: 'Dynamic evaluation using FINAL; identity reconciliation best-effort; historical anonymous events kept under original key where alias missing',
    };
  } catch (err) {
    throw new Error(`Segment evaluation failed: ${(err as Error).message}`);
  }
}
