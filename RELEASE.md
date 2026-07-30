# 云栈桌面版发布流程

## 生成 Windows 安装包

```powershell
npm ci
npm run release:windows
```

安装包会生成到 `release/yunzhan-setup-<version>.exe`（含 `.blockmap` 与 `latest.yml`）。
Windows 图标由发布命令根据 `public/favicon.svg` 自动生成。

一键发版（构建 + 上传 GitHub Release + 打印 downloadUrl）：

```powershell
npm run release:desktop
```

仅上传已有产物（仅允许 dry-run，正式发布必须完整构建）：

```powershell
node scripts/release-desktop.mjs --skip-build --dry-run
```

**安全约束**：`--skip-build` 不再允许单独用于正式发布。所有正式 GitHub Release 必须通过完整 `npm run quality` 与 `npm run release:windows` 构建，确保安装包与当前 HEAD 一致。

## 更新公告草稿（Phase 2）

前置条件：生产数据库已执行 `server/migrations/012_announcement_release_generation.sql`；服务端 AI 仅通过环境变量配置（推荐 `AI_PROVIDERS_JSON` 中包含 DeepSeek Flash，或用 `ANNOUNCEMENT_AI_PROVIDER_ID` 指定）。

- 桌面端：`npm run release:desktop` 在 GitHub Release 创建成功后会 best-effort 执行 `scripts/generate-release-announcement.mjs`，生成 `active=false` 的 `desktop_release` 草稿；数据库或 AI 失败只输出警告，不阻断 Release。可用 `--skip-announcement` 跳过。
- 网站端：Vercel 构建时会在 `npm run vercel:build` 内先执行 `scripts/check-changelog-entry.mjs`，再执行 `server/ensure-release-announcement.mjs` 生成/修复 `web_release` 草稿；失败同样只告警不中断部署（CHANGELOG 门禁失败会阻断构建）。
- 公告正文以 CHANGELOG 为事实来源；AI 仅润色。AI 超时或失败时保存带真实更新列表的详细 fallback，不会再降级为“稳定性改进与问题修复”通用句。
- 若已存在与旧通用降级文案完全一致的 inactive 草稿，下次自动生成会安全修复；管理员已编辑或已发布的公告不会被覆盖。

- 草稿不会自动生效。超管需在 `/admin/announcements` 预览/编辑/必要时重新润色或「从更新日志重新生成」后发布；发布后第一阶段公告按钮、公告中心和最新未读弹窗会按真实未读数推送。

## 更新规则

1. 修改 `package.json` 与 `package-lock.json` 中的版本号。
2. 运行 `npm run release:windows`，确保类型检查、ESLint 和生产构建全部通过。
3. 将新的 Setup 文件发给用户，直接覆盖安装即可。

应用标识 `com.yunzhan.app` 与产品名保持不变，学习进度位于 Electron `userData` 目录。NSIS 配置设置了 `deleteAppDataOnUninstall: false`，因此覆盖安装不会清空进度。发布前仍建议在“学习进度”页面导出一份 JSON 备份。

## 版本管理与发布流程

每次发布新桌面端版本，按以下顺序操作：

1. 修改 `package.json` 与 `package-lock.json` 中的版本号。
2. 更新仓库根目录 `desktop-release.json`：填写当前 `version` 与明确的 `minSupported`（禁止猜测；`minSupported` 不得高于 `version`）。
3. 在 `CHANGELOG.md` 顶部新增条目，标注功能象限（A/B/C/D）与 audience。
4. 运行 `npm run release:desktop`。该命令会校验版本一致、构建安装包、校验 `latest.yml` / exe / blockmap / `yunzhan-desktop-release.json`，再创建 GitHub Release 并上传上述资产。
5. GitHub `release/published` Webhook（或超管后台「从 GitHub 同步」）会在 `desktop_releases` 自动创建 `enabled=false` 的版本记录；超管检查后手动启用，桌面端用户才会收到更新。
6. 同一发版流程仍会 best-effort 生成 `desktop_release` 公告草稿（`active=false`），需超管另行审核发布。

约束：

- `package.json` / `package-lock.json` / `CHANGELOG.md` / `desktop-release.json`（及已有 `release/latest.yml`）版本一致性由 `check-version-sync.cjs` 对账。
- `desktop_releases` 控制检查更新与强制/可选更新；公告草稿面向用户说明。两者默认都不生效。
- Webhook 失败时不要删除 GitHub Release；可在 `/admin/desktop-releases` 使用「从 GitHub 同步」按版本号安全重试（已存在则不覆盖）。
- 应用标识 `com.yunzhan.app` 与产品名保持不变，学习进度位于 Electron `userData` 目录，覆盖安装不清空。
- 当前 Windows 安装包**未配置代码签名**，SmartScreen 可能提示“未知发布者”。

### GitHub Webhook / Vercel 人工配置

1. Vercel Production 环境变量增加 `GITHUB_RELEASE_WEBHOOK_SECRET`（高强度随机串；不要写入仓库）。
2. GitHub 仓库 → Settings → Webhooks → Add webhook：
   - Payload URL：`https://yunzhan.vercel.app/api/integrations/github/releases`
   - Content type：`application/json`
   - Secret：与 Vercel 相同
   - 仅勾选 `Releases` 事件
3. 可选：若需提高 GitHub API 限额，可在服务端配置 `GITHUB_TOKEN`（仅服务端，公共仓库默认可不配）。
