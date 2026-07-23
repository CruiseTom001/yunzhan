import { apiRequest, resolveApiOrigin } from '@/utils/apiClient'

const AI_API_TIMEOUT_MS = 65_000

export type AiProviderFormat = 'anthropic_messages' | 'chat_completions' | 'responses'

export interface StudyNote {
  id: string
  date: string
  content: string
  polishedContent: string
  aiProviderName: string | null
  aiModel: string | null
  createdAt: number
  updatedAt: number
}

export interface StudyNotesResult {
  notes: StudyNote[]
  total: number
}

export interface AiProviderInput {
  name: string
  baseUrl: string
  apiKey: string
  format: AiProviderFormat
  model: string
}

export interface ServerAiProviderSummary {
  id: string
  name: string
  format: AiProviderFormat
  model: string
}

export interface PolishResult {
  content: string
  providerName: string
  model: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFormat(value: unknown): value is AiProviderFormat {
  return value === 'anthropic_messages' || value === 'chat_completions' || value === 'responses'
}

function readServerAiProviderSummary(value: unknown): ServerAiProviderSummary | null {
  if (
    !isRecord(value)
    || typeof value.id !== 'string'
    || !value.id.trim()
    || !isFormat(value.format)
    || typeof value.name !== 'string'
    || typeof value.model !== 'string'
  ) return null
  return {
    id: value.id,
    name: value.name,
    format: value.format,
    model: value.model,
  }
}

function isTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function isStudyDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function readStudyNote(value: unknown): StudyNote | null {
  if (
    !isRecord(value)
    || typeof value.id !== 'string'
    || !isStudyDate(value.date)
    || typeof value.content !== 'string'
    || typeof value.polishedContent !== 'string'
    || (value.aiProviderName !== null && typeof value.aiProviderName !== 'string')
    || (value.aiModel !== null && typeof value.aiModel !== 'string')
    || !isTimestamp(value.createdAt)
    || !isTimestamp(value.updatedAt)
  ) return null
  return {
    id: value.id,
    date: value.date,
    content: value.content,
    polishedContent: value.polishedContent,
    aiProviderName: typeof value.aiProviderName === 'string' ? value.aiProviderName : null,
    aiModel: typeof value.aiModel === 'string' ? value.aiModel : null,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  }
}

function readNotePayload(value: unknown): StudyNote | null {
  if (!isRecord(value)) return null
  return readStudyNote(value.note)
}

function readOkPayload(value: unknown) {
  return isRecord(value) && value.ok === true
}

function readPolishPayload(value: unknown): PolishResult | null {
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

export async function listStudyNotes(input: { limit?: number; offset?: number } = {}): Promise<StudyNotesResult> {
  const params = new URLSearchParams({
    limit: String(input.limit ?? 60),
    offset: String(input.offset ?? 0),
  })
  const payload = await apiRequest(`/study-notes?${params.toString()}`)
  if (!isRecord(payload) || !Array.isArray(payload.notes) || !Number.isInteger(payload.total)) {
    throw new Error('账号服务返回了无效学习记录列表。')
  }
  const notes = payload.notes.map(readStudyNote)
  if (notes.some(note => note === null)) throw new Error('学习记录列表包含无效数据。')
  return {
    notes: notes.filter((note): note is StudyNote => note !== null),
    total: payload.total as number,
  }
}

export async function saveStudyNote(input: {
  date: string
  content: string
  polishedContent?: string
  aiProviderName?: string | null
  aiModel?: string | null
}): Promise<StudyNote> {
  const payload = await apiRequest(`/study-notes/${encodeURIComponent(input.date)}`, {
    method: 'PUT',
    body: JSON.stringify({
      content: input.content,
      polishedContent: input.polishedContent ?? '',
      aiProviderName: input.aiProviderName ?? null,
      aiModel: input.aiModel ?? null,
    }),
  })
  const note = readNotePayload(payload)
  if (!note) throw new Error('账号服务返回了无效学习记录。')
  return note
}

export async function deleteStudyNote(date: string) {
  const payload = await apiRequest(`/study-notes/${encodeURIComponent(date)}`, { method: 'DELETE' })
  if (!readOkPayload(payload)) throw new Error('账号服务返回了无效删除结果。')
}

export async function listServerAiProviders(): Promise<ServerAiProviderSummary[]> {
  const payload = await apiRequest('/study-notes/ai/providers')
  if (!isRecord(payload) || !Array.isArray(payload.providers)) {
    throw new Error('账号服务返回了无效 AI 供应商列表。')
  }
  const providers = payload.providers.map(readServerAiProviderSummary)
  if (providers.some(item => item === null)) {
    throw new Error('账号服务返回了无效 AI 供应商列表。')
  }
  return providers.filter((item): item is ServerAiProviderSummary => item !== null)
}

export async function testServerAiProvider(providerId?: string): Promise<PolishResult> {
  const payload = await apiRequest('/study-notes/ai/test', {
    method: 'POST',
    body: JSON.stringify(buildProviderIdBody(providerId)),
    timeoutMs: AI_API_TIMEOUT_MS,
  })
  const result = readPolishPayload(payload)
  if (!result) throw new Error('账号服务返回了无效 AI 测试结果。')
  return result
}

export async function polishStudyNoteViaServer(content: string, providerId?: string): Promise<PolishResult> {
  const payload = await apiRequest('/study-notes/ai/polish', {
    method: 'POST',
    body: JSON.stringify({ content, ...buildProviderIdBody(providerId) }),
    timeoutMs: AI_API_TIMEOUT_MS,
  })
  const result = readPolishPayload(payload)
  if (!result) throw new Error('账号服务返回了无效 AI 润色结果。')
  return result
}

function buildProviderIdBody(providerId?: string): Record<string, string> {
  if (typeof providerId === 'string' && providerId.trim()) return { providerId: providerId.trim() }
  return {}
}

/**
 * 网页端流式 AI 润色：通过 SSE 逐段接收 AI 生成内容。
 * 桌面端不应调用此函数（桌面端走本地 IPC 直连 AI 供应商）。
 */
export async function polishStudyNoteViaServerStream(
  content: string,
  providerId: string | null,
  onDelta: (text: string) => void,
  onDone: (result: PolishResult) => void,
): Promise<void> {
  const origin = resolveApiOrigin()
  if (!origin) throw new Error('尚未配置云栈账号服务地址。')

  let response: Response
  try {
    response = await fetch(`${origin}/api/study-notes/ai/polish-stream`, {
      method: 'POST',
      headers: {
        'Accept': 'text/event-stream',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content, ...buildProviderIdBody(providerId ?? undefined) }),
      credentials: 'include',
    })
  } catch {
    throw new Error('无法连接云栈账号服务。')
  }

  if (!response.ok) {
    // 尝试读取错误 JSON
    let errorText = 'AI 润色请求失败。'
    try {
      const contentType = response.headers.get('content-type') ?? ''
      if (contentType.includes('application/json')) {
        const payload: unknown = await response.json()
        if (isRecord(payload) && typeof payload.error === 'string') errorText = payload.error
      }
    } catch { /* ignore */ }
    throw new Error(errorText)
  }

  const reader = response.body?.getReader()
  if (!reader) throw new Error('浏览器不支持流式响应。')

  const decoder = new TextDecoder()
  let buffer = ''
  let errorSent = false

  try {
    let reading = true
    while (reading) {
      const { done, value } = await reader.read()
      if (done) {
        reading = false
        continue
      }
      buffer += decoder.decode(value, { stream: true })

      const parts = buffer.split('\n\n')
      buffer = parts.pop() ?? ''

      for (const part of parts) {
        const lines = part.split('\n')
        let eventType = ''
        let dataLine = ''
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim()
          } else if (line.startsWith('data: ')) {
            dataLine = line.slice(6)
          } else if (line.startsWith('data:')) {
            dataLine = line.slice(5).trimStart()
          }
        }
        if (!eventType || !dataLine) continue

        if (eventType === 'error') {
          if (errorSent) continue
          errorSent = true
          try { reader.cancel() } catch { /* ignore */ }
          const parsed = JSON.parse(dataLine)
          throw new Error(typeof parsed?.error === 'string' ? parsed.error : 'AI 润色服务异常。')
        }

        if (eventType === 'delta') {
          const parsed = JSON.parse(dataLine)
          if (typeof parsed?.content === 'string') {
            onDelta(parsed.content)
          }
          continue
        }

        if (eventType === 'done') {
          const parsed = JSON.parse(dataLine)
          const result = readPolishPayload(parsed)
          if (result) {
            onDone(result)
            return
          }
          throw new Error('AI 润色服务返回了无效结果。')
        }
      }
    }

    throw new Error('AI 润色流式响应提前结束。')
  } catch (error) {
    if (errorSent) throw error
    // reader 异常（网络中断等）
    try { reader.cancel() } catch { /* ignore */ }
    if (error instanceof Error) throw error
    throw new Error('AI 润色流式响应中断。')
  }
}
