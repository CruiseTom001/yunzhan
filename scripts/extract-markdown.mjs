/**
 * 提取课程 .ts 文件中的 Markdown 内容到独立 .md 文件
 *
 * 使用方式：
 *   cd E:\trae_project\云栈
 *   node scripts/extract-markdown.mjs
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const COURSES_DIR = path.resolve(__dirname, '../src/data/courses')
const MARKDOWN_DIR = path.resolve(__dirname, '../src/data/markdown')

const COURSE_FILES = fs.readdirSync(COURSES_DIR)
  .filter(f => f.endsWith('.ts') && f !== 'index.ts' && f !== 'all.ts')

function extractCourse(tsFile) {
  const filePath = path.join(COURSES_DIR, tsFile)
  if (!fs.existsSync(filePath)) {
    console.log(`  ❌ 文件不存在: ${tsFile}`)
    return
  }

  const courseId = tsFile.replace('.ts', '')
  const courseDir = path.join(MARKDOWN_DIR, courseId)
  fs.mkdirSync(courseDir, { recursive: true })

  const text = fs.readFileSync(filePath, 'utf-8')
  const lines = text.split('\n')

  // 第一步：找出所有 content 块
  const contentBlocks = []
  let inContent = false
  let block = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (!inContent) {
      const match = line.match(/content:\s*`([\s\S]*)/)
      if (!match) continue

      let idx = 0
      for (let j = Math.max(0, i - 6); j < i; j++) {
        const m = lines[j].match(/index:\s*(\d+)/)
        if (m) idx = parseInt(m[1])
      }

      const trimmed = line.trimEnd()
      const afterTick = match[1]

      // 单行 content（行尾就是 `,）
      if (trimmed.endsWith('`,') && !trimmed.startsWith('content:')) {
        // 去掉行尾的反引号和逗号
        const content = afterTick.slice(0, afterTick.lastIndexOf('`'))
        contentBlocks.push({ index: idx, startLine: i, endLine: i, content })
        inContent = false
      } else if (trimmed.endsWith('`,') || trimmed.endsWith('`,')) {
        // 本行结束（含起始内容）
        const raw = line.slice(line.indexOf('`') + 1)
        const content = raw.slice(0, Math.max(raw.lastIndexOf('`,'), raw.lastIndexOf('`'), 0))
        contentBlocks.push({ index: idx, startLine: i, endLine: i, content })
        inContent = false
      } else {
        inContent = true
        block = { index: idx, startLine: i, lines: [afterTick] }
      }
      continue
    }

    if (!block) continue

    const trimmed = line.trimEnd()
    // 行尾有 `, → 内容结束
    if (trimmed.endsWith('`,') || trimmed.endsWith('`,')) {
      const cleanLine = line.replace(/`,\s*$/, '').replace(/`\s*$/, '')
      block.lines.push(cleanLine)
      const content = block.lines.join('\n')
      contentBlocks.push({ index: block.index, startLine: block.startLine, endLine: i, content })
      block = null
      inContent = false
    } else {
      block.lines.push(line)
    }
  }

  contentBlocks.sort((a, b) => a.index - b.index)

  if (contentBlocks.length === 0) {
    console.log(`  ⏭️ ${tsFile} 已处理过`)
    return
  }

  console.log(`📄 ${tsFile} — ${contentBlocks.length} 个内容块`)

  let modified = text
  let successCount = 0

  for (const c of contentBlocks) {
    let rawContent = c.content.replace(/^\n+/, '').replace(/\n+$/, '')

    const mdFile = `chapter-${c.index}.md`
    const mdPath = path.join(courseDir, mdFile)

    fs.writeFileSync(mdPath, rawContent, 'utf-8')
    console.log(`  ✅ chapter-${c.index}.md (${rawContent.length} 字符)`)

    // 替换 .ts 中的原文
    const origLines = lines.slice(c.startLine, c.endLine + 1)
    const origText = origLines.join('\n')

    const indent = '      '
    const replacement = `${indent}contentFile: '${courseId}/${mdFile}',\n${indent}content: ''`

    if (modified.includes(origText)) {
      modified = modified.replace(origText, replacement)
      successCount++
    } else {
      console.log(`  ⚠️ 替换失败 chapter-${c.index}`)
    }
  }

  if (successCount > 0) {
    fs.writeFileSync(filePath, modified, 'utf-8')
    console.log(`  ✅ ${tsFile} 已更新`)
  }
}

// ===== 主流程 =====
console.log('=== 提取课程 Markdown 内容 ===\n')

const alreadyDone = []
const toProcess = []

for (const file of COURSE_FILES) {
  const filePath = path.join(COURSES_DIR, file)
  const text = fs.readFileSync(filePath, 'utf-8')
  if (text.includes('contentFile:')) {
    alreadyDone.push(file)
  } else {
    toProcess.push(file)
  }
}

for (const file of toProcess) {
  extractCourse(file)
}

if (alreadyDone.length > 0) {
  console.log(`\n⏭️ 已处理：${alreadyDone.join(', ')}`)
}
console.log('\n=== 全部完成 ===')
