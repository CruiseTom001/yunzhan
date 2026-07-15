import { apiRequest } from '@/utils/apiClient'

export interface Announcement {
  id: string
  title: string
  content: string
  publishedAt: number
}

export interface AdminAnnouncement extends Announcement {
  active: boolean
  createdAt: number
  updatedAt: number
}

export interface AdminAnnouncementInput {
  title: string
  content: string
  active?: boolean
  publishedAt?: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function readAnnouncement(value: unknown): Announcement | null {
  if (
    !isRecord(value)
    || typeof value.id !== 'string'
    || typeof value.title !== 'string'
    || typeof value.content !== 'string'
    || !isTimestamp(value.publishedAt)
  ) return null
  return {
    id: value.id,
    title: value.title,
    content: value.content,
    publishedAt: value.publishedAt,
  }
}

function readAdminAnnouncement(value: unknown): AdminAnnouncement | null {
  if (!isRecord(value)) return null
  const base = readAnnouncement(value)
  if (
    !base
    || typeof value.active !== 'boolean'
    || !isTimestamp(value.createdAt)
    || !isTimestamp(value.updatedAt)
  ) return null
  return {
    ...base,
    active: value.active,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  }
}

function readOk(value: unknown) {
  return isRecord(value) && value.ok === true
}

export async function getLatestUnread() {
  const payload = await apiRequest('/announcements/latest')
  if (!isRecord(payload)) throw new Error('账号服务返回了无效公告数据。')
  if (payload.announcement === null) return null
  const announcement = readAnnouncement(payload.announcement)
  if (!announcement) throw new Error('账号服务返回了无效公告数据。')
  return announcement
}

export async function markAnnouncementRead(id: string) {
  const payload = await apiRequest(`/announcements/${encodeURIComponent(id)}/read`, { method: 'POST' })
  if (!readOk(payload)) throw new Error('账号服务返回了无效结果。')
}

export async function listAdminAnnouncements(input: { limit?: number; offset?: number } = {}) {
  const params = new URLSearchParams({
    limit: String(input.limit ?? 50),
    offset: String(input.offset ?? 0),
  })
  const payload = await apiRequest(`/admin/announcements?${params.toString()}`)
  if (!isRecord(payload) || !Array.isArray(payload.announcements) || !Number.isInteger(payload.total)) {
    throw new Error('账号服务返回了无效公告列表。')
  }
  const announcements = payload.announcements.map(readAdminAnnouncement)
  if (announcements.some(item => item === null)) throw new Error('公告列表包含无效数据。')
  return {
    announcements: announcements.filter((item): item is AdminAnnouncement => item !== null),
    total: payload.total as number,
  }
}

export async function createAdminAnnouncement(input: AdminAnnouncementInput) {
  const payload = await apiRequest('/admin/announcements', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  if (!isRecord(payload)) throw new Error('账号服务返回了无效公告数据。')
  const announcement = readAdminAnnouncement(payload.announcement)
  if (!announcement) throw new Error('账号服务返回了无效公告数据。')
  return announcement
}

export async function updateAdminAnnouncement(id: string, input: Partial<AdminAnnouncementInput>) {
  const payload = await apiRequest(`/admin/announcements/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
  if (!isRecord(payload)) throw new Error('账号服务返回了无效公告数据。')
  const announcement = readAdminAnnouncement(payload.announcement)
  if (!announcement) throw new Error('账号服务返回了无效公告数据。')
  return announcement
}
