import { describe, expect, it } from 'vitest'
import { loadServerAiProvider, requestStudyNoteAi, requestStudyNoteAiStream } from './ai-provider.mjs'

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

describe('server AI provider streaming', () => {
  function createSseStream(lines) {
    const encoder = new TextEncoder()
    const chunks = lines.map(line => encoder.encode(line))
    let index = 0
    return new ReadableStream({
      pull(controller) {
        if (index < chunks.length) {
          controller.enqueue(chunks[index])
          index += 1
        } else {
          controller.close()
        }
      },
    })
  }

  it('accumulates delta content from SSE chunks', async () => {
    const deltas = []
    let doneResult = null
    let errorMessage = null

    const sseLines = [
      'data: {"choices":[{"delta":{"content":"今天"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"学习了"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"Docker"}}]}\n\n',
      'data: [DONE]\n\n',
    ]

    const fetchImpl = async () => new Response(createSseStream(sseLines), { status: 200 })

    await requestStudyNoteAiStream({
      content: '学了 Docker',
      environment: VALID_ENVIRONMENT,
      fetchImplementation: fetchImpl,
      onDelta(text) { deltas.push(text) },
      onDone(result) { doneResult = result },
      onError(msg) { errorMessage = msg },
    })

    expect(errorMessage).toBeNull()
    expect(deltas).toEqual(['今天', '学习了', 'Docker'])
    expect(doneResult).toEqual({ providerName: 'DeepSeek', model: 'deepseek-chat' })
  })

  it('calls onDone without [DONE] marker when stream ends naturally', async () => {
    let doneResult = null

    const sseLines = [
      'data: {"choices":[{"delta":{"content":"内容"}}]}\n\n',
    ]

    const fetchImpl = async () => new Response(createSseStream(sseLines), { status: 200 })

    await requestStudyNoteAiStream({
      content: '内容',
      environment: VALID_ENVIRONMENT,
      fetchImplementation: fetchImpl,
      onDelta() {},
      onDone(result) { doneResult = result },
      onError() {},
    })

    expect(doneResult).toEqual({ providerName: 'DeepSeek', model: 'deepseek-chat' })
  })

  it('calls onError on non-2xx response', async () => {
    let errorMessage = null

    const fetchImpl = async () => new Response('{}', { status: 500 })

    await requestStudyNoteAiStream({
      content: '内容',
      environment: VALID_ENVIRONMENT,
      fetchImplementation: fetchImpl,
      onDelta() {},
      onDone() {},
      onError(msg) { errorMessage = msg },
    })

    expect(errorMessage).toBe('AI 供应商返回错误：HTTP 500。')
  })

  it('calls onError when AI format is not chat_completions', async () => {
    let errorMessage = null

    await requestStudyNoteAiStream({
      content: '内容',
      environment: { ...VALID_ENVIRONMENT, AI_API_FORMAT: 'anthropic_messages' },
      fetchImplementation: async () => new Response('{}'),
      onDelta() {},
      onDone() {},
      onError(msg) { errorMessage = msg },
    })

    expect(errorMessage).toBe('当前 AI 格式暂不支持流式润色，请使用 OpenAI 兼容接口。')
  })
})
