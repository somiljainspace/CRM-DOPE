-- Phase 6A: normalize logical delivery jobs vs physical attempts
-- One durable job per recipient; many attempts per job.

CREATE TABLE IF NOT EXISTS delivery_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activation_request_id UUID NOT NULL REFERENCES activation_requests(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  destination_id UUID NOT NULL REFERENCES webhook_destinations(id) ON DELETE RESTRICT,
  profile_id UUID NOT NULL,
  delivery_id UUID NOT NULL,               -- stable across all retries
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','delivered','retrying','failed','skipped','cancelled')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMP WITH TIME ZONE,
  claimed_by TEXT,
  claim_expires_at TIMESTAMP WITH TIME ZONE,
  last_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(activation_request_id, profile_id)
);
CREATE INDEX IF NOT EXISTS idx_dj_claim ON delivery_jobs(status, next_attempt_at, id);
CREATE INDEX IF NOT EXISTS idx_dj_activation ON delivery_jobs(activation_request_id);
CREATE INDEX IF NOT EXISTS idx_dj_delivery_id ON delivery_jobs(delivery_id);

-- Normalize delivery_attempts to reference the logical job.
ALTER TABLE delivery_attempts
  ADD COLUMN IF NOT EXISTS delivery_job_id UUID REFERENCES delivery_jobs(id) ON DELETE CASCADE;
