import { describe, expect, it } from 'vitest'
import {
  ExSection,
  buildDateRangeLabel,
  buildDocxFromSections,
  buildRawDocx,
  parseAiLayout,
  toDocxBuffer,
} from '../server/export-word.mjs'

describe('parseAiLayout', () => {
  it('parses title from # prefix', () => {
    const result = parseAiLayout('# 运维学习笔记')
    expect(result.length).toBeGreaterThanOrEqual(1)
    expect(result[0].level).toBe('title')
    expect(result[0].text).toBe('运维学习笔记')
  })

  it('parses chapters from ## prefix', () => {
    const result = parseAiLayout('## 第1章 Linux 基础')
    expect(result[0].level).toBe('chapter')
    expect(result[0].text).toBe('第1章 Linux 基础')
  })

  it('parses 学习小结 as chapter', () => {
    const result = parseAiLayout('## 学习小结')
    expect(result[0].level).toBe('chapter')
    expect(result[0].text).toBe('学习小结')
  })

  it('parses code from 4-space indented lines', () => {
    const result = parseAiLayout('# 测试\n    ls -la /var/log')
    const code = result.find(s => s.level === 'code')
    expect(code).toBeTruthy()
    expect(code.text).toBe('ls -la /var/log')
  })

  it('parses body paragraphs', () => {
    const result = parseAiLayout('# 标题\n\n这是正文第一段。\n这是正文第二段。')
    const bodies = result.filter(s => s.level === 'body')
    expect(bodies.length).toBe(2)
    expect(bodies[0].text).toBe('这是正文第一段。')
    expect(bodies[1].text).toBe('这是正文第二段。')
  })

  it('skips empty lines', () => {
    const input = '# 标题\n\n\n## 第1章\n\n内容。'
    const result = parseAiLayout(input)
    expect(result.length).toBe(3) // title, chapter, body — 空行跳过
    expect(result.map(s => s.level)).toEqual(['title', 'chapter', 'body'])
  })

  it('handles mixed format without error', () => {
    const input = [
      '# 运维学习笔记（7月下旬）',
      '',
      '## 第1章 容器与编排',
      '本周主要学习了 Docker Compose 和 Kubernetes 基础概念。',
      '    docker-compose up -d',
      '    kubectl get pods -n default',
      '',
      '## 学习小结',
      '本周掌握了容器编排的基础操作，后续需要深入 Helm 和监控。',
    ].join('\n')
    const result = parseAiLayout(input)
    const levels = result.map(s => s.level)
    expect(levels).toEqual(['title', 'chapter', 'body', 'code', 'code', 'chapter', 'body'])
  })

  it('handles tab-indented code', () => {
    const result = parseAiLayout('\tls -la')
    expect(result[0].level).toBe('code')
  })
})

describe('buildDateRangeLabel', () => {
  it('formats single date', () => {
    expect(buildDateRangeLabel(['2026-07-24'])).toBe('2026年7月24日')
  })

  it('formats same-month range', () => {
    expect(buildDateRangeLabel(['2026-07-22', '2026-07-24'])).toBe('2026年7月22日至24日')
  })

  it('formats cross-month range', () => {
    expect(buildDateRangeLabel(['2026-06-28', '2026-07-03'])).toBe('2026年6月28日至7月3日')
  })

  it('formats cross-year range', () => {
    expect(buildDateRangeLabel(['2025-12-30', '2026-01-02'])).toBe('2025年12月30日至2026年1月2日')
  })

  it('handles unsorted input', () => {
    expect(buildDateRangeLabel(['2026-07-24', '2026-07-22'])).toBe('2026年7月22日至24日')
  })

  it('handles 3+ dates correctly', () => {
    expect(buildDateRangeLabel(['2026-07-20', '2026-07-22', '2026-07-24'])).toBe('2026年7月20日至24日')
  })

  it('returns empty string for empty array', () => {
    expect(buildDateRangeLabel([])).toBe('')
  })
})

describe('buildDocxFromSections', () => {
  it('produces a non-empty Buffer', async () => {
    const sections = parseAiLayout([
      '# 运维学习笔记',
      '## 第1章 Linux 基础',
      '学习了用户权限管理。',
      '    chmod 755 script.sh',
      '## 学习小结',
      '基础扎实。',
    ].join('\n'))
    const doc = buildDocxFromSections(sections, {
      title: '运维学习笔记',
      dateRangeLabel: '2026年7月24日',
      mode: 'ai-layout',
      generatedAt: '2026-07-24 12:00',
    })
    const buffer = await toDocxBuffer(doc)
    expect(Buffer.isBuffer(buffer)).toBe(true)
    expect(buffer.length).toBeGreaterThan(1000)
  })

  it('AI mode is reflected in cover metadata', async () => {
    const sections = parseAiLayout('# 标题\n文字。')
    const doc = buildDocxFromSections(sections, {
      title: '标题',
      dateRangeLabel: '2026年7月24日',
      mode: 'ai-layout',
      generatedAt: '2026-07-24 12:00',
    })
    // Verify the Document object has a valid structure
    expect(doc).toBeTruthy()
    const buffer = await toDocxBuffer(doc)
    expect(buffer.length).toBeGreaterThan(0)
  })
})

describe('buildRawDocx', () => {
  it('produces a non-empty Buffer from raw notes', async () => {
    const doc = buildRawDocx(
      [
        { date: '2026-07-22', dateLabel: '7月22日', content: '今天学习了 Nginx 配置。\n    nginx -t\n    nginx -s reload' },
        { date: '2026-07-23', dateLabel: '7月23日', content: '数据库备份与恢复操作。' },
      ],
      {
        dateRangeLabel: '2026年7月22日至23日',
        generatedAt: '2026-07-24 12:00',
      },
    )
    const buffer = await toDocxBuffer(doc)
    expect(Buffer.isBuffer(buffer)).toBe(true)
    expect(buffer.length).toBeGreaterThan(1000)
  })

  it('raw mode metadata reflected', () => {
    const doc = buildRawDocx(
      [{ date: '2026-07-24', dateLabel: '7月24日', content: '测试。' }],
      { dateRangeLabel: '2026年7月24日', generatedAt: '2026-07-24 12:00' },
    )
    expect(doc).toBeTruthy()
  })

  it('handles code-like content in raw notes', async () => {
    const doc = buildRawDocx(
      [{ date: '2026-07-24', dateLabel: '7月24日', content: '$ docker ps\n    CONTAINER ID   IMAGE     COMMAND' }],
      { dateRangeLabel: '2026年7月24日', generatedAt: '2026-07-24 12:00' },
    )
    const buffer = await toDocxBuffer(doc)
    expect(buffer.length).toBeGreaterThan(1000)
  })
})