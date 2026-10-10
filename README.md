# CRM-DOPE

An open-source, self-hostable Customer Data Platform (CDP) and lightweight CRM/engagement infrastructure for small marketplaces and products.

## What is CRM-DOPE?

CRM-DOPE is an early-stage customer data platform designed for small teams that want first-party behavioral analytics without adopting a large enterprise platform. It provides a foundation for collecting product events, storing customer data, and building the analytics and engagement workflows on top.

The basic idea:

```
Customer's product
  → SDK / HTTP Events API
  → event ingestion (auth, validation, rate limiting, idempotency)
  → customer data (PostgreSQL control plane)
  → event analytics (ClickHouse)
  → segmentation / engagement (planned)
```

It is inspired by the category of products such as Braze, CleverTap, MoEngage, and PostHog. **CRM-DOPE does not currently have the full capabilities of those products.** It is an early-stage foundation, not a complete replacement.

## Why build this?

- Enterprise CDP/CRM tools are complex and expensive for small businesses
- Small marketplaces need a simpler, self-hosted system
- First-party data ownership and privacy by design
- Lightweight, boring infrastructure (PostgreSQL + ClickHouse + Redis)
- Developer-friendly HTTP API and shared TypeScript SDK schema
- Open source and self-hostable

## Current Status

**Early-stage.** The ingestion foundation (Phase 1) and control-plane data model (Phase 2A) are implemented. Dashboards, SDKs, segmentation, campaigns, and engagement channels are **not yet built**.

### Implemented

- Docker Compose development infrastructure (PostgreSQL 15, ClickHouse 23.8, Redis 7)
- PostgreSQL control plane foundation (tenants, workspaces, projects, environments, API keys, users, memberships, audit log)
- ClickHouse event storage (`ReplacingMergeTree(inserted_at)`, `ORDER BY (tenant_id, event_id)`)
- Shared TypeScript event schema (`@cdp/event-schema` with Zod validation)
- Event ingestion API: `POST /v1/track`, `POST /v1/track/batch`
- Health/readiness endpoints: `GET /health`, `GET /ready`
- Bearer API-key authentication (SHA-256 hashed keys, no plaintext secrets)
- Tenant isolation on every database query
- Event idempotency via `event_id` + ReplacingMergeTree deduplication
- Zod request validation, rate limiting, body limits, request IDs
- Control-plane hierarchy: Organization/Tenant → Workspace → Project → Environment → API Key
- Role model: OWNER, ADMIN, ANALYST, DEVELOPER, VIEWER (data model only)

### Implemented (Phase 3A)

- Browser SDK (`packages/browser-sdk/`) with consent, batching, identity
- Publishable browser keys (`pk_`) with origin policy and revocation

### Implemented (Phase 3B)

- Identity resolution service (`/v1/identify`) with deterministic anonymous→identified merge
- Profile read APIs with alias expansion and session tracking (sessions, device profiles)

### Implemented (Phase 4A)

- Product Analytics Engine (read-only): `/v1/control/analytics/trends|active-users|events|funnels|retention`
- FINAL-based dedup on ClickHouse, server-derived tenant scoping, pure calculation helpers
- Documented contracts in `docs/ANALYTICS_SPEC.md`

### Implemented (Phase 4B)

- Dashboard (`apps/dashboard/`): Next.js 13.5 + TypeScript + Tailwind + recharts, light theme
- BFF auth (HttpOnly `cdp_session` cookie) + allowlisted analytics proxy with CSRF/origin protection
- Screens: Overview, Trends, Active Users, Event Explorer, Funnels, Retention — all wired to real Fastify API
- No saved-cohort UI (deferred: backend lacks structured cohort-query endpoint)
- See `docs/DASHBOARD.md`

Not Yet Implemented (Deferred)

- Mobile SDKs
- Segmentation engine, campaign automation, engagement channels (email/SMS/push/webhook)
- CRM features, AI features
- Saved cohorts (needs backend cohort endpoint)

## Architecture

This platform includes activation foundations (Phase 6A): webhook destinations with SSRF-resistant URL validation, AES-256-GCM encrypted signing secrets, HMAC-SHA256 payload signing, explicit consent management with default-deny behavior, durable PostgreSQL delivery jobs with bounded retries, and tenant-isolated activation APIs. See docs/ACTIVATION_SPEC.md.

```
Browser / mobile / customer backend
        |
        v
  Client SDK / HTTP Events API
        |
        v
  Ingestion API (Fastify + TypeScript)
        |
        +--> PostgreSQL (control plane: tenants, workspaces, projects, environments, API keys, users)
        |
        v
  ClickHouse (event plane: raw events, analytics)
        |
        v
  Query / Segmentation API (planned)
        |
        v
  Next.js dashboard (implemented in Phase 4B — see apps/dashboard/)
```

## Quick Start

### Prerequisites

