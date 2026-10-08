# CLAUDE.md — Open-source CDP / CRM Platform

## Mission
Build a small, production-minded, open-source customer data + engagement platform inspired by the core workflows of Braze, CleverTap, MoEngage, and PostHog, but intentionally smaller and easier to self-host.

The first customer is a small marketplace. The platform must collect first-party product events from a customer's web/mobile/backend applications, build user/device/session profiles, analyze behavior, create segments, and eventually trigger customer engagement campaigns.

## Non-goals for v1
- Do not build a full Braze clone.
- Do not build a data broker, third-party tracking network, or ad-tech identity graph.
- Do not scrape or purchase personal data.
- Do not use covert fingerprinting or attempt to identify users who have not consented where consent is required.
- Do not start with Kafka, Kubernetes, Flink, Spark, microservices, or a multi-region cluster.
- Do not add email/SMS/WhatsApp/push providers until the core event and segmentation primitives are stable.

## Product principles
1. First-party data only.
2. Explicit tenant isolation.
3. Event ingestion must be reliable before analytics are fancy.
4. Raw events are append-only; derived tables can be rebuilt.
5. Every metric must have a documented definition.
6. Privacy is a product feature, not a later patch.
7. Prefer boring, observable technology over premature distributed systems.
8. OpenTelemetry-compatible backend observability is preferred.
9. SDK calls must be cheap, asynchronous, batched, retryable, and resilient to temporary network failures.
10. Quality must not be sacrificed for token savings, but repeated context and needless work must be eliminated.

## Recommended initial architecture

Browser / mobile / customer backend
        |
        v
  Client SDK / HTTP Events API
        |
        v
  Ingestion API
  - auth / write key validation
  - schema validation
  - rate limiting
  - idempotency
  - PII policy checks
        |
        +-------------------> Postgres (control plane)
        |                      tenants, apps, users, devices,
        |                      segments, campaigns, API keys
        |
        v
  Durable event buffer / batch path
        |
        v
  ClickHouse (analytics/event plane)
  - raw events
  - sessions
  - event aggregates
  - funnels / retention queries
        |
        +----> materialized/derived profile facts
        |
        v
  Query / Segmentation API
        |
        v
  Next.js dashboard

Later:
  Segment evaluation -> campaign trigger engine -> provider adapters
  Email / push / in-app / webhook

### Initial technology choices
- Dashboard: Next.js + TypeScript + Tailwind + component library of choice.
- Core API: TypeScript + Fastify (or NestJS only if the repository already uses it).
- SDK: TypeScript browser SDK first; React Native/Android/iOS later.
- Control plane DB: PostgreSQL.
- Event analytics DB: ClickHouse.
- Cache/short-lived jobs: Redis-compatible service when actually needed.
- Object storage: S3-compatible storage; Cloudflare R2 is suitable for exports/raw archives.
- Local development: Docker Compose.
- Observability: OpenTelemetry traces/metrics/log correlation; avoid adding browser OpenTelemetry as the primary product event mechanism because browser instrumentation is still described as experimental/unspecified. Use a purpose-built product analytics SDK for product events. 

## Event flow requirements
Every event should carry enough information to reconstruct:
- tenant/workspace
- application/source
- anonymous ID
- stable user ID when known
- device ID
- session ID
- event name
- event timestamp
- received timestamp
- source SDK/API
- platform/device metadata appropriate to the integration
- event properties
- consent/privacy flags
- schema/version
- idempotency/event ID

### Identity rule
Anonymous activity may exist before login. When the customer identifies a user, the system must support deterministic identity association between the anonymous ID and the stable customer user ID. Never use an invasive fingerprint as the identity key.

### Device rule
Store a generated device/install identifier supplied by the SDK. Treat IP address, user agent, precise location, advertising IDs, and similar signals as sensitive inputs requiring documented retention and processing rules. Collect only what is necessary.

## Data model rules
Separate:
- control-plane entities: tenant, project/app, API key, user, device, campaign, segment, destination
- event-plane entities: events, sessions, event properties, aggregates

Never put a huge JSON event blob in the primary Postgres tables if it belongs in ClickHouse.
Use Postgres for consistency and configuration. Use ClickHouse for high-volume analytical event scans.

