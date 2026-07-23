const AI_ALLOWED_FORMATS = new Set(['anthropic_messages', 'chat_completions', 'responses'])
const AI_PROVIDER_NAME_MAX_LENGTH = 80
const AI_BASE_URL_MAX_LENGTH = 2048
const AI_KEY_MAX_LENGTH = 4096
const AI_MODEL_MAX_LENGTH = 128
const AI_CONTENT_MAX_LENGTH = 20_000
const AI_POLISHED_MAX_LENGTH = 30_000
const AI_TEST_MAX_LENGTH = 1000
const AI_RESPONSE_MAX_BYTES = 100_000
const AI_REQUEST_TIMEOUT_MS = 60_000

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function validateBoundedString(value, maxLength, label) {
  if (typeof value !== 'string') throw new Error(`${label} invalid`)
  const trimmed = value.trim()
  if (trimmed.length < 1 || trimmed.length > maxLength) throw new Error(`${label} invalid`)
  return trimmed
}

function validateAiBaseUrl(value) {
  if (typeof value !== 'string' || value.trim().length > AI_BASE_URL_MAX_LENGTH) {
    throw new Error('AI_BASE_URL 配置无效。')
  }
  let parsed
  try {
    parsed = new URL(value.trim())
  } catch {
    throw new Error('AI_BASE_URL 配置无效。')
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error('AI_BASE_URL 必须是 https 地址，且不能包含账号、查询参数或片段。')
  }
  return value.trim().replace(/\/+$/, '')
}

export function loadServerAiProvider(environment = process.env) {
  const baseUrlRaw = environment.AI_BASE_URL?.trim() ?? ''
  const apiKeyRaw = environment.AI_API_KEY?.trim() ?? ''
  const modelRaw = environment.AI_MODEL?.trim() ?? ''
  if (!baseUrlRaw || !apiKeyRaw || !modelRaw) return null

  const format = environment.AI_API_FORMAT?.trim() || 'chat_completions'
  if (!AI_ALLOWED_FORMATS.has(format)) throw new Error('AI_API_FORMAT 配置无效。')
  return {
    name: validateBoundedString(environment.AI_PROVIDER_NAME ?? '云栈 AI', AI_PROVIDER_NAME_MAX_LENGTH, 'AI_PROVIDER_NAME'),
    baseUrl: validateAiBaseUrl(baseUrlRaw),
    apiKey: validateBoundedString(apiKeyRaw, AI_KEY_MAX_LENGTH, 'AI_API_KEY'),
    format,
    model: validateBoundedString(modelRaw, AI_MODEL_MAX_LENGTH, 'AI_MODEL'),
  }
}

function buildStudyNotePolishPrompt() {
  return [
    '你是云栈学习平台的学习记录润色助手。',
    '请保留用户自己的学习经历和事实，不新增没有依据的知识点。',
    '把内容整理成清晰、自然、适合复盘的中文学习记录。',
    '可以适当分段、修正错别字、补足表达，但不要写成营销文案。',
  ].join('\n')
}

function buildAiEndpoint(provider) {
  const endpointByFormat = {
    anthropic_messages: '/messages',
    chat_completions: '/chat/completions',
    responses: '/responses',
  }
  return `${provider.baseUrl}${endpointByFormat[provider.format]}`
}

function buildAiRequest(provider, content, purpose) {
  const systemPrompt = purpose === 'test'
    ? '请用中文简短回复“连接成功”。'
    : buildStudyNotePolishPrompt()
  const maxTokens = purpose === 'test' ? 64 : 2000
  if (provider.format === 'anthropic_messages') {
    return {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': provider.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: {
        model: provider.model,
        system: systemPrompt,
        messages: [{ role: 'user', content }],
        max_tokens: maxTokens,
      },
    }
  }
  if (provider.format === 'responses') {
    return {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${provider.apiKey}`,
      },
      body: {
        model: provider.model,
        instructions: systemPrompt,
        input: content,
        temperature: 0.3,
        max_output_tokens: maxTokens,
      },
    }
  }
  return {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${provider.apiKey}`,
    },
    body: {
      model: provider.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content },
      ],
      temperature: 0.3,
      max_tokens: maxTokens,
      stream: false,
    },
  }
}

