import type { AiProviderFormat, AiProviderInput, PolishResult } from '@/utils/studyNotesApi'

const DB_NAME = 'yunzhan-local-ai'
const DB_VERSION = 1
const STORE_NAME = 'providers'
const ACTIVE_PROVIDER_KEY = 'active'
const REQUEST_TIMEOUT_MS = 60_000
const RESPONSE_MAX_BYTES = 100_000
const POLISHED_CONTENT_MAX_LENGTH = 30_000
const CONNECTION_TEST_MAX_LENGTH = 1000

type StoredAiProvider = AiProviderInput & { savedAt: number }

function getElectronApi() {
  return typeof window === 'undefined' ? undefined : window.electronAPI
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFormat(value: unknown): value is AiProviderFormat {
  return value === 'anthropic_messages' || value === 'chat_completions' || value === 'responses'
}

function readStoredProvider(value: unknown): StoredAiProvider | null {
  if (
    !isRecord(value)
    || typeof value.name !== 'string'
    || typeof value.baseUrl !== 'string'
    || typeof value.apiKey !== 'string'
    || !isFormat(value.format)
    || typeof value.model !== 'string'
    || typeof value.savedAt !== 'number'
    || !Number.isFinite(value.savedAt)
  ) return null
  return {
    name: value.name,
    baseUrl: value.baseUrl,
    apiKey: value.apiKey,
    format: value.format,
    model: value.model,
    savedAt: value.savedAt,
  }
}

function readPolishResult(value: unknown): PolishResult | null {
  if (
    !isRecord(value)
    || typeof value.content !== 'string'
    || typeof value.providerName !== 'string'
    || typeof value.model !== 'string'
  ) return null
  return {
    content: value.content,
    providerName: value.providerName,
    model: value.model,
  }
}

function openDatabase(): Promise<IDBDatabase> {
  if (!window.indexedDB) return Promise.reject(new Error('当前环境不支持本地 AI 配置保存。'))
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(new Error('本地 AI 配置数据库打开失败。'))
  })
}

async function readStoreValue(key: string): Promise<unknown> {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.get(key)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(new Error('本地 AI 配置读取失败。'))
    transaction.oncomplete = () => database.close()
    transaction.onerror = () => {
      database.close()
      reject(new Error('本地 AI 配置读取失败。'))
    }
  })
}

async function writeStoreValue(key: string, value: StoredAiProvider): Promise<void> {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    store.put(value, key)
    transaction.oncomplete = () => {
      database.close()
      resolve()
    }
    transaction.onerror = () => {
      database.close()
      reject(new Error('本地 AI 配置保存失败。'))
    }
  })
}

export async function loadLocalAiProvider(): Promise<AiProviderInput | null> {
  const value = await readStoreValue(ACTIVE_PROVIDER_KEY)
  const provider = readStoredProvider(value)
  if (!provider) return null
  return {
    name: provider.name,
    baseUrl: provider.baseUrl,
    apiKey: provider.apiKey,
    format: provider.format,
    model: provider.model,
  }
}

export async function saveLocalAiProvider(provider: AiProviderInput): Promise<void> {
  validateProvider(provider)
  await writeStoreValue(ACTIVE_PROVIDER_KEY, { ...provider, savedAt: Date.now() })
}

export function validateProvider(provider: AiProviderInput) {
  if (!provider.name.trim() || provider.name.length > 80) throw new Error('AI 供应商名称无效。')
  if (!provider.model.trim() || provider.model.length > 128) throw new Error('AI 模型名称无效。')
  if (!provider.apiKey.trim() || provider.apiKey.length > 4096) throw new Error('API Key 无效。')
  if (!isFormat(provider.format)) throw new Error('AI 接口格式无效。')
  let baseUrl: URL
  try {
    baseUrl = new URL(provider.baseUrl.trim())
  } catch {
    throw new Error('AI Base URL 无效。')
  }
  if (baseUrl.protocol !== 'https:' || baseUrl.username || baseUrl.password || baseUrl.search || baseUrl.hash) {
    throw new Error('AI Base URL 必须是 https 地址，且不能包含账号、查询参数或片段。')
  }
}

function buildPolishPrompt() {
  return [
    '你是云栈学习平台的学习记录润色助手。',
    '请保留用户自己的学习经历和事实，不新增没有依据的知识点。',
    '把内容整理成清晰、自然、适合复盘的中文学习记录。',
    '可以适当分段、修正错别字、补足表达，但不要写成营销文案。',
  ].join('\n')
}

function buildAiEndpoint(provider: AiProviderInput) {
  const endpointByFormat: Record<AiProviderFormat, string> = {
    anthropic_messages: '/messages',
    chat_completions: '/chat/completions',
    responses: '/responses',
  }
  return `${provider.baseUrl.replace(/\/+$/, '')}${endpointByFormat[provider.format]}`
}

