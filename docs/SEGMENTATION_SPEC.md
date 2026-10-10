# Segmentation Engine (Phase 5A)

## Status

Phase 5A backend complete. Rule-builder UI, saved campaign audiences, campaign automation, and delivery channels are explicitly deferred to Phase 5B+.

## Segment model

A segment is a rule-defined audience belonging to one tenant/project/environment.

PostgreSQL table `segments`:

- `id` (UUID PK)
- `tenant_id` → `tenants.id`
- `project_id` → `projects.id`
- `environment_id` → `environments.id`
- `name` (varchar 255)
- `description` (text, nullable)
- `definition_json` (jsonb, validated)
- `definition_version` (integer, default 1)
- `created_by` → `platform_users.id`
- `updated_by` → `platform_users.id`
- `created_at`, `updated_at`

Constraints:
- Unique `(tenant_id, project_id, environment_id, name)` per environment
- Index on tenant/project/environment for scoping
- Foreign keys enforce tenant/project/environment relationships

No membership table is materialized. Segments are evaluated dynamically at preview time.

## Rule language

Versioned Zod schema `SegmentDefinitionSchema` (`definition_version: 1`).

Logical structure:
- `operator`: `AND` | `OR`
- `conditions`: array of 1–20 conditions (no nested expression trees)

Condition types (allowlisted):

1. **profile_trait**
   - `field`: allowlisted trait key (e.g., `country`, `plan`, `purchase_count`)
   - `operator`: `equals` | `not_equals` | `greater_than` | `less_than` | `contains`
   - `value`: string | number | boolean (typed per field)
2. **event_occurrence**
   - `event_name` (string, ≤255 chars)
   - `performed`: boolean (true = performed, false = did not perform)
   - `window_days`: 1–90
   - optional `property_filter`: { field, operator, value } with same operator allowlist
3. **event_count**
   - `event_name`
   - `count_operator`: `at_least` | `at_most` | `exactly`
   - `count`: integer ≥ 0
   - `window_days`: 1–90
4. **recency**
   - `type`: `active_within` | `inactive_for`
   - `days`: 1–90

## Query compiler

The client sends JSON only. The server compiles validated conditions into predefined ClickHouse query patterns:

- No SQL fragments, ClickHouse functions, field names, or identifiers from the client.
- Parameterized values only; operators are allowlisted constants.
- Every query is scoped by tenant_id, project_id, environment_id (mapped from the workspace → tenant chain server-side).
- Event conditions use `FINAL` for deterministic dedup.
- Result limits: count capped; sample bounded (default 100).

## Identity semantics

- Events carry `user_id` and/or `anonymous_id`.
- Canonical identity = `customer_profiles.id`, resolved via `customer_identities` rows for the tenant/project/environment.
- Aliases (anonymous_id → user_id merges) map to one canonical profile; the same profile is never counted twice.
- Historical events recorded before an identity merge keep the original anonymous_id. These are reconciled via the `customer_identities` alias table where a mapping exists; events with no resolvable mapping are counted under their raw key and are reported as unresolved.
- Counts are reported as `matched_profiles` with `unresolved_count` metadata. Results must not be presented as exact unique-person counts.

## Event correctness

- `analytics_events` is `ReplacingMergeTree(inserted_at)`, `ORDER BY (tenant_id, event_id)`.
- Event-count conditions use `SELECT ... FROM analytics_events FINAL` so repeated physical copies of the same `event_id` are counted once.
- `FINAL` has a performance cost; queries are time-bounded.

## APIs

All routes require a platform session (`requirePlatformSession`) and explicit permission:

- `POST   /v1/control/segments` — create (requires `segment:write`)
- `GET    /v1/control/segments` — list (requires `segment:read`)
- `GET    /v1/control/segments/:segmentId` — read one (requires `segment:read`)
- `PATCH  /v1/control/segments/:segmentId` — update (requires `segment:write`)
- `DELETE /v1/control/segments/:segmentId` — delete (requires `segment:write`)
- `POST   /v1/control/segments/:segmentId/preview` — evaluate (requires `segment:read`)

Preview response:
```json
{
  "segment_id": "…",
  "definition_version": 1,
  "evaluated_at": "…",
  "matched_profiles": 42,
  "sample": ["profile-id", …],
  "sample_limit": 100,
  "unresolved_count": 0,
  "truncated": false
}
```

## Permissions

Conservative defaults based on the existing role model:
- OWNER / ADMIN: full segment CRUD + preview within their authorized workspaces.
- ANALYST: create, update, preview.
- DEVELOPER / VIEWER: read/preview only where `segment:read` is granted.

The client cannot choose an arbitrary tenant ID; tenant is derived server-side from the workspace.

## Limitations

- No saved cohort membership materialization (dynamic evaluation only).
- No campaign audiences, triggers, or delivery.
- Historical identity reconciliation is best-effort (documented above).
- `FINAL` cost on very large tables; preview is time-bounded.
- Segmentation rule-builder UI is Phase 5B.

## Tests

- Unit: definition validation, operator allowlists, limits, compiler patterns, identity normalization, permission mapping.
- Integration: CRUD, preview, dedup, merged identity dedup, cross-tenant isolation, revoked sessions, malformed/oversized definitions.
