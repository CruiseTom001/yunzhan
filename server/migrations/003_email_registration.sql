ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(254);
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx
  ON users(email)
  WHERE email IS NOT NULL;

CREATE TABLE IF NOT EXISTS email_verification_challenges (
  id UUID PRIMARY KEY,
  email VARCHAR(254) NOT NULL,
  purpose VARCHAR(32) NOT NULL CHECK (purpose IN ('registration')),
  code_digest CHAR(64) NOT NULL,
  request_ip_digest CHAR(64) NOT NULL,
  delivery_status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (delivery_status IN ('pending', 'sent', 'failed')),
  provider_message_id VARCHAR(128),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 5),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS email_verification_email_created_idx
  ON email_verification_challenges(email, created_at DESC);

CREATE INDEX IF NOT EXISTS email_verification_ip_created_idx
  ON email_verification_challenges(request_ip_digest, created_at DESC);

CREATE INDEX IF NOT EXISTS email_verification_expiry_idx
  ON email_verification_challenges(expires_at);
