# 云栈桌面版发布流程

## 生成 Windows 安装包

```powershell
npm ci
npm run release:windows
```

安装包会生成到 `release/云栈-Setup-<version>.exe`。
Windows 图标由发布命令根据 `public/favicon.svg` 自动生成。

一键发版（构建 + 上传 GitHub Release + 打印 downloadUrl）：

```powershell
npm run release:desktop
```

仅上传已有产物：

```powershell
node scripts/release-desktop.mjs --skip-build
```

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
5. 将新的 `云栈-Setup-<version>.exe` 上传至 GitHub Release（`npm run release:desktop` 可一键构建并上传），`downloadUrl` 须为 `https://github.com/...` 或 GitHub 资产域名，桌面端通过受控 IPC `app:openExternal` 打开。
6. 将安装包分发给用户覆盖安装。

约束：

- 三处版本号一致性由 `check-version-sync.cjs` 对账，发版前必须通过。
- `desktop_releases` 记录由超管维护，前端启动时自动读取；该表为空时桌面端不提示。
- 应用标识 `com.yunzhan.app` 与产品名保持不变，学习进度位于 Electron `userData` 目录，覆盖安装不清空（同上文“更新规则”第 3 条）。
- 新增依赖时额外运行 `npm audit --omit=dev`。
