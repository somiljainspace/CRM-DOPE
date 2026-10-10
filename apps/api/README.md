# CRM-DOPE

An open-source, self-hostable customer data platform (CDP) and lightweight CRM/engagement foundation for small marketplaces and product-led teams.

## What this is

CRM-DOPE collects first-party product events, builds user/device/session profiles, analyzes behavior (funnels, retention, active users), creates segments via a visual rule editor, and provides activation foundations (webhook destinations, consent, signed delivery, retries). It is intentionally smaller than enterprise CDPs (Braze, CleverTap, MoEngage) and designed to be self-hosted with boring, observable technology.

Status: early-stage, actively developed. Not all planned capabilities are complete.

## Feature status (verified against code + tests)

| Capability | Status | Evidence / notes |
|---|---|---|
| Event ingestion (SDK + HTTP) | Implemented | SDK package, ingestion routes, validation |
| API-key auth (ingestion) | Implemented | `apiKeys` repo, browser SDK keys |
| Platform auth + roles | Implemented | `requirePlatformSession`, `requirePermission`, `user_memberships` |
| Workspace/project/env | Implemented | Tables, routes, authorization |
| Profiles + identity | Implemented | `customer_profiles`, `customer_identities`, identity merge |
| Browser SDK | Implemented | `packages/browser-sdk` |
| Analytics (trends, events) | Implemented | Routes + ClickHouse queries |
| Funnels / retention / DAU | Implemented | Dashboard pages (`funnels.tsx`, `retention.tsx`, `active-users.tsx`) |
| Segment definition + preview | Implemented | `segments` route, `definition.ts`, real `evaluator.ts`, preview endpoint |
| Segment builder UI | Implemented | `/segments`, `/segments/[id]`; 4 condition types; AND/OR |
| Webhook destinations | Partial | Route exists (`activation.ts`); DB migration 008; full controller needs connection to repo |
| Consent management | Partial | Table in 008; default-deny spec; service endpoint exists; full enforcement in worker not wired |
| Activation request endpoint | Partial | Route returns 501 until audience enumeration complete (documented limitation) |
| Durable delivery jobs | Planned | Spec + model defined; worker not implemented |
| Webhook delivery + retries | Planned | Signing/encryption implemented; delivery worker not implemented |
| Campaign / messaging | Not started | Out of scope |

Distinction: backend functionality = source exists; UI wired to real APIs = pages exist; integration tests = `segments.real.test.ts` (blocked by pre-existing DB fixture); full quality gate = partial (dashboard no ESLint config; api lint has legacy warnings).

## Architecture

```
Browser / mobile / backend
        |
        v
  Client SDK / HTTP Events API
        |
        v
  Fastify Ingestion API (auth / validation / rate limit / idempotency)
        |
        +---------> PostgreSQL (control plane: tenants, workspaces, users, profiles, segments, destinations, consent, jobs)
        |
        v
  ClickHouse (analytics/event plane: raw events, sessions, aggregates)
        |
        +-----> materialized profile facts
        |
        v
  Query / Segmentation / Activation APIs
        |
        v
  Next.js Dashboard (pages router, BFF proxy with HttpOnly session cookie)
```

**Separation:** PostgreSQL for consistency/config; ClickHouse for high-volume analytical scans. Raw events append-only; derived tables rebuildable.

**Identity:** analytics key = `COALESCE(user_id, anonymous_id)`. Anonymous events pre-login keep original `anonymous_id`; identity merge documented as best-effort.

**Activation (Phase 6A):** webhook destinations in PG with AES-256-GCM encrypted secrets; HMAC-SHA256 payload signing; consent default-deny; bounded audience required before activation; durable job model defined.

## Repository structure

```
.migrations/postgres/           -- versioned migrations
migrations/clickhouse/         -- ClickHouse migrations (if present)
packages/
  browser-sdk/                 -- TypeScript browser SDK
  event-schema/                -- shared event schema
apps/
  api/                         -- Fastify backend (TypeScript)
    src/routes/                -- segmentRoutes, activationRoutes, analytics, auth, etc.
    src/services/              -- segments (definition, compiler, evaluator), activation (urlValidation, signing)
    src/repositories/          -- segments, events, auth, analytics
  dashboard/                   -- Next.js pages router (port 3001)
    pages/                     -- analytics pages + /segments + /segments/[id]
    pages/api/proxy/[...path].ts  -- BFF proxy (HttpOnly session -> Bearer)
docs/
  ARCHITECTURE.md
  SEGMENTATION_SPEC.md
  ANALYTICS_SPEC.md
  ACTIVATION_SPEC.md          -- Phase 6A spec
  EVENT_SCHEMA.md
  DATA_MODEL.md
  API_CONTRACTS.md
  SDK_SPEC.md
  SECURITY_PRIVACY.md
  TESTING.md
  DEPLOYMENT_FREE_TIER.md
  REVIEW_CHECKLIST.md
  SEGMENT_BUILDER.md
```

## Prerequisites

