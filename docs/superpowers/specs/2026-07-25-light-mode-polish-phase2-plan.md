# 浅色模式打磨 Phase 2 — 后续修改计划

> **承接**：Phase 1 交割（`specs/2026-07-25-light-mode-polish-handoff.md`）  
> **目标**：把所有 Admin 与管理页面同步浅色化，消除剩余的硬编码色值，并完成系统性变量驱动的准备

---

## 1. 基线上下文

### 1.1 主题机制速览

| 物品 | 说明 |
|---|---|
| 主题属性 | `<html data-theme="dark\|light">` |
| 切换代码 | `src/stores/theme.ts` 中的 `useTheme()`（非 Pinia），每切换同步 `data-theme` 和 `.dark` class |
| 深色变量 | `:root,[data-theme="dark"]` 块（style.css L24-52） |
| 浅色变量 | `[data-theme="light"]` 块（style.css L55-91） --accent-* 四色已同步定义在浅色和深色 |
| Tailwind 深色前缀 | `dark:` 已可用（Phase 1 修复了 `classList.toggle('dark')`） |
| FOUC 预防 | `index.html` 内联同步脚本已就位 |

### 1.2 现有全局覆盖（style.css Phase 1 补丁）

浅色模式会自动处理以下类：

- `bg-[#0c0f18]`, `bg-[#0c0c14]`, `bg-[#252525]`, `bg-[#0c0c14]/80` → `var(--bg-card)`
- `bg-white/[0.01~0.06]` → `var(--bg-elevated)` / `var(--bg-card-hover)`
- `border-white/[0.01~0.08]` → `var(--border-card)` / `var(--border-light)`
- `bg-black/20` → `var(--bg-elevated)`
- `bg-gray-700/10~30` → 浅色灰条
- `text-gray-100,text-gray-950` → 补齐
- `text-emerald-400,amber-400,rose-400,red-200,emerald-300,blue-400/300` → 沉档
- `hover:bg-white/[0.01~0.08]` → 浅色 hover
- LoginPage 输入框 / label / 密码切换 / 爆码等
- 进度卡、解答示例代码(explain-example-code)、各项 bg-emerald/amber/rose/cyan/10
- 账号账页(account-modal)、度量格(metric-cell)

### 1.3 代码块与终端

- **shiki**：按需加载 (bash/nginx/yaml) + 内联 `var(--shiki-*)` token，CSS 变量在 dark/light 两套定义
- **终端**：`FloatingTerminal` 和 `TerminalView` 在浅色下强制保持深色（`background:#0a0a14`）

---

## 2. 本期应做的 7 页面打磨

| # | 页面/组件 | 当前状态 | 预期变更 |
|---|---|---|---|
| 1 | `AdminAnnouncementsPage.vue` | 模态 `bg-[#0c0f18]` 已全局覆盖；仍有 scoped hex 无浅色规则 | 追加浅色规则或 de-scooping |
| 2 | `AdminAuditPage.vue` | 同模态已覆盖；scoped hex 残留 | 转变量或补充 style.css |
| 3 | `AdminFeedbackPage.vue` | 同上 | 同上 |
| 4 | `AdminDesktopReleasesPage.vue` | 模态已全局处理；内部卡片/字段硬编码 hex 犹存 | 少量补丁 |
| 5 | `AdminUsersPage.vue` | `.metric-cell` 已全局处理 + bg-[#0c0f18] 已覆盖；剩余 `.metric-cell strong` text-gray-100 等缺口 | 补齐 style.css 或变量 |
| 6 | `QuizPage.vue` | bg-white/[0.0x] 已全局处理；bg-*-gradient 卡片在浅色下仍带深色氛围 | 调整 tab 默认/选中态 |
| 7 | `DailyStudyNotesPage.vue` | bg-black/20 textarea 已全局覆盖；bg-[#252525] 弹窗已覆盖；text-red-200/emerald-300 横幅已补 | 需验证 border-white/[0.0x] 输入框边线 |

## 3. 本期应做的 2 个组件

| # | 组件 | 预期变更 |
|---|---|---|
| C1 | `QuizPage.vue` → `QuizQuestionCard` | DIFF 难度标签 background-emerald/amber/rose-400/10 在浅色下底淡 | 加 `.bg-emerald-400/10` 等变量到全局覆盖 |
| C2 | `LandingPage.vue` | bg-[#0c0f18] 统计卡片已全局覆盖；scoped 色值移入变量或全局规则 |

## 4. 本期可选的结构改进

### 4.1 合并 style.css 中 Lab-card 和全局的双倍定义

目前 `bg-white/[0.01~0.05]` 在 `.lab-card .bg-white/...` 和全局两处都有规则，值相同。可把 `.lab-card` 限定符去掉，只留一份全局规则。

### 4.2 统一声明--skeleton 变量

当前骨架是 `bg-gray-700/10~30` 覆盖。可定义一个新的 `--skeleton` 变量在两套颜色模式下。

### 4.3 Deep 迁移 `dark:` 前缀

Phase 1 仅修了 `UpdateBanner` 的 Tailwind `dark:` 问题。后续可逐步将 style.css 的[data-theme="light"]补丁转换为组件的 `light:` 变体。

---

## 5. 质量门禁（每步必须执行）

```bash
npm run check    # vue-tsc -b 零错
npm run lint     # max-warning 0
npm test         # 18 files / 204 tests
npm run server:check  # server syntax
npm run build    # Vite build
git diff --check
```

## 6. 实施顺序建议

1. **先改 style.css** — 补全局覆盖（quiz bg-*/10、landing bg 等），可一次性解决多个页面
2. **再改 7 页面** — 每页改完立即 `check + lint + build`，避免堆积
3. **最后结构改进** — `--skeleton` 变量 + 整理重复规则
4. **前夕质量** — `npm test` + `npm run build` + 对比 dist 大小不爆涨

---

> 此文档已编码在 `docs/superpowers/specs/2026-07-25-light-mode-polish-phase2-plan.md`。  
> 交割文档见 `docs/superpowers/specs/2026-07-25-light-mode-polish-handoff.md`