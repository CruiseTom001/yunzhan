/**
 * 构建前校验：chapterCounts 表与 src/data/markdown 下实际 .md 文件数是否一致
 *
 * 设计动机：
 * - chapterCounts 用于进度百分比/成就计算，手工维护容易脱节（曾导致 linux-basics
 *   声称 14 章实际只有 8 章，进度永远卡在 57%）。
 * - 不能在运行时用 import.meta.glob 派生：那会把 .md 内容拉进首屏 bundle。
 * - 折中：运行时手工维护，但构建时自动校验，不一致则 fail-fast。
 *
 * 运行：node scripts/check-chapter-counts.cjs
 * 退出码：0 = 一致；1 = 不一致（构建应中止）
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const MARKDOWN_DIR = path.join(ROOT, 'src', 'data', 'markdown')
const COURSES_INDEX = path.join(ROOT, 'src', 'data', 'courses', 'index.ts')

/** 扫描 src/data/markdown 下每个课程目录的 chapter-*.md 文件数 */
function scanMarkdownCounts() {
  const counts = {}
  if (!fs.existsSync(MARKDOWN_DIR)) return counts
  for (const course of fs.readdirSync(MARKDOWN_DIR)) {
    const courseDir = path.join(MARKDOWN_DIR, course)
    if (!fs.statSync(courseDir).isDirectory()) continue
    const files = fs
      .readdirSync(courseDir)
      .filter((f) => /^chapter-\d+\.md$/.test(f))
    counts[course] = files.length
  }
  return counts
}

/** 用正则从 courses/index.ts 提取 chapterCounts 字面量 */
function parseChapterCounts() {
  const src = fs.readFileSync(COURSES_INDEX, 'utf8')
  // 匹配 chapterCounts 表块（支持行内 'key': value 或 "key": value）
  const blockMatch = src.match(/export const chapterCounts[^{]*\{([\s\S]*?)\}/)
  if (!blockMatch) {
    throw new Error('check-chapter-counts: 未找到 chapterCounts 定义')
  }
  const body = blockMatch[1]
  const counts = {}
  // 支持带引号 ('key'/"key") 或裸 key（git: 6），key 不含引号/冒号/空白
  const re = /['"]?([^'":\s]+)['"]?\s*:\s*(\d+)/g
  let m
  while ((m = re.exec(body)) !== null) {
    counts[m[1]] = Number(m[2])
  }
  return counts
}

function main() {
  const actual = scanMarkdownCounts()
  const declared = parseChapterCounts()

  const allKeys = new Set([...Object.keys(actual), ...Object.keys(declared)])
  const mismatches = []
  for (const key of allKeys) {
    const a = actual[key] ?? 0
    const d = declared[key] ?? 0
    if (a !== d) {
      mismatches.push(`  ${key.padEnd(20)} 实际 ${a} 章 / 声明 ${d} 章`)
    }
  }

  if (mismatches.length === 0) {
    console.log(`[check-chapter-counts] OK: ${Object.keys(declared).length} 门课程章节数一致`)
    return
  }

  console.error('[check-chapter-counts] 章节数不一致，请修正 src/data/courses/index.ts:')
  for (const line of mismatches) console.error(line)
  process.exit(1)
}

main()
