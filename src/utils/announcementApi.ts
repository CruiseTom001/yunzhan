import { apiRequest } from '@/utils/apiClient'

export interface Announcement {
  id: string
  title: string
  content: string
  publishedAt: number
}

export type AnnouncementCategory = 'general' | 'web_release' | 'desktop_release'

export interface AnnouncementListItem extends Announcement {
  read: boolean
  category: AnnouncementCategory
  version: string | null
}

export interface AdminAnnouncement extends Announcement {
  active: boolean
  createdAt: number
  updatedAt: number
  category: AnnouncementCategory
  version: string | null
  sourceKey: string | null
  sourceCommit: string | null
  generatedByAi: boolean
  generationProvider: string | null
  generationError: string | null
}

export interface AdminAnnouncementInput {
  title: string
  content: string
  active?: boolean
  publishedAt?: number
  category?: AnnouncementCategory
  version?: string | null
  sourceKey?: string | null
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

function readNullableString(value: unknown): string | null | undefined {
  if (value === null) return null
  if (typeof value === 'string') return value
  return undefined
}

const PAIR_VERSION_PATTERN = /^\d+\.\d+\.\d+$/
const PAIR_COMMIT_PATTERN = /^[0-9a-f]{7,40}$/i
const PAIR_CHANNEL_STATUSES = ['created', 'already_exists', 'skipped', 'failed'] as const

export type PairGenerateChannelStatus = typeof PAIR_CHANNEL_STATUSES[number]

function isPairGenerateChannelStatus(value: unknown): value is PairGenerateChannelStatus {
  return typeof value === 'string'
    && (PAIR_CHANNEL_STATUSES as readonly string[]).includes(value)
}

function isPairReleaseVersion(value: string): boolean {
  return PAIR_VERSION_PATTERN.test(value)
}

function isPairSourceCommit(value: string | null): boolean {
  if (value === null) return true
  return PAIR_COMMIT_PATTERN.test(value)
}

function readAdminAnnouncement(value: unknown): AdminAnnouncement | null {
  if (!isRecord(value)) return null
  const base = readAnnouncement(value)
  const version = readNullableString(value.version)
  const sourceKey = readNullableString(value.sourceKey)
  const sourceCommit = readNullableString(value.sourceCommit)
  const generationProvider = readNullableString(value.generationProvider)
  const generationError = readNullableString(value.generationError)
  if (
    !base
    || typeof value.active !== 'boolean'
    || !isTimestamp(value.createdAt)
    || !isTimestamp(value.updatedAt)
    || !isAnnouncementCategory(value.category)
    || version === undefined
    || sourceKey === undefined
    || sourceCommit === undefined
    || typeof value.generatedByAi !== 'boolean'
    || generationProvider === undefined
    || generationError === undefined
  ) return null
  return {
    ...base,
    active: value.active,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    category: value.category,
    version,
    sourceKey,
    sourceCommit,
    generatedByAi: value.generatedByAi,
    generationProvider,
    generationError,
  }
}

const ANNOUNCEMENT_CATEGORIES = new Set<AnnouncementCategory>([
  'general',
  'web_release',
  'desktop_release',
])

function isAnnouncementCategory(value: unknown): value is AnnouncementCategory {
  return typeof value === 'string' && ANNOUNCEMENT_CATEGORIES.has(value as AnnouncementCategory)
}

function readAnnouncementListItem(value: unknown): AnnouncementListItem | null {
  if (!isRecord(value)) return null
  const base = readAnnouncement(value)
  if (
    !base
    || typeof value.read !== 'boolean'
    || !isAnnouncementCategory(value.category)
  ) return null
  let version: string | null = null
  if (value.version !== null) {
    if (typeof value.version !== 'string') return null
    version = value.version
  }
  return {
    ...base,
    read: value.read,
    category: value.category,
    version,
  }
}

function readNonNegativeInteger(value: unknown): number | null {
  if (!Number.isInteger(value) || (value as number) < 0) return null
  return value as number
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

export async function markAllAnnouncementsRead() {
  const payload = await apiRequest('/announcements/read-all', { method: 'POST' })
  if (!readOk(payload)) throw new Error('账号服务返回了无效结果。')
}

export async function listAnnouncements(input: { limit?: number; offset?: number } = {}) {
  const params = new URLSearchParams({
    limit: String(input.limit ?? 20),
    offset: String(input.offset ?? 0),
  })
  const payload = await apiRequest(`/announcements?${params.toString()}`)
  if (!isRecord(payload) || !Array.isArray(payload.announcements)) {
    throw new Error('账号服务返回了无效公告列表。')
  }
  const total = readNonNegativeInteger(payload.total)
  const unreadTotal = readNonNegativeInteger(payload.unreadTotal)
  if (total === null || unreadTotal === null) {
    throw new Error('账号服务返回了无效公告统计。')
  }
  const announcements = payload.announcements.map(readAnnouncementListItem)
  if (announcements.some(item => item === null)) {
    throw new Error('公告列表包含无效数据。')
  }
  return {
    announcements: announcements.filter((item): item is AnnouncementListItem => item !== null),
    total,
    unreadTotal,
  }
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

export async function repolishAdminAnnouncement(id: string, input: { providerId?: string | null } = {}) {
  const payload = await apiRequest(`/admin/announcements/${encodeURIComponent(id)}/repolish`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
  if (!isRecord(payload)) throw new Error('账号服务返回了无效公告数据。')
  const announcement = readAdminAnnouncement(payload.announcement)
  if (!announcement) throw new Error('账号服务返回了无效公告数据。')
  return announcement
}

export async function regenerateAdminAnnouncementFromChangelog(
  id: string,
  input: { providerId?: string | null } = {},
) {
  const payload = await apiRequest(`/admin/announcements/${encodeURIComponent(id)}/regenerate-from-changelog`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
  if (!isRecord(payload)) throw new Error('账号服务返回了无效公告数据。')
  const announcement = readAdminAnnouncement(payload.announcement)
  if (!announcement) throw new Error('账号服务返回了无效公告数据。')
  return announcement
}

export type ReleaseAnnouncementCategory = 'web_release' | 'desktop_release'

export interface GenerateAnnouncementFromChangelogInput {
  category: ReleaseAnnouncementCategory
  version: string
  sourceCommit?: string | null
}

export interface GenerateAnnouncementFromChangelogResult {
  announcement: AdminAnnouncement
  created: boolean
  repaired: boolean
  skipped: boolean
}

export interface PairGenerateChannelResult {
  status: PairGenerateChannelStatus
  announcement: AdminAnnouncement | null
  message: string
}

export interface GenerateAnnouncementPairFromChangelogInput {
  version?: string | null
  sourceCommit?: string | null
}

export interface GenerateAnnouncementPairFromChangelogResult {
  version: string
  sourceCommit: string | null
  results: {
    web: PairGenerateChannelResult
    desktop: PairGenerateChannelResult
  }
}

export async function generateAdminAnnouncementFromChangelog(
  input: GenerateAnnouncementFromChangelogInput,
): Promise<GenerateAnnouncementFromChangelogResult> {
  const body: Record<string, string> = {
    category: input.category,
    version: input.version,
  }
  if (typeof input.sourceCommit === 'string' && input.sourceCommit.trim()) {
    body.sourceCommit = input.sourceCommit.trim()
  }
  const payload = await apiRequest('/admin/announcements/generate-from-changelog', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  if (!isRecord(payload)) throw new Error('账号服务返回了无效公告数据。')
  const announcement = readAdminAnnouncement(payload.announcement)
  if (!announcement) throw new Error('账号服务返回了无效公告数据。')
  if (typeof payload.created !== 'boolean' || typeof payload.repaired !== 'boolean') {
    throw new Error('账号服务返回了无效公告数据。')
  }
  return {
    announcement,
    created: payload.created,
    repaired: payload.repaired,
    skipped: payload.skipped === true,
  }
}

function readPairChannelResult(value: unknown): PairGenerateChannelResult | null {
  if (!isRecord(value) || typeof value.message !== 'string' || !isPairGenerateChannelStatus(value.status)) {
    return null
  }
  if (value.status === 'skipped' || value.status === 'failed') {
    if (value.announcement !== null) return null
    return {
      status: value.status,
      announcement: null,
      message: value.message,
    }
  }
  const announcement = readAdminAnnouncement(value.announcement)
  if (!announcement) return null
  return {
    status: value.status,
    announcement,
    message: value.message,
  }
}

export async function generateAdminAnnouncementPairFromChangelog(
  input: GenerateAnnouncementPairFromChangelogInput,
): Promise<GenerateAnnouncementPairFromChangelogResult> {
  const body: Record<string, string> = {}
  if (typeof input.version === 'string' && input.version.trim()) {
    body.version = input.version.trim()
  }
  if (typeof input.sourceCommit === 'string' && input.sourceCommit.trim()) {
    body.sourceCommit = input.sourceCommit.trim()
  }
  const payload = await apiRequest('/admin/announcements/generate-pair-from-changelog', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  if (!isRecord(payload) || typeof payload.version !== 'string' || !isPairReleaseVersion(payload.version)) {
    throw new Error('账号服务返回了无效公告数据。')
  }
  const sourceCommit = readNullableString(payload.sourceCommit)
  if (sourceCommit === undefined || !isPairSourceCommit(sourceCommit)) {
    throw new Error('账号服务返回了无效公告数据。')
  }
  if (!isRecord(payload.results)) throw new Error('账号服务返回了无效公告数据。')
  const web = readPairChannelResult(payload.results.web)
  const desktop = readPairChannelResult(payload.results.desktop)
  if (!web || !desktop) throw new Error('账号服务返回了无效公告数据。')
  return {
    version: payload.version,
    sourceCommit,
    results: { web, desktop },
  }
}

export async function deleteAdminAnnouncement(id: string) {
  const payload = await apiRequest(`/admin/announcements/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
  if (!readOk(payload)) throw new Error('账号服务返回了无效结果。')
}
