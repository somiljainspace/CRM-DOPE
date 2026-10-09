import { Pool } from 'pg';
const pg = new Pool({ host: process.env.PG_HOST || 'localhost', port: parseInt(process.env.PG_PORT || '5433', 10), user: process.env.PG_USER || 'postgres', password: process.env.PG_PASSWORD || 'password', database: process.env.PG_DATABASE || 'cdp_crm' });

export interface ResolveInput { tenantId: string; projectId: string; environmentId: string; anonymousId?: string; userId?: string; traits?: Record<string, unknown>; }

export async function resolveProfile(input: ResolveInput): Promise<{ profileId: string; merged?: boolean }> {
  const client = await pg.connect();
  try {
    await client.query('BEGIN');
    // Anonymous profile
    if (input.anonymousId) {
      const anon = await client.query('SELECT id FROM customer_profiles WHERE tenant_id=$1 AND project_id=$2 AND environment_id=$3 AND anonymous_id=$4', [input.tenantId, input.projectId, input.environmentId, input.anonymousId]);
      if (anon.rows.length === 0) {
        const ins = await client.query('INSERT INTO customer_profiles (tenant_id, project_id, environment_id, anonymous_id, traits) VALUES ($1,$2,$3,$4,$5) RETURNING id', [input.tenantId, input.projectId, input.environmentId, input.anonymousId, JSON.stringify(input.traits || {})]);
        await client.query('INSERT INTO customer_identities (tenant_id, project_id, environment_id, profile_id, identity_type, identity_value) VALUES ($1,$2,$3,$4,$5,$6)', [input.tenantId, input.projectId, input.environmentId, ins.rows[0].id, 'anonymous_id', input.anonymousId]);
      } else {
        await client.query('UPDATE customer_profiles SET last_seen_at = CURRENT_TIMESTAMP WHERE id = $1', [anon.rows[0].id]);
      }
    }
    // Identified profile
    if (input.userId) {
      const iden = await client.query('SELECT id FROM customer_profiles WHERE tenant_id=$1 AND project_id=$2 AND environment_id=$3 AND user_id=$4', [input.tenantId, input.projectId, input.environmentId, input.userId]);
      if (iden.rows.length === 0) {
        const ins = await client.query('INSERT INTO customer_profiles (tenant_id, project_id, environment_id, user_id, traits) VALUES ($1,$2,$3,$4,$5) RETURNING id', [input.tenantId, input.projectId, input.environmentId, input.userId, JSON.stringify(input.traits || {})]);
        await client.query('INSERT INTO customer_identities (tenant_id, project_id, environment_id, profile_id, identity_type, identity_value) VALUES ($1,$2,$3,$4,$5,$6)', [input.tenantId, input.projectId, input.environmentId, ins.rows[0].id, 'user_id', input.userId]);
      } else {
        await client.query('UPDATE customer_profiles SET last_seen_at = CURRENT_TIMESTAMP, traits = COALESCE(traits,\'{}\')::jsonb || $4 WHERE id = $1', [iden.rows[0].id, JSON.stringify(input.traits || {})]);
      }
      // Merge anonymous -> identified if different profiles
      if (input.anonymousId) {
        const anon = await client.query('SELECT id FROM customer_profiles WHERE tenant_id=$1 AND project_id=$2 AND environment_id=$3 AND anonymous_id=$4', [input.tenantId, input.projectId, input.environmentId, input.anonymousId]);
        const user = await client.query('SELECT id FROM customer_profiles WHERE tenant_id=$1 AND project_id=$2 AND environment_id=$3 AND user_id=$4', [input.tenantId, input.projectId, input.environmentId, input.userId]);
        if (anon.rows.length > 0 && user.rows.length > 0 && anon.rows[0].id !== user.rows[0].id) {
          await client.query('UPDATE customer_identities SET profile_id = $1 WHERE profile_id = $2 AND identity_type = \'anonymous_id\'', [user.rows[0].id, anon.rows[0].id]);
          await client.query('DELETE FROM customer_profiles WHERE id = $1', [anon.rows[0].id]);
          await client.query('COMMIT');
          return { profileId: user.rows[0].id, merged: true };
        }
      }
    }
    await client.query('COMMIT');
    const p = await client.query('SELECT id FROM customer_profiles WHERE tenant_id=$1 AND project_id=$2 AND environment_id=$3 AND (user_id=$4 OR (user_id IS NULL AND anonymous_id=$5))', [input.tenantId, input.projectId, input.environmentId, input.userId || null, input.anonymousId || null]);
    return { profileId: p.rows[0].id };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
