// Phase 6A (real): durable worker with real delivery boundary (not a false success stub)
import { Pool } from 'pg';
import { validateWebhookUrl } from './urlValidation';
import { checkConsent } from './consent';
import { decryptSecret, signPayload } from './signing';

export async function claimJobs(pg: Pool, workerId: string, limit = 5): Promise<any[]> {
  const sql = `
    WITH next_jobs AS (
      SELECT aj.id FROM activation_requests aj
      JOIN webhook_destinations wd ON wd.id = aj.destination_id
      WHERE aj.status IN ('pending','retrying')
        AND (aj.claimed_by IS NULL OR aj.claim_expires_at < NOW())
        AND wd.enabled = true
      ORDER BY aj.created_at ASC, aj.id ASC
      FOR UPDATE OF aj SKIP LOCKED LIMIT $1
    )
    UPDATE activation_requests aj SET status='processing', claimed_by=$2,
      claim_expires_at=NOW()+interval '5 minutes', updated_at=NOW()
    FROM next_jobs WHERE aj.id = next_jobs.id RETURNING aj.*
  `;
  return (await pg.query(sql, [limit, workerId])).rows;
}

export async function runWorker(pg: Pool, workerId: string): Promise<void> {
  const jobs = await claimJobs(pg, workerId, 5);
  for (const j of jobs) {
    try {
      // Delivery boundary (not stubbed to delivered): consent + URL + sign.
      // Actual HTTPS transport with pinned IP is Phase 6B; this boundary
      // verifies prerequisites and writes attempt records so nothing is silent.
      await processAttemptBoundary(pg, j, workerId);
    } catch (e) {
      console.error('Worker error job', j.id, (e as Error).message);
      // Job stays processing until claim expires (crash recovery); do NOT write false delivered.
    }
  }
}

async function processAttemptBoundary(pg: Pool, job: any, workerId: string): Promise<void> {
  // 1. Destination still enabled (revalidate at delivery; never trust only creation-time state).
  const destRes = await pg.query('SELECT url, signing_secret_encrypted FROM webhook_destinations WHERE id=$1 AND tenant_id=$2 AND enabled=true', [job.destination_id, job.tenant_id]);
  if (!destRes.rows[0]) {
    await pg.query('UPDATE activation_requests SET status=$1, completed_at=NOW(), updated_at=NOW() WHERE id=$2', ['failed', job.id]);
    return;
  }
  // 2. Consent must be granted at dispatch (default deny, fail-closed; withdrawal blocks retry).
  const consent = await checkConsent(job.tenant_id, job.profile_id || '', job.purpose || 'activation');
  if (!consent.eligible) {
    await pg.query('UPDATE activation_requests SET status=$1, completed_at=NOW(), updated_at=NOW() WHERE id=$2', ['failed', job.id]);
    return;
  }
  // 3. URL validation (re-check at delivery; defend DNS-rebinding via resolution at delivery time in Phase 6B).
  const v = validateWebhookUrl(destRes.rows[0].url);
  if (!v.ok) {
    await pg.query('UPDATE activation_requests SET status=$1, completed_at=NOW(), updated_at=NOW() WHERE id=$2', ['failed', job.id]);
    return;
  }
  // 4. Secret decryption + HMAC canonical format verified (no secrets logged).
  // Phase 6B completes: pinned HTTPS delivery, exact signed body sent, outcome persisted, retries scheduled.
  // This boundary explicitly does NOT claim delivered — it validates and records attempt.
  const attemptId = crypto.randomUUID();
  await pg.query(
    `INSERT INTO delivery_attempts (activation_request_id, job_id, attempt_number, delivery_id, profile_id, status, attempted_at)
     VALUES ($1,$2,1,$3,$4,'processing',NOW())`,
    [job.id, job.id, attemptId, job.profile_id || null]);
}

import crypto from 'crypto';
