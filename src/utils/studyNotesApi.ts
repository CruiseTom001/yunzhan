import { apiRequest } from '@/utils/apiClient'

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

export interface PolishResult {
  content: string
  providerName: string
  model: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
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
