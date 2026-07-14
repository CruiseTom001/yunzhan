import type { AuthUser, UserRole, UserStatus } from '@/types/auth'
import { apiRequest } from '@/utils/apiClient'

export interface AccountSession {
  id: string
  userAgent: string
  current: boolean
  createdAt: number
  lastUsedAt: number
  expiresAt: number
}

export interface AccountExport {
  account: AuthUser
  progress: unknown
  progressVersion: number
  progressUpdatedAt: number | null
  exportedAt: number
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

function isTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
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

function readUserPayload(value: unknown) {
  if (!isRecord(value)) return null
  return readAuthUser(value.user)
}

function readOkPayload(value: unknown) {
  return isRecord(value) && value.ok === true
}

function readCooldown(value: unknown) {
  if (!isRecord(value) || !Number.isInteger(value.cooldownSeconds)) return null
  const cooldownSeconds = value.cooldownSeconds as number
  return cooldownSeconds > 0 && cooldownSeconds <= 600 ? cooldownSeconds : null
}

function readSession(value: unknown): AccountSession | null {
  if (!isRecord(value)) return null
  if (
    typeof value.id !== 'string'
    || typeof value.userAgent !== 'string'
    || typeof value.current !== 'boolean'
    || !isTimestamp(value.createdAt)
    || !isTimestamp(value.lastUsedAt)
    || !isTimestamp(value.expiresAt)
  ) return null
  return {
    id: value.id,
    userAgent: value.userAgent,
    current: value.current,
    createdAt: value.createdAt,
    lastUsedAt: value.lastUsedAt,
    expiresAt: value.expiresAt,
  }
}

export async function updateAccountProfile(input: { username: string; displayName: string }) {
  const payload = await apiRequest('/account/profile', {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
  const user = readUserPayload(payload)
  if (!user) throw new Error('账号服务返回了无效用户资料。')
  return user
}

export async function changeAccountPassword(input: { currentPassword: string; newPassword: string }) {
  const payload = await apiRequest('/account/password', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  if (!readOkPayload(payload)) throw new Error('账号服务返回了无效改密结果。')
}

export async function requestEmailChangeCode(input: { email: string; currentPassword: string }) {
  const payload = await apiRequest('/account/email/code', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  const cooldownSeconds = readCooldown(payload)
  if (!cooldownSeconds) throw new Error('账号服务返回了无效验证码结果。')
  return cooldownSeconds
}

export async function confirmEmailChange(input: { email: string; code: string; currentPassword: string }) {
  const payload = await apiRequest('/account/email', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  const user = readUserPayload(payload)
  if (!user) throw new Error('账号服务返回了无效邮箱变更结果。')
  return user
}

export async function listAccountSessions() {
  const payload = await apiRequest('/account/sessions')
  if (!isRecord(payload) || !Array.isArray(payload.sessions)) {
    throw new Error('账号服务返回了无效会话列表。')
  }
  const sessions = payload.sessions.map(readSession)
  if (sessions.some(session => session === null)) throw new Error('会话列表包含无效数据。')
  return sessions.filter((session): session is AccountSession => session !== null)
}

export async function revokeAccountSession(sessionId: string) {
  const payload = await apiRequest(`/account/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' })
  if (!readOkPayload(payload)) throw new Error('账号服务返回了无效会话撤销结果。')
}

export async function revokeOtherAccountSessions() {
  const payload = await apiRequest('/account/sessions/others', { method: 'DELETE' })
  if (!readOkPayload(payload)) throw new Error('账号服务返回了无效会话撤销结果。')
}

export async function exportAccountData(): Promise<AccountExport> {
  const payload = await apiRequest('/account/export')
  if (!isRecord(payload)) throw new Error('账号服务返回了无效导出数据。')
  const account = readAuthUser(payload.account)
  if (
    !account
    || !Number.isInteger(payload.progressVersion)
    || (payload.progressUpdatedAt !== null && !isTimestamp(payload.progressUpdatedAt))
    || !isTimestamp(payload.exportedAt)
  ) throw new Error('账号服务返回了无效导出数据。')
  return {
    account,
    progress: payload.progress,
    progressVersion: payload.progressVersion as number,
    progressUpdatedAt: isTimestamp(payload.progressUpdatedAt) ? payload.progressUpdatedAt : null,
    exportedAt: payload.exportedAt,
  }
}

export async function deleteAccount(input: { currentPassword: string; confirmation: string }) {
  const payload = await apiRequest('/account', {
    method: 'DELETE',
    body: JSON.stringify(input),
  })
  if (!readOkPayload(payload)) throw new Error('账号服务返回了无效注销结果。')
}
