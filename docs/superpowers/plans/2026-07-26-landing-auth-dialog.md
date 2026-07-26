# 落地页认证弹窗实施计划

> 日期：2026-07-26  
> 设计文档：`docs/superpowers/specs/2026-07-26-landing-auth-dialog-design.md`

## 实施步骤

1. 抽取 `AuthPanel.vue`，迁移 `LoginPage.vue` 表单逻辑。
2. 新增 `AuthDialog.vue`（Teleport + 焦点/滚动管理）。
3. 新增 `authRedirect.ts` 与 `authDialogFocus.ts` 工具模块。
4. `LandingPage.vue` 接入单一 `AuthDialog`，所有账号入口改 Query 打开。
5. `/login` 路由改为 `buildLoginCompatRedirect` 重定向。
6. `main.ts` 守卫改为 `/landing?auth=login&redirect=...`。
7. 删除 `LoginPage.vue`；更新 `AppHeader` / `AccountPage` 登出跳转。
8. 补充单元测试与三种视口手动验证。

## 验证清单

- [ ] 落地页登录/注册/忘记密码弹窗
- [ ] `/login` 与 `/login?mode=register` 兼容
- [ ] 未登录访问 `/study-notes` 自动打开登录弹窗
- [ ] 登录成功回跳 `redirect`
- [ ] 390 / 768 / 1440 视口无溢出
- [ ] 浅色 / 深色主题弹窗层级清晰

## 回滚

- 恢复 `LoginPage.vue` 与 `/login` 组件路由即可回退 UI；`authRedirect.ts` 可保留。
