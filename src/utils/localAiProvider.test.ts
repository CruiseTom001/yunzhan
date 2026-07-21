import { describe, expect, it } from 'vitest'
import { polishStudyNoteLocally, testAiProviderLocally, validateProvider } from './localAiProvider'

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

describe('localAiProvider direct polish', () => {
  it('parses chat completions response', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = async () => new Response(JSON.stringify({
      choices: [{ message: { content: '今天系统学习了 Docker 网络。' } }],
    }))
    try {
      const result = await polishStudyNoteLocally({
        content: '学了 Docker 网络',
        provider: {
          name: 'DeepSeek',
          baseUrl: 'https://api.deepseek.com/v1',
          apiKey: 'sk-test',
          format: 'chat_completions',
          model: 'deepseek-chat',
        },
      })
      expect(result.content).toContain('Docker')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('parses connection test response', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = async () => new Response(JSON.stringify({
      choices: [{ message: { content: '连接成功' } }],
    }))
    try {
      const result = await testAiProviderLocally({
        name: 'DeepSeek',
        baseUrl: 'https://api.deepseek.com/v1',
        apiKey: 'sk-test',
        format: 'chat_completions',
        model: 'deepseek-chat',
      })
      expect(result.content).toBe('连接成功')
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
