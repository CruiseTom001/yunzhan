import { beforeEach, describe, expect, it, vi } from 'vitest'

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

describe('localAiProvider web proxy', () => {
  it('polishes through server API in browser mode', async () => {
    mockedApiRequest.mockResolvedValueOnce({
      content: '今天系统学习了 Docker 网络。',
      providerName: '云栈 AI',
      model: 'deepseek-chat',
    })
    const result = await polishStudyNoteLocally({ content: '学了 Docker 网络' })
    expect(result.content).toContain('Docker')
    expect(mockedApiRequest).toHaveBeenCalledWith('/study-notes/ai/polish', {
      method: 'POST',
      body: JSON.stringify({ content: '学了 Docker 网络' }),
    })
  })

  it('tests server AI provider in browser mode', async () => {
    mockedApiRequest.mockResolvedValueOnce({
      content: '连接成功',
      providerName: '云栈 AI',
      model: 'deepseek-chat',
    })
    const result = await testAiProviderLocally()
    expect(result.content).toBe('连接成功')
    expect(mockedApiRequest).toHaveBeenCalledWith('/study-notes/ai/test', { method: 'POST' })
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
})
