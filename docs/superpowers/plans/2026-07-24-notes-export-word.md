# 学习笔记导出 Word 文档功能 — 实施计划

> 日期：2026-07-24
>
> 依赖设计文档：`docs/superpowers/specs/2026-07-24-notes-export-word-design.md`
>
> 状态：待审批后实施

## 一、变更范围（只动 6 个文件 + 新建 1 个文件）

| 文件 | 动作 | 行数估 |
| --- | --- | --- |
| `package.json` | +1 dep (`docx`) | ~1 行 |
| `server/export-word.mjs` | **新建**，docx 生成模块 | ~250 行 |
| `server/index.mjs` | 新增 `POST /api/study-notes/export-word` 路由（在 PolishStream 之后，error handler 之前） | ~75 行 |
| `server/ai-provider.mjs` | `buildAiRequest` 新增 `purpose=export` 分支（longer maxTokens、新 systemPrompt）；`requestStudyNoteAi` 的 `AI_POLISHED_MAX_LENGTH` 需要为 export 提供更大上限 | ~20 行 |
| `src/utils/studyNotesApi.ts` | 新增 `exportStudyNotesAsWord()` + `ExportMode` 类型导出 | ~90 行 |
| `src/pages/DailyStudyNotesPage.vue` | 侧栏复选框 + 导出栏 + 确认弹窗 + 导出逻辑 | ~160 行 |
| `docs/superpowers/specs/...-design.md` | 已创建（本次） | — |
| `docs/superpowers/plans/...-notes-export-word.md` | 本文件 | — |

**不改**：AI 组件、终端、Electron `main.cjs`/`preload.cjs`、课程数据、进度 Store、章节数、路由、管理后台。

## 二、依赖决策

| 包 | 必要性 | 安全边界 | 体积 | 维护成本 |
| --- | --- | --- | --- | --- |
| `docx` (npm) | 零原生依赖、纯 JS 生成标准 `.docx` OOXML。无法用手拼 XML 获得同等可靠性/维护性 | 只 Server 运行，无客户端暴露。开源 MIT | ~300KB 安装后 ~5MB | 生态成熟（weekly 200K+ dowloads），API 稳定，本项目只用 `Packer.toBuffer` + `Document` + `Paragraph` + `TextRun` + `HeadingLevel` subset |

已有 `dompurify` / `markdown-it` 等文档基础设施，`docx` 仅服务端用，不影响前端 bundle 体积。

## 三、实施顺序（5 步）

### Step 1：安装依赖 + 构建 docx 生成模块

1. `npm install docx --save-exact`（锁定版本）
2. 新建 `server/export-word.mjs`：

```
parseAiLayout(text): { level:'title'|'chapter'|'code'|'body', text }[]
buildCover(title, dateRangeLabel, mode, generatedAt): Paragraph[]
buildDocxFromSections(sections): Document  → Packer.toBuffer
buildRawDocx(notes): docx Buffer (无 AI)
```

验证：`node -e "const m=require('./server/export-word.mjs'); ..."` 确保模块可加载。

3. `server/ai-provider.mjs` 改动：
   - `buildStudyNotePolishPrompt()` 旁边追加 `buildStudyNoteExportPrompt()` — 用于系统提示
   - `buildAiRequest()` 新增 `purpose === 'export'` 分支 → `maxTokens=4000`（长文档需要更多 token）
   - `requestStudyNoteAi()` 中 `parsedContent` 上限判断：`purpose === 'export'` 用 `AI_EXPORT_MAX_LENGTH = 120_000`（对应 30 篇×4000 avg）
   - 修改 `parseAiContent` 匹配常量。

4. 测试：立即写 `server/export-word.test.mjs` 覆盖 `parseAiLayout` 和 `buildDocxFromSections`（Buffer > 0），确保后续改动 baseline 可见。

### Step 2：新增服务器端点

1. `server/index.mjs` 第 1363 行后（PolishStream 关门之后、Admin Audit 准备行之前）插入：

