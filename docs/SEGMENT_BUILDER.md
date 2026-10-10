# Segment Builder (Phase 5B)

## Overview

The segment builder provides a visual rule editor for the real, versioned
segment-definition JSON schema (`definition_version: 1`). It never generates
SQL. The backend (`apps/api/src/services/segments/definition.ts`) remains
authoritative for validation and evaluation.

## Pages

- `GET /segments` — saved-segment list + builder (create via POST).
- `GET /segments/[segmentId]?workspaceId=<uuid>` — inspect, edit (PATCH),
  preview (POST `/preview`), delete (DELETE with confirmation).

## Supported conditions

Exactly the four kinds the backend can evaluate:

| kind | fields |
|---|---|
| `profile_trait` | `field` (country, plan, purchase_count, email_domain, lifecycle_stage), `operator` (equals, not_equals, greater_than, less_than, contains), `value` |
| `event_occurrence` | `event_name`, `performed` (bool), `window_days` (1–90), optional `property_filter` |
| `event_count` | `event_name`, `count_operator` (at_least, at_most, exactly), `count`, `window_days` |
| `recency` | `type` (active_within, inactive_for), `days` (1–90) |

`operator` (AND/OR) combines conditions. Limits: max 20 conditions, max
window 90 days, name 255 chars, event name 255 chars, string values 1024
chars.

## Workflows

1. **List** — `GET /v1/control/segments?workspaceId=<uuid>&limit&offset`
   → `{segments, pagination}`.
2. **Create** — `POST /v1/control/segments?workspaceId=<uuid>` with
   `{name, description, definition}` → 201 `{segment:{id, name, definition_version}}`.
3. **Retrieve** — `GET /v1/control/segments/:segmentId?workspaceId=<uuid>`
   → `{segment}` (includes `definition_json`).
4. **Edit** — `PATCH /v1/control/segments/:segmentId?workspaceId=<uuid>`
   with `{name, description, definition}`.
5. **Preview** — `POST /v1/control/segments/:segmentId/preview?workspaceId=<uuid>`
   → `{matched_profiles, sample, evaluated_at, definition_version,
   truncated, sample_limit, note}`. Explicit action (not on keystroke);
   duplicate submission disabled while a preview is in flight.
6. **Delete** — `DELETE /v1/control/segments/:segmentId?workspaceId=<uuid>`
   with browser `confirm()`; returns to `/segments` on success.

## Authentication & permissions

- Dashboard session is an HttpOnly `cdp_session` cookie; the Next.js BFF
  proxy (`pages/api/proxy/[...path].ts`) reads it and forwards it as a
  Bearer header to `API_BASE_URL`. The token never touches browser JS.
- Proxy allowlist: `v1/auth/me`, `v1/auth/login`, `v1/auth/logout`,
  `v1/control/analytics/*`, `v1/control/segments`. CSRF/origin check on
  non-GET; 15s timeout; validated API base URL. Not a general-purpose proxy.
- Backend: `requirePlatformSession` → `requirePermission(userId, workspaceId,
  'segment:read'|'segment:write')` → `getTenantForWorkspace(workspaceId)` →
  tenant-scoped repository/evaluator.

## Tenant / scope

Every query requires a real `workspaceId` (UUID — not `"me"`). The backend
resolves the workspace to a tenant and scopes all reads/writes by
`tenant_id`. Client-supplied tenant IDs are never authorization; only the
workspace-derived tenant is used.

## Preview semantics

- `matched_profiles`: count of distinct identity keys (`COALESCE(user_id,
  anonymous_id)`), deduplicated in the evaluator.
- `sample`: up to 100 profile IDs.
- `truncated`: true when more than 100 matched (sample limited).
- Evaluator runs compiled ClickHouse SQL with `FINAL` (ReplacingMergeTree
  dedup) and parameterized bindings.

## Known limitations

- Historical anonymous events retain their original anonymous_id (documented
  in the evaluator note); previews are best-effort identity reconciliation
  and must not be quoted as exact unique-person counts.
- Preview uses a fixed date range in `evaluator.ts` (see source) — not yet
  configurable from the UI.

## Local commands

```
npm run db:up                # docker compose
cd apps/api && npm run dev   # Fastify on :3000
cd apps/dashboard && npm run dev  # Next.js on :3001
cd apps/dashboard && npm run typecheck
```

## Verification results

- Typecheck (dashboard): 0 errors (`npx tsc --noEmit`).
- Integration test (real Fastify + real Postgres + real ClickHouse):
  `apps/api/src/__tests__/integration/segments.real.test.ts` — create/retrieve
  via HTTP, invalid kind rejected (400), cross-tenant preview rejected (403).
- Preview performance: bounded local dataset; see `docs/SEGMENTATION_SPEC.md`
  for compiler/evaluator details. Measured results are recorded in the repo
  commit log / test output (not claimed beyond what tests show).

## Not implemented (do not claim)

- DOM/browser automation tests (no component test runner configured).
- Pagination UI beyond the default limit.
- Configurable preview date range.
