const AI_ALLOWED_FORMATS = new Set(['anthropic_messages', 'chat_completions', 'responses'])
const AI_PROVIDER_NAME_MAX_LENGTH = 80
const AI_BASE_URL_MAX_LENGTH = 2048
const AI_KEY_MAX_LENGTH = 4096
const AI_MODEL_MAX_LENGTH = 128
const AI_PROVIDER_ID_MAX_LENGTH = 64
const AI_PROVIDERS_JSON_MAX_LENGTH = 200_000
const AI_PROVIDER_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/
const AI_CONTENT_MAX_LENGTH = 20_000
const AI_POLISHED_MAX_LENGTH = 30_000
const AI_EXPORT_INPUT_MAX_LENGTH = 120_000
const AI_EXPORT_MAX_LENGTH = 120_000
const AI_TEST_MAX_LENGTH = 1000
const AI_RESPONSE_MAX_BYTES = 100_000
const AI_STREAM_MAX_BYTES = 100_000
const AI_STREAM_MAX_CHARS = 30_000
const AI_REQUEST_TIMEOUT_MS = 60_000
const AI_STREAM_TIMEOUT_MS = 60_000

export {
  AI_CONTENT_MAX_LENGTH,
  AI_EXPORT_INPUT_MAX_LENGTH,
  AI_EXPORT_MAX_LENGTH,
  AI_POLISHED_MAX_LENGTH,
  AI_STREAM_MAX_BYTES,
  AI_STREAM_MAX_CHARS,
  AI_STREAM_TIMEOUT_MS,
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function validateBoundedString(value, maxLength, label) {
  if (typeof value !== 'string') throw new Error(`${label} invalid`)
  const trimmed = value.trim()
  if (trimmed.length < 1 || trimmed.length > maxLength) throw new Error(`${label} invalid`)
  return trimmed
}

function validateAiBaseUrl(value, label = 'AI_BASE_URL') {
  if (typeof value !== 'string' || value.trim().length > AI_BASE_URL_MAX_LENGTH) {
    throw new Error(`${label} 配置无效。`)
  }
  let parsed
  try {
    parsed = new URL(value.trim())
  } catch {
    throw new Error(`${label} 配置无效。`)
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error(`${label} 必须是 https 地址，且不能包含账号、查询参数或片段。`)
  }
  return value.trim().replace(/\/+$/, '')
}

export class AIProviderError extends Error {
  constructor(message, statusCode = 500) {
    super(message)
    this.statusCode = statusCode
  }
}

function validateProviderId(value) {
  if (typeof value !== 'string' || !AI_PROVIDER_ID_PATTERN.test(value.trim())) {
    throw new AIProviderError('AI 供应商 id 格式无效。', 400)
  }
  return value.trim()
}

function normalizeProvider(raw, index) {
  const label = `AI 提供商配置第 ${index + 1} 项`
  if (!isPlainObject(raw)) throw new Error(`${label} 无效。`)
  const id = validateProviderId(raw.id)
  const name = validateBoundedString(raw.name, AI_PROVIDER_NAME_MAX_LENGTH, `${label} name`)
  const baseUrl = validateAiBaseUrl(raw.baseUrl, `${label} baseUrl`)
  const apiKey = validateBoundedString(raw.apiKey, AI_KEY_MAX_LENGTH, `${label} apiKey`)
  const model = validateBoundedString(raw.model, AI_MODEL_MAX_LENGTH, `${label} model`)
  const format = typeof raw.format === 'string' ? raw.format.trim() : 'chat_completions'
  if (!AI_ALLOWED_FORMATS.has(format)) throw new Error(`${label} format 无效。`)
  const provider = { id, name, baseUrl, apiKey, format, model }
  if (typeof raw.exportModel === 'string' && raw.exportModel.trim()) {
    provider.exportModel = validateBoundedString(raw.exportModel, AI_MODEL_MAX_LENGTH, `${label} exportModel`)
  }
  return provider
}

function loadLegacyProvider(environment) {
  const baseUrlRaw = environment.AI_BASE_URL?.trim() ?? ''
  const apiKeyRaw = environment.AI_API_KEY?.trim() ?? ''
  const modelRaw = environment.AI_MODEL?.trim() ?? ''
  if (!baseUrlRaw || !apiKeyRaw || !modelRaw) return null
  const format = environment.AI_API_FORMAT?.trim() || 'chat_completions'
  if (!AI_ALLOWED_FORMATS.has(format)) throw new Error('AI_API_FORMAT 配置无效。')
      return {
    id: safeHostToId(baseUrlRaw),
    name: validateBoundedString(environment.AI_PROVIDER_NAME ?? '云栈 AI', AI_PROVIDER_NAME_MAX_LENGTH, 'AI_PROVIDER_NAME'),
    baseUrl: validateAiBaseUrl(baseUrlRaw),
    apiKey: validateBoundedString(apiKeyRaw, AI_KEY_MAX_LENGTH, 'AI_API_KEY'),
    format,
    model: validateBoundedString(modelRaw, AI_MODEL_MAX_LENGTH, 'AI_MODEL'),
  }
}

function safeHostToId(baseUrl) {
  try {
    const hostname = new URL(baseUrl).hostname.toLowerCase()
    const slugged = hostname.replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '')
    if (slugged && AI_PROVIDER_ID_PATTERN.test(slugged)) return slugged
  } catch { /* ignore */ }
  // host 不合规时降级为稳定默认值，避免抛错泄露内部细节
  return 'default'
}

