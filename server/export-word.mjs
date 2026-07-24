/**
 * 学习笔记导出 Word 文档生成模块。
 *
 * 仅运行在 Node.js 服务端（不进入浏览器 bundle）。
 * 依赖 `docx` npm 包生成标准 OOXML .docx 文件。
 */

import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from 'docx'

/** AI 排版输出解析出的节段 */
export class ExSection {
  /**
   * @param {'title'|'chapter'|'code'|'body'} level
   * @param {string} text
   */
  constructor(level, text) {
    this.level = level
    this.text = text
  }
}

// ---------- AI 排版文本解析 ----------

/**
 * 解析 AI 输出的简单标记文本为结构化节段列表。
 *
 * 约定格式（AI prompt 中声明）：
 *   # 文档标题           → title (封面标题)
 *   ## 第N章 ...         → chapter
 *   ## 学习小结          → chapter (Heading)
 *   以 4 空格开头的行    → code (等宽/灰底)
 *   空行                 → 跳过
 *   其他                 → body (正文段落)
 *
 * @param {string} text - AI 返回的完整排版文本
 * @returns {ExSection[]}
 */
export function parseAiLayout(text) {
  const lines = text.split('\n')
  /** @type {ExSection[]} */
  const sections = []
  for (const rawLine of lines) {
    const line = rawLine.trimEnd()
    // 空行 -> 段落间距（不生成 section，后续 build 时在 spacings 处理）
    if (line.trim() === '') continue

    const trimmed = line.trimStart()
    if (line.startsWith('# ')) {
      sections.push(new ExSection('title', trimmed.slice(2).trim()))
    } else if (line.startsWith('## ')) {
      sections.push(new ExSection('chapter', trimmed.slice(3).trim()))
    } else if (line.startsWith('    ') || line.startsWith('\t')) {
      sections.push(new ExSection('code', trimmed))
    } else {
      sections.push(new ExSection('body', trimmed))
    }
  }
  return sections
}

// ---------- 日期格式化 ----------

/**
 * 将 YYYY-MM-DD 日期数组格式化为中文区间标签。
 * 单日 → "2026年7月24日"
 * 连续区间 → "2026年7月22日至24日"
 *
 * @param {string[]} dates - 已排序的 YYYY-MM-DD 数组
 * @returns {string}
 */
export function buildDateRangeLabel(dates) {
  if (dates.length === 0) return ''
  const sorted = [...dates].sort()
  const first = parseDateParts(sorted[0])
  const last = parseDateParts(sorted[sorted.length - 1])

  if (sorted.length === 1 || (first.year === last.year && first.month === last.month && first.day === last.day)) {
    return `${first.year}年${first.month}月${first.day}日`
  }

  if (first.year === last.year && first.month === last.month) {
    return `${first.year}年${first.month}月${first.day}日至${last.day}日`
  }

  if (first.year === last.year) {
    return `${first.year}年${first.month}月${first.day}日至${last.month}月${last.day}日`
  }

  return `${first.year}年${first.month}月${first.day}日至${last.year}年${last.month}月${last.day}日`
}

/**
 * @param {string} dateStr YYYY-MM-DD
 * @returns {{ year: number, month: number, day: number }}
 */
function parseDateParts(dateStr) {
  const [y, m, d] = dateStr.split('-')
  return { year: Number(y), month: Number(m), day: Number(d) }
}

// ---------- Docx 构造 ----------

/**
 * 根据解析出的节段列表生成 docx Document 对象。
 *
 * 封面标题 + 章节 + 正文 + 代码段。
 *
 * @param {ExSection[]} sections
 * @param {{ title: string, dateRangeLabel: string, mode: string, generatedAt: string }} metadata
 * @returns {Document}
 */