- Node.js 20+
- Docker Desktop (for local PostgreSQL/ClickHouse/Redis)
- npm

### 1. Install dependencies

```bash
npm install
```

### 2. Start infrastructure

```bash
npm run db:up
```

This starts PostgreSQL (host port `5433`), ClickHouse (`8123`), and Redis.

### 3. Run migrations

Apply PostgreSQL schema:

```bash
psql -h localhost -p 5433 -U postgres -d cdp_crm -f migrations/postgres/001_initial_schema.sql
psql -h localhost -p 5433 -U postgres -d cdp_crm -f migrations/postgres/002_control_plane.sql
```

Apply ClickHouse schema:

```bash
curl "http://localhost:8123/?query=$(cat migrations/clickhouse/001_events_table.sql)"
```

### 4. Run the API

```bash
cp .env.example .env
cd apps/api
npm run dev   # or: npx ts-node src/index.ts
```

The API listens on port `3000`.

### 5. Verify

```bash
curl http://localhost:3000/health
curl http://localhost:3000/ready
```

## API Overview

### Event Ingestion

```bash
curl -X POST http://localhost:3000/v1/track \
  -H "Authorization: Bearer sk_test_..." \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "<tenant-uuid>",
    "eventId": "<uuid>",
    "timestamp": "2026-10-09T00:00:00.000Z",
    "type": "track",
    "event": "order_completed",
    "userId": "user-123",
    "properties": {"value": 100}
  }'
```

- `POST /v1/track` — single event (202 Accepted)
- `POST /v1/track/batch` — batch events (`{"batch": [...]}`)
- Duplicate `event_id` → `409 Conflict`
- Invalid payload → `400 Bad Request`
- Invalid API key → `401 Unauthorized`
- Tenant mismatch → `403 Forbidden`

### Health

- `GET /health` — liveness (no auth)
- `GET /ready` — readiness (no auth)

## Project Structure

```
crm-dope/
├── apps/
│   └── api/                  # Fastify ingestion API
│       └── src/
│           ├── routes/       # /v1/track, /health, /ready
│           ├── services/     # business logic
│           ├── repositories/ # PostgreSQL + ClickHouse access
│           ├── auth/         # Bearer API-key auth
│           ├── config/       # environment configuration
│           └── lib/          # errors, utilities
├── packages/
│   └── event-schema/         # shared Zod event schema (@cdp/event-schema)
├── migrations/
│   ├── postgres/             # 001_initial_schema, 002_control_plane
│   └── clickhouse/           # events table (ReplacingMergeTree)
├── docs/                     # architecture, data model, ingestion, security
├── docker-compose.yml
└── .env.example
```

## Security & Privacy

- API keys are stored as SHA-256 hashes; raw secrets are never persisted
- Every database query has an explicit tenant boundary
- Parameterized queries only (no string-built SQL)
- No secrets or PII in logs
- Request IDs for correlation
- Rate limiting and body-size limits
- No invasive device fingerprinting
- Privacy rules documented in `docs/SECURITY_PRIVACY.md`

## Development

```bash
npm run lint        # ESLint
npm run typecheck   # TypeScript strict
npm run test        # Jest (unit tests; integration tests require Docker)
npm run build       # tsc build
```

**Note:** Integration tests (`apps/api/src/__tests__/ingestion.integration.test.ts`) require live PostgreSQL and ClickHouse via Docker. When Docker is unavailable, those tests cannot execute and must not be considered passing.

## Documentation

- `docs/ARCHITECTURE.md` — system architecture
- `docs/DATA_MODEL.md` — data model
- `docs/EVENT_SCHEMA.md` — event schema
- `docs/INGESTION.md` — ingestion API and idempotency
- `docs/CONTROL_PLANE.md` — control-plane hierarchy, roles, tenant isolation
- `docs/SECURITY_PRIVACY.md` — security and privacy rules
- `docs/LOCAL_DEVELOPMENT.md` — local setup
- `docs/PHASE1_AUDIT.md` — Phase 1 audit results

## Roadmap (Build Order)

1. ✅ Repository skeleton + Docker Compose
2. ✅ Tenant/project/API-key model
3. 🔄 Browser SDK + ingestion endpoint (ingestion done; SDK pending)
4. ✅ Event validation + idempotency
5. ✅ ClickHouse event storage + Postgres control plane
6. ⬜ Sessions + user/device/profile views
7. ⬜ Dashboard: live event stream + DAU/WAU/MAU + event trends
8. ⬜ Segmentation engine
9. ⬜ Funnel + retention analysis
10. ⬜ Exports and webhooks
11. ⬜ Campaign engine (one channel first)
12. ⬜ Additional SDKs and channels

## License

Private / early-stage. See repository for details.

## Contributing

Contributions are welcome. Please read `docs/IMPLEMENTATION_PLAN.md` and `docs/REVIEW_CHECKLIST.md` before submitting changes.
