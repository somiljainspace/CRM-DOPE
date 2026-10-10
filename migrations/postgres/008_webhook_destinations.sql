-- Webhook destinations (Phase 6A activation foundation)
CREATE TABLE IF NOT EXISTS webhook_destinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  environment_id UUID REFERENCES environments(id) ON DELETE SET NULL,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  signing_secret_encrypted BYTEA NOT NULL,
  signature_version INTEGER NOT NULL DEFAULT 1,
  created_by UUID REFERENCES platform_users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT webhook_dest_name_unique UNIQUE (tenant_id, workspace_id, name)
);
CREATE INDEX IF NOT EXISTS idx_webhook_dest_tenant ON webhook_destinations(tenant_id, enabled);
CREATE INDEX IF NOT EXISTS idx_webhook_dest_workspace ON webhook_destinations(workspace_id);
-- Consent records (default deny)
CREATE TABLE IF NOT EXISTS consent_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES customer_profiles(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('granted','withdrawn')),
  source TEXT,
  policy_version TEXT,
  granted_at TIMESTAMP WITH TIME ZONE,
  withdrawn_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES platform_users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT consent_profile_purpose_unique UNIQUE (tenant_id, profile_id, purpose)
);
CREATE INDEX IF NOT EXISTS idx_consent_profile ON consent_records(tenant_id, profile_id, status);
