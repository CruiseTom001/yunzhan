# 学习笔记导出 Word 文档功能设计

> 日期：2026-07-24
>
> 状态：草案（审批阶段）
>
> 适用仓库：`E:\trae_project\运维学习网站`

## 1. 目标与非目标

### 目标

在「每日学习记录」页面新增导出 Word 文档能力：

1. **勾选多条笔记**（日期复选框，支持 1-30 篇）
2. **AI 生成结构化文档**：所有选中笔记交由 AI 整合、提炼主题、生成章层排版 Word 文档
3. **原笔记直出**：不经过 AI，按日期分组的原样笔记导出（保留原文/已润色内容）
4. **文档有封面页**（标题 + 日期范围 + 生成时间）
5. **浏览器下载真正的 `.docx`**

### 非目标

- 不改为富文本编辑器
- 不新增图片/图表排版
- 不生成 PDF / HTML / Markdown 格式
- 不云端持久化文档
- 不做模板选择器
- 不做流式进度推送（首次用 loading spinner）

## 2. 用户流程

```
用户在 /study-notes 侧边栏勾选笔记 (checkbox)
    │
    ▼
侧栏底部显示计数 + 「导出 Word 文档」按钮 → 弹出确认弹窗
    │
    ├─ [AI 排版导出]  (Radio 默认选中)
    │    发送 POST → Server /api/study-notes/export-word?mode=ai-layout
    │    Server SELECT 笔记 → 拼配 AI prompt → AI 返回排版文本 → docx 包生成
    │    Server 返回 Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document
    │    浏览器触发 download
    │
    └─ [原样笔记导出]  (Radio 切换)
         发送 POST → Server /api/study-notes/export-word?mode=raw
         Server SELECT 笔记 → 直接 buildDocx（无 AI）
         浏览器触发 download
```

### 文件名格式

`学习笔记_2026年7月22日至24日.docx`（中文日期区间，按勾选最早和最晚日期计算）。

## 3. 新增服务器端点

### POST /api/study-notes/export-word

- **鉴权**：`requireAuth`
- **Content-Type request**：`application/json`
- **Content-Type response**：二进制 docx（成功） / `application/json`（错误）
- **Content-Disposition response**：`attachment; filename="学习笔记_xxx.docx"`

#### 请求体

```json
{
  "dates": ["2026-07-22", "2026-07-23", "2026-07-24"],
  "mode": "ai-layout",          // "ai-layout" | "raw"
  "providerId": "deepseek_v3"   // 可选，仅 ai-layout 模式使用
}
```

`dates` 长 1-30，每个元素经 `validateStudyNoteDate` 校验。

#### mode=ai-layout 流程

1. 校验 `dates`, `providerId`
2. `pool.query` 查询 `user_id = request.auth.id AND note_date IN (dates)`（最多 30 条）
3. 构造 `buildExportPrompt(notes, mode='ai-layout')`：整合所有笔记交给 AI
4. `requestStudyNoteAi({content: assembledPrompt, purpose: 'export', providerId})`
5. AI 返回结构化排版文本 → `parseAiLayout(text)` 解析章/段/代码标记
6. `buildDocx(sections)` + `Packer.toBuffer(doc)` 生成 Buffer
7. 写回 response

#### mode=raw 流程

1. 校验 `dates`
2. `pool.query` 同上
3. `buildDocx` 直接按日期分组、不做 AI 调用
4. 返回 Buffer

#### 错误场景

| 条件 | HTTP | 错误 JSON |
| --- | --- | --- |
| dates 空/格式错误 | 400 | `{ error: '学习记录日期...' }` |
| AI 提供商未配置/离线 | 502 | `{ error: 'AI 厂商...' }` |
| AI 返回空 | 502 | `{ error: 'AI 排版未产生...' }` |
| docx 生成异常 | 500 | `{ error: '文档生成异常。' }` |
| dates 不属于本用户 | 正常 SQL 返回 0 行，生成空文档（含封面） | N/A |

## 4. 新增前端能力

### studyNotesApi.ts

```typescript
type ExportMode = 'ai-layout' | 'raw'

export async function exportStudyNotesAsWord(
  dates: string[],
  mode: ExportMode,
  providerId?: string,
): Promise<{ blob: Blob; filename: string }>

// 用 fetch 直连（不可经 apiRequest，后者默认解析 JSON）
```

### DailyStudyNotesPage.vue

1. **侧边栏复选框**（`line 534-577` 区间）：每个 `sortedNotes` 条目前新增 `<input type='checkbox' :value='note.date' v-model='selectedExportDates' @click.stop>`。
2. **侧栏底部导出栏**：计数 + 按钮 `已选 N 篇  📥 导出 Word 文档`（仅 selectedExportDates.length > 0 时显示）。
3. **确认弹窗**（仿 AI config modal 模式）：显示已选数量/日期区间、mode 单选（AI 排版 / 原样笔记）、导出按钮 → executeExport。
4. **axporting/exportError loading 态**：按钮禁用 + 进度文字 `正在准备笔记数据…` `正在生成文档…`。
5. **浏览器下载**：`URL.createObjectURL(blob) → <a>.click() → URL.revokeObjectURL`。

