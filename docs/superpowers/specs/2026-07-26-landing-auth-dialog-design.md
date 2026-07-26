# 落地页认证弹窗设计

> 日期：2026-07-26  
> 范围：Web/桌面共用前端路由与落地页 UI

## 目标

- 登录、注册、忘记密码在落地页以弹窗完成，不再跳转独立页面。
- 保留 `/login` 旧链接兼容，统一重定向到 `/landing?auth=...`。
- 未登录访问受保护路由时，落地页自动打开登录弹窗并保留安全 `redirect`。
- 认证表单逻辑只维护一份，供弹窗复用。

## 非目标

- 不修改后端认证协议、Cookie、验证码频控或密码规则。
- 不把密码、验证码、Token 写入日志或前端持久化。
- 不改变深色/浅色主题变量定义（沿用 `src/style.css` 现有主题）。

## 组件边界

| 组件/模块 | 职责 |
| --- | --- |
| `AuthPanel.vue` | 登录/注册/忘记密码表单、验证码倒计时、调用 `authStore` 与 `progressStore.bindAccount` |
| `AuthDialog.vue` | Teleport 弹窗、遮罩、焦点陷阱、Escape/遮罩关闭、body 滚动锁 |
| `authRedirect.ts` | `auth`/`redirect` Query 解析与安全校验 |
| `authDialogFocus.ts` | 焦点循环与 body 滚动锁 |
| `LandingPage.vue` | 打开/关闭弹窗、Query 同步、认证成功后导航 |

## 路由与 Query

合法 `auth` 值：

- `login`
- `register`
- `forgot-password`

示例：

- `/landing?auth=login`
- `/landing?auth=register&redirect=/study-notes`

旧链接兼容：

- `/login` → `/landing?auth=login`
- `/login?mode=register` → `/landing?auth=register`

## redirect 安全规则

`readSafeRedirect` 仅接受：

- 以单个 `/` 开头的站内路径
- 拒绝 `//`、`javascript:`、`data:`、外部 URL
- 拒绝包含 `/login` 或 `auth=` 的循环跳转

## 认证成功流程

1. `authStore.login` / `authStore.register`
2. `progressStore.bindAccount`
3. 清除敏感输入
4. 关闭弹窗（移除 `auth` Query）
5. `router.replace` 到安全 `redirect`，默认 `/`

## 可访问性

- `role="dialog"` + `aria-modal="true"`
- 打开时聚焦首个输入框；关闭时焦点回到触发按钮
- Tab / Shift+Tab 焦点限制在弹窗内
- 错误 `role="alert"`，成功 `role="status"`
- 提交中禁止遮罩/Escape 误关闭