```
app.post('/api/study-notes/export-word', requireAuth, asyncRoute(async (request, response) => {
  // 1. validate body
  // 2. validateDates → query DB
  // 3. if mode=ai-layout → buildExportPrompt → requestStudyNoteAi(purpose:export) → parseAiLayout → buildDocxFromSections
  // 4. if mode=raw → buildRawDocx
  // 5. response + Content-Type + Content-Disposition
}))
```

2. 校验复用 `hasOnlyKeys`、`validateStudyNoteDate`、`readOptionalProviderId`。

3. 文件名格式：`学习笔记_2026年7月22日至24日.docx` → `buildDateRangeLabel(dates)` 函数：
```
function buildDateRangeLabel(dates: string[]) {
  const sorted = [...dates].sort()
  const first = sorted[0]; const last = sorted[sorted.length - 1]
  // 格式化为 "2026年7月22日至24日"（同日去重 → "2026年7月22日"）
}
```

4. 写 server 测试（`server/export-word.test.mjs` 补充路由层测试）。

### Step 3：前端 API client + 类型导出

1. `src/utils/studyNotesApi.ts`：
   - 顶部 `export type ExportMode = 'ai-layout' | 'raw'`
   - 新增 `exportStudyNotesAsWord(dates, mode, providerId?)` — 参照 `polishStudyNoteViaServerStream` 的 fetch 模式（不用 apiRequest），取 blob + Content-Disposition 提取文件名。

2. 注册 `ExportMode` 到页面 import（`DailyStudyNotesPage.vue` 的 import 块）。

3. 写前端测试：`src/utils/studyNotesApi.test.ts` 补充 `exportStudyNotesAsWord` 的 fake fetch blob 测试。

### Step 4：页面 UI 改动

1. `DailyStudyNotesPage.vue` script：
   - 新增 refs：`selectedExportDates: ref<string[]>([])`、`showExportConfirm: ref(false)`、`exporting: ref(false)`、`exportError: ref('')`、`exportMode: ref<ExportMode>('ai-layout')`
   - 新增 computed：`exportDateRangeLabel`（从 selectedExportDates 算）
   - 新增函数：`openExportConfirm()`、`executeExport()`、取消回调

2. 侧边栏每笔记行插入 checkbox（`line 535~577`）：

```
<label v-for="note in sortedNotes" :key="note.date" class="... flex gap-2 cursor-pointer">
  <input type='checkbox' :value='note.date' v-model='selectedExportDates' @click.stop />
  <button @click='selectDate(note.date)' class='text-left flex-[1] ...'> ... (原样不变) </button>
</label>
```

3. 侧栏底部导出栏（列表 `<div>` 后）：

```
<div v-if='selectedExportDates.length > 0' class='mt-3 px-3'>
  <p>已选 {{ selectedExportDates.length }} 篇（{{ exportDateRangeLabel }}）</p>
  <button @click='openExportConfirm' :disabled='exporting' class='...'>
    📥 导出 Word 文档
  </button>
</div>
```

4. 确认弹窗（`line 701` 前，和 AI config modal 同级固定定位）：

```
<div v-if='showExportConfirm' class='fixed inset-0 z-[60] bg-black/50 flex items-center justify-center'>
  <div class='bg-gray-900 rounded-xl ... p-6 max-w-md'>
    <h3>导出 Word 文档</h3>
    <p>已选 N 篇笔记，{{ exportDateRangeLabel }}</p>
    <div class='...'>
      <label>导出方式</label>
      <radio-group v-model='exportMode'>
        <radio value='ai-layout'>AI 自动排版（推荐）</radio>
        <radio value='raw'>原样笔记输出</radio>
      </radio-group>
    </div>
    <p v-if='exportError'>{{ exportError }}</p>
    <div>
      <button @click='showExportConfirm=false'>取消</button>
      <button @click='executeExport' :disabled='exporting'>
        {{ exporting ? '生成中…' : '开始生成' }}
      </button>
    </div>
  </div>
</div>
```

5. `executeExport` 函数：

