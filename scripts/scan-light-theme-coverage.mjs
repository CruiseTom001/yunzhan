/**
 * 静态扫描：全站 Tailwind 颜色类与 src/style.css 浅色补丁覆盖对照。
 * 只报告"浅色下需要补丁但缺失"的类（浅色阶文字、白色系、半透明白背景/边框）。
 * 用法：node scripts/scan-light-theme-coverage.mjs
 */
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const css = fs.readFileSync(path.join(root, 'src/style.css'), 'utf8')

const COLOR_CLASS_PATTERN = /^(hover:|group-hover\/?[a-z-]*:|focus:|disabled:|placeholder:)?(text|bg|border|divide)-(white|black|gray|slate|zinc|neutral|stone|cyan|red|amber|emerald|purple|rose|blue|green|orange|yellow|indigo|violet|pink)(-\d+)?(\/\d+|\/\[[\d.]+\])?$/

// 收集 src 下所有 .vue 文件中的颜色类（class 属性 + scoped @apply）
const colorTokens = new Set()
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(full)
    } else if (entry.name.endsWith('.vue')) {
      const source = fs.readFileSync(full, 'utf8')
      const classContent = [...source.matchAll(/class="([^"]+)"/g)].map(m => m[1]).join(' ')
      const applyContent = [...source.matchAll(/@apply\s+([^;]+);/g)].map(m => m[1]).join(' ')
      for (const token of `${classContent} ${applyContent}`.split(/\s+/)) {
        const candidate = token.trim()
        if (candidate && COLOR_CLASS_PATTERN.test(candidate)) colorTokens.add(candidate)
      }
    }
  }
}
walk(path.join(root, 'src'))

// style.css 中补丁选择器为 [data-theme="light"] <selector>，直接字符串包含检查
function hasPatch(selector) {
  return css.includes(`[data-theme="light"] ${selector}`)
}

// Tailwind 类名的 CSS 转义写法（与编译产物一致）：[0.01] → \[0\.01\]
function escapeTailwindClass(name) {
  return name
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\./g, '\\.')
    .replace(/\//g, '\\/')
    .replace(/:/g, '\\:')
    .replace(/%/g, '\\%')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
}

const DEEP_TEXT_SHADES = new Set(['500', '600', '700', '800', '900', '950'])
const missed = []
for (const token of [...colorTokens].sort()) {
  let prefix = ''
  let base = token
  if (token.startsWith('group-hover/')) {
    prefix = 'group-hover/'
    base = token.slice('group-hover/'.length)
  } else if (token.startsWith('group-hover:')) {
    prefix = 'group-hover:'
    base = token.slice('group-hover:'.length)
  } else if (token.startsWith('hover:')) {
    prefix = 'hover:'
    base = token.slice('hover:'.length)
  } else if (token.startsWith('focus:') || token.startsWith('disabled:') || token.startsWith('placeholder:')) {
    continue
  }

  const match = base.match(/^(text|bg|border|divide)-(white|black|gray|slate|zinc|neutral|stone|cyan|red|amber|emerald|purple|rose|blue|green|orange|yellow|indigo|violet|pink)(-\d+)?(\/\d+|\/\[[\d.]+\])?$/)
  if (!match) continue
  const kind = match[1]
  const color = match[2]
  const shade = match[3] ? Number(match[3].slice(1)) : null
  const alpha = match[4] ?? ''

  // 深色文字阶（500+）在浅色下天然可读；实色背景（无 alpha）保持原色；黑色遮罩已有专门处理
  if (kind === 'text' && shade !== null && DEEP_TEXT_SHADES.has(String(shade))) continue
  if (kind === 'bg' && !alpha) continue
  if (kind === 'bg' && color === 'black') continue
  // 彩色半透明背景/边框在浅色下可见（非文字），无需浅色映射；白色系背景/边框需要
  if (kind === 'bg' && color !== 'white') continue
  if (kind === 'border' && color !== 'white') continue

  let selector
  if (prefix === 'hover:') {
    selector = `.${escapeTailwindClass(`hover:${base}`)}:hover`
  } else if (prefix === 'group-hover:' || prefix === 'group-hover/') {
    const groupClass = prefix === 'group-hover/' ? 'group\\/' : 'group'
    selector = `.${groupClass}:hover .${escapeTailwindClass(`group-hover:${base}`)}`
  } else if (kind === 'divide') {
    selector = `.${escapeTailwindClass(base)} > :not([hidden]) ~ :not([hidden])`
  } else {
    selector = `.${escapeTailwindClass(base)}`
  }

  if (!hasPatch(selector)) {
    missed.push({ token, selector })
  }
}

console.log('=== 需要浅色补丁但 style.css 中缺失的类 ===')
if (missed.length === 0) console.log('（无遗漏）')
for (const { token, selector } of missed) {
  console.log(`- ${token}   (需补丁: [data-theme="light"] ${selector})`)
}
console.log(`\n扫描类总数: ${colorTokens.size}，缺失: ${missed.length}`)
