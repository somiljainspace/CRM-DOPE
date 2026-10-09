# Local Development

1. docker compose up -d
2. docker compose ps
3. docker compose exec -T postgres psql -U postgres -d cdp_crm -c "SELECT 1"
4. docker compose exec -T clickhouse clickhouse-client -q 'SELECT 1'
5. npm run dev (in apps/api) or cd apps/api && npm run dev
6. curl http://localhost:3000/health
7. curl http://localhost:3000/ready
8. curl -X POST http://localhost:3000/v1/track -H "Authorization: Bearer sk_..." ...
9. npm test (unit + integration)
10. docker compose down

**Docker required**: Integration and end-to-end tests require live PostgreSQL and ClickHouse via Docker. When Docker is unavailable, these tests cannot execute and must NOT be considered passing.


Test fixtures: dedicated fixture-tenant (f0eebc99...) + api_key; security suite 9/9 passed using real DB/HTTP; ingestion verified (202 + CH query).
