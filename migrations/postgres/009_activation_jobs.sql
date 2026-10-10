-- Phase 6A durable delivery jobs and attempts
CREATE TABLE IF NOT EXISTS activation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  segment_id UUID NOT NULL,
  destination_id UUID NOT NULL REFERENCES webhook_destinations(id) ON DELETE RESTRICT,
  purpose TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','delivered','retrying','failed','cancelled')),
  audience_size INTEGER,
  payload_size INTEGER,
  idempotency_key TEXT,
  created_by UUID REFERENCES platform_users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  unique(tenant_id, idempotency_key)
);
CREATE INDEX idx_ar_tenant_status ON activation_requests(tenant_id, status, created_at);

CREATE TABLE IF NOT EXISTS delivery_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activation_request_id UUID NOT NULL REFERENCES activation_requests(id) ON DELETE CASCADE,
  job_id UUID NOT NULL,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  delivery_id UUID NOT NULL,
  profile_id UUID NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','processing','delivered','retrying','failed','cancelled')),
  http_status INTEGER,
  response_body_preview TEXT,
  error_reason TEXT,
  retry_at TIMESTAMP WITH TIME ZONE,
  attempted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX idx_da_activation_attempt ON delivery_attempts(activation_request_id, attempt_number);
CREATE INDEX idx_da_delivery_id ON delivery_attempts(delivery_id);
