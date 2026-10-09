# Session Tracking (Phase 3B)

- `sessionId` added to event schema and ClickHouse `analytics_events`.
- Generated via `crypto.randomUUID()` after consent enabled.
- Session derived from ClickHouse events: group by tenant/project/env/sessionId.
- Timeout: 30-minute inactivity default (documented, not enforced by server state store).
- No cookie/persistent device identifier required.
