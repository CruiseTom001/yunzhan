import MarkdownIt from 'markdown-it'
import type { HighlighterCore } from 'shiki/types'
import { createCssVariablesTheme, createHighlighterCore } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'
import langBash from 'shiki/langs/bash.mjs'
import langNginx from 'shiki/langs/nginx.mjs'
import langYaml from 'shiki/langs/yaml.mjs'
import DOMPurify from 'dompurify'

/**
 * 代码块语法高亮：使用 css-variables 主题（内联 var(--shiki-*)），
 * 深浅模式切换不重新生成 HTML，CSS 变量随 [data-theme] 自动转色。
 *
 * 只按需加载 bash / nginx / yaml，避免引入完整语言包。
 */
const SUPPORTED_LANGS = new Set(['bash', 'sh', 'shell', 'nginx', 'yaml', 'yml'])

const CSS_VARIABLES_THEME = createCssVariablesTheme({
  name: 'css-variables',
  variablePrefix: '--shiki-',
})
const THEME_NAME = 'css-variables'

let highlighterPromise: Promise<HighlighterCore> | null = null
let highlighter: HighlighterCore | null = null
let highlighterInitFailed = false

function initHighlighter(): Promise<HighlighterCore> {
  if (highlighterInitFailed) {
    return Promise.reject(new Error('shiki unavailable'))
  }
  if (!highlighterPromise) {
    highlighterPromise = createHighlighterCore({
      themes: [CSS_VARIABLES_THEME],
      langs: [langBash, langNginx, langYaml],
      engine: createJavaScriptRegexEngine(),
    }).then((hl) => {
      highlighter = hl
      return hl
    }).catch((error) => {
      highlighterInitFailed = true
      highlighterPromise = null
      console.warn('[markdown] shiki init failed:', error)
      throw error
    })
  }
  return highlighterPromise
}

void initHighlighter().catch(() => {
  // 已在 initHighlighter 内记录；避免未处理的 rejection
})

function escapeHtml(s: string): string {
  return md.utils.escapeHtml(s)
}

function normalizeLang(lang: string): string {
  const normalized = lang?.toLowerCase().trim() || ''
  if (normalized === 'yml') return 'yaml'
  if (normalized === 'shell' || normalized === 'sh') return 'bash'
  return normalized
}

function fallbackPre(code: string, lang: string, pending = false): string {
  const normalized = normalizeLang(lang)
  const langClass = normalized ? ` language-${escapeHtml(normalized)}` : ''
  const pendingAttr = pending ? ' data-shiki-pending="1"' : ''
  return `<pre class="hljs${langClass}"${pendingAttr}><code>${escapeHtml(code)}</code></pre>`
}

function injectLanguageClass(html: string, lang: string): string {
  const normalized = normalizeLang(lang)
  if (!normalized) return html
  const className = `language-${escapeHtml(normalized)}`
  if (html.includes('class="')) {
    return html.replace(/<pre class="/, `<pre class="${className} `)
  }
  return html.replace('<pre', `<pre class="${className}"`)
}

function highlightSync(code: string, lang: string): string {
  const normalized = normalizeLang(lang)
  if (!SUPPORTED_LANGS.has(lang?.toLowerCase().trim() || '') && !SUPPORTED_LANGS.has(normalized)) {
    return fallbackPre(code, lang)
  }
  if (!highlighter) {
    return fallbackPre(code, lang, true)
  }
  try {
    const targetLang = normalized === 'yaml' ? 'yaml' : normalized === 'nginx' ? 'nginx' : 'bash'
    const html = highlighter.codeToHtml(code, {
      lang: targetLang,
      theme: THEME_NAME,
    })
    return injectLanguageClass(html, targetLang)
  } catch {
    return fallbackPre(code, lang)
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
  } else if (!highlighterInitFailed) {
    initHighlighter().then(wrapped).catch(() => {
      // 初始化失败时保持 pending 块的纯文本回退
    })
  }
  return () => {
    cancelled = true
  }
}

/** 测试专用：重置 Shiki 单例状态 */
export function __resetMarkdownHighlighterForTests() {
  highlighterPromise = null
  highlighter = null
  highlighterInitFailed = false
}

export { SUPPORTED_LANGS, normalizeLang, initHighlighter }
