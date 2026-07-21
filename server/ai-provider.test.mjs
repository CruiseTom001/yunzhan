import { describe, expect, it } from 'vitest'
import { loadServerAiProvider, requestStudyNoteAi } from './ai-provider.mjs'

const VALID_ENVIRONMENT = {
  AI_PROVIDER_NAME: 'DeepSeek',
  AI_BASE_URL: 'https://api.deepseek.com/v1',
  AI_API_KEY: 'sk-test-only',
  AI_API_FORMAT: 'chat_completions',
  AI_MODEL: 'deepseek-chat',
}

describe('server AI provider configuration', () => {
  it('loads optional server AI provider config', () => {
    expect(loadServerAiProvider({})).toBeNull()
    expect(loadServerAiProvider(VALID_ENVIRONMENT)?.model).toBe('deepseek-chat')
  })

  it('rejects non-https AI base URL', () => {
    expect(() => loadServerAiProvider({
      ...VALID_ENVIRONMENT,
      AI_BASE_URL: 'http://127.0.0.1:11434/v1',
    })).toThrow('https')
  })
})

describe('server AI provider request', () => {
  it('parses chat completions polish response', async () => {
    const requests = []
    const fetchImplementation = async (url, options) => {
      requests.push({ url, options })
      return new Response(JSON.stringify({
        choices: [{ message: { content: '今天系统学习了 Docker 网络。' } }],
      }))
    }

    const result = await requestStudyNoteAi({
      content: '学了 Docker 网络',
      environment: VALID_ENVIRONMENT,
      fetchImplementation,
    })

    expect(result.content).toContain('Docker')
    expect(result.providerName).toBe('DeepSeek')
    expect(requests[0].url).toBe('https://api.deepseek.com/v1/chat/completions')
    expect(requests[0].options.headers.Authorization).toBe('Bearer sk-test-only')
  })

  it('returns service unavailable when server AI is not configured', async () => {
    await expect(requestStudyNoteAi({
      content: '内容',
      environment: {},
      fetchImplementation: async () => new Response('{}'),
    })).rejects.toMatchObject({
      message: '服务端 AI 尚未配置。',
      statusCode: 503,
    })
  })
})
