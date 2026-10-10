---
name: segmentation-spec-phase-5a
description: Phase 5A segment engine spec — structured rule language, query compiler, identity semantics, dedup, APIs
metadata:
  type: project
  phase: 5A
---

Segment model (Postgres): `segments` table — id, tenant_id, project_id, environment_id, name, description, definition_json, definition_version, created_by, updated_by, timestamps. Foreign keys to workspaces/tenants; versioned definitions; no unbounded membership list in PG.

Rule language (Zod): versioned `SegmentDefinitionSchema`; logical operators AND/OR; conditions: profile_trait (field, operator, value), event_occurrence (event_name, performed/not, window_days, property_filter), event_count (event_name, min/max, window_days), recency (last_active_days / inactive_days). Limits: max conditions 20, max window 90 days, name/property length 255, nesting depth 3.

Query compiler (server-side): validated JSON → predefined ClickHouse patterns only. Parameterized; no SQL from client; allowlisted operators (`equals`, `greater_than`, `less_than`, `contains`, `not_contains`, `performed`, `not_performed`); tenant/project/env scoping enforced; bounded execution.

Identity: resolve to `customer_profiles.id` via `customer_identities`; aliases mapped to canonical profile; historical anonymous events keep original anonymous_id (documented limitation); no fingerprinting; count = approximate when reconciliation incomplete.

Dedup: `FINAL` + `ReplacingMergeTree`; event counts use deterministic dedup; duplicate aliases don't duplicate profiles.

APIs: `POST/GET /v1/control/segments`, `GET/PUT/DELETE /v1/control/segments/:id`, `POST /v1/control/segments/:id/preview` → count + bounded sample + metadata.

Permissions: `segment:read`/`segment:write`; OWNER/ADMIN manage; ANALYST create/update if permitted; VIEWER read only if granted; never arbitrary tenant choice.

Cohorts: deferred until backend structured endpoint exists (documented).

See `docs/SEGMENTATION_SPEC.md` for full contract.
