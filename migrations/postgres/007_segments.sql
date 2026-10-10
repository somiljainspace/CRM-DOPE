CREATE TABLE IF NOT EXISTS segments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  environment_id UUID NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  definition_json JSONB NOT NULL DEFAULT '{}',
  definition_version INTEGER NOT NULL DEFAULT 1,
  created_by UUID REFERENCES platform_users(id),
  updated_by UUID REFERENCES platform_users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX idx_segments_unique_scope_name ON segments (tenant_id, project_id, environment_id, name);
CREATE INDEX idx_segments_tenant ON segments (tenant_id);
CREATE INDEX idx_segments_project ON segments (project_id);
CREATE INDEX idx_segments_env ON segments (environment_id);
CREATE INDEX idx_segments_version ON segments (definition_version);
