# Customer Profiles (Phase 3B)

## Model
`customer_profiles`: id, tenant/project/env FKs, anonymous_id/user_id, first/last_seen, traits (JSONB), created/updated.
`customer_identities`: profile_id + identity_type + identity_value (anonymous/user). Unique per scope.

## Identity Resolution
- Anonymous event → resolve/create anonymous profile.
- Identified event → resolve/create identified profile.
- Both present → merge anonymous into identified (transactional, deterministic, audit via identity mapping updates).
- Cross-tenant merge prevented by scope.

## Profile APIs
`GET /v1/control/profiles` (list), `GET /v1/control/profiles/:profileId` (read).
Profile events/sessions derived from ClickHouse (`ReplacingMergeTree` eventual dedup); not claimed exactly-once.
