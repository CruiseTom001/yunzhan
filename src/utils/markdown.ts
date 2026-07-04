import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'

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

export function renderMarkdown(content: string): string {
  // 兼容历史内容中被批量转义的反引号，否则围栏代码块会退化成普通段落。
  return md.render(content.replace(/\\`/g, '`'))
}