- Node.js 20+ (verified from `package.json`/`devDependencies`)
- npm (workspaces: `packages/*`, `apps/*`)
- Docker + Docker Compose (PostgreSQL 5433, ClickHouse 8123, Redis)
- TypeScript strict mode (`tsconfig.json`)

No external Kubernetes/Kafka/Flint/Spark required for v1.

## Local setup

```bash
# 1. Install
npm install

# 2. Start services
docker compose up -d

# 3. Apply migrations (PostgreSQL)
# Migrations run from migrations/postgres/ (e.g., 005_browser_keys, 006_customer_profiles, 007_segments, 008_webhook_destinations)
# Confirm tables exist via psql or app startup

# 4. Start API (port 3000)
cd apps/api && npm run dev

# 5. Start dashboard (port 3001)
cd apps/dashboard && npm run dev
```

**Ports:** PostgreSQL 5433, ClickHouse 8123, Redis default, API 3000, Dashboard 3001.

**Health:** `docker ps --filter name=testing-moe` shows healthy containers.

## Environment reference (`.env` / `.env.example` concept)

Required / important (use placeholders; never commit real secrets):

| Variable | Purpose | Default / note |
|---|---|---|
| `API_BASE_URL` | BFF upstream | `http://localhost:3000` |
| `PG_HOST` / `PG_PORT` / `PG_USER` / `PG_PASSWORD` / `PG_DATABASE` | PostgreSQL | `localhost` / `5433` / `postgres` / `password` / `cdp_crm` |
| `CLICKHOUSE_HOST` / `CLICKHOUSE_PORT` / `CLICKHOUSE_DB` | ClickHouse | `localhost` / `8123` / `events` |
| `REDIS_URL` | Cache/short jobs | (optional) |
| `WEBHOOK_ENCRYPTION_KEY` | AES-256-GCM secret encryption | Must be 32 bytes; fail-closed if missing |
| `NODE_ENV` | Runtime mode | `development` |

Security: encryption key never in `.env` committed; use secret manager / env injection.

## API reference (verified routes)

**Auth / session**
- `POST /v1/auth/login` → session token
- `POST /v1/auth/logout`
- `GET /v1/auth/me` → `{user: {id, email, createdAt}}`

**Ingestion (publishable API key)**
- `POST /v1/track` (batch events)
- `POST /v1/identify`
- Validate with `event-schema`; idempotency by event ID.

