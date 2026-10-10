-- Add 'partially_completed' status for activation requests.
ALTER TABLE activation_requests
  DROP CONSTRAINT IF EXISTS activation_requests_status_check,
  ADD CONSTRAINT activation_requests_status_check
    CHECK (status IN ('pending','processing','delivered','retrying','failed','cancelled','partially_completed'));