```
async executeExport() {
  exporting.value = true; exportError.value = ''
  try {
    const { blob, filename } = await exportStudyNotesAsWord(
      selectedExportDates.value, exportMode.value,
      ai-layout ? 当前选择的 provider id : undefined,
    )
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = filename
    a.click(); URL.revokeObjectURL(url)
    showExportConfirm.value = false
    setTransientMessage('已成功导出 ' + filename)
  } catch (e) {
    exportError.value = e instanceof Error ? e.message : '导出失败，请稍后再试'
  } finally { exporting.value = false }
}
```

6. Tailwind 无横向溢出检查：弹窗 `max-w-md` + `p-6`，Radio Group 在窄屏自动堆叠。复选框在移动端 sidebar 自然跟随 `<label>` flex 布局。

### Step 5：质量门禁 + 提交 + 推送

按序跑：

1. `npm run policy:check`
2. `npm run check`
3. `npm run lint`
4. `npm run server:check`（新 `export-word.mjs` 是 .mjs，会覆盖）
5. `npm test`（新 server 测试 + API 测试补齐）
6. `npm run build`
7. `git diff --check`

通过后提交：

```
git add server/export-word.mjs server/export-word.test.mjs \
        server/index.mjs server/ai-provider.mjs \
        src/utils/studyNotesApi.ts src/pages/DailyStudyNotesPage.vue \
        package.json package-lock.json \
        docs/superpowers/specs/2026-07-24-notes-export-word-design.md \
        docs/superpowers/plans/2026-07-24-notes-export-word.md

git commit -m "feat: export study notes as AI-formatted Word document"
git push origin main
```

## 四、风险与验点

| 风险 | 应对 |
| --- | --- |
| Vercel Hobby Plan 10s 函数超时（AI 调用 + docx 生成） | `requestStudyNoteAi` 已有 65s timeout，Vercel 20 秒 body limit → 前端 loading 30s 可接受；如果实测超时，可将 AI 调用独立成 Vercel Edge Function |
| 用户未登录/未配置 AI → 导出按钮不可见 | `aiReady` 已判断：未配置 AI 时 `exportMode=ai-layout` 按钮禁用并给提示 |
| docx 包对旧 Node.js 兼容性 | 项目最低 Node.js ≥22，`docx` v8+ 完全兼容 |
| AI 返回排版思想乱 | fallback：`parseAiLayout` 解析失败 → 改为 raw 模式输出（降级逻辑在 server 侧实现） |
| 勾选复选框误触发 `selectDate` | `@click.stop` 阻止事件冒泡，原 `<button>` 不受影响 |

## 五、兼容性

- 只读 `study_notes` 表，不动结构。
- 全站导航、课程库、进度、登录注册等不受影响。
- Electron 桌面端无需任何改动 — 导出 API 走 Web Server。
- 移动端 checkbox + 弹窗 Tailwind 响应式自然适配。

## 六、实施步骤汇总

| Step | 内容 | 预计行数 |
| --- | --- | --- |
| 1 | install `docx` + 创建 `server/export-word.mjs` (+ tests) | ~300 |
| 2 | `server/index.mjs` 新增路由 + `ai-provider.mjs` export 分支 | ~100 |
| 3 | `src/utils/studyNotesApi.ts` 新增 `exportStudyNotesAsWord` + tests | ~110 |
| 4 | `DailyStudyNotesPage.vue` 复选框 + 弹窗 + 导出逻辑 | ~160 |
| 5 | 7 门禁 + 提交推送 | — |
| **总计** | | **~670 行** |

## 七、验证清单（推送后）

- Vercel 部署 Ready → `https://yunzhan.vercel.app/#/study-notes`
- 登录后看到以往笔记，侧栏出现复选框
- 勾选 ≥1 篇 → 底部出现「导出 Word 文档」按钮
- 点击 → 弹出确认弹窗，Radio 切换 AI / 原样
- 执行导出 → loading 态 → 浏览器下载 `.docx`
- 用 Word / WPS 打开 → 有封面页 + 章节正文 + 中文正常
- 移动端无横向溢出
- Electron 桌面端同样操作 OK