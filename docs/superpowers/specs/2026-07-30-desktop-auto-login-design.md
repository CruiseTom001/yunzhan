# 网页保持登录与桌面安全自动登录设计

> 日期：2026-07-30  
> 状态：已确认，待 v1.2.9 桌面发版

## 目标

- 网页端登录弹窗提供「保持登录 7 天」，控制 HttpOnly Cookie 是否为持久 Cookie。
- 桌面端提供「记住账号」与「启动时自动登录」，会话令牌仅在主进程通过 `safeStorage` 加密持久化。
- 不使用「记住密码」表述；密码永不离开登录请求内存。

## 非目标

- 不新增永久登录；最长仍受服务端 7 天会话约束。
- 不在渲染进程、localStorage、IndexedDB 或 Pinia 持久化密码、Cookie 或 Token。
- 不修改数据库结构。
- 不改变 Electron 安全三元组（contextIsolation / nodeIntegration / sandbox）。

## Web 行为

| 选项 | Cookie | DB 会话 |
|------|--------|---------|
| 保持登录（默认勾选） | HttpOnly + Secure(生产) + SameSite + Path=/ + **Max-Age=7天** | expires_at = now + 7d |
| 取消保持登录 | 会话 Cookie（无 Max-Age/Expires） | expires_at 仍为 now + 7d |

`remember` 缺失时按 `true` 兼容旧客户端；非法类型返回 400。

## Desktop 行为

### 记住账号

- 仅保存用户名或邮箱（≤254）到 `userData/desktop-login-preferences.json`（明文标识符，非密钥）。
- 密码框启动时为空。

### 自动登录

- 勾选时强制勾选记住账号。
- 登录成功后，主进程将 `yunzhan_session` 令牌与 `expiresAt` 写入 `userData/desktop-auto-login.bin`（`safeStorage` 加密字节）。
- 启动时在 `app ready` 后、窗口创建前解密并恢复到内存 Cookie 容器；Vue 仍调用 `/api/auth/me`。
- Linux `safeStorage.getSelectedStorageBackend() === 'basic_text'` 时拒绝启用并提示。

### 清除场景

登出、401、`/auth/me` 失败、密码重置、撤销当前会话、加密文件损坏或过期 → 删除加密文件并关闭 `autoLogin`；记住账号按用户选项保留。

## IPC 白名单

| 通道 | 方向 | 说明 |
|------|------|------|
| `auth:getDesktopLoginPreferences` | 读 | 返回偏好与 autoLogin 可用性 |
| `auth:setDesktopLoginPreferences` | 写 | rememberIdentifier / autoLogin / identifier |
| `auth:clearDesktopAutoLogin` | 写 | 清除会话文件与内存 Cookie，关闭 autoLogin |

不暴露读取 Token 的 IPC。

## 回滚

- 关闭功能：用户取消自动登录并登出即可删除加密文件。
- 降级旧版桌面端：无加密文件，正常手动登录；preferences 文件被忽略。
