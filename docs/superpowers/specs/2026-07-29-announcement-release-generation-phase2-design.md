# 更新公告自动生成 Phase 2 设计

> 日期：2026-07-29  
> 承接：第一阶段「公告功能键与历史公告中心」已落地；本文只覆盖第二阶段「版本更新公告自动生成、AI 润色、超管确认与站内推送」。

## 1. 目标

- 公告增加分类与来源元数据：`category`、`source_key`、`version`、`source_commit`、`generated_by_ai`、`generation_provider`、`generation_error`。
- 发布成功后自动生成 `active=false` 的更新公告草稿，`source_key` 唯一，重复触发不产生重复公告。
- 服务端优先调用配置中的 DeepSeek Flash 供应商润色；API Key 只存在服务端环境变量。
- AI 未配置、超时、返回无效或超限时，使用 CHANGELOG 生成的确定性降级文本，并记录 `generation_error`。
- 草稿必须经超管确认后才能 `active=true`；确认后由第一阶段公告按钮、公告中心和最新未读弹窗推送。
- 超管可预览、编辑、重新润色、发布或放弃草稿。

## 2. 非目标

- 不自动发布生效公告；不绕过超管确认。
- 不修改 Electron IPC、公告展示组件架构或桌面端本地 AI 配置。
- 不执行生产数据库迁移、不提交、不推送、不部署、不创建 Release。
- 不为 AI 失败阻断 GitHub Release、Vercel 部署或桌面发版脚本。

## 3. 用户流程

1. 桌面端执行 `scripts/release-desktop.mjs` 创建 GitHub Release 成功后，脚本以 best-effort 调用 `scripts/generate-release-announcement.mjs`；网站发布后可由维护者执行同一脚本传入 `web_release`。
2. 生成脚本读取 `CHANGELOG.md` 中对应版本条目，调用服务端生成模块写入 `announcements`：`active=false`、`category=web_release|desktop_release`、`source_key=<category>:<version>`。
3. 服务端生成模块先构造确定性降级标题/正文，再尝试调用 DeepSeek Flash；成功则保存 AI 正文与 `generation_provider`，失败则保存降级正文与 `generation_error`。
4. 超管进入 `/admin/announcements`：可看到草稿、来源、AI 状态和错误；可编辑标题/分类/版本/正文、重新润色、发布或放弃。
5. 超管确认发布后，普通用户公告列表返回真实 `category/version`，公告按钮未读数、公告中心和最新未读弹窗复用第一阶段逻辑。

## 4. 数据结构

新增迁移 `server/migrations/012_announcement_release_generation.sql`：

- `category VARCHAR(32) NOT NULL DEFAULT 'general'`，约束为 `general/web_release/desktop_release`。
- `source_key TEXT`，部分唯一索引 `WHERE source_key IS NOT NULL`。
- `version VARCHAR(32)`，发布类公告使用语义化版本；普通公告为 `NULL`。
- `source_commit VARCHAR(64)`，记录触发生成的提交哈希，可空。
- `generated_by_ai BOOLEAN NOT NULL DEFAULT false`。
- `generation_provider VARCHAR(120)`，记录 `供应商/模型` 摘要，不记录 API Key。
- `generation_error TEXT`，记录安全降级原因，不向普通用户暴露。

兼容策略：旧公告迁移后 `category='general'`、其余来源字段为 `NULL/false`，`announcement_reads` 不受影响。普通用户接口仍只返回公开字段。

## 5. 接口

### 普通用户

- `GET /api/announcements`：返回真实 `category/version`；仍只返回 `active=true AND published_at <= NOW()`。
- `GET /api/announcements/latest`、`POST /api/announcements/:id/read`：保持第一阶段行为。

### 超管

- `GET /api/admin/announcements`：列表返回来源元数据与 AI 状态。
- `POST /api/admin/announcements`：允许传入 `category/version/sourceKey`；默认仍为 `general`。
- `PATCH /api/admin/announcements/:id`：允许编辑 `title/content/category/version/active`；`active false -> true` 时同时设置 `published_at=NOW()`。
- `POST /api/admin/announcements/:id/repolish`：仅允许 `active=false` 草稿；成功后更新正文与 AI 元数据，失败保留原文并记录 `generation_error`。
- `DELETE /api/admin/announcements/:id`：仅允许删除 `active=false` 草稿；生效公告需先下线。

## 6. 异常与安全边界

- AI API Key 只从 `AI_PROVIDERS_JSON` 或旧版 `AI_*` 服务端环境变量读取；不写日志、不下发前端、不进入数据库。
- 公告 AI 供应商选择顺序：`ANNOUNCEMENT_AI_PROVIDER_ID` > id/name/model 同时匹配 DeepSeek 与 Flash > model 含 `flash` > 第一个供应商。
- AI 输入/输出设置长度上限；公告正文最终仍按 1-4000 字符校验，且只按纯文本展示。
- `source_key` 唯一冲突按“已生成”处理；生成脚本对数据库不可用、AI 失败只输出警告并以 0 退出，避免阻断发布。
- 所有管理写操作保留审计日志；审计 metadata 不含秘密和完整正文。
- 普通用户不暴露 `created_by/source_commit/generated_by_ai/generation_provider/generation_error`。

## 7. 测试与回滚

测试：

- 迁移文件具备 `IF NOT EXISTS` / 部分唯一索引，可重复执行。
- 服务端助手：分类/版本/source_key 校验、公开列表返回分类版本、草稿发布设置 `published_at`、生效公告删除保护。
- 生成模块：AI 成功写入 AI 元数据、AI 失败降级且不阻断、`source_key` 去重、重新润色仅允许草稿。
- 前端 API：管理公告扩展字段类型守卫、重新润色/删除方法；公告中心继续展示分类/版本。

回滚：

- 代码回滚前不得删除迁移列；如需回滚数据，仅将新生成的 `source_key` 草稿删除或置为 `active=false`。
- 迁移本身只追加可空/默认列，不删除旧数据；回滚代码后旧公告与阅读记录仍可用。

## 8. 发布边界

- 本任务只交付代码与迁移文件；不执行生产迁移。
- 生产应用前必须先备份并在测试数据库连续执行两次迁移，确认旧公告和 `announcement_reads` 未丢失。
- `scripts/release-desktop.mjs` 的公告生成为 best-effort，失败不影响 GitHub Release；网站发布后的公告生成不阻断 Vercel 部署。
