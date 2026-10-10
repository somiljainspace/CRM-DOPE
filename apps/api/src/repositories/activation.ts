// Phase 6A: activation repository (destinations, consent, jobs)
import { Pool } from 'pg';

const pg = new Pool({ host: process.env.PG_HOST || 'localhost', port: parseInt(process.env.PG_PORT || '5433', 10), user: process.env.PG_USER || 'postgres', password: process.env.PG_PASSWORD || 'password', database: process.env.PG_DATABASE || 'cdp_crm' });

export interface DestinationRow {
  id: string; tenant_id: string; workspace_id: string; project_id: string | null;
  environment_id: string | null; name: string; url: string; enabled: boolean;
  signing_secret_encrypted: Buffer; signature_version: number; created_by: string | null;
  created_at: string; updated_at: string;
}

export async function createDestination(d: {
  tenantId: string; workspaceId: string; projectId?: string | null; environmentId?: string | null;
  name: string; url: string; encryptedSecret: Buffer; createdBy?: string | null;
}): Promise<DestinationRow> {
  const r = await pg.query(
    `INSERT INTO webhook_destinations (tenant_id, workspace_id, project_id, environment_id, name, url, enabled, signing_secret_encrypted, signature_version, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,true,$7,1,$8) RETURNING *`,
    [d.tenantId, d.workspaceId, d.projectId || null, d.environmentId || null, d.name, d.url, d.encryptedSecret, d.createdBy || null]);
  return r.rows[0] as DestinationRow;
}

export async function listDestinations(tenantId: string, limit = 50, offset = 0): Promise<DestinationRow[]> {
  const r = await pg.query('SELECT * FROM webhook_destinations WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3', [tenantId, limit, offset]);
  return r.rows as DestinationRow[];
}

export async function getDestination(id: string, tenantId: string): Promise<DestinationRow | null> {
  const r = await pg.query('SELECT * FROM webhook_destinations WHERE id=$1 AND tenant_id=$2', [id, tenantId]);
  return (r.rows[0] || null) as DestinationRow | null;
}

export async function updateDestination(id: string, tenantId: string, fields: Partial<{ name: string; url: string; enabled: boolean; encryptedSecret: Buffer }>): Promise<DestinationRow | null> {
  const sets: string[] = []; const vals: unknown[] = [];
  let idx = 1;
  if (fields.name !== undefined) { sets.push(`name=$${idx++}`); vals.push(fields.name); }
  if (fields.url !== undefined) { sets.push(`url=$${idx++}`); vals.push(fields.url); }
  if (fields.enabled !== undefined) { sets.push(`enabled=$${idx++}`); vals.push(fields.enabled); }
  if (fields.encryptedSecret !== undefined) { sets.push(`signing_secret_encrypted=$${idx++}`); vals.push(fields.encryptedSecret); }
  if (sets.length === 0) return getDestination(id, tenantId);
  sets.push(`updated_at=CURRENT_TIMESTAMP`);
  vals.push(id, tenantId);
  const r = await pg.query(`UPDATE webhook_destinations SET ${sets.join(',')} WHERE id=$${idx} AND tenant_id=$${idx+1} RETURNING *`, vals);
  return (r.rows[0] || null) as DestinationRow | null;
}

export async function deleteDestination(id: string, tenantId: string): Promise<boolean> {
  const r = await pg.query('DELETE FROM webhook_destinations WHERE id=$1 AND tenant_id=$2', [id, tenantId]);
  return (r.rowCount || 0) > 0;
}

export interface ConsentRow {
  id: string; tenant_id: string; profile_id: string; purpose: string;
  status: 'granted' | 'withdrawn'; granted_at: string | null; withdrawn_at: string | null; created_at: string;
}

export async function upsertConsent(c: { tenantId: string; profileId: string; purpose: string; status: 'granted' | 'withdrawn'; source?: string | null; policyVersion?: string | null; createdBy?: string | null }): Promise<ConsentRow> {
  const now = new Date().toISOString();
  const r = await pg.query(
    `INSERT INTO consent_records (tenant_id, profile_id, purpose, status, source, policy_version, granted_at, withdrawn_at, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (tenant_id, profile_id, purpose) DO UPDATE SET status=EXCLUDED.status, updated_at=CURRENT_TIMESTAMP, withdrawn_at=EXCLUDED.withdrawn_at, granted_at=EXCLUDED.granted_at
     RETURNING *`,
    [c.tenantId, c.profileId, c.purpose, c.status, c.source || null, c.policyVersion || null,
     c.status === 'granted' ? now : null, c.status === 'withdrawn' ? now : null, c.createdBy || null]);
  return r.rows[0] as ConsentRow;
}

export async function getConsent(tenantId: string, profileId: string, purpose: string): Promise<ConsentRow | null> {
  const r = await pg.query('SELECT * FROM consent_records WHERE tenant_id=$1 AND profile_id=$2 AND purpose=$3', [tenantId, profileId, purpose]);
  return (r.rows[0] || null) as ConsentRow | null;
}
