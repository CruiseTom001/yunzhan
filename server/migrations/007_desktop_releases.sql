-- 007_desktop_releases.sql
-- 桌面端版本发布记录,供前端启动时检查并分级提示升级。
-- 配套文档:docs/superpowers/specs/2026-07-15-desktop-update-notice-design.md

CREATE TABLE IF NOT EXISTS desktop_releases (
  id            BIGSERIAL PRIMARY KEY,
  version       TEXT NOT NULL UNIQUE,
  min_supported TEXT NOT NULL,
  download_url  TEXT NOT NULL,
  release_notes TEXT NOT NULL DEFAULT '',
  enabled       INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_desktop_releases_enabled ON desktop_releases (enabled);
