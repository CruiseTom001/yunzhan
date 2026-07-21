-- 008_study_notes.sql
-- 用户每日学习记录。AI Key 不入库；这里只保存用户记录正文和用户明确应用的润色结果。

CREATE TABLE IF NOT EXISTS study_notes (
  id                BIGSERIAL PRIMARY KEY,
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note_date         DATE NOT NULL,
  content           TEXT NOT NULL,
  polished_content  TEXT NOT NULL DEFAULT '',
  ai_provider_name  VARCHAR(80),
  ai_model          VARCHAR(128),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, note_date)
);

CREATE INDEX IF NOT EXISTS study_notes_user_date_idx ON study_notes (user_id, note_date DESC);
