import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('dompurify', () => ({
  default: {
    sanitize: (html: string) => html.replace(/<script[\s\S]*?<\/script>/gi, ''),
  },
}))

import {
  __resetMarkdownHighlighterForTests,
  initHighlighter,
  normalizeLang,
  renderMarkdown,
  SUPPORTED_LANGS,
} from './markdown'

afterEach(() => {
  __resetMarkdownHighlighterForTests()
})

describe('markdown shiki integration', () => {
  it('initializes shiki with css-variables theme', async () => {
    const highlighter = await initHighlighter()
    expect(highlighter).toBeTruthy()
    const html = highlighter.codeToHtml('echo hello', { lang: 'bash', theme: 'css-variables' })
    expect(html).toContain('shiki')
    expect(html).toContain('var(--shiki-')
  })

  it('renders bash nginx yaml and falls back for unsupported language', async () => {
    await initHighlighter()
    const bashHtml = renderMarkdown('```bash\necho hi\n```')
    expect(bashHtml).toContain('shiki')
    expect(bashHtml).toContain('language-bash')

    const nginxHtml = renderMarkdown('```nginx\nserver {}\n```')
    expect(nginxHtml).toContain('language-nginx')

    const yamlHtml = renderMarkdown('```yaml\nkey: value\n```')
    expect(yamlHtml).toContain('language-yaml')

    const unknownHtml = renderMarkdown('```rust\nfn main() {}\n```')
    expect(unknownHtml).toContain('class="hljs language-rust"')
    expect(unknownHtml).not.toContain('ShikiError')
  })

  it('sanitizes rendered output', () => {
    const html = renderMarkdown('<script>alert(1)</script>\n\n```bash\nls\n```')
    expect(html).not.toContain('<script>')
  })

  it('normalizes shell aliases to bash', () => {
    expect(normalizeLang('shell')).toBe('bash')
    expect(SUPPORTED_LANGS.has('bash')).toBe(true)
  })
})
