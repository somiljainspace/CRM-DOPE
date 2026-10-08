# Small Marketplace CDP - Architecture

## Overview

The Small Marketplace CDP is a self-hostable CDP + lightweight CRM/engagement platform designed for small marketplaces. It uses a multi-plane architecture for separation of concerns.

## Core Architecture

### Control Plane (PostgreSQL)
- **Purpose**: Manage metadata, configuration, and business data
- **Database**: PostgreSQL with tenant-scoped tables
- **Tables**:
  - `tenants`: Stores marketplace/tenant information
  - `users`: User accounts scoped to tenants
  - `workspaces`: Organization units within tenants
- **Relationships**: All customer data is tenant-scoped with foreign key constraints

### Event/Analytics Plane (ClickHouse)
- **Purpose**: High-performance event storage and analytics
- **Database**: ClickHouse with append-oriented schema
- **Table**: `events.analytics_events`
- **Characteristics**:
  - Append-only (MergeTree engine)
  - Partitioned by month
  - Ordered by (tenant_id, timestamp, event_name)
  - JSON string columns for flexibility

### Optional Infrastructure (Redis)
- **Purpose**: Used only where cache/invalidation is justified
- **Not required** for core functionality
- Used optionally for session management or caching

## Data Flow

1. **Event Capture**: Frontend sends events via API (track, identify, page)
2. **Validation**: Events validated using Zod schemas (tenant-scoped, idempotent)
3. **Storage**: 
   - Business data → PostgreSQL
   - Raw events → ClickHouse
4. **Analytics**: Queries run against ClickHouse for reporting
5. **Control**: Management operations via PostgreSQL

## Key Design Decisions

### Tenant Scoping
- All customer data is automatically tenant-scoped
- No cross-tenant data leakage
- Foreign key constraints enforce boundaries

### Event Idempotency
- Event IDs use UUID for deduplication
- ClickHouse can detect duplicates by event_id

### Append-Oriented Events
- Raw events are never updated
- Historical data integrity preserved
- Analytics based on complete event history

### Security
- No arbitrary SQL execution from frontend
- No invasive device fingerprinting
- Sensitive data filtered from logs
- All data access goes through controlled API layer

## Deployment

### Local Development
```bash
docker compose up -d
```

### Production Considerations
- Use managed PostgreSQL/ClickHouse services
- Redis optional, deploy only if needed
- Proper backup strategies for both databases
- Connection pooling for PostgreSQL
- Replication for ClickHouse if needed

## API Layer

Future implementation will include:
- REST API endpoints for event ingestion
- GraphQL for flexible querying
- WebSocket for real-time updates
- Authentication/authorization

## Security & Privacy

Reference `docs/SECURITY_PRIVACY.md` for detailed security policies.

## Scaling

For small marketplaces, the current architecture scales horizontally by:
- Adding more ClickHouse replicas for read-heavy workloads
- Using read replicas for PostgreSQL
- Caching strategies with Redis where needed

## References
- `docs/DATA_MODEL.md`: Detailed data model
- `docs/EVENT_SCHEMA.md`: Event definitions
- `docs/SECURITY_PRIVACY.md`: Security policies