function buildAiRequest(provider: AiProviderInput, content: string, purpose: 'polish' | 'test' = 'polish') {
  const systemPrompt = purpose === 'test'
    ? '请用中文简短回复“连接成功”。'
    : buildPolishPrompt()
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
        max_tokens: purpose === 'test' ? 64 : 2000,
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
        max_output_tokens: purpose === 'test' ? 64 : 2000,
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
      max_tokens: purpose === 'test' ? 64 : 2000,
      stream: false,
    },
  }
}

async function readLimitedResponseText(response: Response) {
  const reader = response.body?.getReader()
  if (!reader) return ''
  const chunks: Uint8Array[] = []
  let total = 0
  let reading = true
  while (reading) {
    const { done, value } = await reader.read()
    if (done) {
      reading = false
      continue
    }
    total += value.byteLength
    if (total > RESPONSE_MAX_BYTES) throw new Error('AI 供应商响应过大。')
    chunks.push(value)
  }
  const result = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(result)
}

function readTextPart(value: unknown) {
  if (typeof value === 'string') return value
  if (!isRecord(value)) return ''
  if (typeof value.text === 'string') return value.text
  if (typeof value.content === 'string') return value.content
  return ''
}

function parseChatCompletionContent(payload: unknown) {
  if (!isRecord(payload) || !Array.isArray(payload.choices)) return ''
  const choice = payload.choices[0]
  if (!isRecord(choice) || !isRecord(choice.message)) return ''
  return typeof choice.message.content === 'string' ? choice.message.content : ''
}

function parseAnthropicContent(payload: unknown) {
  if (!isRecord(payload)) return ''
  if (typeof payload.content === 'string') return payload.content
  if (!Array.isArray(payload.content)) return ''
  return payload.content.map(readTextPart).filter(Boolean).join('\n')
}

function parseResponsesContent(payload: unknown) {
  if (!isRecord(payload)) return ''
  if (typeof payload.output_text === 'string') return payload.output_text
  if (!Array.isArray(payload.output)) return ''
  return payload.output
    .flatMap(item => (isRecord(item) && Array.isArray(item.content) ? item.content : []))
    .map(readTextPart)
    .filter(Boolean)
    .join('\n')
}

function parseAiContent(payload: unknown, format: AiProviderFormat, maxLength: number) {
  const content = format === 'anthropic_messages'
    ? parseAnthropicContent(payload)
    : format === 'responses'
      ? parseResponsesContent(payload)
      : parseChatCompletionContent(payload)
  const normalized = content.trim()
  return normalized.length >= 1 && normalized.length <= maxLength ? normalized : ''
}

async function requestAiFromBrowser(input: {
  content: string
  provider: AiProviderInput
  purpose: 'polish' | 'test'
}): Promise<PolishResult> {
  const requestPayload = buildAiRequest(input.provider, input.content, input.purpose)

  let response: Response
  try {
    response = await fetch(buildAiEndpoint(input.provider), {
      method: 'POST',
      headers: requestPayload.headers,
      body: JSON.stringify(requestPayload.body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (error) {
    const message = error instanceof Error && error.name === 'TimeoutError'
      ? 'AI 供应商响应超时。'
      : '无法直连 AI 供应商。请确认该供应商允许浏览器跨域请求。'
    throw new Error(message)
  }

  const rawText = await readLimitedResponseText(response)
  if (!response.ok) throw new Error(`AI 供应商返回错误：HTTP ${response.status}。`)

  let payload: unknown
  try {
    payload = JSON.parse(rawText)
  } catch {
    throw new Error('AI 供应商返回了无效 JSON。')
  }

  const parsedContent = parseAiContent(
    payload,
    input.provider.format,
    input.purpose === 'test' ? CONNECTION_TEST_MAX_LENGTH : POLISHED_CONTENT_MAX_LENGTH,
  )
  if (!parsedContent) throw new Error('AI 供应商返回内容无效。')
  return {
    content: parsedContent,
    providerName: input.provider.name.trim(),
    model: input.provider.model.trim(),
  }
}

async function requestAiFromDesktop(channel: 'ai:polishStudyNote' | 'ai:testProvider', payload: unknown): Promise<PolishResult> {
  const electronApi = getElectronApi()
  if (!electronApi) throw new Error('当前不是桌面端。')
  const result = await electronApi.invoke(channel, payload)
  const parsed = readPolishResult(result)
  if (!parsed) throw new Error('桌面端返回了无效 AI 结果。')
  return parsed
}

export async function polishStudyNoteLocally(input: { content: string; provider: AiProviderInput }): Promise<PolishResult> {
  const content = input.content.trim()
  if (!content || content.length > 20_000) throw new Error('学习记录内容需为 1-20000 个字符。')
  validateProvider(input.provider)
  if (getElectronApi()) return requestAiFromDesktop('ai:polishStudyNote', { content, provider: input.provider })
  return requestAiFromBrowser({ content, provider: input.provider, purpose: 'polish' })
}

export async function testAiProviderLocally(provider: AiProviderInput): Promise<PolishResult> {
  validateProvider(provider)
  if (getElectronApi()) return requestAiFromDesktop('ai:testProvider', provider)
  return requestAiFromBrowser({
    content: '请测试当前模型连接。',
    provider,
    purpose: 'test',
  })
}