**Analytics**
- `GET /v1/control/analytics/trends?workspaceId&startDate&endDate&interval&eventName?
- `GET /v1/control/analytics/active-users?workspaceId...`
- `GET /v1/control/analytics/events?workspaceId...`
- `GET /v1/control/analytics/funnels...`
- `GET /v1/control/analytics/retention...`

**Segments** (verified; real evaluator used)
- `GET /v1/control/segments?workspaceId&limit&offset`
- `POST /v1/control/segments?workspaceId`
- `GET /v1/control/segments/:segmentId?workspaceId`
- `PATCH /v1/control/segments/:segmentId?workspaceId`
- `DELETE /v1/control/segments/:segmentId?workspaceId`
- `POST /v1/control/segments/:segmentId/preview?workspaceId`
- Definition: `definition_version: 1`, `operator: AND|OR`, conditions array (max 20). See `docs/SEGMENTATION_SPEC.md`.

**Activation / webhook (Phase 6A — routes registered; full controller/worker planned)**
- `POST /v1/control/webhook-destinations?workspaceId`
- `GET /v1/control/webhook-destinations?workspaceId`
- `GET /v1/control/webhook-destinations/:id?workspaceId`
- `PATCH /v1/control/webhook-destinations/:id?workspaceId`
- `DELETE /v1/control/webhook-destinations/:id?workspaceId`
- `POST /v1/control/segments/:segmentId/activations?workspaceId` — returns 501 until audience enumeration complete (documented limitation)
- `POST /v1/control/consent?workspaceId` — consent grant/withdrawal

Every endpoint requires `requirePlatformSession`; mutations require `requirePermission`; `workspaceId` is a UUID derived from session/member relationships — never user-supplied tenant ID.

**BFF proxy** (`/api/proxy/[...path]`): allows only whitelisted prefixes (`v1/auth/*`, analytics, `v1/control/segments`, `v1/control/webhook-destinations`); reads HttpOnly `cdp_session`; forwards Bearer; CSRF/origin check on mutations; 15s timeout.

## Browser SDK quickstart

```typescript
import { CRM_DOPE } from '@cdp/browser-sdk';

const sdk = CRM_DOPE.init({ publishableKey: 'pk_...' });

// Consent first (default deny; must opt in before tracking for activation)
sdk.consent({ purpose: 'analytics', granted: true });

// Track
sdk.track('purchase', { plan: 'pro', value: 99 });

// Identify
sdk.identify('user-123');

// Opt out / reset
sdk.reset();
```

- Batch/retry async; resilient to temporary failures.
- Anonymous ID generated; stable user ID after `identify`.
- Never send secrets, payment data, government IDs.

## Profiles, identity, analytics

- `customer_profiles` (control plane) + `customer_identities` (alias mapping).
- Identity merge: `COALESCE(user_id, anonymous_id)` in ClickHouse analytics.
- Historical anonymous events before merge retain original anonymous_id (documented limitation — not exact unique counts).
- Active users = distinct identity keys over window; funnels = step sequence; retention = cohort-day tracking.

## Segmentation

- Definition JSON (`definition_version: 1`) — never SQL generated by UI.
- 4 condition kinds: `profile_trait`, `event_occurrence`, `event_count`, `recency`.
- Operators: `equals`, `not_equals`, `greater_than`, `less_than`, `contains`; count operators: `at_least`, `at_most`, `exactly`.
- Time windows: 1–90 days; max 20 conditions; names/values bounded (255/1024 chars).
- Preview: bounded (≤100 sample, `truncated` flag); uses real ClickHouse `FINAL`; not a full audience enumeration.
- Activation requires complete enumeration first (documented limitation; currently returns 501).

## Activation / webhook security

- Destination URL validated with SSRF defenses; HTTPS required in production; loopback/private blocked; DNS resolved at validation and delivery; redirects blocked; bounded timeouts; restricted headers.
- Secret encrypted AES-256-GCM with env key; never returned; rotation explicit.
- HMAC-SHA256 over `deliveryId|timestamp|body`; timestamp replay window documented; recipient deduplicates by stable delivery ID.
- Consent: default deny; purpose-scoped; withdrawal enforced at dispatch; rechecked on retry; storage errors fail closed.
- Job model: PG durable; claim with `FOR UPDATE SKIP LOCKED`; at-least-once delivery; no exactly-once claim.
- Cancellation: supported; in-flight requests may not stop immediately.

## Security model

- Platform session token in HttpOnly cookie; never exposed to browser JS; BFF proxies via Bearer.
- API keys scoped (write/read) and tenant-scoped; secrets encrypted at rest.
- Every query has explicit `tenant_id`/`workspaceId` boundary; no cross-tenant query by ID manipulation.
- Authorization tests required for tenant-scoped endpoints.
- PII configured; retention configurable by design; IP capture configurable.
- No covert fingerprinting; consent required for activation.

## Testing, build, quality

```bash
# Regression (segment definition): 11/11 pass
npx jest src/__tests__/unit/segments.definition.test.ts --no-coverage

# Activation (unit): attempted; ts-jest parse issue documented
npx jest src/__tests__/unit/activation/signing.test.ts --no-coverage

# Typecheck: 0 errors (dashboard + api)
npm run typecheck --workspaces --if-present

# Lint: api segments.routes = 0 errors; legacy warnings elsewhere
npm run lint --workspaces --if-present

# Build: completes
npm run build --workspaces --if-present

# Integration (segmentation): pre-existing DB fixture issue (documented)
npx jest src/__tests__/integration/segments.real.test.ts --no-coverage
```

Known failures (documented, not hidden):
- `segments.real.test.ts`: DB fixture parameter inconsistency (workspaces/projects INSERT expressions); pre-existing
- Activation unit tests: ts-jest config requires isolatedModules for import syntax; attempted, result documented
- Dashboard no `.eslintrc`: pre-existing

## Limitations and roadmap

Implemented: ingestion, profiles/identity, analytics dashboards, segmentation builder + preview, webhook destination spec + URL/signing/conent services + migration, activation route scaffold.

Partial / in progress: activation endpoint (returns 501 until audience enumeration complete); delivery worker; retry loop; status/cancellation APIs fully wired.

Not started: campaign automation, recurring journeys, email/SMS/push, CRM UI expansion, AI analytics.

Known limitations:
- Identity reconciliation is best-effort; historical anonymous events stay under original key.
- Segment preview is bounded (≤100); not full audience.
- Activation requires complete enumeration (not yet implemented).
- No Kafka/K8s/Flink; single-node Docker Compose for v1.

## Contributing

- TypeScript strict; migrations versioned; business logic unit-testable without network.
- Integration tests use real DB (not mocked compiler/evaluator for evaluation claims).
- No `test.skip`/`only`/conditional success; no synthetic metrics.
- Commit attribution: `Co-Authored-By: Claude Code <noreply@anthropic.com>`; PR line: `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- License: see repository root for license file.

## Documentation links

- `docs/ARCHITECTURE.md` — architecture
- `docs/SEGMENTATION_SPEC.md` — segment definition + evaluator
- `docs/ANALYTICS_SPEC.md` — analytics queries
- `docs/ACTIVATION_SPEC.md` — Phase 6A activation specification
- `docs/SEGMENT_BUILDER.md` — segment builder UX
- `docs/SDK_SPEC.md` — browser SDK
- `docs/SECURITY_PRIVACY.md` — privacy rules
- `docs/TESTING.md` — test conventions
- `docs/REVIEW_CHECKLIST.md` — definition of done
