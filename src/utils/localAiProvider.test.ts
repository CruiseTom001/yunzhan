import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/utils/apiClient', () => ({
  apiRequest: vi.fn(),
}))

import { apiRequest } from '@/utils/apiClient'
import {
  polishStudyNoteLocally,
  testAiProviderFromBrowser,
  testAiProviderLocally,
  validateProvider,
} from './localAiProvider'

const mockedApiRequest = vi.mocked(apiRequest)

beforeEach(() => {
  mockedApiRequest.mockReset()
})

describe('localAiProvider validation', () => {
  it('accepts https provider config', () => {
    expect(() => validateProvider({
      name: 'DeepSeek',
      baseUrl: 'https://api.deepseek.com/v1',
      apiKey: 'sk-test',
      format: 'chat_completions',
      model: 'deepseek-chat',
    })).not.toThrow()
  })

  it('rejects non-https provider config', () => {
    expect(() => validateProvider({
      name: 'Local',
      baseUrl: 'http://127.0.0.1:11434/v1',
      apiKey: 'sk-test',
      format: 'chat_completions',
      model: 'local-model',
    })).toThrow('https')
  })

  it('rejects empty api key', () => {
    expect(() => validateProvider({
      name: 'DeepSeek',
      baseUrl: 'https://api.deepseek.com/v1',
      apiKey: '',
      format: 'chat_completions',
      model: 'deepseek-chat',
    })).toThrow('API Key')
  })
})

describe('localAiProvider desktop mode', () => {
  const mockInvoke = vi.fn()

  beforeEach(() => {
    mockInvoke.mockReset()
    vi.stubGlobal('window', { electronAPI: { invoke: mockInvoke } })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('polishes through Electron IPC on desktop', async () => {
    mockInvoke.mockResolvedValueOnce({
      content: '今天系统学习了 Docker 网络。',
      providerName: 'DeepSeek',
      model: 'deepseek-chat',
    })
    const provider = {
      name: 'DeepSeek',
      baseUrl: 'https://api.deepseek.com/v1',
      apiKey: 'sk-local-secret',
      format: 'chat_completions' as const,
      model: 'deepseek-chat',
    }
    const result = await polishStudyNoteLocally({ content: '学了 Docker 网络', provider })
    expect(result.content).toContain('Docker')
    expect(mockInvoke).toHaveBeenCalledWith('ai:polishStudyNote', {
      content: '学了 Docker 网络',
      provider,
    })
    expect(mockedApiRequest).not.toHaveBeenCalled()
  })

  it('does not send desktop api key through server fetch', async () => {
    const originalFetch = globalThis.fetch
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    mockInvoke.mockResolvedValueOnce({
      content: '润色完成',
      providerName: 'DeepSeek',
      model: 'deepseek-chat',
    })
    try {
      await polishStudyNoteLocally({
        content: '原始内容',
        provider: {
          name: 'DeepSeek',
          baseUrl: 'https://api.deepseek.com/v1',
          apiKey: 'sk-local-secret',
          format: 'chat_completions',
          model: 'deepseek-chat',
        },
      })
      expect(fetchSpy).not.toHaveBeenCalled()
      expect(mockedApiRequest).not.toHaveBeenCalled()
    } finally {
      vi.stubGlobal('fetch', originalFetch)
    }
  })
})

describe('localAiProvider web proxy', () => {
  it('polishes through server API in browser mode', async () => {
    mockedApiRequest.mockResolvedValueOnce({
      content: '今天系统学习了 Docker 网络。',
      providerName: '云栈 AI',
      model: 'deepseek-chat',
    })
    const result = await polishStudyNoteLocally({ content: '学了 Docker 网络' })
    expect(result.content).toContain('Docker')
    expect(mockedApiRequest).toHaveBeenCalledWith('/study-notes/ai/polish', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ content: '学了 Docker 网络' }),
      timeoutMs: 65_000,
    }))
  })

  it('tests server AI provider in browser mode', async () => {
    mockedApiRequest.mockResolvedValueOnce({
      content: '连接成功',
      providerName: '云栈 AI',
      model: 'deepseek-chat',
    })
    const result = await testAiProviderLocally()
    expect(result.content).toBe('连接成功')
    expect(mockedApiRequest).toHaveBeenCalledWith('/study-notes/ai/test', expect.objectContaining({
      method: 'POST',
      timeoutMs: 65_000,
    }))
  })
})

describe('localAiProvider direct browser compatibility helper', () => {
  it('parses chat completions response', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = async () => new Response(JSON.stringify({
      choices: [{ message: { content: '今天系统学习了 Docker 网络。' } }],
    }))
    try {
      const result = await testAiProviderFromBrowser({
        name: 'DeepSeek',
        baseUrl: 'https://api.deepseek.com/v1',
        apiKey: 'sk-test',
        format: 'chat_completions',
        model: 'deepseek-chat',
      })
      expect(result.content).toContain('Docker')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('includes provider error details without leaking api key', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = async () => new Response(JSON.stringify({
      error: {
        message: 'insufficient_quota: sk-test has exceeded quota',
        type: 'rate_limit_error',
        code: 'insufficient_quota',
      },
    }), { status: 429 })
    try {
      await expect(testAiProviderFromBrowser({
        name: 'DeepSeek',
        baseUrl: 'https://api.deepseek.com/v1',
        apiKey: 'sk-test',
        format: 'chat_completions',
        model: 'deepseek-chat',
      })).rejects.toThrow('insufficient_quota')
      await expect(testAiProviderFromBrowser({
        name: 'DeepSeek',
        baseUrl: 'https://api.deepseek.com/v1',
        apiKey: 'sk-test',
        format: 'chat_completions',
        model: 'deepseek-chat',
      })).rejects.not.toThrow('sk-test')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('appends busy retry hint for HTTP 529 and keeps status code', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = async () => new Response(JSON.stringify({
      error: { message: 'overloaded' },
    }), { status: 529 })
    try {
      const error = await testAiProviderFromBrowser({
        name: 'DeepSeek',
        baseUrl: 'https://api.deepseek.com/v1',
        apiKey: 'sk-secret-key',
        format: 'chat_completions',
        model: 'deepseek-chat',
      }).catch(item => item)
      expect(error).toBeInstanceOf(Error)
      expect(error.message).toContain('HTTP 529')
      expect(error.message).toContain('overloaded')
      expect(error.message).toContain('供应商当前可能繁忙，请稍后重试。')
      expect(error.message).not.toContain('sk-secret-key')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('does not append busy retry hint for HTTP 401/403/404', async () => {
    const originalFetch = globalThis.fetch
    try {
      for (const status of [401, 403, 404]) {
        globalThis.fetch = async () => new Response(JSON.stringify({
          error: { message: 'denied' },
        }), { status })
        const error = await testAiProviderFromBrowser({
          name: 'DeepSeek',
          baseUrl: 'https://api.deepseek.com/v1',
          apiKey: 'sk-secret-key',
          format: 'chat_completions',
          model: 'deepseek-chat',
        }).catch(item => item)
        expect(error.message).toContain(`HTTP ${status}`)
        expect(error.message).not.toContain('供应商当前可能繁忙')
        expect(error.message).not.toContain('请稍后重试')
        expect(error.message).not.toContain('sk-secret-key')
      }
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
