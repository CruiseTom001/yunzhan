ALTER TABLE email_verification_challenges
  DROP CONSTRAINT IF EXISTS email_verification_challenges_purpose_check;

ALTER TABLE email_verification_challenges
  ADD CONSTRAINT email_verification_challenges_purpose_check
  CHECK (purpose IN ('registration', 'password_reset', 'email_change'));

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_agent VARCHAR(256);

UPDATE sessions
   SET id = (
     SUBSTRING(MD5(token_hash), 1, 8) || '-' ||
     SUBSTRING(MD5(token_hash), 9, 4) || '-' ||
     SUBSTRING(MD5(token_hash), 13, 4) || '-' ||
     SUBSTRING(MD5(token_hash), 17, 4) || '-' ||
     SUBSTRING(MD5(token_hash), 21, 12)
   )::UUID
 WHERE id IS NULL;

ALTER TABLE sessions ALTER COLUMN id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS sessions_id_unique_idx ON sessions(id);
CREATE INDEX IF NOT EXISTS sessions_user_last_used_idx ON sessions(user_id, last_used_at DESC);

CREATE TABLE IF NOT EXISTS login_attempts (
  attempt_key CHAR(64) PRIMARY KEY,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 5),
  reset_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS login_attempts_reset_idx ON login_attempts(reset_at);
CREATE INDEX IF NOT EXISTS audit_logs_action_created_idx ON audit_logs(action, created_at DESC);
