import { Pool } from 'pg';
const pg = new Pool({ host: process.env.PG_HOST||'localhost', port: parseInt(process.env.PG_PORT||'5433'), user: process.env.PG_USER||'postgres', password: process.env.PG_PASSWORD||'password', database: process.env.PG_DATABASE||'cdp_crm' });

export async function createSegment({ tenantId, projectId, environmentId, name, description, definition, version, createdBy }: { tenantId: string; projectId: string; environmentId: string; name: string; description?: string; definition: string; version: number; createdBy: string }) {
  const r = await pg.query('INSERT INTO segments (tenant_id, project_id, environment_id, name, description, definition_json, definition_version, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *', [tenantId, projectId, environmentId, name, description||null, definition, version, createdBy]);
  return r.rows[0];
}
export async function listSegments({ tenantId }: { tenantId: string }, { limit=25, offset=0 }: { limit?: number; offset?: number }) {
  const r = await pg.query('SELECT * FROM segments WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3', [tenantId, limit, offset]);
  return r.rows;
}
export async function getSegment(id: string, tenantId: string) {
  const r = await pg.query('SELECT * FROM segments WHERE id=$1 AND tenant_id=$2', [id, tenantId]);
  return r.rows[0] || null;
}
export async function updateSegment(id: string, tenantId: string, fields: Partial<{ name: string; description: string; definition: string; version: number; updatedBy: string }>) {
  const sets = []; const vals = []; let idx = 1;
  if (fields.name !== undefined) { sets.push(`name=$${idx++}`); vals.push(fields.name); }
  if (fields.description !== undefined) { sets.push(`description=$${idx++}`); vals.push(fields.description); }
  if (fields.definition !== undefined) { sets.push(`definition_json=$${idx++}`); vals.push(fields.definition); }
  if (fields.version !== undefined) { sets.push(`definition_version=$${idx++}`); vals.push(fields.version); }
  if (fields.updatedBy) { sets.push(`updated_by=$${idx++}`); vals.push(fields.updatedBy); }
  sets.push(`updated_at=CURRENT_TIMESTAMP`);
  vals.push(id); vals.push(tenantId);
  const r = await pg.query(`UPDATE segments SET ${sets.join(',')} WHERE id=$${vals.length-1} AND tenant_id=$${vals.length} RETURNING *`, vals);
  return r.rows[0] || null;
}
export async function deleteSegment(id: string, tenantId: string) {
  const r = await pg.query('DELETE FROM segments WHERE id=$1 AND tenant_id=$2 RETURNING id', [id, tenantId]);
  return r.rows[0] || null;
}
