# Small Marketplace CDP - Phase 0 Implementation

## Repository Structure
- Root: Monorepo using npm workspaces.
- `/packages/event-schema`: Shared TypeScript event schema with Zod.
- `/migrations`: PostgreSQL & ClickHouse migrations.
- `/scripts`: Helper scripts (healthcheck, seed).

## Local Setup (Docker Compose)
- `docker-compose.yml` starts PostgreSQL (5432), ClickHouse (8123/9000), and Redis (6379).
- Volumes persist data in named Docker volumes.
- Health checks are built into the compose file.

## Event Schema
- Uses `zod` for runtime validation.
- Strict tenant scoping (`tenant_id` is a required UUID on all events).
- Event ID is a UUID for idempotency.
- Append-oriented raw events in ClickHouse.
- No device fingerprints.

## Database
- **PostgreSQL**: Control plane (tenants, users, workspaces). All customer data is tenant-scoped.
- **ClickHouse**: Event/analytics plane. Append-oriented events table.
- **Redis**: Optional, used only if justified.

## Quality Gates
- Lint: ESLint with TypeScript rules.
- Typecheck: TypeScript strict mode.
- Test: Jest with ts-jest.

## Security & Privacy
- No arbitrary SQL from the frontend.
- No invasive device fingerprints.
- No secrets or sensitive personal information in logs.
