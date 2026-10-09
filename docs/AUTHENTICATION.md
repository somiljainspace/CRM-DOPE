# Platform Authentication (Phase 2B)

## Identity Model
- platform_users (distinct from tracked end-users `users`)
- platform_sessions (token_hash, expires_at, revoked_at, user_agent, ip)
- invitations (token_hash, expires_at, accepted_at; workspace-scoped)

## Authentication Flow
- POST /v1/auth/login → validates email + argon2id password hash → creates session (hash token, store in PostgreSQL) → returns opaque bearer token (returned once, never logged, expires)
- GET /v1/auth/me → requires valid session; returns user + roles
- POST /v1/auth/logout → revokes session; deletes token_hash from DB

## Security
- Passwords hashed with argon2id (memoryCost 65536, timeCost 3, parallelism 4)
- Session tokens: cryptographically secure random, hashed in DB, only plain at creation
- Generic errors: never disclose whether account exists
- Rate limiting recommended (not fully implemented yet)
- No social/SSO/OAuth yet
- No multi-factor yet

## Team / Membership
- Roles: OWNER, ADMIN, ANALYST, DEVELOPER, VIEWER
- Ownership protected: last OWNER cannot be demoted/removed
- Admin cannot promote self to OWNER
- Invitations single-use, expiring, hashed; secret returned once to authorized admin for manual delivery (no email provider configured)

## Bootstrap
- scripts/bootstrap-owner.sh requires BOOTSTRAP_TENANT_ID, EMAIL, PASSWORD (explicit env, not hardcoded; password never logged)
- Refuses re-run if owner exists; no public registration

## Limitations
- No dashboard login UI yet
- Session tokens returned only via API (not browser localStorage by design; document tells clients to handle securely)
- Email delivery not configured
- No Redis session store needed; PostgreSQL sufficient
- Control-plane routes currently fail-closed until platform session auth completes integration (routes return 501 with documentation link)

## Distinction
- Ingestion API keys (`api_keys`) = customer application authentication
- Platform session = operator authentication
- Never reuse ingestion keys for admin login
