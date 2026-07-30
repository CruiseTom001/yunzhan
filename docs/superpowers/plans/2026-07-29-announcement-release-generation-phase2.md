# 更新公告自动生成 Phase 2 实施计划

> 对应设计：`docs/superpowers/specs/2026-07-29-announcement-release-generation-phase2-design.md`  
> 约束：不提交、不推送、不部署、不创建 Release、不执行生产迁移。  
> 状态：2026-07-29 本地实现完成；PGLite 与真实 PostgreSQL（`npm run verify:phase2:real`）验证均通过；远程 Neon 测试库需自备 `DATABASE_URL`。

## Task 1：数据库迁移

- 新增 `server/migrations/012_announcement_release_generation.sql`。
- 追加 `category/source_key/version/source_commit/generated_by_ai/generation_provider/generation_error`。
- 添加分类约束、`source_key` 部分唯一索引、分类发布时间索引。
- 验证：无本地 `DATABASE_URL` 时不伪造迁移执行；最终说明明确未跑真实迁移。

## Task 2：服务端公告模型

- 扩展 `server/announcements.mjs`：公开列表返回真实 `category/version`，增加管理行映射与输入解析。
- 更新 `server/index.mjs` 管理公告 CRUD：扩展字段、发布时设置 `published_at`、来源冲突返回 409、删除保护。
- 测试：更新 `server/announcements.test.mjs`。

## Task 3：AI 生成与降级

- 扩展 `server/ai-provider.mjs`：新增公告润色 purpose 与 `requestAnnouncementPolish`，复用现有供应商加载、超时和大小限制。
- 新增 `server/announcement-generation.mjs`：确定性 CHANGELOG 降级、DeepSeek Flash 供应商选择、草稿生成去重、重新润色。
- 新增 `scripts/generate-release-announcement.mjs`；在 `scripts/release-desktop.mjs` 的 GitHub Release 成功后 best-effort 调用。
- 测试：`server/announcement-generation.test.mjs`、`server/ai-provider.test.mjs`。

## Task 4：超管草稿工作流

- 扩展 `src/utils/announcementApi.ts`：管理公告字段、`repolishAdminAnnouncement`、`deleteAdminAnnouncement`。
- 更新 `src/pages/AdminAnnouncementsPage.vue`：分类/版本/来源展示、草稿发布、重新润色、放弃、编辑。
- 测试：`src/utils/announcementApi.test.ts`。

## Task 5：用户侧展示接入

- 第一阶段公告中心已展示 `category/version`；本阶段只需服务端返回真实值并更新相关测试。
- 确认普通用户接口不返回后台字段。

## Task 6：门禁与交付说明

- 运行：`npm run policy:check`、`npm run check`、`npm run lint`、`npm run server:check`、`npm test`、`npm run build`、`git diff --check`。
- 依赖未变化则不强制 `npm audit`；若生成脚本/AI 改动引入依赖再运行 `npm audit --omit=dev`。
- 最终说明包含：行为变化、验证命令、未执行检查（真实测试数据库迁移）、兼容性影响和遗留风险。

## Task 7：成对补建更新草稿（后续增量）

- 新增 `POST /api/admin/announcements/generate-pair-from-changelog` 与 `server/generate-release-announcement-pair.mjs`。
- commit-only：`server/resolve-release-version-from-commit.mjs` + `limitedHttpsFetch` 白名单解析 GitHub raw。
- 后台「补建更新草稿」改为一次生成网站端 + 桌面端；分渠道展示 `已创建 / 已存在 / 无用户侧内容 / 失败`。
- **skipped 协议**：pair 适配层将草稿层 `skipped=true + id:null` 占位对象规范为 `announcement:null`，避免前端类型守卫误判“无效公告数据”；单渠道旧接口协议不变。
- 部分成功：渠道隔离，HTTP 200 可含单侧 `failed`。
- 测试：pair 单元、路由、`announcementApi` 真实 JSON 解析、`AdminAnnouncementsPage` 分渠道展示与防重复提交。

## Task 8：AI HTTP 529 提示（后续增量）

- `server/ai-http-error.mjs`：`formatAiProviderHttpError(status)` 仅状态码；529 追加繁忙重试提示。
- Electron `appendAiHttpBusyRetryHint` / 浏览器直连脱敏后追加同样提示。
- 公告生成将 529 纳入临时错误有限重试；笔记润色前端不无限自动重试。
- Webhook Secret 若曾泄露：须在 Vercel Production 与 GitHub Webhook 同步轮换后再正式 Release。