async function readLimitedResponseText(response) {
  const reader = response.body?.getReader()
  if (!reader) return ''
  const chunks = []
  let total = 0
  let reading = true
  while (reading) {
    const { done, value } = await reader.read()
    if (done) {
      reading = false
      continue
    }
    total += value.byteLength
    if (total > AI_RESPONSE_MAX_BYTES) {
      throw new Error('AI 供应商响应过大。')
    }
    chunks.push(value)
  }
  return Buffer.concat(chunks, total).toString('utf8')
}

function readTextPart(value) {
  if (typeof value === 'string') return value
  if (!isPlainObject(value)) return ''
  if (typeof value.text === 'string') return value.text
  if (typeof value.content === 'string') return value.content
  return ''
}

function parseChatCompletionContent(payload) {
  if (!isPlainObject(payload) || !Array.isArray(payload.choices)) return ''
  const choice = payload.choices[0]
  if (!isPlainObject(choice) || !isPlainObject(choice.message)) return ''
  return typeof choice.message.content === 'string' ? choice.message.content : ''
}

function parseAnthropicContent(payload) {
  if (!isPlainObject(payload)) return ''
  if (typeof payload.content === 'string') return payload.content
  if (!Array.isArray(payload.content)) return ''
  return payload.content.map(readTextPart).filter(Boolean).join('\n')
}

function parseResponsesContent(payload) {
  if (!isPlainObject(payload)) return ''
  if (typeof payload.output_text === 'string') return payload.output_text
  if (!Array.isArray(payload.output)) return ''
  return payload.output
    .flatMap(item => (isPlainObject(item) && Array.isArray(item.content) ? item.content : []))
    .map(readTextPart)
    .filter(Boolean)
    .join('\n')
}

function parseAiContent(payload, format, maxLength) {
  const content = format === 'anthropic_messages'
    ? parseAnthropicContent(payload)
    : format === 'responses'
      ? parseResponsesContent(payload)
      : parseChatCompletionContent(payload)
  const normalized = content.trim()
  return normalized.length >= 1 && normalized.length <= maxLength ? normalized : ''
}

export async function requestStudyNoteAi({
  content,
  environment = process.env,
  fetchImplementation = globalThis.fetch,
  purpose = 'polish',
}) {
  const provider = loadServerAiProvider(environment)
  if (!provider) {
    const error = new Error('服务端 AI 尚未配置。')
    error.statusCode = 503
    throw error
  }
  if (typeof fetchImplementation !== 'function') {
    const error = new Error('当前 Node.js 运行时不支持 fetch。')
    error.statusCode = 503
    throw error
  }
  const normalizedContent = purpose === 'test'
    ? '请测试当前模型连接。'
    : validateBoundedString(content, AI_CONTENT_MAX_LENGTH, 'content')
  const requestPayload = buildAiRequest(provider, normalizedContent, purpose)

  let response
  try {
    response = await fetchImplementation(buildAiEndpoint(provider), {
      method: 'POST',
      headers: requestPayload.headers,
      body: JSON.stringify(requestPayload.body),
      signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
    })
  } catch (error) {
    const message = error instanceof Error && error.name === 'TimeoutError'
      ? 'AI 供应商响应超时。'
      : '服务端无法连接 AI 供应商。'
    const wrapped = new Error(message)
    wrapped.statusCode = 502
    throw wrapped
  }

  const rawText = await readLimitedResponseText(response)
  if (!response.ok) {
    const error = new Error(`AI 供应商返回错误：HTTP ${response.status}。`)
    error.statusCode = 502
    throw error
  }

  let payload
  try {
    payload = JSON.parse(rawText)
  } catch {
    const error = new Error('AI 供应商返回了无效 JSON。')
    error.statusCode = 502
    throw error
  }

  const parsedContent = parseAiContent(
    payload,
    provider.format,
    purpose === 'test' ? AI_TEST_MAX_LENGTH : AI_POLISHED_MAX_LENGTH,
  )
  if (!parsedContent) {
    const error = new Error('AI 供应商返回内容无效。')
    error.statusCode = 502
    throw error
  }
  return {
    content: parsedContent,
    providerName: provider.name,
    model: provider.model,
  }
}

