# 浅色模式打磨 Phase 1 — 交割文档

> **交付日期**：2026-07-25  
> **接收方**：Grok / 后续接手者  
> **分支**：`main`（当前工作区有未提交的本地改动）

---

## 1. 已完成工作概览

| 层面 | 内容 |
|---|---|
| 架构修补 | FOUC 预防脚本、Tailwind `darkMode` 修复、`--accent-*` 变量深浅对称 |
| 样式集中补丁 | `style.css` 增 ~150 行浅色覆盖，覆盖面广（硬编码深底、半透明白、骨架、色阶补全、登录页元素等） |
| 代码高亮迁移 | `highlight.js` → `shiki` (css-variables 主题, 按需仅加载 bash/nginx/yaml 3 个语言) |
| 四个页面级打磨 | LoginPage、CourseDetailPage、AccountPage、HomePage 的 scoped hex → CSS 变量 |
| 终端策略 | 在浅色模式下终端外框显式声明保持深色，避免全局覆盖误洗 |
| 弹窗浅色化 | 全部硬编码深底模框の bg-[#...] 由全局覆盖 → 浅色卡片 |

## 2. 变更清单（11 个文件）

| 文件 | 变更类型 | 行数估算 |
|---|---|---|
| `index.html` | +13 行 FOUC 内联脚本 | +13 |
| `src/stores/theme.ts` | +1 行 `classList.toggle('dark')` | +1 |
| `src/style.css` | 浅色覆盖系统 + shiki 变量 + 终端深色 | +~140 / -50 |
| `src/utils/markdown.ts` | hljs→shiki 按需加载 | 全文重写 |
| `src/components/common/MarkdownRenderer.vue` | shiki 异步就绪检测 | +20 |
| `src/pages/LoginPage.vue` | scoped hex→var 全量 | ~60 行替换 |
| `src/pages/CourseDetailPage.vue` | 核心面板 hex→var | ~30 行替换 |
| `src/pages/AccountPage.vue` | select option hex→var | +2 -2 |
| `src/pages/HomePage.vue` | brand-glitch + skill-label hex→var | +3 -3 |
| `package.json` | −highlight.js +shiki | +1 -1 |

## 3. 质量门禁（全部通过）

```bash
npm run check      # ✅ vue-tsc -b 零错
npm run lint       # ✅ max-warnings 0
npm run server:check  # ✅ 20 文件语法 OK
npm test           # ✅ 18 files, 204 tests passed
npm run build      # ✅ Vite build 通过，shiki 按需导入避免 200+ 语言膨胀
git diff --check   # ✅ 无尾空白
```

## 4. 关键技术决策

| 项目 | 选择 | 理由 |
|---|---|---|
| 推进策略 | 分层治理（Phase 1 先 10 核心页） | 见效快、风险低 |
| 弹窗 | 全部融入浅色 | 一致性最好 |
| 终端 | 始终深色 | 终端必定深色更合理 |
| 代码高亮 | shiki 按需 3 语言 | 告别 hljs 无高亮的隐藏 bug |
| FOUC | 内联同步脚本 | 最快最快 |

## 5. 兼容性提示

- **深色模式**所有页面保持与改动前视觉一致（已逐步替换硬编码 hex 为变量，但变量取值与原 hex 相同）
- **浅色补丁**优先影响 10 核心页面 + style.css 全局规则；不在此列表的页面（Admin 等）仅受全局覆盖保护
- **shiki 异步发放**首屏可能处于 `data-shiki-pending`（灰色代码块），入场后回调重渲染抹平

---

## 6. 给出下文修改建议 —— 浅色模式 Phase 2 工作项

见配套文档 `specs/2026-07-25-light-mode-polish-phase2-plan.md`