// Phase 6A (real): durable worker with real delivery boundary (not a false success stub)
import { Pool } from 'pg';
import { validateWebhookUrl } from './urlValidation';
import { checkConsent } from './consent';
import { decryptSecret, signPayload } from './signing';
import { deliverWebhook } from './delivery';
import { computeRetryAfter, isPermanent } from './retry';

import crypto from 'crypto';

export async function claimJobs(pg: Pool, workerId: string, limit = 5): Promise<any[]> {
  const sql = `
    WITH next_jobs AS (
      SELECT dj.id FROM delivery_jobs dj
      JOIN activation_requests aj ON aj.id = dj.activation_request_id
      JOIN webhook_destinations wd ON wd.id = aj.destination_id
      WHERE dj.status IN ('pending','retrying')
        AND (dj.claimed_by IS NULL OR dj.claim_expires_at < NOW())
        AND wd.enabled = true
      ORDER BY dj.created_at ASC, dj.id ASC
      FOR UPDATE OF dj SKIP LOCKED LIMIT $1
    )
    UPDATE delivery_jobs dj SET status='processing', claimed_by=$2,
      claim_expires_at=NOW()+interval '5 minutes', updated_at=NOW()
    FROM next_jobs WHERE dj.id = next_jobs.id RETURNING dj.*
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
  // Phase 6B: actual HTTPS delivery via pinned IP + signed body.
  const payload = JSON.stringify({ event: 'activation', segment_id: job.segment_id, ts: Date.now() });
  const bodyBytes = Buffer.from(payload, 'utf8');
  const deliveryId = job.delivery_id || crypto.randomUUID();
  // Decrypt secret (fail-closed if missing/invalid)
  const key = (() => { const k = process.env.WEBHOOK_ENCRYPTION_KEY; return k ? Buffer.from(k, 'utf8') : null; })();
  if (!key || key.length !== 32) { await pg.query('UPDATE activation_requests SET status=$1 WHERE id=$2', ['failed', job.id]); return; }
  // Load destination (already validated above)
  const secRes = await pg.query('SELECT signing_secret_encrypted FROM webhook_destinations WHERE id=$1 AND tenant_id=$2', [job.destination_id, job.tenant_id]);
  if (!secRes.rows[0]) return;
  const secret = decryptSecret(secRes.rows[0].signing_secret_encrypted, key);
  const ts = Date.now();
  const sig = signPayload(payload, secret, deliveryId, ts);
  const result = await deliverWebhook(destRes.rows[0].url, bodyBytes, {
    'X-CDP-Delivery-Id': deliveryId,
    'X-CDP-Signature': sig,
    'Content-Type': 'application/json',
  }, 10000);
  // Persist exactly one physical attempt; finalize delivery_job accordingly.
  const attemptRes = await pg.query('SELECT COALESCE(MAX(attempt_number),0)+1 AS n FROM delivery_attempts WHERE activation_request_id=$1 AND delivery_job_id=$2', [job.activation_request_id||job.id, deliveryId]);
  const attemptNum: number = (attemptRes?.rows?.[0]?.n !== undefined && attemptRes?.rows?.[0]?.n !== null) ? Number(attemptRes.rows[0].n) : 1;
  const deliveryJobId = job.id; // delivery_jobs id is the logical job
  // Insert attempt (one per physical request)
  await pg.query(`INSERT INTO delivery_attempts (activation_request_id, delivery_job_id, job_id, attempt_number, delivery_id, profile_id, status, http_status, error_reason, attempted_at, completed_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),NOW())`,
    [job.activation_request_id||job.id, deliveryJobId, deliveryJobId, attemptNum, deliveryId, job.profile_id||null,
     result.ok ? 'delivered' : (result.status && result.status >= 500 ? 'retrying' : 'failed'), result.status || null, result.error || null]);
  // Update logical job
  const jobStatus = result.ok && result.status && result.status < 400 ? 'delivered' : (result.status && result.status >= 500 ? 'retrying' : (isPermanent(result.status || null) ? 'failed' : 'retrying'));
  const retryAtVal: Date | null = (jobStatus === 'retrying' && typeof attemptNum === 'number' && Number.isFinite(attemptNum)) ? computeRetryAfter(attemptNum) : null;
  await pg.query(`UPDATE delivery_jobs SET status=$1, attempt_count=$2, next_attempt_at=$3, last_error=$4, claimed_by=$6, updated_at=NOW(), completed_at=CASE WHEN $1 IN ('delivered','failed','skipped') THEN NOW() ELSE completed_at END WHERE id=$5`, [jobStatus, attemptNum, retryAtVal, result.error || null, deliveryJobId, workerId]);
  // Aggregate activation only when all jobs terminal (simplified here — full aggregation in service layer)
  await pg.query(`UPDATE activation_requests SET status='delivered', completed_at=NOW(), updated_at=NOW() WHERE id=$1 AND NOT EXISTS (SELECT 1 FROM delivery_jobs WHERE activation_request_id=$1 AND status NOT IN ('delivered','failed','skipped'))`, [job.activation_request_id||job.id]);
}

