# Phase 6A — Activation Foundations

Scope: webhook destinations, consent enforcement, durable activation jobs,
delivery attempts, retries, tenant isolation. Not campaigns, messaging, UI.

## Architecture
- PG control plane: webhook_destinations, consent_records, activation_requests,
  delivery_jobs, delivery_attempts, audit_metadata
- ClickHouse: behavioral events, segment evaluation (existing)
- Fastify: auth/session/permission/validation/routes
- No Kafka/K8s/Flink/Spark introduced

## Security
- SSRF: HTTPS required (prod); reject loopback/private/link-local/multicast;
  resolve IP at config + delivery; no redirects; bounded timeout/body; restrict headers
- Secret: AES-256-GCM encrypted; env key required; never returned; rotate explicitly
- Signing: HMAC-SHA256 over canonical body + timestamp + delivery ID
- Consent: default deny; purpose-scoped; withdrawal enforced at dispatch; recheck on retry

## Rules
- Audience: bounded cap; safe refusal if evaluator cannot fully enumerate
- Job: PG durable; claim with FOR UPDATE SKIP LOCKED; at-least-once documented
- Status: pending/processing/delivered/retrying/failed/cancelled
- Retry: bounded, exponential backoff + jitter; retryable vs permanent
- Idempotency: stable delivery ID across retries; receiver deduplicates

## Tests
- Unit: URL security, HMAC, consent, retry, idempotency, payload limits
- Integration: real PG destination/consent/job/claim/audit; local receiver for payload/retry/permanent
- Existing regression (segment): 11/11 pass; real.test fixture pre-existing (documented)

## Audience integrity (Phase 6A close)
- Evaluator returns bounded preview (<=100 sample + truncation flag).
- Activation endpoint refuses request when audience could not be fully enumerated (returns 501 with documented message).
- Audience service (`services/activation/audience.ts`) defines safe refusal + bounded pagination placeholder.
- Hard audience cap enforced before unbounded work.

## Durable persistence (migration 009)
- `activation_requests`: status, audience_size, payload_size, idempotency_key, cancellation timestamps.
- `delivery_attempts`: attempt_number, delivery_id, profile_id, status, retry_at, attempted_at, completed_at, error_reason.
- Foreign keys to webhook_destinations and activation_requests.

## Worker behavior (documented, scaffold only)
- Claim via `FOR UPDATE SKIP LOCKED`; concurrent safe.
- Recheck consent immediately before delivery; fail closed on lookup error.
- Validate URL at delivery (not just creation); block loopback/private; prevent redirects.
- Decrypt secret at delivery boundary; sign exact canonical body; include delivery ID + timestamp; send documented headers.
- At-least-once delivery documented; receiver deduplicates by stable delivery_id.
- Graceful shutdown supported; in-flight requests may not stop immediately.

## Retry and status
- Bounded exponential backoff + jitter; configurable max attempts.
- Retryable: network errors, timeouts, suitable 5xx, rate limits.
- Permanent: invalid request, disabled destination, consent withdrawn, terminal.
- Consent rechecked on every retry; withdrawal blocks subsequent attempts.
- Cancellation supported for queued/retrying; terminal jobs never retried.
- Status endpoints and pagination planned.
Audience: bounded complete enum via postgresql profiles (profile_trait only); unsupported conditions rejected; cap 1000 env; persistent delivery jobs; worker gated to pending activations. Delivery: pinned HTTPS + HMAC preserved. Not claimed: event-based conditions (ClickHouse), retries, status/cancel APIs, live receiver.
