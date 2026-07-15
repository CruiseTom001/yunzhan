import { apiRequest } from '@/utils/apiClient'

export type FeedbackCategory = 'suggestion' | 'bug' | 'other'
export type FeedbackStatus = 'open' | 'seen' | 'resolved'

export interface MyFeedback {
  id: string
  category: FeedbackCategory
  content: string
  contact: string | null
  status: FeedbackStatus
  createdAt: number
  seenAt: number | null
}

export interface AdminFeedbackUser {
  id: string
  username: string
  displayName: string
}

export interface AdminFeedback {
  id: string
  category: FeedbackCategory
  content: string
  contact: string | null
  status: FeedbackStatus
  createdAt: number
  seenAt: number | null
  user: AdminFeedbackUser | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function isCategory(value: unknown): value is FeedbackCategory {
  return value === 'suggestion' || value === 'bug' || value === 'other'
}

function isStatus(value: unknown): value is FeedbackStatus {
  return value === 'open' || value === 'seen' || value === 'resolved'
}

function readUserReference(value: unknown): AdminFeedbackUser | null {
  if (value === null) return null
  if (
    !isRecord(value)
    || typeof value.id !== 'string'
    || typeof value.username !== 'string'
    || typeof value.displayName !== 'string'
  ) return null
  return { id: value.id, username: value.username, displayName: value.displayName }
}

function readMyFeedback(value: unknown): MyFeedback | null {
  if (
    !isRecord(value)
    || typeof value.id !== 'string'
    || !isCategory(value.category)
    || typeof value.content !== 'string'
    || (value.contact !== null && typeof value.contact !== 'string')
    || !isStatus(value.status)
    || !isTimestamp(value.createdAt)
    || (value.seenAt !== null && !isTimestamp(value.seenAt))
  ) return null
  return {
    id: value.id,
    category: value.category,
    content: value.content,
    contact: typeof value.contact === 'string' ? value.contact : null,
    status: value.status,
    createdAt: value.createdAt,
    seenAt: isTimestamp(value.seenAt) ? value.seenAt : null,
  }
}

function readAdminFeedback(value: unknown): AdminFeedback | null {
  if (!isRecord(value)) return null
  const base = readMyFeedback(value)
  if (!base) return null
  const user = readUserReference(value.user)
  if (value.user !== null && user === null) return null
  return { ...base, user }
}

function readOk(value: unknown) {
  return isRecord(value) && value.ok === true
}

export async function submitFeedback(input: { category: FeedbackCategory; content: string; contact?: string }) {
  const payload = await apiRequest('/feedback', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  if (!readOk(payload)) throw new Error('账号服务返回了无效反馈结果。')
}

export async function listMyFeedback() {
  const payload = await apiRequest('/feedback/mine')
  if (!isRecord(payload) || !Array.isArray(payload.feedbacks)) {
    throw new Error('账号服务返回了无效反馈列表。')
  }
  const feedbacks = payload.feedbacks.map(readMyFeedback)
  if (feedbacks.some(item => item === null)) throw new Error('反馈列表包含无效数据。')
  return feedbacks.filter((item): item is MyFeedback => item !== null)
}

export async function listAdminFeedback(input: { status?: FeedbackStatus | ''; limit?: number; offset?: number } = {}) {
  const params = new URLSearchParams({
    status: input.status ?? '',
    limit: String(input.limit ?? 50),
    offset: String(input.offset ?? 0),
  })
  const payload = await apiRequest(`/admin/feedback?${params.toString()}`)
  if (!isRecord(payload) || !Array.isArray(payload.feedbacks) || !Number.isInteger(payload.total)) {
    throw new Error('账号服务返回了无效反馈列表。')
  }
  const feedbacks = payload.feedbacks.map(readAdminFeedback)
  if (feedbacks.some(item => item === null)) throw new Error('反馈列表包含无效数据。')
  return {
    feedbacks: feedbacks.filter((item): item is AdminFeedback => item !== null),
    total: payload.total as number,
  }
}

export async function updateFeedbackStatus(id: string, status: FeedbackStatus) {
  const payload = await apiRequest(`/admin/feedback/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
  if (!readOk(payload)) throw new Error('账号服务返回了无效反馈更新结果。')
}
