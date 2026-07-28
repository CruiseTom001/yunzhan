-- Repair legacy feedback tables that existed before migration 006 fully applied.
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS seen_at TIMESTAMPTZ;

ALTER TABLE feedback DROP CONSTRAINT IF EXISTS feedback_status_check;
ALTER TABLE feedback
  ADD CONSTRAINT feedback_status_check
  CHECK (status IN ('open', 'seen', 'resolved'));
