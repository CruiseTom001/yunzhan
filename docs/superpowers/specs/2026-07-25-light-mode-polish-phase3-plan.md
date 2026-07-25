# 浅色模式打磨 Phase 3 — 粗清理

> **承接**：Phase 1+2（`bf91e10`）  
> **目标**：补齐剩余小页面 + 系统主题自动跟随

## 范围

1. `NotFoundPage` / `LandingPage` / `ReviewPage` / `TerminalPage` 语义色变量化
2. `theme.ts` + `index.html` FOUC：无显式偏好时跟随 `prefers-color-scheme`
3. `ParticleBg` 浅色降低透明度；补 `bg-black/10`、`hover:bg-white/[0.04]`

## 非目标

- 全面 `dark:` 前缀迁移（长远）
- 三态主题切换 UI（system/dark/light）；手动切换仍写入显式 dark/light

## 行为

- 无 `localStorage['yunzhan-theme']` → 跟随系统
- 已存 `dark`/`light` → 保持用户选择
- 顶栏切换 → 写入显式偏好，之后不再自动跟随，直到清除存储
