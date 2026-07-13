CREATE TABLE IF NOT EXISTS progress_backups (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  payload JSONB NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  reason VARCHAR(32) NOT NULL DEFAULT 'automatic_sync',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS progress_backups_user_created_idx
  ON progress_backups(user_id, created_at DESC);
