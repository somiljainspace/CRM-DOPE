# Data Model

This document defines the data model for the Small Marketplace CDP platform.

## Overview

The data model separates business data (managed by PostgreSQL) from event data (managed by ClickHouse). This separation provides the right balance of transactional integrity for business operations and high-performance analytics for event data.

## PostgreSQL (Control Plane)

### Tenants

**Purpose**: Represents marketplace or customer data scope

**Table**: `tenants`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT `uuid_generate_v4()` | Unique tenant identifier |
| `name` | VARCHAR(255) | NOT NULL | Tenant/display name |
| `created_at` | TIMESTAMP WITH TIME ZONE | DEFAULT `CURRENT_TIMESTAMP` | Record creation time |
| `updated_at` | TIMESTAMP WITH TIME ZONE | DEFAULT `CURRENT_TIMESTAMP` | Record last update time |

**Relationships**:
- One tenant has many `users`
- One tenant has many `workspaces`

### Users

**Purpose**: User accounts within tenants

**Table**: `users`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT `uuid_generate_v4()` | Unique user identifier |
| `tenant_id` | UUID | NOT NULL, FOREIGN KEY `tenants(id)` ON DELETE CASCADE | Tenant ownership |
| `email` | VARCHAR(255) | NOT NULL | User's email address |
| `created_at` | TIMESTAMP WITH TIME ZONE | DEFAULT `CURRENT_TIMESTAMP` | Record creation time |
| `updated_at` | TIMESTAMP WITH TIME ZONE | DEFAULT `CURRENT_TIMESTAMP` | Record last update time |

**Constraints**:
- UNIQUE (`tenant_id`, `email`): One user per email per tenant
- Indexed on `tenant_id` for efficient filtering

### Workspaces

**Purpose**: Organizational units within tenants

**Table**: `workspaces`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT `uuid_generate_v4()` | Unique workspace identifier |
| `tenant_id` | UUID | NOT NULL, FOREIGN KEY `tenants(id)` ON DELETE CASCADE | Tenant ownership |
| `name` | VARCHAR(255) | NOT NULL | Workspace/display name |
| `created_at` | TIMESTAMP WITH TIME ZONE | DEFAULT `CURRENT_TIMESTAMP` | Record creation time |

**Relationships**:
- One workspace has many users (through `tenant_id`)
- Indexed on `tenant_id` for efficient filtering

## ClickHouse (Event/Analytics Plane)

### Analytics Events

**Purpose**: High-performance event storage and analytics

**Table**: `events.analytics_events`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `tenant_id` | UUID | - | Tenant ownership for isolation |
| `event_id` | UUID | - | Unique event identifier (idempotency) |
| `event_type` | String | - | Event type (track, identify, page) |
| `event_name` | String | - | Event name (e.g., "User Signed Up") |
| `timestamp` | DateTime64(3, 'UTC') | - | Event timestamp with millisecond precision |
| `user_id` | Nullable(String) | - | User identifier (may be null for anonymous) |
| `anonymous_id` | Nullable(String) | - | Anonymous user identifier |
| `properties` | String | - | JSON string of event properties |
| `context` | String | - | JSON string of event context |
| `inserted_at` | DateTime | DEFAULT `now()` | When event was inserted |

**Indexing Strategy**:
- **Partition**: `toYYYYMM(timestamp)` - Monthly partitions for time-based queries
- **Order**: `(tenant_id, timestamp, event_name)` - Supports common analytics queries
- **TTL**: Configurable for data retention

**Engine**: MergeTree (append-only, high-performance)

## Data Relationships

### Cross-Plane Relationships

**Tenant Linking**:
- **PostgreSQL**: Primary source of truth for tenants, users, workspaces
- **ClickHouse**: Events linked by `tenant_id` for analytics
- **Usage**: Analytics queries join with PostgreSQL for user/workspace data

**User Linking**:
- **PostgreSQL**: User identity and attributes
- **ClickHouse**: Event context includes `user_id` for user-centric analytics
- **Anonymity**: Users may have only anonymous_id for privacy

### Referential Integrity

**PostgreSQL Constraints**:
- **Foreign Keys**: Enforce referential integrity
- **Cascading Deletes**: When a tenant is deleted, all related data is cleaned up
- **Unique Constraints**: Prevent duplicate user emails within tenants

**ClickHouse Flexibility**:
- **No Foreign Keys**: Performance optimization for analytics
- **Denormalization**: Common query patterns pre-computed
- **Append-Only**: Historical data integrity preserved

## Data Access Patterns

### Business Operations (PostgreSQL)

**Read Operations**:
- Get tenant details by ID
- List users for a tenant
- Get user details
- Get workspace information

**Write Operations**:
- Create tenant
- Update user profile
- Create workspace
- Manage user roles

### Analytics (ClickHouse)

**Event Storage**:
- Events inserted as-is from API
- Validation occurs at ingestion
- JSON properties stored as string for flexibility

**Analytics Queries**:
- Time-based aggregations (daily, weekly, monthly)
- User behavior analysis
- Conversion funnel analysis
- Cohort analysis
- Segmentation queries

## Data Privacy & Security

### Tenant Isolation
- **PostgreSQL**: Foreign key constraints ensure data isolation
- **ClickHouse**: All queries automatically scoped to tenant via `tenant_id`
- **API Layer**: Authentication/authorization enforces tenant access

### Data Anonymization
- **User IDs**: May be hashed for privacy
- **IP Addresses**: May be anonymized or hashed
- **Anonymous IDs**: Used when user authentication is not required

### Data Retention
- **PostgreSQL**: Configurable retention periods
- **ClickHouse**: TTL policies for automatic data purging
- **Archives**: Long-term storage for compliance

## Data Quality

### Validation
- **Schema Validation**: Zod schemas ensure event validity
- **Business Rules**: Custom validation for specific event types
- **Tenant Scoping**: All operations scoped to authorized tenants

### Indexes
- **PostgreSQL**: B-tree indexes on primary keys and common filter columns
- **ClickHouse**: MergeTree indexes on partition and sorting keys
- ** Covering Indexes**: For common analytics queries

### Monitoring
- **Data Completeness**: Track insertion rates and completeness
- **Query Performance**: Monitor and optimize slow queries
- **Data Quality**: Alerts for anomalies or data quality issues

## Migration Strategies

### Schema Evolution
- **PostgreSQL**: Alembic-style migrations
- **ClickHouse**: Self-describing schema with forward compatibility
- **Data Synchronization**: Ensure consistency across systems

### Backward Compatibility
- **Event Schema**: New fields are optional
- **Database Schema**: Migration scripts for structural changes
- **API**: Versioned endpoints where needed

## Performance Considerations

### Read Performance
- **ClickHouse**: Optimized for analytics queries
- **PostgreSQL**: Indexed for operational queries
- **Caching**: Application and database-level caching

### Write Performance
- **ClickHouse**: High-throughput ingestion
- **PostgreSQL**: Transactional integrity
- **Batching**: Batch operations where appropriate

### Storage
- **Compression**: Columnar storage with compression
- **Partitioning**: Time-based and tenant-based partitioning
- **Archival**: Long-term storage for cold data

## References
- `docs/ARCHITECTURE.md`: System architecture overview
- `docs/EVENT_SCHEMA.md`: Event definitions and validation
- `docs/SECURITY_PRIVACY.md`: Security and privacy policies
- `docs/IMPLEMENTATION_PLAN.md`: Implementation roadmap