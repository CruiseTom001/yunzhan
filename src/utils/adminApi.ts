import type { LearningProgress } from '@/types'
import type { AdminProgressSummary, AdminUser, AuthUser, UserRole, UserStatus } from '@/types/auth'
import { apiRequest } from '@/utils/apiClient'
import { isValidProgressPayload, normalizeProgress } from '@/utils/storage'

export interface AdminUserInput {
  username: string
  displayName: string
  password?: string
  role: UserRole
  status: UserStatus
}

export interface AdminProgressDetail {
  user: Pick<AuthUser, 'id' | 'username' | 'displayName'>
  progress: LearningProgress | null
  summary: AdminProgressSummary
  version: number
  updatedAt: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isRole(value: unknown): value is UserRole {
  return value === 'user' || value === 'super_admin'
}

function isStatus(value: unknown): value is UserStatus {
  return value === 'active' || value === 'disabled'
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

function isTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function readSummary(value: unknown): AdminProgressSummary | null {
  if (!isRecord(value)) return null
  if (
    !isNonNegativeInteger(value.completedChapters)
    || !isNonNegativeInteger(value.quizAnswers)
    || !isNonNegativeInteger(value.studyDays)
    || !isTimestamp(value.totalTimeSpent)
  ) return null
  return {
    completedChapters: value.completedChapters,
    quizAnswers: value.quizAnswers,
    studyDays: value.studyDays,
    totalTimeSpent: value.totalTimeSpent,
  }
}

function readAuthUser(value: unknown): AuthUser | null {
  if (!isRecord(value)) return null
  if (
    typeof value.id !== 'string'
    || typeof value.username !== 'string'
    || typeof value.displayName !== 'string'
    || (value.email !== null && typeof value.email !== 'string')
    || (value.emailVerifiedAt !== null && !isTimestamp(value.emailVerifiedAt))
    || !isRole(value.role)
    || !isStatus(value.status)
    || !isTimestamp(value.createdAt)
    || !isTimestamp(value.updatedAt)
    || (value.lastLoginAt !== null && !isTimestamp(value.lastLoginAt))
  ) return null
  return {
    id: value.id,
    username: value.username,
    displayName: value.displayName,
    email: typeof value.email === 'string' ? value.email : null,
    emailVerifiedAt: isTimestamp(value.emailVerifiedAt) ? value.emailVerifiedAt : null,
    role: value.role,
    status: value.status,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    lastLoginAt: isTimestamp(value.lastLoginAt) ? value.lastLoginAt : null,
  }
}

function readAdminUser(value: unknown): AdminUser | null {
  const user = readAuthUser(value)
  if (!user || !isRecord(value)) return null
  const progressSummary = readSummary(value.progressSummary)
  if (!progressSummary || (value.progressUpdatedAt !== null && !isTimestamp(value.progressUpdatedAt))) return null
  return {
    ...user,
    progressSummary,
    progressUpdatedAt: isTimestamp(value.progressUpdatedAt) ? value.progressUpdatedAt : null,
  }
}

export async function listAdminUsers(query = '') {
  const params = new URLSearchParams({ query, limit: '100', offset: '0' })
  const payload = await apiRequest(`/admin/users?${params.toString()}`)
  if (!isRecord(payload) || !Array.isArray(payload.users) || !isNonNegativeInteger(payload.total)) {
    throw new Error('账号服务返回了无效用户列表。')
  }
  const users = payload.users.map(readAdminUser)
  if (users.some(user => user === null)) throw new Error('用户列表包含无效数据。')
  return { users: users.filter((user): user is AdminUser => user !== null), total: payload.total }
}

export async function createAdminUser(input: AdminUserInput) {
  const payload = await apiRequest('/admin/users', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  const user = isRecord(payload) ? readAuthUser(payload.user) : null
  if (!user) throw new Error('账号服务返回了无效用户数据。')
  return user
}

export async function updateAdminUser(userId: string, input: Partial<AdminUserInput>) {
  const payload = await apiRequest(`/admin/users/${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
  const user = isRecord(payload) ? readAuthUser(payload.user) : null
  if (!user) throw new Error('账号服务返回了无效用户数据。')
  return user
}

export async function deleteAdminUser(userId: string) {
  await apiRequest(`/admin/users/${encodeURIComponent(userId)}`, { method: 'DELETE' })
}

export async function loadAdminUserProgress(userId: string): Promise<AdminProgressDetail> {
  const payload = await apiRequest(`/admin/users/${encodeURIComponent(userId)}/progress`)
  if (!isRecord(payload) || !isRecord(payload.user)) throw new Error('账号服务返回了无效进度数据。')
  const summary = readSummary(payload.summary)
  if (
    !summary
    || typeof payload.user.id !== 'string'
    || typeof payload.user.username !== 'string'
    || typeof payload.user.displayName !== 'string'
    || !isNonNegativeInteger(payload.version)
    || !isTimestamp(payload.updatedAt)
    || (payload.progress !== null && !isValidProgressPayload(payload.progress))
  ) throw new Error('账号服务返回了无效进度数据。')
  return {
    user: {
      id: payload.user.id,
      username: payload.user.username,
      displayName: payload.user.displayName,
    },
    progress: payload.progress === null ? null : normalizeProgress(payload.progress),
    summary,
    version: payload.version,
    updatedAt: payload.updatedAt,
  }
}
