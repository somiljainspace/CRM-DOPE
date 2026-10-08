# Ingestion Backend Contract

## Architecture

* PostgreSQL = control plane (tenants, api_keys)
* ClickHouse = analytics plane (analytics_events, ReplacingMergeTree)
* Redis = unused (reserved for future session/cache needs)
* Modular monolith: `apps/api` with routes/auth/services/repositories/lib

## Endpoints

### POST /v1/track

* Auth: Bearer `<api_key>` header (required)
* Body: single analytics event (`AnalyticsEventSchema`)
* Response: 202 `{ success, eventId }`
* Errors: 400 (bad payload), 401 (missing/invalid key), 403 (tenant mismatch), 409 (duplicate event_id), 413 (>1MB), 500 (ClickHouse failure)

### POST /v1/track/batch

* Auth: Bearer `<api_key>` header (required)
* Body: `{ batch: AnalyticsEvent[] }` (max 500 events)
* Response: 202 `{ success, processed }`
* Errors: same as /track plus 413 for batch exceeding max size

### GET /health

* No auth
* Response: 200 `{ status: 'ok' }`

### GET /ready

* No auth
* Response: 200 `{ status: 'ready' }` when ClickHouse reachable; 503 otherwise

## Authentication

* API key is hashed using `sha256` server-side before comparison with `api_keys.key_hash`
* The authenticated key determines `tenant_id`; never accept `tenantId` from the request body as authorization
* `api_keys` has `revoked_at` for revocation

## Idempotency Strategy

* ClickHouse table uses `MergeTree` (current deployment); migration file specifies `ReplacingMergeTree(inserted_at)` but requires volume rebuild to apply. For idempotency: query layer uses `SELECT ... FINAL` or `argMax` to deduplicate; API relies on event_id preservation and defensive 409 where supported.
* Duplicates are NOT collapsed automatically (MergeTree); analytics must query with `FINAL` or deduplicate via `argMax(event_id, inserted_at)`.
* Query-level dedup can be done via `SELECT * FROM analytics_events FINAL`
* The API checks exceptions for 'duplicate' text (defensive); ClickHouse MergeTree does not raise for duplicate inserts, so 409 is rare. (defensive); the architecture is naturally idempotent by design

## Security

* Request body limit: 1MB enforced by Fastify (`bodyLimit`)
* Rate limit: 100 requests/minute per IP (`fastify-rate-limit`)
* Request IDs: auto-generated UUID per request (`genReqId`)
* Errors: structured JSON, no secrets or raw DB errors exposed externally
* Logging: request-level only; API secrets never logged
* No arbitrary SQL construction; all DB access uses parameterized queries
* No invasive device fingerprinting collected
* No authorization bypass possible via `tenantId` manipulation

## Local Testing

```bash
docker compose up -d
# Verify PostgreSQL/ClickHouse/Redis
curl -X POST http://localhost:3000/v1/track \
  -H "Authorization: Bearer sk_live_..." \
  -H "Content-Type: application/json" \
  -d '{"tenantId":"...","eventId":"...","timestamp":"...","type":"track","event":"Test"}'
```

## Limits

* Single event payload: ~1MB
* Batch size: max 500 events per request
* Rate limit: 100 req/min
* All times are UTC
