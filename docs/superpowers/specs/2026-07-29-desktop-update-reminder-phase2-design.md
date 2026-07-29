# 桌面端版本更新提醒（阶段二）设计文档

- 日期: 2026-07-29
- 范围: 启动/手动检查、统一 Pinia Store、更新弹窗、个人中心入口、安全外链 IPC
- 状态: 已实现（含 2026-07-29 审查修复）
- 前置: `docs/superpowers/specs/2026-07-15-desktop-update-notice-design.md`（阶段一已完成）

## 1. 背景

阶段一已落地 `desktop_releases` 表、`GET /api/desktop/latest-version`、超管 CRUD、`UpdateBanner.vue` 与 `desktopUpdateCheck.ts`。

阶段二在不引入 `electron-updater` 的前提下完善：

1. 桌面端启动后延迟自动检查
2. 新版本弹窗（可选更新）与最低兼容版本强提醒
3. 个人中心「桌面端与更新」手动检查
4. 通过受控 IPC `app:openExternal` 打开 GitHub Release 安装包

## 2. 非目标

- 不引入 `electron-updater`
- 不自动下载、静默安装、自动重启
- 不修改 `appId`、userData、进度结构
- 网页端不请求桌面版本 API

## 3. 架构

```
App.vue
  └─ UpdateBanner.vue（全局挂载，含落地页/未登录桌面端）
       ├─ desktopUpdateStore.initialize()
       └─ DesktopUpdateDialog.vue（受 shouldRenderDialog 控制）

desktopUpdateStore
  ├─ resolveLocalVersion() → app:getVersion IPC，兜底 __APP_VERSION__
  ├─ checkForUpdates({ source: startup | periodic | visibility | manual })
  ├─ desktopUpdateCheck.ts（判定 optional/required、24h 暂缓、每日 L3）
  ├─ desktopUpdateSchedule.ts（基于 lastCheckedAt 的 setTimeout 周期调度）
  ├─ desktopVersionApi.getDesktopLatestVersion()
  └─ onboardingStore.blocksDesktopUpdateDialog（与公告/教程互斥）

AccountPage.vue
  └─ desktopUpdateStore（只读状态 + 手动 checkForUpdates({ source: manual, force: true })）
```

## 4. 统一 Store 状态

| 字段 | 说明 |
|---|---|
| `isDesktop` | `window.electronAPI` 是否存在 |
| `status` | `idle` / `checking` / `upToDate` / `updateAvailable` / `error` |
| `localVersion` | IPC 读取的 x.y.z |
| `remoteVersion` | 远端最新版本 |
| `minSupported` | 最低兼容版本 |
| `downloadUrl` | 校验后的 HTTPS 下载地址 |
| `releaseNotes` | 纯文本 |
| `noticeMode` | `optional` / `required` |
| `lastCheckedAt` | 上次成功/失败检查时间戳 |
| `errorMessage` | 检查失败时的用户可读错误 |
| `downloadErrorMessage` | 打开下载链接失败时的用户可读错误 |
| `dialogPending` | 是否有待展示的更新提醒 |
| `dialogVisible` | 弹窗逻辑可见（可能被教程阻塞） |
| `shouldRenderDialog` | 实际是否挂载弹窗并锁定 body |

## 5. 检查时机

| 来源 | 节流 | 弹窗 |
|---|---|---|
| `startup` | 主界面挂载后延迟 3s；6h 内不重复 | 可选：24h 暂缓；必需：同日最多 1 次 |
| `periodic` | 每次检查完成后按 `lastCheckedAt + 6h` 调度下一次 | 同上 |
| `visibility` | 可见且距上次 >6h | 同上 |
| `manual` | `force: true`，绕过节流与暂缓 | 始终显示明确结果 |

并发：`checkPromise` 单例，防止重复请求。

## 6. 新手教程互斥

当 `onboardingStore.blocksDesktopUpdateDialog` 为真（教程运行中或待自动启动）时：

- 仍可完成版本检查并保存 `updateAvailable` 状态
- 不挂载 `DesktopUpdateDialog`、不锁定 body、不抢焦点
- 教程完成或关闭后通过 `syncDialogVisibility()` 再展示弹窗

## 7. 暂缓策略

- 旧版 `yunzhan:ignoredUpdateVersion`（永久忽略）改为：
  - `yunzhan:snoozedUpdateVersion`
  - `yunzhan:snoozedUpdateUntil`（毫秒时间戳，默认 +24h）
- 最低兼容弹窗仍用 `yunzhan:lastBlockedPromptDate`（同日一次）

## 8. 下载安全

白名单主机（HTTPS only）：

- `github.com`
- `release-assets.githubusercontent.com`
- `objects.githubusercontent.com`

渲染进程：`src/utils/desktopDownloadUrl.ts` 校验后调用 `app:openExternal`。

主进程：`electron/download-url-validation.cjs` 同等校验，`contextIsolation` / `sandbox` / `nodeIntegration: false` 保持不变。

Electron 中 `openDownload` 仅走 IPC，失败时展示 `downloadErrorMessage`，禁止回退 `window.open`。网页端不进入桌面下载流程。

## 9. 错误分类

- 版本号或下载地址无效：抛出 `InvalidDesktopUpdateInfoError`，映射为「版本信息格式无效」
- 真实网络错误（`ApiError.status === 0` 且非无效信息）：「网络连接失败」
- IPC 打开外链失败：「无法打开下载链接」

## 10. 兼容性

- 不修改数据库 schema
- 不修改现有 API 契约
- 覆盖安装保留 userData（NSIS `deleteAppDataOnUninstall: false`）

## 11. 测试要点

- 网页端跳过检查与下载
- 启动 3s 检查、6h 周期调度、6h 内不重复
- `dispose` 清理 startup/periodic 定时器与 visibility 监听
- 新手教程期间隐藏弹窗、结束后显示
- 非法 downloadUrl 不误报网络错误
- `openDownload` IPC 抛错 / `ok:false` / 非法地址；禁止 `window.open` 回退
- 弹窗 Escape、焦点恢复、body 锁定与下载失败状态（`desktopUpdateDialogBehavior`）
