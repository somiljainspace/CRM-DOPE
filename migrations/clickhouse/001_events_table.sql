-- ClickHouse events table
-- Using ReplacingMergeTree to support event deduplication (idempotency)
-- based on (tenant_id, event_id). Duplicates will be collapsed asynchronously
-- during part merges, and can be deduplicated at query time using FINAL or argMax.

CREATE DATABASE IF NOT EXISTS events;

CREATE TABLE IF NOT EXISTS events.analytics_events (
    tenant_id UUID,
    event_id UUID,
    event_type String,
    event_name String,
    timestamp DateTime64(3, 'UTC'),
    user_id Nullable(String),
    anonymous_id Nullable(String),
    properties String, -- JSON string
    context String, -- JSON string
    inserted_at DateTime DEFAULT now()
) ENGINE = ReplacingMergeTree(inserted_at)
PARTITION BY toYYYYMM(timestamp)
ORDER BY (tenant_id, event_id);
