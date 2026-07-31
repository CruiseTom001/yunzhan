# 网页保持登录与桌面安全自动登录实施计划

> 日期：2026-07-30  
> 目标版本：v1.2.9（代码先落地，版本 bump 待确认）

## Task 1 — 服务端 remember Cookie

- [x] 新增 `server/auth-session.mjs`：`parseLoginRememberInput`、`buildSessionCookieOptions`
- [x] `POST /api/auth/login` 支持 `remember`
- [x] 路由与 Cookie 单测

## Task 2 — Electron 主进程安全存储

- [x] 新增 `electron/desktop-auth-storage.cjs`
- [x] safeStorage 加密文件 + 明文 preferences
- [x] Linux basic_text 检测
- [x] 启动恢复、登出清除、登录后持久化钩子

## Task 3 — IPC 与 preload

- [x] 注册三个 auth IPC 通道
- [x] preload 白名单扩展

## Task 4 — 前端 AuthPanel / auth store

- [x] Web「保持登录 7 天」
- [x] Desktop「记住账号」「启动时自动登录」
- [x] 401 / 登出 / 安全更新时清理桌面会话

## Task 5 — 测试与 CHANGELOG

- [x] 服务端、Web 组件、Electron 模块测试
- [x] CHANGELOG 1.2.8 追加待发布用户条目（bump 1.2.9 时迁移）
- [x] 全部门禁