/**
 * 流式 AI 润色接口：通过回调逐段转发 AI 生成的内容。
 * 当前优先支持 chat_completions 格式（OpenAI 兼容 SSE），
 * 其他格式暂不支持流式，会直接返回错误。
 */
export async function requestStudyNoteAiStream({
  content,
  environment = process.env,
  fetchImplementation = globalThis.fetch,
  onDelta,
  onDone,
  onError,
}) {
  const provider = loadServerAiProvider(environment)
  if (!provider) {
    onError('服务端 AI 尚未配置。')
    return
  }
  if (typeof fetchImplementation !== 'function') {
    onError('当前 Node.js 运行时不支持 fetch。')
    return
  }
  if (provider.format !== 'chat_completions') {
    onError('当前 AI 格式暂不支持流式润色，请使用 OpenAI 兼容接口。')
    return
  }

  const normalizedContent = validateBoundedString(content, AI_CONTENT_MAX_LENGTH, 'content')
  const requestPayload = buildAiRequest(provider, normalizedContent, 'polish')
  const streamBody = { ...requestPayload.body, stream: true }

  let response
  try {
    response = await fetchImplementation(buildAiEndpoint(provider), {
      method: 'POST',
      headers: requestPayload.headers,
      body: JSON.stringify(streamBody),
    })
  } catch (error) {
    const message = error instanceof Error && error.name === 'TimeoutError'
      ? 'AI 供应商响应超时。'
      : '服务端无法连接 AI 供应商。'
    onError(message)
    return
  }

  if (!response.ok) {
    onError(`AI 供应商返回错误：HTTP ${response.status}。`)
    return
  }

  const reader = response.body?.getReader()
  if (!reader) {
    onError('AI 供应商未返回可读的流式响应。')
    return
  }

  let buffer = ''
  let errorSent = false
  let finished = false

  function finish() {
    if (finished) return
    finished = true
    try { reader.cancel() } catch { /* ignore */ }
  }

  function sendError(message) {
    if (errorSent) return
    errorSent = true
    finish()
    onError(message)
  }

  try {
    let reading = true
    while (reading) {
      const { done, value } = await reader.read()
      if (done) {
        reading = false
        continue
      }
      buffer += new TextDecoder().decode(value, { stream: true })

      // 按 \n\n（SSE 事件分隔符）分割
      const parts = buffer.split('\n\n')
      buffer = parts.pop() ?? ''

      for (const part of parts) {
        const lines = part.split('\n')
        let dataLine = ''
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            dataLine += line.slice(6)
          } else if (line.startsWith('data:')) {
            dataLine += line.slice(5).trimStart()
          }
        }
        if (!dataLine) continue

        if (dataLine === '[DONE]') {
          finish()
          onDone({ providerName: provider.name, model: provider.model })
          return
        }

        try {
          const parsed = JSON.parse(dataLine)
          const deltaContent = parsed?.choices?.[0]?.delta?.content
          if (typeof deltaContent === 'string' && deltaContent.length > 0) {
            onDelta(deltaContent)
          }
        } catch {
          // 跳过无法解析的 data 行
        }
      }
    }

    // 流自然结束（无 [DONE] 标记的情况）
    finish()
    onDone({ providerName: provider.name, model: provider.model })
  } catch (error) {
    sendError('AI 供应商流式响应中断。')
  }
}
