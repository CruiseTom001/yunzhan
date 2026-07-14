ALTER TABLE email_verification_challenges
  DROP CONSTRAINT IF EXISTS email_verification_challenges_purpose_check;

ALTER TABLE email_verification_challenges
  ADD CONSTRAINT email_verification_challenges_purpose_check
  CHECK (purpose IN ('registration', 'password_reset'));

ALTER TABLE email_verification_challenges
  DROP CONSTRAINT IF EXISTS email_verification_challenges_delivery_status_check;

ALTER TABLE email_verification_challenges
  ADD CONSTRAINT email_verification_challenges_delivery_status_check
  CHECK (delivery_status IN ('pending', 'sent', 'failed', 'suppressed'));

DO $$
BEGIN
  IF EXISTS (
    SELECT LOWER(username)
      FROM users
     GROUP BY LOWER(username)
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enable case-insensitive usernames because duplicate values exist';
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS users_username_case_insensitive_idx
  ON users (LOWER(username));