function loadProvidersFromJson(environment) {
  const raw = environment.AI_PROVIDERS_JSON
  if (typeof raw !== 'string' || !raw.trim()) return null
  if (raw.trim().length > AI_PROVIDERS_JSON_MAX_LENGTH) {
    throw new Error('AI_PROVIDERS_JSON 配置过大。')
  }
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('AI_PROVIDERS_JSON 不是有效的 JSON。')
  }
  const list = Array.isArray(parsed) ? parsed : null
  if (!list) throw new Error('AI_PROVIDERS_JSON 必须是对象数组。')
  if (list.length === 0) return []
  const providers = []
  const seenIds = new Set()
  list.forEach((item, index) => {
    const provider = normalizeProvider(item, index)
    if (seenIds.has(provider.id)) {
      throw new Error(`AI 提供商配置第 ${index + 1} 项 id 重复。`)
    }
    seenIds.add(provider.id)
    providers.push(provider)
  })
  return providers
}

/** 加载所有服务端 AI 供应商配置，不影响旧单供应商环境变量。 */
export function loadServerAiProviders(environment = process.env) {
  const fromJson = loadProvidersFromJson(environment)
  if (fromJson !== null) return fromJson
  const legacy = loadLegacyProvider(environment)
  return legacy ? [legacy] : []
}

/** 选定单项供应商；providerId 为空则返回第一个。 */
export function loadServerAiProvider(environment = process.env, providerId) {
  const providers = loadServerAiProviders(environment)
  if (providers.length === 0) return null
  if (!providerId) return providers[0]
  const match = providers.find(item => item.id === providerId)
  if (!match) throw new AIProviderError('选择的 AI 供应商不存在。', 404)
  return match
}

/** 列出不含 apiKey 的安全摘要，用于下发到前端。 */
export function listServerAiProviderSummaries(environment = process.env) {
  return loadServerAiProviders(environment).map(provider => ({
    id: provider.id,
    name: provider.name,
    format: provider.format,
    model: provider.model,
  }))
}

function buildStudyNotePolishPrompt() {
  return [
    '你是云栈学习平台的学习记录润色助手。',
    '请保留用户自己的学习经历和事实，不新增没有依据的知识点。',
    '把内容整理成清晰、自然、适合复盘的中文学习记录。',
    '可以适当分段、修正错别字、补足表达，但不要写成营销文案。',
  ].join('\n')
}

