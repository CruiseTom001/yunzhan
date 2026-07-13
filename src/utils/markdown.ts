import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js/lib/core'
import bash from 'highlight.js/lib/languages/bash'
import nginx from 'highlight.js/lib/languages/nginx'
import yaml from 'highlight.js/lib/languages/yaml'
import DOMPurify from 'dompurify'

hljs.registerLanguage('bash', bash)
hljs.registerAliases(['sh', 'shell'], { languageName: 'bash' })
hljs.registerLanguage('nginx', nginx)
hljs.registerLanguage('yaml', yaml)
hljs.registerAliases('yml', { languageName: 'yaml' })

const md = new MarkdownIt({
  html: false,
  breaks: true,
  linkify: true,
  highlight(str: string, lang: string): string {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return (
          `<pre class="hljs language-${md.utils.escapeHtml(lang)}"><code>` +
          hljs.highlight(str, { language: lang, ignoreIllegals: true }).value +
          '</code></pre>'
        )
      } catch { /* fall through */ }
    }
    const langClass = lang ? ` language-${md.utils.escapeHtml(lang)}` : ''
    return `<pre class="hljs${langClass}"><code>` + md.utils.escapeHtml(str) + '</code></pre>'
  },
})

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ['target', 'rel', 'data-term', 'data-testid', 'data-core'],
  })
}

export function renderMarkdown(content: string): string {
  // Keep old course content compatible when backticks were escaped in bulk.
  return sanitizeHtml(md.render(content.replace(/\\`/g, '`')))
}
