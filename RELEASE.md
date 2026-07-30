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
2. 在 `CHANGELOG.md` 顶部新增条目，标注功能象限（A/B/C/D）。
3. 运行 `npm run release:windows`。该命令会通过 `prebuild` 自动调用 `scripts/check-version-sync.cjs`，校验 `package.json` / `CHANGELOG.md` / `release/latest.yml` 三处版本号是否一致；不一致构建中止。
4. 在超管后台“桌面端版本管理”页面（`/admin/desktop-releases`）新建一条记录，填写 `version` / `minSupported` / `downloadUrl` / `releaseNotes`。桌面端用户启动后会自动拉取最新启用版本并分级提示；个人中心「桌面端与更新」可手动检查。
5. 将新的 `yunzhan-setup-<version>.exe`、`yunzhan-setup-<version>.exe.blockmap` 与 `latest.yml` 上传至 GitHub Release（`npm run release:desktop` 可一键构建、校验并上传）。网页端落地页仍通过白名单 HTTPS 地址 `window.open` 下载；桌面端使用 electron-updater 应用内自动更新，不再跳转浏览器。
6. 将安装包分发给用户覆盖安装。

约束：

- 三处版本号一致性由 `check-version-sync.cjs` 对账，发版前必须通过。
- `desktop_releases` 记录由超管维护，前端启动时自动读取；该表为空时桌面端不提示。
- 应用标识 `com.yunzhan.app` 与产品名保持不变，学习进度位于 Electron `userData` 目录，覆盖安装不清空（同上文“更新规则”第 3 条）。
- 当前 Windows 安装包**未配置代码签名**，SmartScreen 可能提示“未知发布者”；覆盖安装不会清空 `userData`，但首次从旧版手动安装到带自动更新器版本仍需用户确认 UAC/安装向导。