## Reliability rules
- At-least-once ingestion is acceptable for v1, but duplicate events must be safe to detect.
- Event IDs should support idempotent inserts/deduplication.
- Client SDK must batch events and retry with exponential backoff plus jitter.
- Server ingestion must validate before persistence.
- Do not lose accepted events silently.
- Never make dashboard analytics depend on synchronous writes to multiple downstream systems when a durable boundary can be used.

## Security rules
- API keys are write/read scoped and tenant scoped.
- Never store plaintext secret keys when a hash or one-time reveal is sufficient.
- Encrypt secrets at rest using the platform's secret store where possible.
- Every database query involving customer data must have an explicit tenant boundary.
- No customer can query another tenant by manipulating IDs.
- Add authorization tests for every tenant-scoped endpoint.
- Log security-sensitive actions to an audit log.

## Privacy rules
- Document what is collected by default.
- Make IP capture configurable.
- Support event/user deletion and export workflows.
- Support anonymous/identified user distinction.
- Make retention configurable by tenant in the design, even if v1 exposes only one global setting.
- Do not store passwords or authentication secrets in analytics events.
- Never encourage customers to send payment card data or government IDs as event properties.

## Engineering style
- TypeScript strict mode.
- Small modules with clear boundaries.
- Explicit schemas at API boundaries.
- No `any` unless justified in a comment.
- Prefer pure functions for event normalization and metric calculations.
- Migrations are versioned and reversible when practical.
- Business logic must be unit-testable without the network.
- Integration tests must exist for event ingestion, tenant isolation, identity merge, and segmentation.
- Keep functions short enough to reason about; do not split code just to create many files.

## Token-optimized Claude workflow
Claude should NOT repeatedly read the whole repository.

Before coding:
1. Read this file.
2. Read only the relevant spec file(s) listed in the task.
3. Inspect the smallest set of source files needed.
4. State the exact change in 1–3 bullets internally, then implement.
5. Run targeted tests first, then broader checks only when necessary.

When coding:
- Prefer `rg`, `sed -n`, and targeted file reads over dumping directories/files.
- Never paste an entire large file into chat unless needed.
- Reuse existing utilities instead of creating duplicate helpers.
- Do not refactor unrelated code.
- Do not reformat unrelated files.
- Do not regenerate lockfiles unless dependency changes require it.
- Do not add dependencies when the standard library or an existing package is sufficient.
- For repetitive operations, script them once rather than making many small edits.
- Keep summaries compact: changed files, behavior, tests, remaining risk.

After coding:
1. Run the smallest relevant test/lint/typecheck set.
2. Run the full quality gate before declaring a feature complete.
3. Review the diff for unrelated changes.
4. Check migration safety and tenant isolation.
5. Update documentation only for behavior that actually changed.

## Definition of Done
A feature is complete only when:
- happy path works
- invalid input is rejected
- tenant isolation is tested
- retries/duplicate behavior are defined
- logs/metrics are adequate
- relevant tests pass
- API/schema docs match implementation
- no secrets/PII are accidentally logged
- no unrelated refactor is included

## Required quality gate
`pnpm lint && pnpm typecheck && pnpm test && pnpm build`

If the project uses npm instead of pnpm, use the repository's existing package manager and scripts.

## Important source-of-truth documents
- `docs/ARCHITECTURE.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/EVENT_SCHEMA.md`
- `docs/DATA_MODEL.md`
- `docs/API_CONTRACTS.md`
- `docs/SDK_SPEC.md`
- `docs/ANALYTICS_SPEC.md`
- `docs/SECURITY_PRIVACY.md`
- `docs/TESTING.md`
- `docs/DEPLOYMENT_FREE_TIER.md`
- `docs/REVIEW_CHECKLIST.md`

## Build order
1. Repository skeleton + local Docker Compose.
2. Tenant/project/API-key model.
3. Browser SDK + ingestion endpoint.
4. Event validation + idempotency.
5. ClickHouse event storage + Postgres control plane.
6. Sessions + user/device/profile views.
7. Dashboard: live event stream + basic DAU/WAU/MAU + event trends.
8. Segmentation engine.
9. Funnel + retention analysis.
10. Exports and webhooks.
11. Campaign engine with one channel first.
12. Additional SDKs and channels.

Never skip ahead simply because a later feature looks more visually impressive.
