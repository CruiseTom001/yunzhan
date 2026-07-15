CREATE TABLE IF NOT EXISTS feedback (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category VARCHAR(32) NOT NULL,
  content TEXT NOT NULL,
  contact VARCHAR(128),
  status VARCHAR(16) NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  seen_at TIMESTAMPTZ
);

ALTER TABLE feedback
  DROP CONSTRAINT IF EXISTS feedback_category_check;
ALTER TABLE feedback
  ADD CONSTRAINT feedback_category_check
  CHECK (category IN ('suggestion', 'bug', 'other'));

ALTER TABLE feedback
  DROP CONSTRAINT IF EXISTS feedback_status_check;
ALTER TABLE feedback
  ADD CONSTRAINT feedback_status_check
  CHECK (status IN ('open', 'seen', 'resolved'));

CREATE INDEX IF NOT EXISTS feedback_status_created_idx ON feedback(status, created_at DESC);
CREATE INDEX IF NOT EXISTS feedback_user_idx ON feedback(user_id);

CREATE TABLE IF NOT EXISTS announcements (
  id BIGSERIAL PRIMARY KEY,
  title VARCHAR(120) NOT NULL,
  content TEXT NOT NULL,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS announcements_active_published_idx ON announcements(active, published_at DESC);

CREATE TABLE IF NOT EXISTS announcement_reads (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  announcement_id BIGINT NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, announcement_id)
);
