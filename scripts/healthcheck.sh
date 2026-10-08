#!/bin/bash
set -e

echo "Checking services..."

# Check PostgreSQL
if docker compose exec -T postgres pg_isready -U postgres >/dev/null 2>&1; then
    echo "✅ PostgreSQL is healthy"
else
    echo "❌ PostgreSQL is NOT healthy"
    exit 1
fi

# Check ClickHouse
if docker compose exec -T clickhouse wget --spider -q localhost:8123/ping >/dev/null 2>&1; then
    echo "✅ ClickHouse is healthy"
else
    echo "❌ ClickHouse is NOT healthy"
    exit 1
fi

# Check Redis (optional)
if docker compose exec -T redis redis-cli ping >/dev/null 2>&1; then
    echo "✅ Redis is healthy"
else
    echo "⚠️ Redis is NOT healthy (optional)"
fi

echo "All critical services are running."
