// Phase 6A: durable worker (PostgreSQL + consent check + delivery path)
import { Pool } from 'pg';
import { validateWebhookUrl } from './urlValidation';
import { checkConsent } from './consent';

export async function runWorker(pg: Pool, workerId: string): Promise<void> {
  // Claim: FOR UPDATE SKIP LOCKED (placeholder — requires full job/attempt tables)
  // Before any delivery: validate destination URL (HTTPS, not loopback/private),
  // decrypt secret, check consent (default deny, fail-closed), sign payload,
  // send with timeout, record attempt, retry if retryable, cancel if cancelled.
  // Documented at docs/ACTIVATION_SPEC.md; implementation requires complete
  // job/attempt persistence and outbound HTTP transport (not fully wired in this pass).
}

export async function claimJobs(pg: Pool, workerId: string, limit = 5): Promise<any[]> {
  // Placeholder for real FOR UPDATE SKIP LOCKED claim on activation_requests/delivery_attempts
  return [];
}
