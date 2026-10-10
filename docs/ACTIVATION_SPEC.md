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