## 5. AI 排版 Prompt 定义

```ts
function buildExportPrompt(notes: NoteForExport[]) {
  // NoteForExport = { date, titleDate, content }
  // 优先用 polishedContent，为空则用 content
  return [
    '你是云栈运维学习笔记整理助手。',
    '任务：将下列多篇学习笔记整合为一份结构化学习文档（语言用中文），按以下格式输出：',
    '# {智能概括的文档标题}',
    '## 第1章 {主题标题}',
    '{从相关笔记提炼融合的正文，保留命令/参数/配置等}',
    '## 第2章 ...',
    '## 学习小结',
    '{全篇内容的提炼总结，100-200字}',
    '',
    '格式约定：以 "# " 开头的作为封面的标题；以 "## " 开头的是章节；普通行是正文。',
    '几条：保留技术细节（命令、参数、配置），合并重复内容，不发明新知识。',
    '',
    '下面是笔记（按日期）：',
    `总共 ${notes.length} 篇笔记`,
    ...notes.flatMap(note => [
      '',
      `---`,
      `日期：${note.titleDate}`,
      note.content,
    ]),
  ].join('\n')
}
```

## 6. docx 生成模块 (server/export-word.mjs)

### 用 `docx` npm 包（5 点理由）

详见实施计划中的依赖决策。

### 解析 AI 排版输出

AI 输出格式为简单标记文本。`parseAiLayout` 按行拆分：

| 行开始 | 映射 docx 构造 | 样式 |
| --- | --- | --- |
| `# ` | HeadingLevel.TITLE (封面标题) | size=56, bold, CENTER |
| `## 第N章` | HeadingLevel.HEADING_1 | size=32, bold, 段前 300 |
| `` ` `` 或 `    ` 开头 | 代码段落 | Courier New 20/灰色背景 |
| 空行 → 段落间隔 | spacing: after: 160 | — |
| 其他 → 正文 | Paragraph size=22 | after 120 |

### 封面页

`buildCover` 生成：
- 标题（居中 bold）
- 日期范围：`2026年7月22日至24日`
- 生成时间：`2026-07-24 12:30`
- 生成方式：AI 自动排版 / 原样导出
总在文档第一节，第一章在新的 Section 开始。

### raw 模式文档结构

无 AI：按日期逐篇输出：
```
## 07月22日
{content / polishedContent}
## 07月23日
{content / polishedContent}
...
```

## 7. 安全边界

- API 密钥不进入导出接口、不进入 docx 最终文件
- 提示词内嵌虽有用户内容，但仅注入用户己笔记（无外部注入点）
- 二进制 docx 不包含 JS/宏/外部 URL（`docx` 包纯 OOXML，无脚本上下文）
- `contentLengthMax=120000`（30×4000 avg），超出按截断 + "省略" 处理
- 文档不持久化在文件系统——生成后仅以 Buffer 发回、用完回收

## 8. 兼容性评估

| 维度 | 评估 |
| --- | --- |
| 数据模型 | 不动 `study_notes` 结构，纯读 |
| 进度 | 无关 |
| Web / Web 前端 | 仅新增按钮/弹窗/API 调用，不动现有功能 |
| Electron | 导出 API 走 Web Server，不动 preload/main/IPC |
| 章节数 | 无关 |
| 管理后台 | 无关 |
| 移动端 | 复选框 + 弹窗 Tailwind 自然适配 |

## 9. 测试策略

- Server 测试：`server/export-word` 单元测试 (Vitest)：
  - `parseAiLayout` 解析章节/代码/正文
  - `buildDocx` 返回 Buffer（Packer.toBuffer），检查长度 > 0
  - AI prompt 不含 API Key 泄漏
- 前端测试：`src/utils/studyNotesApi.test.ts` 新增：
  - `exportStudyNotesAsWord` blob 解析 + 文件名提取
  - 错误响应 → 抛出中文消息
  - 空日期 → 抛错

## 10. 交付项

1. `server/export-word.mjs` — docx 生成模块
2. `server/index.mjs` — 新增 `/api/study-notes/export-word` 路由
3. `server/ai-provider.mjs` — 新增 `purpose=export` prompt 常量 + maxTokens 调整
4. `src/utils/studyNotesApi.ts` — 新增 `exportStudyNotesAsWord()` + `ExportMode` 类型导出
5. `src/pages/DailyStudyNotesPage.vue` — 复选框 + 导出按钮 + 弹窗 + 进度交互
6. `package.json` — 新增 `docx` 依赖 (dependencies)
7. `docs/superpowers/specs/2026-07-24-notes-export-word-design.md` — 本设计文档
8. `docs/superpowers/plans/2026-07-24-notes-export-word.md` — 实施计划（待审批通过后写入）