-- User onboarding / first-login tour state
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS onboarding_status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (onboarding_status IN ('pending', 'skipped', 'completed')),
  ADD COLUMN IF NOT EXISTS onboarding_version INTEGER NOT NULL DEFAULT 0
    CHECK (onboarding_version >= 0),
  ADD COLUMN IF NOT EXISTS onboarding_step VARCHAR(64),
  ADD COLUMN IF NOT EXISTS onboarding_updated_at TIMESTAMPTZ;

-- Existing accounts should not be forced through the tour.
UPDATE users
   SET onboarding_status = 'completed',
       onboarding_version = 1,
       onboarding_step = NULL,
       onboarding_updated_at = COALESCE(onboarding_updated_at, NOW())
 WHERE onboarding_updated_at IS NULL;
