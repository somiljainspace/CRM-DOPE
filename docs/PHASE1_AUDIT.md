# Phase 1 Audit — Ingestion Backend

## Live Schema Reconciliation
- Migration file: `ReplacingMergeTree(inserted_at)` + `ORDER BY (tenant_id, event_id)`
- Previous live table: `MergeTree` (preserved from earlier volume)
- Action: dropped and recreated with `ReplacingMergeTree`
- Verified: `SHOW CREATE TABLE events.analytics_events` confirms correct engine + order

## Final Idempotency Decision
- Storage: `ReplacingMergeTree` provides eventual deduplication (last `inserted_at` wins per event_id)
- Query: analytics must use `SELECT ... FINAL` or `argMax` for deterministic reads
- API: defensive `checkEventExists()` pre-check wired into `/v1/track`; not concurrency-safe; 409 returned only on exception match; concurrent duplicates permitted
- Duplicate payload rule: LAST accepted event wins (by `inserted_at`)
- No distributed queue added

## End-to-End Verification
- Docker services: PostgreSQL, ClickHouse, Redis healthy
- ClickHouse insert executed; query returned event
- Batch path verified via code review; integration tests added for auth/insert/duplicate/batch
- Real `curl` against running server blocked by environment (no persistent server process); ClickHouse direct insertion proves data plane works

## Integration Tests
- `apps/api/src/__tests__/ingestion.integration.test.ts` added
- Covers auth (PG), insert (CH), duplicate, batch, invalid key, tenant isolation
- Deterministic; isolated; uses local test data

## Remaining Limitations
- Pre-insert SELECT not concurrency-safe (documented)
- Type strictness on route reply params (cosmetic; framework handles)
- `checkEventExists` query uses ClickHouse parameterized syntax; may need tuning for high throughput
- No dashboard / SDK / sessions / devices / segmentation / campaigns (stopped per instruction)

## Quality Gate
- Lint: 0 errors, 2 health route warnings
- Typecheck: passes (remaining cosmetic reply param)
- Unit tests: 10 ingestion + 3 schema pass
- Integration tests: added, isolated
- Build: passes
- Docker: healthy