export function buildDocxFromSections(sections, metadata) {
  /** @type {Paragraph[]} */
  const children = []

  // 封面
  children.push(...buildCover(metadata))

  // 正文节段
  let afterHeading = false
  for (const sec of sections) {
    switch (sec.level) {
      case 'title':
        // AI 返回的标题通常出现在开头，作为封面标题已在封面展示；
        // 如果中间出现 # ，作为文档内标题
        children.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 360, after: 240 },
            children: [
              new TextRun({ text: sec.text, size: 36, bold: true, font: 'Microsoft YaHei' }),
            ],
          }),
        )
        afterHeading = false
        break
      case 'chapter':
        if (afterHeading) {
          // 章节之间留更大间距
          children.push(new Paragraph({ spacing: { before: 100 } }))
        }
        children.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 300, after: 160 },
            children: [
              new TextRun({ text: sec.text, size: 32, bold: true, font: 'Microsoft YaHei' }),
            ],
          }),
        )
        afterHeading = true
        break
      case 'code':
        children.push(
          new Paragraph({
            spacing: { before: 80, after: 80 },
            indent: { left: 360 },
            shading: { type: 'solid', fill: 'F3F4F6' },
            children: [
              new TextRun({ text: sec.text, font: 'Courier New', size: 20 }),
            ],
          }),
        )
        afterHeading = false
        break
      case 'body':
      default:
        children.push(
          new Paragraph({
            spacing: { after: afterHeading ? 160 : 120 },
            children: [
              new TextRun({ text: sec.text, size: 22, font: 'Microsoft YaHei' }),
            ],
          }),
        )
        afterHeading = false
        break
    }
  }

  return new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Microsoft YaHei', size: 22 },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
          },
        },
        children,
      },
    ],
  })
}

/**
 * 生成封面段落组。
 *
 * @param {{ title: string, dateRangeLabel: string, mode: string, generatedAt: string }} metadata
 * @returns {Paragraph[]}
 */
function buildCover(metadata) {
  const modeLabel = metadata.mode === 'ai-layout' ? 'AI 自动排版' : '原样笔记导出'
  return [
    // 上方留白
    new Paragraph({ spacing: { before: 1600 } }),
    // 标题
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 600 },
      children: [
        new TextRun({ text: metadata.title, size: 56, bold: true, font: 'Microsoft YaHei' }),
      ],
    }),
    // 日期范围
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({ text: metadata.dateRangeLabel, size: 24, color: '64748B', font: 'Microsoft YaHei' }),
      ],
    }),
    // 生成方式 + 时间
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [
        new TextRun({ text: `${modeLabel}  ·  生成于 ${metadata.generatedAt}`, size: 20, color: '94A3B8', font: 'Microsoft YaHei' }),
      ],
    }),
    // 封面/正文分隔
    new Paragraph({ spacing: { before: 800 } }),
  ]
}

/**
 * 原样笔记导出（不经过 AI）：按日期从早到晚逐篇输出。
 *
 * @param {{ date: string, dateLabel: string, content: string }[]} notes
 * @param {{ dateRangeLabel: string, generatedAt: string }} metadata
 * @returns {Document}
 */
export function buildRawDocx(notes, metadata) {
  /** @type {Paragraph[]} */
  const children = []

  // 封面
  children.push(...buildCover({
    title: '学习笔记',
    dateRangeLabel: metadata.dateRangeLabel,
    mode: 'raw',
    generatedAt: metadata.generatedAt,
  }))

  // 按日期分章节
  for (const note of notes) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 300, after: 160 },
        children: [
          new TextRun({ text: note.dateLabel, size: 28, bold: true, font: 'Microsoft YaHei' }),
        ],
      }),
    )

    // 正文按段落分割
    const paragraphs = note.content.split('\n')
    for (const para of paragraphs) {
      const trimmed = para.trim()
      if (trimmed === '') {
        children.push(new Paragraph({ spacing: { after: 80 } }))
        continue
      }
      const isCode = para.startsWith('    ') || para.startsWith('\t') || trimmed.startsWith('$ ') || trimmed.startsWith('# ')
      if (isCode) {
        children.push(
          new Paragraph({
            spacing: { before: 80, after: 80 },
            indent: { left: 360 },
            shading: { type: 'solid', fill: 'F3F4F6' },
            children: [
              new TextRun({ text: trimmed, font: 'Courier New', size: 20 }),
            ],
          }),
        )
      } else {
        children.push(
          new Paragraph({
            spacing: { after: 120 },
            children: [
              new TextRun({ text: trimmed, size: 22, font: 'Microsoft YaHei' }),
            ],
          }),
        )
      }
    }

    children.push(new Paragraph({ spacing: { before: 100 } }))
  }

  return new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Microsoft YaHei', size: 22 },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
          },
        },
        children,
      },
    ],
  })
}

/**
 * 生成最终 .docx Buffer。
 *
 * @param {Document} doc
 * @returns {Promise<Buffer>}
 */
export async function toDocxBuffer(doc) {
  return Packer.toBuffer(doc)
}