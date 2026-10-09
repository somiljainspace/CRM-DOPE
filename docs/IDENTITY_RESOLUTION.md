# Identity Resolution (Phase 3B)

- Scope: tenant/project/environment.
- Anonymous + user both present → merge anonymous profile into identified profile; update identity mappings.
- Concurrent requests handled via DB uniqueness + BEGIN/COMMIT.
- No graph DB, fingerprinting, or ML matching used.
- Traits merged with COALESCE, not overwritten arbitrarily.
