# Analytics Engine Specification (Phase 4A)

Read-only product analytics over the ClickHouse `events.analytics_events` table.
All metrics are tenant/project/environment scoped, UTC-based, and deduplicated.

## Authorization

Every endpoint requires a valid platform session (`requirePlatformSession`) and the
`member:read` permission on the requested `workspaceId`. The tenant boundary is
derived server-side from the workspace (`getTenantForWorkspace`); client-supplied
tenant IDs are never trusted for authorization. Cross-workspace and cross-tenant
access is rejected.

## Common constraints

- Time ranges are UTC ISO-8601 strings and must be bounded (max 90 days).
- `analytics_events` is a `ReplacingMergeTree(inserted_at)`. Duplicate
  `(tenant_id, event_id)` pairs are collapsed asynchronously; all analytics
  queries use `FINAL` to force deterministic deduplication at query time.
- Identity normalization: `COALESCE(user_id, anonymous_id)` is the analytics
  identity key. Anonymous visitors count once per `anonymous_id`; identified
  users count once per `user_id`.
- Known limitation: historical events emitted *before* an anonymous→identified
  merge keep their original `anonymous_id`, so cross-identity deduplication
  depends on an ingestion-time canonical `profile_id` (documented follow-up).
- Pagination is clamped to `[1, 100]` rows per page with a non-negative offset.

## 1. Event Trends

`GET /v1/control/analytics/trends`

Inputs (query): `workspaceId` (uuid, required), `startDate`, `endDate`
(ISO-8601), `interval` (`hour` | `day`), `eventName` (optional filter).

Output: `{ trends: [{ time_bucket: string, event_count: string }] }`
buckets are UTC labels (`YYYY-MM-DD HH:00:00` for hours, `YYYY-MM-DD 00:00:00`
for days), ascending.

Calculation: `count()` of deduplicated events per bucket, optionally filtered by
`event_name`.

## 2. Active Users (DAU / WAU / MAU)

`GET /v1/control/analytics/active-users`

Inputs (query): `workspaceId`, `startDate`, `endDate`, `period`
(`day` | `week` | `month`).

Output: `{ activeUsers: [{ time_bucket: string, unique_users: string }] }`
ascending.

Calculation: `uniqExact(COALESCE(user_id, anonymous_id))` per bucket.
Limitation: counts distinct event identities, not merged customer profiles
(see identity limitation above).

## 3. Event Explorer

`GET /v1/control/analytics/events`

Inputs (query): `workspaceId`, `startDate`, `endDate`, `eventName`
(optional), `limit` (1–100, default 25), `offset` (≥0, default 0).

Output: `{ events: [...] }` ordered `timestamp DESC, event_id DESC` for stable
pagination.

## 4. Funnels

`POST /v1/control/analytics/funnels`

Inputs (body): `workspaceId` (query), `startDate`, `endDate`,
`steps: string[]` (2–5 event names).

Output: `{ funnel: [{ level: string, count: string }] }` where `level` is the
number of steps reached (1..N).

Calculation: `windowFunnel` over `toDateTime(timestamp)` grouped by
`COALESCE(user_id, anonymous_id)`, within a fixed 7-day (604800s) conversion
window. Ordered, first-match semantics; repeated events after a step do not
re-open the funnel.

## 5. Retention

`POST /v1/control/analytics/retention`

Inputs (body): `workspaceId` (query), `startDate`, `endDate`,
`entryEvent`, `returningEvent`.

Output: `{ retention: [{ cohort_date: string, day_offset: string, users_count: string }] }`

Calculation: users first performing `entryEvent` define the cohort
(`min(toDate(timestamp))`); `day_offset = toDate(returningEvent) - cohort_date`
for users who later perform `returningEvent`. Daily model only.
Limitation: counts distinct event identities, not deduplicated merged profiles.

## 6. Cohorts (Read-Only)

The cohort builder is intentionally **not** exposed as an arbitrary query
endpoint in Phase 4A. Ad-hoc cohort exploration is available by combining the
Event Explorer (`/v1/control/analytics/events`) with event-name and time-range
filters. Saved cohorts and a segmentation engine are explicitly out of scope
for this phase. Any future cohort endpoint must accept a structured, allowlisted
condition schema and never raw SQL.

## Performance & limits

- `FINAL` deduplication trades query cost for correctness; it is required
  because `event_id` presence alone does not prevent double counting until
  background merges complete.
- ClickHouse `max_execution_time` and result-size limits apply server-side.
- No Redis caching, Kafka, queues, or background workers were introduced.

## Roles & permissions

`member:read` is required for all analytics endpoints (OWNER, ADMIN, ANALYST,
DEVELOPER, VIEWER). Least-privilege `analytics:read` is tracked as a follow-up
once saved cohorts/campaigns require separation from workspace administration.
