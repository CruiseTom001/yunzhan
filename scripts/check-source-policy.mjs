import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourceRoots = ['src', 'electron', 'server']
const sourceExtensions = new Set(['.ts', '.vue', '.cjs', '.mjs'])
const forbiddenPatterns = [
  { pattern: /@ts-(?:ignore|nocheck)/, message: '禁止绕过 TypeScript 检查' },
  { pattern: /eslint-disable/, message: '禁止绕过 ESLint；应修复规则或集中配置例外' },
  { pattern: /\b(?:as|:)\s+any\b/, message: '禁止显式 any，应使用 unknown 与类型守卫' },
  { pattern: /\beval\s*\(/, message: '禁止 eval' },
  { pattern: /new\s+Function\s*\(/, message: '禁止动态 Function' },
  { pattern: /console\.log\s*\(/, message: '应用代码禁止 console.log' },
  {
    pattern: /localStorage\.(?:getItem|setItem)\(\s*['"][^'"]*(?:api|token|secret|key)/i,
    message: '敏感凭据禁止写入 localStorage',
  },
]

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const target = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await collectFiles(target))
    else if (sourceExtensions.has(path.extname(entry.name))) files.push(target)
  }
  return files
}

const files = (await Promise.all(sourceRoots.map(name => collectFiles(path.join(root, name))))).flat()
const violations = []

for (const file of files) {
  const content = await readFile(file, 'utf8')
  const relative = path.relative(root, file)
  const lines = content.split(/\r?\n/)

  for (const [index, line] of lines.entries()) {
    for (const rule of forbiddenPatterns) {
      if (rule.pattern.test(line)) violations.push(`${relative}:${index + 1} ${rule.message}`)
    }

    if (line.includes('v-html=')) {
      const isApprovedRenderer =
        (relative === path.join('src', 'components', 'common', 'MarkdownRenderer.vue') && line.includes('renderMarkdown(content)')) ||
        (relative === path.join('src', 'components', 'ai', 'AIChatPanel.vue') && line.includes('renderAIContent(msg.content)'))
      if (!isApprovedRenderer) violations.push(`${relative}:${index + 1} v-html 必须经过统一安全渲染器`)
    }
  }
}

if (violations.length > 0) {
  console.error('[policy] 源码规范检查失败：')
  for (const violation of violations) console.error(`- ${violation}`)
  process.exitCode = 1
} else {
  console.info(`[policy] OK: 已检查 ${files.length} 个源码文件`)
}