function buildStudyNoteExportPrompt(noteCount) {
  return [
    '你是云栈运维学习笔记本排版助手。',
    '任务：将下列多篇学习笔记整合为一份结构化的学习文档（语言用中文），按以下格式输出：',
    '',
    '# {智能概括的文档标题，如"7月下旬 容器与运维学习笔记"}',
    '## 第1章 {主题标题}',
    '{从相关笔记提炼融合的正文，保留命令、参数、配置示例等}',
    '## 第2章 ...',
    '## 学习小结',
    '{全篇内容的提炼，100-200字}',
    '',
    '格式约定：',
    '- 以"# "开头的是封面标题',
    '- 以"## "开头的是章节标题',
    '- 以4个半角空格（"    "）或制表符（"\\t"）开头的行是代码/命令示例',
    '- 其余行是正文段落',
    '- 空行仅用于段落间距',
    '',
    '重要规则：',
    '- 保留技术细节（命令、参数、配置等），不要编造新知识点',
    '- 对重复或类似内容进行合并，避免冗余',
    '- 不产生任何非本文档的解释性元信息',
    `- 请确保总计不超过 ${noteCount} 个日期对应的笔记主题覆盖`,
  ].join('\n')
}

function buildAnnouncementPolishPrompt() {
  return [
    '你是云栈产品更新公告撰写助手。',
    '请基于给定变更日志生成中文站内公告正文。',
    '要求：只使用输入中的事实，不新增功能、不编造影响范围。',
    '输出纯文本，不使用 Markdown、HTML、链接或表情。',
    '语气简洁可靠，长度控制在 120-800 字，可按“本次更新”“使用提示”分段。',
    '不要输出公告标题、版本号标题或解释性元信息。',
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

function resolveEffectiveModel(provider, purpose) {
  if (purpose === 'export' && typeof provider.exportModel === 'string' && provider.exportModel.trim()) {
    return provider.exportModel
  }
  return provider.model
}

function buildAiRequest(provider, content, purpose) {
  const systemPrompt = purpose === 'test'
    ? '请用中文简短回复”连接成功”。'
    : purpose === 'export'
      ? buildStudyNoteExportPrompt(content.split('\n').filter(l => l.startsWith('日期：')).length || 1)
      : purpose === 'announcement'
        ? buildAnnouncementPolishPrompt()
        : buildStudyNotePolishPrompt()
  const maxTokens = purpose === 'test' ? 64 : purpose === 'export' ? 4000 : 2000
  const effectiveModel = resolveEffectiveModel(provider, purpose)
  if (provider.format === 'anthropic_messages') {
    return {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': provider.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: {
        model: effectiveModel,
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
        model: effectiveModel,
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
      model: effectiveModel,
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
  providerId,
}) {
  const provider = loadServerAiProvider(environment, providerId)
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
    : validateBoundedString(
      content,
      purpose === 'export' ? AI_EXPORT_INPUT_MAX_LENGTH : AI_CONTENT_MAX_LENGTH,
      purpose === 'export' ? 'exportContent' : 'content',
    )
  const requestPayload = buildAiRequest(provider, normalizedContent, purpose)
  const requestedModel = resolveEffectiveModel(provider, purpose)

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
    error.statusCode = response.status >= 400 && response.status < 600 ? response.status : 502
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
    purpose === 'test' ? AI_TEST_MAX_LENGTH : purpose === 'export' ? AI_EXPORT_MAX_LENGTH : AI_POLISHED_MAX_LENGTH,
  )
  if (!parsedContent) {
    const error = new Error('AI 供应商返回内容无效。')
    error.statusCode = 502
    throw error
  }
  return {
    content: parsedContent,
    providerName: provider.name,
    model: requestedModel,
  }
}

export async function requestAnnouncementPolish({
  content,
  environment = process.env,
  fetchImplementation = globalThis.fetch,
  providerId,
}) {
  return requestStudyNoteAi({
    content,
    environment,
    fetchImplementation,
    purpose: 'announcement',
    providerId,
  })
}

/**
 * 流式 AI 润色接口：通过回调逐段转发 AI 生成的内容。
 * 当前优先支持 chat_completions 格式（OpenAI 兼容 SSE）。
 */
export async function requestStudyNoteAiStream({
  content,
  environment = process.env,
  fetchImplementation = globalThis.fetch,
  onDelta,
  onDone,
  onError,
  providerId,
  abortSignal,
  timeoutMs = AI_STREAM_TIMEOUT_MS,
}) {
  let provider
  try {
    provider = loadServerAiProvider(environment, providerId)
  } catch (error) {
    onError(error instanceof Error ? error.message : '选择的 AI 供应商不存在。')
    return
  }
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
  const requestedModel = resolveEffectiveModel(provider, 'polish')

  const controller = new AbortController()
  let timeoutId = null
  let clientAbortHandler = null
  let finished = false
  let errorSent = false
  let doneSent = false
  let reader = null
  let totalBytes = 0
  let totalChars = 0

  function cleanup() {
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
    if (clientAbortHandler && abortSignal) {
      abortSignal.removeEventListener('abort', clientAbortHandler)
      clientAbortHandler = null
    }
    if (reader) {
      try { reader.cancel() } catch { /* ignore */ }
      reader = null
    }
  }

  function finish() {
    if (finished) return
    finished = true
    cleanup()
  }

  function sendError(message) {
    if (errorSent || doneSent) return
    errorSent = true
    finish()
    onError(message)
  }

  function sendDone() {
    if (errorSent || doneSent) return
    doneSent = true
    finish()
    onDone({ providerName: provider.name, model: requestedModel })
  }

  timeoutId = setTimeout(() => {
    controller.abort()
  }, timeoutMs)

  if (abortSignal) {
    clientAbortHandler = () => controller.abort()
    if (abortSignal.aborted) {
      controller.abort()
    } else {
      abortSignal.addEventListener('abort', clientAbortHandler, { once: true })
    }
  }

  let response
  try {
    response = await fetchImplementation(buildAiEndpoint(provider), {
      method: 'POST',
      headers: requestPayload.headers,
      body: JSON.stringify(streamBody),
      signal: controller.signal,
    })
  } catch (error) {
    cleanup()
    if (error instanceof Error && error.name === 'AbortError') {
      if (abortSignal?.aborted) {
        onError('客户端已取消请求。')
        return
      }
      onError('AI 供应商响应超时。')
      return
    }
    onError('服务端无法连接 AI 供应商。')
    return
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
  }

  if (!response.ok) {
    cleanup()
    onError(`AI 供应商返回错误：HTTP ${response.status}。`)
    return
  }

  reader = response.body?.getReader()
  if (!reader) {
    cleanup()
    onError('AI 供应商未返回可读的流式响应。')
    return
  }

  let buffer = ''

  try {
    let reading = true
    while (reading) {
      const { done, value } = await reader.read()
      if (done) {
        reading = false
        continue
      }

      totalBytes += value.byteLength
      if (totalBytes > AI_STREAM_MAX_BYTES) {
        sendError('AI 流式响应超过大小限制。')
        return
      }

      buffer += new TextDecoder().decode(value, { stream: true })

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
          sendDone()
          return
        }

        try {
          const parsed = JSON.parse(dataLine)
          const deltaContent = parsed?.choices?.[0]?.delta?.content
          if (typeof deltaContent === 'string' && deltaContent.length > 0) {
            totalChars += deltaContent.length
            if (totalChars > AI_STREAM_MAX_CHARS) {
              sendError('AI 流式响应超过长度限制。')
              return
            }
            onDelta(deltaContent)
          }
        } catch {
          // 跳过无法解析的 data 行
        }
      }
    }

    if (buffer.trim()) {
      const lines = buffer.split('\n')
      let dataLine = ''
      for (const line of lines) {
        if (line.startsWith('data: ')) dataLine += line.slice(6)
        else if (line.startsWith('data:')) dataLine += line.slice(5).trimStart()
      }
      if (dataLine && dataLine !== '[DONE]') {
        try {
          const parsed = JSON.parse(dataLine)
          const deltaContent = parsed?.choices?.[0]?.delta?.content
          if (typeof deltaContent === 'string' && deltaContent.length > 0) {
            totalChars += deltaContent.length
            if (totalChars <= AI_STREAM_MAX_CHARS) onDelta(deltaContent)
          }
        } catch { /* ignore trailing buffer */ }
      }
    }

    sendDone()
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      sendError(abortSignal?.aborted ? '客户端已取消请求。' : 'AI 供应商响应超时。')
      return
    }
    sendError('AI 供应商流式响应中断。')
  } finally {
    cleanup()
  }
}
