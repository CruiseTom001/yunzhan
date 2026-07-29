-- 012_announcement_release_generation.sql
-- 更新公告自动生成 Phase 2：公告分类、来源去重与 AI 生成元数据。
-- 配套文档：docs/superpowers/specs/2026-07-29-announcement-release-generation-phase2-design.md

ALTER TABLE announcements
  ADD COLUMN IF NOT EXISTS category VARCHAR(32) NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS source_key TEXT,
  ADD COLUMN IF NOT EXISTS version VARCHAR(32),
  ADD COLUMN IF NOT EXISTS source_commit VARCHAR(64),
  ADD COLUMN IF NOT EXISTS generated_by_ai BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS generation_provider VARCHAR(120),
  ADD COLUMN IF NOT EXISTS generation_error TEXT;

ALTER TABLE announcements
  DROP CONSTRAINT IF EXISTS announcements_category_check;
ALTER TABLE announcements
  ADD CONSTRAINT announcements_category_check
  CHECK (category IN ('general', 'web_release', 'desktop_release'));

CREATE UNIQUE INDEX IF NOT EXISTS announcements_source_key_unique
  ON announcements (source_key);

CREATE INDEX IF NOT EXISTS announcements_category_published_idx
  ON announcements (category, published_at DESC);
