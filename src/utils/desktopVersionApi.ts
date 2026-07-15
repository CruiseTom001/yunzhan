import { apiRequest } from '@/utils/apiClient'

export interface DesktopLatestVersion {
  version: string | null
  minSupported: string | null
  downloadUrl: string | null
  releaseNotes: string | null
}

export interface DesktopReleaseRecord {
  id: number
  version: string
  minSupported: string
  downloadUrl: string
  releaseNotes: string
  enabled: boolean
  createdAt: number
  updatedAt: number
}

export interface DesktopReleaseInput {
  version: string
  minSupported: string
  downloadUrl: string
  releaseNotes?: string
  enabled?: boolean
}

export type DesktopReleaseUpdate = Partial<Omit<DesktopReleaseInput, 'version'>>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

function readLatest(value: unknown): DesktopLatestVersion | null {
  if (
    !isRecord(value)
    || !isNullableString(value.version)
    || !isNullableString(value.minSupported)
    || !isNullableString(value.downloadUrl)
    || !isNullableString(value.releaseNotes)
  ) return null
  return {
    version: value.version,
    minSupported: value.minSupported,
    downloadUrl: value.downloadUrl,
    releaseNotes: value.releaseNotes,
  }
}

function readRecord(value: unknown): DesktopReleaseRecord | null {
  if (
    !isRecord(value)
    || typeof value.id !== 'number'
    || typeof value.version !== 'string'
    || typeof value.minSupported !== 'string'
    || typeof value.downloadUrl !== 'string'
    || typeof value.releaseNotes !== 'string'
    || typeof value.enabled !== 'boolean'
    || !isTimestamp(value.createdAt)
    || !isTimestamp(value.updatedAt)
  ) return null
  return {
    id: value.id,
    version: value.version,
    minSupported: value.minSupported,
    downloadUrl: value.downloadUrl,
    releaseNotes: value.releaseNotes,
    enabled: value.enabled,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  }
}

function readOk(value: unknown) {
  return isRecord(value) && value.ok === true
}

export async function getDesktopLatestVersion(): Promise<DesktopLatestVersion> {
  const payload = await apiRequest('/desktop/latest-version')
  const result = readLatest(payload)
  if (!result) throw new Error('账号服务返回了无效版本数据。')
  return result
}

export async function listAdminDesktopReleases(input: { limit?: number; offset?: number } = {}) {
  const params = new URLSearchParams({
    limit: String(input.limit ?? 50),
    offset: String(input.offset ?? 0),
  })
  const payload = await apiRequest(`/admin/desktop-releases?${params.toString()}`)
  if (!isRecord(payload) || !Array.isArray(payload.releases) || !Number.isInteger(payload.total)) {
    throw new Error('账号服务返回了无效版本列表。')
  }
  const releases = payload.releases.map(readRecord)
  if (releases.some(item => item === null)) throw new Error('版本列表包含无效数据。')
  return {
    releases: releases.filter((item): item is DesktopReleaseRecord => item !== null),
    total: payload.total as number,
  }
}

export async function createAdminDesktopRelease(input: DesktopReleaseInput): Promise<DesktopReleaseRecord> {
  const payload = await apiRequest('/admin/desktop-releases', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  if (!isRecord(payload)) throw new Error('账号服务返回了无效版本数据。')
  const release = readRecord(payload.release)
  if (!release) throw new Error('账号服务返回了无效版本数据。')
  return release
}

export async function updateAdminDesktopRelease(id: number, input: DesktopReleaseUpdate): Promise<DesktopReleaseRecord> {
  const payload = await apiRequest(`/admin/desktop-releases/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
  if (!isRecord(payload)) throw new Error('账号服务返回了无效版本数据。')
  const release = readRecord(payload.release)
  if (!release) throw new Error('账号服务返回了无效版本数据。')
  return release
}

export async function deleteAdminDesktopRelease(id: number): Promise<void> {
  const payload = await apiRequest(`/admin/desktop-releases/${encodeURIComponent(id)}`, { method: 'DELETE' })
  if (!readOk(payload)) throw new Error('账号服务返回了无效结果。')
}
