import { describe, expect, it, vi } from 'vitest'
import {
  buildReleaseAnnouncementFallback,
  buildReleaseAnnouncementSourceKey,
  generateReleaseAnnouncementDraft,
  repolishAnnouncementDraft,
  resolveAnnouncementAiProviderId,
  polishReleaseAnnouncement,
} from './announcement-generation.mjs'

const NOW = new Date('2026-07-29T06:00:00Z')
const FLASH_ENVIRONMENT = {
  AI_PROVIDERS_JSON: JSON.stringify([
    {
      id: 'deepseek-chat',
      name: 'DeepSeek',
      baseUrl: 'https://api.deepseek.com/v1',
      apiKey: 'fake-key-deepseek',
      format: 'chat_completions',
      model: 'deepseek-chat',
    },
    {
      id: 'deepseek-flash',
      name: 'DeepSeek Flash',
      baseUrl: 'https://api.deepseek.com/v1',
      apiKey: 'fake-key-flash',
      format: 'chat_completions',
      model: 'deepseek-flash',
    },
  ]),
}

function adminRow(overrides = {}) {
  return {
    id: 7,
    title: '云栈桌面端 v1.2.5 更新',
    content: '云栈桌面端 v1.2.5 已发布。',
    published_at: NOW,
    active: false,
    created_at: NOW,
    updated_at: NOW,
    category: 'desktop_release',
    version: '1.2.5',
    source_key: 'desktop_release:1.2.5',
    source_commit: 'abc1234',
    generated_by_ai: false,
    generation_provider: null,
    generation_error: null,
    ...overrides,
  }
}

function aiFetch(content, requests = []) {
  return async (url, options) => {
    requests.push({ url, options })
    return new Response(JSON.stringify({
      choices: [{ message: { content } }],
    }))
  }
}

describe('release announcement fallback', () => {
  it('builds deterministic source_key and fallback from changelog', () => {
    expect(buildReleaseAnnouncementSourceKey('desktop_release', '1.2.5')).toBe('desktop_release:1.2.5')
    const fallback = buildReleaseAnnouncementFallback({
      category: 'desktop_release',
      version: '1.2.5',
      changelogEntry: '## [1.2.5] - 2026-07-26\n\n### 修复\n- 修复桌面更新提示\n- 修复公告已读计数',
    })
    expect(fallback.title).toBe('云栈桌面端 v1.2.5 更新')
    expect(fallback.content).toContain('云栈桌面端 v1.2.5 已发布。')
    expect(fallback.content).toContain('修复：')
    expect(fallback.content).toContain('- 修复桌面更新提示')
    expect(fallback.content).not.toContain('## [1.2.5]')
  })

  it('rejects invalid category or version', () => {
    expect(() => buildReleaseAnnouncementSourceKey('general', '1.2.5')).toThrow('公告分类无效')
    expect(() => buildReleaseAnnouncementFallback({ category: 'web_release', version: '1.2' })).toThrow('公告分类或版本无效')
  })
})

describe('announcement AI provider selection', () => {
  it('prefers DeepSeek Flash provider', () => {
    expect(resolveAnnouncementAiProviderId(FLASH_ENVIRONMENT)).toBe('deepseek-flash')
  })

  it('uses explicit provider id when configured', () => {
    expect(resolveAnnouncementAiProviderId({
      ...FLASH_ENVIRONMENT,
      ANNOUNCEMENT_AI_PROVIDER_ID: 'deepseek-chat',
    })).toBe('deepseek-chat')
  })
})

describe('generateReleaseAnnouncementDraft', () => {
  it('creates inactive AI draft with source metadata', async () => {
    const requests = []
    const client = {
      query: vi.fn().mockResolvedValueOnce({
        rowCount: 1,
        rows: [adminRow({
          content: '本次更新修复了桌面更新与公告已读问题。',
          generated_by_ai: true,
          generation_provider: 'DeepSeek Flash/deepseek-flash',
        })],
      }),
    }

    const result = await generateReleaseAnnouncementDraft(client, {
      category: 'desktop_release',
      version: '1.2.5',
      sourceCommit: 'ABC1234',
      changelogEntry: '### 修复\n- 修复桌面更新提示',
      environment: FLASH_ENVIRONMENT,
      fetchImplementation: aiFetch('本次更新修复了桌面更新与公告已读问题。', requests),
    })

    expect(result.created).toBe(true)
    expect(result.announcement.active).toBe(false)
    expect(result.announcement.generatedByAi).toBe(true)
    expect(result.announcement.generationProvider).toBe('DeepSeek Flash/deepseek-flash')
    expect(client.query).toHaveBeenCalledOnce()
    const [sql, params] = client.query.mock.calls[0]
    expect(sql).toContain('ON CONFLICT (source_key) DO NOTHING')
    expect(params).toContain('desktop_release:1.2.5')
    expect(params).toContain('abc1234')
    expect(requests).toHaveLength(1)
    const body = JSON.parse(requests[0].options.body)
    expect(body.model).toBe('deepseek-flash')
    expect(body.messages[0].content).toContain('产品更新公告')
  })

  it('falls back to deterministic changelog text when AI fails', async () => {
    const client = {
      query: vi.fn().mockResolvedValueOnce({
        rowCount: 1,
        rows: [adminRow({
          content: '云栈桌面端 v1.2.5 已发布。\n\n本次更新：\n修复：\n- 修复桌面更新提示',
          generated_by_ai: false,
          generation_provider: null,
          generation_error: '服务端无法连接 AI 供应商。',
        })],
      }),
    }

    const result = await generateReleaseAnnouncementDraft(client, {
      category: 'desktop_release',
      version: '1.2.5',
      changelogEntry: '### 修复\n- 修复桌面更新提示',
      environment: FLASH_ENVIRONMENT,
      fetchImplementation: async () => {
        throw new Error('network down')
      },
    })

    expect(result.created).toBe(true)
    expect(result.announcement.generatedByAi).toBe(false)
    expect(result.announcement.content).toContain('云栈桌面端 v1.2.5 已发布。')
    expect(result.announcement.generationError).toContain('无法连接 AI 供应商')
  })

  it('returns existing announcement when source_key already exists', async () => {
    const client = {
      query: vi.fn()
        .mockResolvedValueOnce({ rowCount: 0, rows: [] })
        .mockResolvedValueOnce({ rowCount: 1, rows: [adminRow()] }),
    }

    const result = await generateReleaseAnnouncementDraft(client, {
      category: 'desktop_release',
      version: '1.2.5',
      environment: FLASH_ENVIRONMENT,
      fetchImplementation: aiFetch('AI 正文'),
    })

    expect(result.created).toBe(false)
    expect(result.announcement.sourceKey).toBe('desktop_release:1.2.5')
    expect(client.query).toHaveBeenCalledTimes(2)
  })
})

