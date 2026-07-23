import { describe, expect, it } from 'vitest'
import {
  listServerAiProviderSummaries,
  loadServerAiProvider,
  loadServerAiProviders,
  requestStudyNoteAi,
  requestStudyNoteAiStream,
} from './ai-provider.mjs'

const VALID_ENVIRONMENT = {
  AI_PROVIDER_NAME: 'DeepSeek',
  AI_BASE_URL: 'https://api.deepseek.com/v1',
  AI_API_KEY: 'sk-test-only',
  AI_API_FORMAT: 'chat_completions',
  AI_MODEL: 'deepseek-chat',
}

const JSON_ENVIRONMENT = {
  AI_PROVIDERS_JSON: JSON.stringify([
    {
      id: 'deepseek',
      name: 'DeepSeek',
      baseUrl: 'https://api.deepseek.com/v1',
      apiKey: 'fake-key-deepseek',
      format: 'chat_completions',
      model: 'deepseek-chat',
    },
    {
      id: 'glm',
      name: '智谱 GLM',
      baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
      apiKey: 'fake-key-glm',
      format: 'chat_completions',
      model: 'glm-4-flash',
    },
  ]),
}

describe('server AI provider configuration', () => {
  it('loads optional server AI provider config', () => {
    expect(loadServerAiProviders({})).toEqual([])
    expect(loadServerAiProvider({})).toBeNull()
    expect(loadServerAiProvider(VALID_ENVIRONMENT)?.model).toBe('deepseek-chat')
  })

  it('rejects non-https AI base URL', () => {
    expect(() => loadServerAiProvider({
      ...VALID_ENVIRONMENT,
      AI_BASE_URL: 'http://127.0.0.1:11434/v1',
    })).toThrow('https')
  })

  it('loads multiple providers from AI_PROVIDERS_JSON', () => {
    const providers = loadServerAiProviders(JSON_ENVIRONMENT)
    expect(providers).toHaveLength(2)
    expect(providers[0].id).toBe('deepseek')
    expect(providers[0].apiKey).toBe('fake-key-deepseek')
    expect(providers[1].id).toBe('glm')
  })

  it('listServerAiProviderSummaries never exposes apiKey', () => {
    const summaries = listServerAiProviderSummaries(JSON_ENVIRONMENT)
    expect(summaries).toEqual([
      { id: 'deepseek', name: 'DeepSeek', format: 'chat_completions', model: 'deepseek-chat' },
      { id: 'glm', name: '智谱 GLM', format: 'chat_completions', model: 'glm-4-flash' },
    ])
    summaries.forEach(summary => {
      expect(Object.keys(summary)).not.toContain('apiKey')
      expect(JSON.stringify(summary)).not.toContain('fake-key')
    })
  })

  it('selects provider by providerId', () => {
    const provider = loadServerAiProvider(JSON_ENVIRONMENT, 'glm')
    expect(provider?.id).toBe('glm')
    expect(provider?.model).toBe('glm-4-flash')
  })

  it('returns first provider when providerId is empty', () => {
    expect(loadServerAiProvider(JSON_ENVIRONMENT)?.id).toBe('deepseek')
    expect(loadServerAiProvider(JSON_ENVIRONMENT, '')?.id).toBe('deepseek')
  })

  it('throws stable error when providerId does not exist', () => {
    expect(() => loadServerAiProvider(JSON_ENVIRONMENT, 'missing')).toThrow('选择的 AI 供应商不存在。')
  })

  it('rejects duplicate ids in AI_PROVIDERS_JSON', () => {
    expect(() => loadServerAiProviders({
      AI_PROVIDERS_JSON: JSON.stringify([
        { id: 'a', name: 'A', baseUrl: 'https://a.example.com', apiKey: 'fake-key', format: 'chat_completions', model: 'm' },
        { id: 'a', name: 'A2', baseUrl: 'https://b.example.com', apiKey: 'fake-key', format: 'chat_completions', model: 'm' },
      ]),
    })).toThrow('id 重复')
  })

  it('rejects invalid id format', () => {
    expect(() => loadServerAiProviders({
      AI_PROVIDERS_JSON: JSON.stringify([
        { id: 'Bad Id', name: 'A', baseUrl: 'https://a.example.com', apiKey: 'fake-key', format: 'chat_completions', model: 'm' },
      ]),
    })).toThrow('id 格式无效')
  })

  it('falls back to legacy single-provider env when AI_PROVIDERS_JSON is absent', () => {
    const providers = loadServerAiProviders(VALID_ENVIRONMENT)
    expect(providers).toHaveLength(1)
    expect(providers[0].apiKey).toBe('sk-test-only')
    expect(providers[0].model).toBe('deepseek-chat')
  })

  it('returns empty array when neither json nor legacy configured', () => {
    expect(loadServerAiProviders({})).toEqual([])
  })

  it('throws on invalid AI_PROVIDERS_JSON', () => {
    expect(() => loadServerAiProviders({ AI_PROVIDERS_JSON: '{not json' })).toThrow('JSON')
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

  it('uses specified providerId to call the correct provider', async () => {
    const requests = []
    const fetchImplementation = async (url, options) => {
      requests.push({ url, options })
      return new Response(JSON.stringify({
        choices: [{ message: { content: '今天用 GLM 润色。' } }],
      }))
    }

    const result = await requestStudyNoteAi({
      content: '学了 Docker',
      environment: JSON_ENVIRONMENT,
      fetchImplementation,
      providerId: 'glm',
    })

    expect(result.providerName).toBe('智谱 GLM')
    expect(result.model).toBe('glm-4-flash')
    expect(requests[0].url).toBe('https://open.bigmodel.cn/api/paas/v4/chat/completions')
    expect(requests[0].options.headers.Authorization).toBe('Bearer fake-key-glm')
  })

  it('throws stable error when providerId is missing during request', async () => {
    const fetchImplementation = async () => new Response('{}')
    await expect(requestStudyNoteAi({
      content: '内容',
      environment: JSON_ENVIRONMENT,
      fetchImplementation,
      providerId: 'missing',
    })).rejects.toMatchObject({
      message: '选择的 AI 供应商不存在。',
      statusCode: 404,
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

  it('uses specified providerId for streaming request', async () => {
    const requests = []
    const sseLines = [
      'data: {"choices":[{"delta":{"content":"GLM 流式"}}]}\n\n',
      'data: [DONE]\n\n',
    ]
    const fetchImpl = async (url, options) => {
      requests.push({ url, options })
      return new Response(createSseStream(sseLines), { status: 200 })
    }
    let doneResult = null

    await requestStudyNoteAiStream({
      content: '内容',
      environment: JSON_ENVIRONMENT,
      fetchImplementation: fetchImpl,
      providerId: 'glm',
      onDelta() {},
      onDone(result) { doneResult = result },
      onError() {},
    })

    expect(requests[0].url).toBe('https://open.bigmodel.cn/api/paas/v4/chat/completions')
    expect(requests[0].options.headers.Authorization).toBe('Bearer fake-key-glm')
    expect(doneResult).toEqual({ providerName: '智谱 GLM', model: 'glm-4-flash' })
  })

  it('calls onError when providerId does not exist for streaming', async () => {
    let errorMessage = null

    await requestStudyNoteAiStream({
      content: '内容',
      environment: JSON_ENVIRONMENT,
      fetchImplementation: async () => new Response('{}'),
      providerId: 'missing',
      onDelta() {},
      onDone() {},
      onError(msg) { errorMessage = msg },
    })

    expect(errorMessage).toBe('选择的 AI 供应商不存在。')
  })
})
