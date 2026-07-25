import MarkdownIt from 'markdown-it'
import { createHighlighter, type Highlighter, type BundledTheme } from 'shiki'
import langBash from 'shiki/langs/bash.mjs'
import langNginx from 'shiki/langs/nginx.mjs'
import langYaml from 'shiki/langs/yaml.mjs'
import DOMPurify from 'dompurify'

/**
 * 代码块语法高亮：使用 shiki 的 css-variables 主题（内联 <span style="color:var(--shiki-*)">），
 * 深浅模式切换不重新生成 HTML，CSS 变量随 [data-theme] 自动转色。
 *
 * 支持的 lang：bash / sh / shell、nginx、yaml / yml。
 * 只按需加载 3 个语法包，避免 bundle-full 引入 200+ 语言。
 */
const SUPPORTED_LANGS = new Set(['bash', 'sh', 'shell', 'nginx', 'yaml', 'yml'])
// css-variables 是 shiki 内置的特殊主题，不属于 BundledTheme 联合类型
const THEME = 'css-variables' as BundledTheme

let highlighterPromise: Promise<Highlighter> | null = null
let highlighter: Highlighter | null = null

function initHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: [THEME],
      langs: [langBash, langNginx, langYaml],
    }).then((hl) => {
      highlighter = hl
      return hl
    })
  }
  return highlighterPromise
}

// 模块加载即启动异步初始化
void initHighlighter().catch((err) => {
  console.warn('[markdown] shiki init failed:', err)
})

function escapeHtml(s: string): string {
  return md.utils.escapeHtml(s)
}

function highlightSync(code: string, lang: string): string {
  const normalized = lang?.toLowerCase().trim() || ''
  if (!SUPPORTED_LANGS.has(normalized)) {
    const langClass = lang ? ` language-${escapeHtml(lang)}` : ''
    return `<pre class="hljs${langClass}"><code>${escapeHtml(code)}</code></pre>`
  }
  if (!highlighter) {
    const langClass = ` language-${escapeHtml(normalized)}`
    return `<pre class="hljs${langClass}" data-shiki-pending="1"><code>${escapeHtml(code)}</code></pre>`
  }
  try {
    const targetLang = normalized === 'yml' ? 'yaml' : (normalized === 'shell' ? 'bash' : normalized)
    return highlighter.codeToHtml(code, {
      lang: targetLang,
      theme: THEME,
    })
  } catch {
    const langClass = ` language-${escapeHtml(normalized)}`
    return `<pre class="hljs${langClass}"><code>${escapeHtml(code)}</code></pre>`
  }
}

const md = new MarkdownIt({
  html: false,
  breaks: true,
  linkify: true,
  highlight: highlightSync,
})

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ['target', 'rel', 'data-term', 'data-testid', 'data-core', 'data-shiki-pending'],
  })
}

export function renderMarkdown(content: string): string {
  return sanitizeHtml(md.render(content.replace(/\\`/g, '`')))
}

export function isHighlighterReady(): boolean {
  return highlighter !== null
}

export function onHighlighterReady(cb: () => void): () => void {
  let cancelled = false
  const wrapped = () => {
    if (!cancelled) cb()
  }
  if (highlighter) {
    Promise.resolve().then(wrapped)
  } else {
    initHighlighter().then(wrapped)
  }
  return () => {
    cancelled = true
  }
}