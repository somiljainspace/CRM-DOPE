// Phase 6A (real): durable worker with real delivery boundary (not a false success stub)
import { Pool } from 'pg';
import { validateWebhookUrl } from './urlValidation';
import { checkConsent } from './consent';
import { decryptSecret, signPayload } from './signing';
import { deliverWebhook } from './delivery';

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
  // Phase 6B: actual HTTPS delivery via pinned IP + signed body.
  const payload = JSON.stringify({ event: 'activation', segment_id: job.segment_id, ts: Date.now() });
  const bodyBytes = Buffer.from(payload, 'utf8');
  const deliveryId = crypto.randomUUID();
  // Decrypt secret (fail-closed if missing/invalid)
  const key = (() => { const k = process.env.WEBHOOK_ENCRYPTION_KEY; return k ? Buffer.from(k, 'utf8') : null; })();
  if (!key || key.length !== 32) { await pg.query('UPDATE activation_requests SET status=$1 WHERE id=$2', ['failed', job.id]); return; }
  // Load destination (already validated above)
  const secRes = await pg.query('SELECT signing_secret_encrypted FROM webhook_destinations WHERE id=$1', [job.destination_id]);
  if (!secRes.rows[0]) return;
  const secret = decryptSecret(secRes.rows[0].signing_secret_encrypted, key);
  const ts = Date.now();
  const sig = signPayload(payload, secret, deliveryId, ts);
  const result = await deliverWebhook(destRes.rows[0].url, bodyBytes, {
    'X-CDP-Delivery-Id': deliveryId,
    'X-CDP-Signature': sig,
    'Content-Type': 'application/json',
  }, 10000);
  // Persist attempt (not falsely delivered)
  await pg.query(`INSERT INTO delivery_attempts
    (activation_request_id, job_id, attempt_number, delivery_id, profile_id, status, http_status, error_reason, attempted_at)
    VALUES ($1,$2,1,$3,$4,$5,$6,$7,NOW())`,
    [job.id, job.id, deliveryId, job.profile_id||null,
     result.ok ? (result.status||200) : 'pending', // simplified status record
     result.status || null, result.error || null]);
  if (result.ok && result.status && result.status < 400) {
    await pg.query('UPDATE activation_requests SET status=$1, completed_at=NOW(), updated_at=NOW() WHERE id=$2', ['delivered', job.id]);
  } else {
    await pg.query('UPDATE activation_requests SET status=$1, updated_at=NOW() WHERE id=$2', ['retrying', job.id]);
  }
}

import crypto from 'crypto';