describe('repolishAnnouncementDraft', () => {
  it('rejects active announcements', async () => {
    const client = {
      query: vi.fn().mockResolvedValueOnce({ rows: [adminRow({ active: true })] }),
    }
    await expect(repolishAnnouncementDraft(client, 7, {
      environment: FLASH_ENVIRONMENT,
      fetchImplementation: aiFetch('AI 正文'),
    })).rejects.toMatchObject({ statusCode: 400 })
    expect(client.query).toHaveBeenCalledOnce()
  })

  it('keeps current content and records error when repolish AI fails', async () => {
    const current = adminRow({ content: '原始草稿正文', generated_by_ai: true, generation_provider: 'Old/model' })
    const updated = adminRow({
      content: '原始草稿正文',
      generated_by_ai: false,
      generation_provider: null,
      generation_error: '服务端无法连接 AI 供应商。',
    })
    const client = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [current] })
        .mockResolvedValueOnce({ rows: [updated] }),
    }

    const result = await repolishAnnouncementDraft(client, 7, {
      environment: FLASH_ENVIRONMENT,
      fetchImplementation: async () => {
        throw new Error('network down')
      },
    })

    expect(result.content).toBe('原始草稿正文')
    expect(result.generatedByAi).toBe(false)
    expect(result.generationError).toContain('无法连接 AI 供应商')
    expect(client.query).toHaveBeenCalledTimes(2)
    expect(client.query.mock.calls[1][1][1]).toBe('原始草稿正文')
  })
})

describe('polishReleaseAnnouncement resilience', () => {
  it('retries transient HTTP 503 and succeeds', async () => {
    let attempts = 0
    const result = await polishReleaseAnnouncement({
      fallback: buildReleaseAnnouncementFallback({
        category: 'web_release',
        version: '1.2.6',
        changelogEntry: '### 修复\n- 修复公告',
      }),
      category: 'web_release',
      version: '1.2.6',
      environment: FLASH_ENVIRONMENT,
      maxAttempts: 3,
      retryDelayMs: 0,
      fetchImplementation: async () => {
        attempts += 1
        if (attempts < 2) {
          return new Response('{}', { status: 503 })
        }
        return new Response(JSON.stringify({
          choices: [{ message: { content: '云栈网站 v1.2.6 已发布，本次修复了公告相关问题。' } }],
        }))
      },
    })

    expect(attempts).toBe(2)
    expect(result.generatedByAi).toBe(true)
    expect(result.generationError).toBeNull()
    expect(result.content).toContain('公告')
  })

  it('falls back to the next provider when flash keeps returning 503', async () => {
    const requests = []
    const result = await polishReleaseAnnouncement({
      fallback: buildReleaseAnnouncementFallback({
        category: 'web_release',
        version: '1.2.6',
      }),
      category: 'web_release',
      version: '1.2.6',
      environment: FLASH_ENVIRONMENT,
      maxAttempts: 1,
      retryDelayMs: 0,
      fetchImplementation: async (url, options) => {
        requests.push({ url, options })
        const body = JSON.parse(options.body)
        if (body.model === 'deepseek-flash') {
          return new Response('{}', { status: 503 })
        }
        return new Response(JSON.stringify({
          choices: [{ message: { content: '由 deepseek-chat 生成的公告正文。' } }],
        }))
      },
    })

    expect(result.generatedByAi).toBe(true)
    expect(result.generationProvider).toBe('DeepSeek/deepseek-chat')
    expect(JSON.parse(requests[0].options.body).model).toBe('deepseek-flash')
    expect(JSON.parse(requests[1].options.body).model).toBe('deepseek-chat')
  })
})
