import { describe, expect, it } from 'vitest'
import {
  AI_EXPORT_INPUT_MAX_LENGTH,
  listServerAiProviderSummaries,
  loadServerAiProvider,
  loadServerAiProviders,
  requestAnnouncementPolish,
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

  it('uses provider configured model for export purpose', async () => {
    const requests = []
    const fetchImplementation = async (url, options) => {
      requests.push({ url, options })
      return new Response(JSON.stringify({
        choices: [{ message: { content: '# 标题\n## 章节\n正文' } }],
      }))
    }

    const result = await requestStudyNoteAi({
      content: '日期：2026-07-01\n笔记内容',
      environment: JSON_ENVIRONMENT,
      fetchImplementation,
      purpose: 'export',
      providerId: 'glm',
    })

    expect(result.model).toBe('glm-4-flash')
    const body = JSON.parse(requests[0].options.body)
    expect(body.model).toBe('glm-4-flash')
  })

  it('uses deepseek model for deepseek export', async () => {
    const requests = []
    const fetchImplementation = async (url, options) => {
      requests.push({ url, options })
      return new Response(JSON.stringify({
        choices: [{ message: { content: '# 标题\n## 章节\n正文' } }],
      }))
    }

    const result = await requestStudyNoteAi({
      content: '日期：2026-07-01\n笔记内容',
      environment: JSON_ENVIRONMENT,
      fetchImplementation,
      purpose: 'export',
      providerId: 'deepseek',
    })

    expect(result.model).toBe('deepseek-chat')
    expect(JSON.parse(requests[0].options.body).model).toBe('deepseek-chat')
  })

  it('uses exportModel when configured', async () => {
    const env = {
      AI_PROVIDERS_JSON: JSON.stringify([
        {
          id: 'glm',
          name: '智谱 GLM',
          baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
          apiKey: 'fake-key-glm',
          format: 'chat_completions',
          model: 'glm-4-flash',
          exportModel: 'glm-4-air',
        },
      ]),
    }
    const requests = []
    const fetchImplementation = async (url, options) => {
      requests.push({ url, options })
      return new Response(JSON.stringify({
        choices: [{ message: { content: '# 标题\n## 章节\n正文' } }],
      }))
    }

    const result = await requestStudyNoteAi({
      content: '日期：2026-07-01\n笔记内容',
      environment: env,
      fetchImplementation,
      purpose: 'export',
      providerId: 'glm',
    })

    expect(result.model).toBe('glm-4-air')
    expect(JSON.parse(requests[0].options.body).model).toBe('glm-4-air')
  })

  it('rejects export input exceeding AI_EXPORT_INPUT_MAX_LENGTH', async () => {
    await expect(requestStudyNoteAi({
      content: 'x'.repeat(AI_EXPORT_INPUT_MAX_LENGTH + 1),
      environment: VALID_ENVIRONMENT,
      fetchImplementation: async () => new Response('{}'),
      purpose: 'export',
    })).rejects.toThrow('exportContent invalid')
  })

  it('throws stable error when providerId does not exist', async () => {
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

  it('uses announcement prompt for announcement polish purpose', async () => {
    const requests = []
    const fetchImplementation = async (url, options) => {
      requests.push({ url, options })
      return new Response(JSON.stringify({
        choices: [{ message: { content: '本次更新包含稳定性改进。' } }],
      }))
    }

    const result = await requestAnnouncementPolish({
      content: '公告类型：桌面端更新\n可用变更事实：\n- 修复更新提示',
      environment: VALID_ENVIRONMENT,
      fetchImplementation,
    })

    expect(result.content).toBe('本次更新包含稳定性改进。')
    const body = JSON.parse(requests[0].options.body)
    expect(body.messages[0].content).toContain('产品更新公告')
    expect(body.max_tokens).toBe(2000)
  })
})

describe('server AI provider streaming limits', () => {
  function createDelayedSseStream(lines, delayMs = 0) {
    const encoder = new TextEncoder()
    const chunks = lines.map(line => encoder.encode(line))
    let index = 0
    return new ReadableStream({
      async pull(controller) {
        if (delayMs > 0) await new Promise(resolve => setTimeout(resolve, delayMs))
        if (index < chunks.length) {
          controller.enqueue(chunks[index])
          index += 1
        } else {
          controller.close()
        }
      },
    })
  }

  it('times out when upstream fetch is slow to respond', async () => {
    let errorMessage = null
    const fetchImpl = async (_url, options) => {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, 200)
        options.signal?.addEventListener('abort', () => {
          clearTimeout(timer)
          reject(new DOMException('Aborted', 'AbortError'))
        }, { once: true })
      })
      return new Response('{}', { status: 200 })
    }

    await requestStudyNoteAiStream({
      content: '内容',
      environment: VALID_ENVIRONMENT,
      fetchImplementation: fetchImpl,
      timeoutMs: 30,
      onDelta() {},
      onDone() {},
      onError(msg) { errorMessage = msg },
    })

    expect(errorMessage).toBe('AI 供应商响应超时。')
  })

  it('aborts when client signal is cancelled', async () => {
    let errorMessage = null
    const controller = new AbortController()
    const fetchImpl = async (_url, options) => {
      await new Promise(resolve => setTimeout(resolve, 20))
      if (options.signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError')
      }
      return new Response(createDelayedSseStream([
        'data: {"choices":[{"delta":{"content":"x"}}]}\n\n',
      ]), { status: 200 })
    }

    controller.abort()
    await requestStudyNoteAiStream({
      content: '内容',
      environment: VALID_ENVIRONMENT,
      fetchImplementation: fetchImpl,
      abortSignal: controller.signal,
      onDelta() {},
      onDone() {},
      onError(msg) { errorMessage = msg },
    })

    expect(errorMessage).toBe('客户端已取消请求。')
  })

  it('rejects stream exceeding character limit', async () => {
    let errorMessage = null
    const huge = 'a'.repeat(50)
    const sseLines = Array.from({ length: 700 }, () => `data: {"choices":[{"delta":{"content":"${huge}"}}]}\n\n`)
    sseLines.push('data: [DONE]\n\n')
    const fetchImpl = async () => new Response(createDelayedSseStream(sseLines), { status: 200 })

    await requestStudyNoteAiStream({
      content: '内容',
      environment: VALID_ENVIRONMENT,
      fetchImplementation: fetchImpl,
      onDelta() {},
      onDone() {},
      onError(msg) { errorMessage = msg },
    })

    expect(errorMessage).toBe('AI 流式响应超过长度限制。')
  })

  it('calls onError on upstream HTTP 500', async () => {
    let errorMessage = null
    await requestStudyNoteAiStream({
      content: '内容',
      environment: VALID_ENVIRONMENT,
      fetchImplementation: async () => new Response('{}', { status: 500 }),
      onDelta() {},
      onDone() {},
      onError(msg) { errorMessage = msg },
    })
    expect(errorMessage).toBe('AI 供应商返回错误：HTTP 500。')
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
