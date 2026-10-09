-- Phase 3B: customer profiles and identity mappings
-- Tracked marketplace users are distinct from platform users.
-- Never store passwords, tokens, or payment secrets in profiles.

CREATE TABLE IF NOT EXISTS customer_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  environment_id UUID NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  anonymous_id VARCHAR(255),
  user_id VARCHAR(255),
  traits JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_profiles_tenant ON customer_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_profiles_project ON customer_profiles(project_id);
CREATE INDEX IF NOT EXISTS idx_profiles_env ON customer_profiles(environment_id);
CREATE INDEX IF NOT EXISTS idx_profiles_anon ON customer_profiles(anonymous_id);
CREATE INDEX IF NOT EXISTS idx_profiles_user ON customer_profiles(user_id);

CREATE TABLE IF NOT EXISTS customer_identities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  environment_id UUID NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES customer_profiles(id) ON DELETE CASCADE,
  identity_type VARCHAR(20) NOT NULL CHECK (identity_type IN ('anonymous_id','user_id')),
  identity_value VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, project_id, environment_id, identity_type, identity_value)
);
CREATE INDEX IF NOT EXISTS idx_identities_profile ON customer_identities(profile_id);
