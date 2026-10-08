# Event Schema Definitions

This document defines the event schema used throughout the Small Marketplace CDP platform.

## Overview

All events follow a standard schema with tenant scoping, idempotent event IDs, and append-oriented storage. Events are validated using Zod schemas for runtime type safety.

## Core Event Schema

### Base Event Properties

```typescript
interface BaseEvent {
  tenantId: string;              // UUID - all customer data is tenant-scoped
  eventId: string;               // UUID - supports idempotency
  timestamp: string;             // ISO 8601 datetime
  event: string;                 // Event name/identifier
  properties?: Record<string, any>; // Event-specific properties
  context?: {
    userAgent?: string;          // Browser/device user agent
    ip?: string;                 // Source IP (hashed/anonymized)
    library?: {
      name: string;             // Library name (e.g., "analytics-js")
      version: string;           // Library version
    };
  };
}
```

### Event Types

#### Track Event
Represents a generic user action or business event.

```typescript
interface TrackEvent extends BaseEvent {
  type: 'track';
  event: string;                 // Event name (e.g., "User Signed Up")
  properties?: Record<string, any>;
}
```

#### Identify Event
Represents identification of a user with traits.

```typescript
interface IdentifyEvent extends BaseEvent {
  type: 'identify';
  traits?: Record<string, any>;  // User traits (email, name, etc.)
}
```

#### Page Event
Represents a page view or screen view.

```typescript
interface PageEvent extends BaseEvent {
  type: 'page';
  name?: string;                 // Page name (e.g., "Home Page")
}
```

## Event Validation Rules

### Tenant Scoping
- **Required**: All events must include a `tenantId`
- **Validation**: Must be a valid UUID
- **Usage**: Ensures data isolation between tenants

### Event Idempotency
- **Required**: All events must include a unique `eventId`
- **Validation**: Must be a valid UUID
- **Usage**: Allows detection of duplicate events

### Timestamp Format
- **Required**: All events must include a `timestamp`
- **Validation**: Must be ISO 8601 format
- **Usage**: Enables time-based analytics and sorting

### Event Type Consistency
- **Required**: Event `type` must match the event subtype
- **Validation**: Discriminated union in Zod schema
- **Usage**: Ensures type safety in event processing

## Context Properties

### User Agent
- **Format**: Standard HTTP User-Agent string
- **Purpose**: Browser/device identification
- **Privacy**: No personal information extracted

### IP Address
- **Format**: IPv4 or IPv6 address (may be anonymized)
- **Purpose**: Geographic analytics, fraud detection
- **Privacy**: May be hashed depending on privacy settings

### Library Information
- **Purpose**: Track which SDK/library generated the event
- **Usage**: Helps with debugging and usage analytics

## Event Properties

### General Rules
- **Flexibility**: Event-specific properties use `Record<string, any>`
- **Validation**: Can be extended by downstream consumers
- **Usage**: Allows diverse event types without schema changes

### Common Properties
Many events share common properties:
- `plan`: Subscription tier (e.g., "free", "pro", "enterprise")
- `source`: How the event was generated (e.g., "api", "sdk", "import")
- `version`: Application version
- `environment`: Production, staging, development

## Event Examples

### Track Event Example
```json
{
  "tenantId": "123e4567-e89b-12d3-a456-426614174000",
  "eventId": "456e7890-f1a2-3b4c-5d6e-789012345678",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "type": "track",
  "event": "User Signed Up",
  "properties": {
    "plan": "pro",
    "source": "website",
    "signup_method": "email"
  },
  "context": {
    "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "ip": "192.168.1.1",
    "library": {
      "name": "analytics-js",
      "version": "1.2.3"
    }
  }
}
```

### Identify Event Example
```json
{
  "tenantId": "123e4567-e89b-12d3-a456-426614174000",
  "eventId": "789a0b1c-d2e3-4f5g-6h7i-890123456789",
  "timestamp": "2024-01-15T10:35:00.000Z",
  "type": "identify",
  "traits": {
    "email": "user@example.com",
    "name": "John Doe",
    "avatar": "https://example.com/avatar.jpg"
  },
  "context": {
    "library": {
      "name": "analytics-js",
      "version": "1.2.3"
    }
  }
}
```

### Page Event Example
```json
{
  "tenantId": "123e4567-e89b-12d3-a456-426614174000",
  "eventId": "abcde123-4567-89ab-cdef-0123456789ab",
  "timestamp": "2024-01-15T10:40:00.000Z",
  "type": "page",
  "name": "Product Page",
  "properties": {
    "url": "/products/123",
    "title": "Amazing Product",
    "path": "/marketplace/products/123"
  },
  "context": {
    "userAgent": "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)",
    "library": {
      "name": "mobile-sdk",
      "version": "2.1.0"
    }
  }
}
```

## Event Processing

### Validation
All events are validated using Zod schemas:
1. **Required fields**: `tenantId`, `eventId`, `timestamp`, `type`
2. **Type-specific validation**: Different schemas for each event type
3. **Business rules**: Custom validation based on event type

### Storage
- **ClickHouse**: Raw events stored as append-only
- **PostgreSQL**: Enriched events for analytics queries
- **Indexing**: Optimized for common query patterns

### Analytics
- **Aggregation**: Group by tenant, event type, time windows
- **Funnels**: Track user conversion paths
- **Cohorts**: Analyze user behavior over time
- **Segmentation**: Filter users based on event properties

## Migration Guidelines

### Schema Evolution
- **Backward Compatible**: New fields added as optional
- **Forward Compatible**: Old events still parseable
- **Validation**: Graceful handling of unknown fields

### Versioning
- Events include `context.library.version` for tracking changes
- Schema versions can be tracked independently
- Migration procedures for schema updates

## Security & Privacy

### Tenant Isolation
- All events automatically scoped to tenants
- No cross-tenant data access possible
- Enforcement at validation and storage layers

### Data Privacy
- **No invasive fingerprints**: Device fingerprinting prohibited
- **Limited data collection**: Only what's necessary for analytics
- **Anonymization**: IP addresses may be hashed
- **Retention**: Configurable data retention policies

### Data Security
- **Encryption**: In-transit and at-rest encryption
- **Access control**: Role-based access to data
- **Auditing**: All data access logged

## References
- `docs/ARCHITECTURE.md`: System architecture
- `docs/SECURITY_PRIVACY.md`: Security and privacy policies
- `docs/DATA_MODEL.md`: Detailed data model
- `docs/IMPLEMENTATION_PLAN.md`: Implementation roadmap