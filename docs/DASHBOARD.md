# Dashboard (Phase 4B)

Analytics dashboard for the open-source CDP/CRM (`CRM-DOPE`).

## Status

Phase 4B complete through verification; not production-ready. Cohort UI deferred.

## Architecture

- App: `apps/dashboard/` — Next.js 13.5 + TypeScript + Tailwind + recharts.
- Auth: BFF server routes (`pages/api/auth/login.ts`, `logout.ts`) set an HttpOnly `cdp_session` cookie; token never exposed to browser JS.
- Proxy: `pages/api/proxy/[...path].ts` allowlists analytics/auth paths; validates `API_BASE_URL`; applies CSRF origin checks on mutations; 15-second `AbortController` timeout.
- Data: all analytics pages call `/api/proxy/v1/control/analytics/*` with `workspaceId`; server derives tenant via `getTenantForWorkspace`.

## Startup

```bash
# From repo root (npm workspaces)
npm install        # installs @cdp/dashboard
docker compose up -d # PostgreSQL, ClickHouse, Redis
# Then start the main Fastify API (separate terminal or background)
# Then:
cd apps/dashboard
npm run dev        # port 3001
npm run build
```

Environment (optional):
- `API_BASE_URL` (default `http://localhost:3000`)

## Auth flow

1. Login POST to `/api/auth/login` → validates against Fastify `/v1/auth/login` → sets `cdp_session` cookie (HttpOnly, Path=/, Max-Age=86400, SameSite=Lax, Secure only in production).
2. Cookie forwarded to BFF proxy as `Authorization: Bearer <token>`; never sent to browser JS.
3. Logout POST to `/api/auth/logout` → calls upstream `/v1/auth/logout`, then clears cookie (`Max-Age=0`).
4. Expired/revoked upstream sessions return 401 from proxy; cookie alone does not grant access.

## Security

- No open proxy: only `v1/auth/me|login|logout` and `v1/control/analytics/trends|active-users|events|funnels|retention` allowed.
- CSRF: mutating proxy requests (POST) require `origin.host === req.host`; otherwise 403.
- No `NEXT_PUBLIC_*` exposes credentials; proxy reads cookie server-side.
- No synthetic metrics: all charts/data come from actual `/api/proxy` responses; empty-state messages instruct users to connect the SDK.

## Screens

- `/` — Overview: event trend (recharts), metric cards (sum/to date/buckets/recent), recent events table.
- `/login` — Email/password form; no default credentials shown.
- `/trends` — Date range + interval/hour/day + optional event name; chart + accessible table.
- `/active-users` — Period (DAU/WAU/MAU); identity counts reflect `COALESCE(user_id, anonymous_id)` — documented as not exact unique people.
- `/events` — Pagination (25/page), filters, expandable property rows.
- `/funnels` — Ordered steps (2–5); 7-day window; conversion/drop-off.
- `/retention` — Cohort matrix; explanation text; 7/30-day ranges.

No `/cohorts` — backend lacks structured cohort-query endpoint (`docs/ANALYTICS_SPEC.md` only defines event-filter queries).

## Data contracts (match backend)

- Trends: `GET /v1/control/analytics/trends?workspaceId&startDate&endDate&interval&eventName?` → `{trends:[{time_bucket,event_count}]}`
- Active users: `pending/period` → `{activeUsers:[{time_bucket,unique_users}]}`
- Explorer: `limit(1-100, def 25)&offset` → `{events:[...],total,limit,offset}`
- Funnel: POST `{startDate,endDate,steps[2-5]}` → `{funnel:[{level,count}]}`
- Retention: POST `{startDate,endDate,entryEvent,returningEvent}` → `{retention:[{cohort_date,day_offset,users_count}]}`

Identity semantics per `docs/ANALYTICS_SPEC.md`: `normalizeIdentity(user_id, anonymous_id)`; analytics key = `COALESCE(user_id, anonymous_id)`; historical anonymous events pre-merge keep original anonymous_id.

## Empty states (no synthetic data)

- "No events received yet" — overview
- "Connect your website using the Browser SDK" — with write-key and allowed-origin instructions
- Filter-mismatch messages on trends/explorer
- No production metrics invented

## Permissions / tenant scoping

- All analytics endpoints require `requirePlatformSession`, `requirePermission(..., 'member:read')`, `getTenantForWorkspace(workspaceId)`.
- Dashboard passes `workspaceId` through proxy; backend enforces per-workspace tenant boundary.
- Cross-tenant requests blocked by authorization layer; not solely by UI.

## Test / integration status (Phase 4B)

- Typecheck: clean (`tsc --noEmit`).
- Build: `npm run build` completes.
- Tests: basic framework present; full spec suite (login/logout/protected/proxy/auth/CSRF/filter/form/retention/empty/expiry/tenant) deferred — must be run against live Fastify + real DB.
- Integration verification (live): not fully automated; performed manually via Fastify healthcheck and endpoint inspection. DOM-level browser tests unavailable; limitation documented.
- Cohort endpoint missing — UI deferred, not faked.

## Known limitations

- Cohort screen deferred (needs backend endpoint).
- Full automated integration tests against live analytics DB deferred.
- `README.md` not fully updated (only describe what's verified in code).
- Dashboard is light theme, compact sidebar, accessible data tables; responsive verified visually, not via automated visual regression.
- Security audit is partial (cookie settings, proxy allowlist, CSRF checked; full session-revocation expiry verification against upstream requires extended live test).
