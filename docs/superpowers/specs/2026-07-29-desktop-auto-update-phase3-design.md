# 桌面端应用内自动更新（阶段三）设计文档

- 日期: 2026-07-29
- 范围: electron-updater 应用内下载/安装、IPC 状态机、发布产物校验
- 状态: 实施中
- 前置: `docs/superpowers/specs/2026-07-29-desktop-update-reminder-phase2-design.md`

## 1. 背景

阶段二通过 `app:openExternal` 跳转浏览器手动下载安装包。阶段三改为 **electron-updater** 应用内下载 NSIS 安装包并 `quitAndInstall`，用户全程不离开云栈。

**重要兼容说明**：当前已发布的 v1.2.5（无 electron-updater）无法自动升级到首个带更新器的版本，用户需 **手动安装一次** 首个内置更新器的版本；从该版本起才可使用应用内自动更新。

## 2. 目标流程

1. 桌面端发现新版本（GitHub `latest.yml` + 服务端元数据对账）
2. 弹窗提示（optional/required 逻辑保留）
3. 用户点击「下载更新」→ 应用内下载，显示进度/速度/大小
4. 下载完成 →「立即重启并安装」/「稍后安装」
5. 安装前检查未保存内容 → `quitAndInstall(false, true)` → NSIS 覆盖安装 → 重启
6. **保留** `appId`、userData、登录、进度、本地 API 配置

## 3. 非目标

- 静默安装、绕过 UAC、杀进程、删除安装目录
- 渲染进程传入 URL/路径
- 服务端任意 URL 作为 updater feed
- 预发布版本覆盖稳定版
- 代码签名（当前未配置；Windows SmartScreen 风险需在文档标明）

## 4. 架构

```
electron/desktop-updater.cjs
  ├─ autoUpdater（electron-updater）
  ├─ checkForUpdates / downloadUpdate / quitAndInstall
  └─ updater:stateChanged → 渲染进程

desktopUpdateStore（Pinia）
  ├─ 订阅 onDesktopUpdaterStateChanged
  ├─ 服务端 API：minSupported / releaseNotes / optional|required
  ├─ 版本对账：服务端 version === updater version
  └─ 弹窗 / 个人中心 UI

LandingPage（Web only）
  └─ isAllowedDesktopDownloadUrl + window.open
```

## 5. 状态机（主进程为唯一可信来源）

| status | 说明 |
|---|---|
| idle | 初始/重置 |
| checking | 检查 GitHub Release |
| available | 有新版本可下载 |
| downloading | 下载中（含 percent/transferred/total/bytesPerSecond） |
| downloaded | 可安装 |
| installing | 即将退出安装 |
| upToDate | 已是最新 |
| error | 失败（errorCode + errorMessage，无路径/Token） |

## 6. IPC 白名单

**Invoke（无参数）**
- `updater:getState`
- `updater:check`
- `updater:download`
- `updater:install`

**Event**
- `updater:stateChanged`（精简公开状态）

**Preload 方法**
- `getUpdaterState()` / `checkForDesktopUpdate()` / `downloadDesktopUpdate()` / `installDesktopUpdate()`
- `onDesktopUpdaterStateChanged(listener)` → 返回取消订阅函数

## 7. 升级与回滚

### 升级路径
1. 发布带 electron-updater 的新版本到 GitHub Release（`latest.yml` + exe + blockmap）
2. 超管后台 `desktop_releases` 写入相同 version/minSupported
3. 旧版（无 updater）用户手动安装一次
4. 之后版本通过应用内更新

### 失败恢复
- 下载失败：保留 error 状态，允许「重新下载」/「重新检查」
- 安装失败：不删除已下载包，可重试 install
- 开发环境：拒绝真实 check/download/install

### 回滚
- 不提供自动降级
- 若新版本严重缺陷：发布更高版本修复，或用户手动安装旧版安装包覆盖（userData 保留）

## 8. 发布产物

- `artifactName`: `yunzhan-setup-${version}.${ext}`
- `publish.provider`: github / CruiseTom001 / yunzhan
- 必须上传：`yunzhan-setup-<version>.exe`、`.blockmap`、`latest.yml`
- 发布脚本校验 version/path/size/sha512 一致后才上传

## 9. 安全

- 固定 GitHub 仓库 feed，不接受服务端 downloadUrl 作为 updater 源
- sha512 校验由 electron-updater 完成
- 渲染进程仅接收精简状态，不含本地路径、Token、堆栈

## 10. UI 规则

- **Electron 落地页**：隐藏「下载桌面端」，不请求下载 URL
- **Web 落地页**：保留白名单 `window.open` 下载
- **optional 下载中**：允许关闭弹窗，后台继续下载（electron-updater）
- **required 下载中**：不可关闭弹窗
- **安装前**：`appQuitGuard` 检查未保存内容
