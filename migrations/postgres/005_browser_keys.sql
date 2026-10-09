-- Phase 3A: browser publishable keys + origin policy + environment binding
-- Adds environment link and allowed-origin for browser ingestion.
-- Existing secret keys (sk_) remain unchanged.

ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS environment_id UUID REFERENCES environments(id) ON DELETE SET NULL;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS key_type VARCHAR(20) NOT NULL DEFAULT 'secret' CHECK (key_type IN ('secret','browser'));
CREATE INDEX IF NOT EXISTS idx_api_keys_env ON api_keys(environment_id);

ALTER TABLE environments ADD COLUMN IF NOT EXISTS allowed_origins TEXT[] DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_env_origins ON environments USING gin(allowed_origins);
