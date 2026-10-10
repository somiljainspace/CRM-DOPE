// Phase 6A (real): durable activation preparation with bounded audience
import { Pool } from 'pg';
import crypto from 'crypto';
import { enumerateAudience, getMaxAudience } from './audience';

export async function createActivation(
  pg: Pool,
  params: {
    tenantId: string;
    workspaceId: string;
    segmentId: string;
    segmentDefinition: any;
    destinationId: string;
    purpose: string;
    createdBy: string | null;
    idempotencyKey: string;
  }
): Promise<{ id: string; status: string; audienceSize: number; note: string }> {
  const max = getMaxAudience();
  const audience = await enumerateAudience(pg, params.segmentDefinition, params.tenantId, params.workspaceId, max);
  if (audience.truncated && audience.profileIds.length >= max) {
    // Safe refusal: over cap. Persist rejected activation.
    const r = await pg.query(
      `INSERT INTO activation_requests (tenant_id, workspace_id, segment_id, destination_id, purpose, status, audience_size, idempotency_key, created_by, completed_at)
       VALUES ($1,$2,$3,$4,$5,'failed',$6,$7,$8,NOW()) RETURNING id`,
      [params.tenantId, params.workspaceId, params.segmentId, params.destinationId, params.purpose, audience.totalCount, params.idempotencyKey, params.createdBy]);
    return { id: r.rows[0].id, status: 'failed', audienceSize: audience.totalCount, note: audience.note };
  }
  if (audience.note.startsWith('Unsupported')) {
    const r = await pg.query(
      `INSERT INTO activation_requests (tenant_id, workspace_id, segment_id, destination_id, purpose, status, idempotency_key, created_by, completed_at)
       VALUES ($1,$2,$3,$4,$5,'failed',$6,$7,NOW()) RETURNING id`,
      [params.tenantId, params.workspaceId, params.segmentId, params.destinationId, params.purpose, params.idempotencyKey, params.createdBy]);
    return { id: r.rows[0].id, status: 'failed', audienceSize: 0, note: audience.note };
  }
  // Complete: persist recipient jobs (one per profile), stable delivery ids.
  const client = await pg.connect();
  try {
    await client.query('BEGIN');
    const ar = await client.query(
      `INSERT INTO activation_requests (tenant_id, workspace_id, segment_id, destination_id, purpose, status, audience_size, idempotency_key, created_by)
       VALUES ($1,$2,$3,$4,$5,'pending',$6,$7,$8) RETURNING id`,
      [params.tenantId, params.workspaceId, params.segmentId, params.destinationId, params.purpose, audience.profileIds.length, params.idempotencyKey, params.createdBy]);
    const activationId: string = ar.rows[0].id;
    for (const profileId of audience.profileIds) {
      const deliveryId = crypto.randomUUID();
      await client.query(
        `INSERT INTO delivery_attempts (activation_request_id, job_id, attempt_number, delivery_id, profile_id, status)
         VALUES ($1,$1,1,$2,$3,'pending')`,
        [activationId, deliveryId, profileId]);
    }
    await client.query('COMMIT');
    return { id: activationId, status: 'pending', audienceSize: audience.profileIds.length, note: audience.note };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
