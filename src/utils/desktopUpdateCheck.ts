import { ApiError } from './apiClient'
import { compareVersions, isSemver } from './semver'
import type { DesktopLatestVersion } from './desktopVersionApi'

export const DESKTOP_UPDATE_SNOOZE_MS = 24 * 60 * 60 * 1000
export const DESKTOP_UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000
export const DESKTOP_UPDATE_STARTUP_DELAY_MS = 3000

const SNOOZE_VERSION_KEY = 'yunzhan:snoozedUpdateVersion'
const SNOOZE_UNTIL_KEY = 'yunzhan:snoozedUpdateUntil'
const BLOCKED_DATE_KEY = 'yunzhan:lastBlockedPromptDate'

export type UpdateNoticeMode = 'optional' | 'required'

export interface UpdateNotice {
  mode: UpdateNoticeMode
  remoteVersion: string
  minSupported: string
  downloadUrl: string
  releaseNotes: string
}

export class InvalidDesktopUpdateInfoError extends Error {
  constructor(message = '版本信息格式无效。') {
    super(message)
    this.name = 'InvalidDesktopUpdateInfoError'
  }
}

function isStringRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function safeLocalVersion(value: unknown): string {
  if (typeof value !== 'string' || !isSemver(value)) return '0.0.0'
  return value
}

/**
 * 根据本地版本与远端版本数据,决定是否提示以及提示层级。
 */
export function decideUpdateNotice(local: unknown, remote: DesktopLatestVersion): UpdateNotice | null {
  if (!remote.version || !remote.minSupported || !remote.downloadUrl) return null
  if (!isSemver(remote.version) || !isSemver(remote.minSupported)) return null
  const localVersion = safeLocalVersion(local)
  if (compareVersions(localVersion, remote.version) >= 0) return null
  const releaseNotes = typeof remote.releaseNotes === 'string' ? remote.releaseNotes : ''
  if (compareVersions(localVersion, remote.minSupported) < 0) {
    return {
      mode: 'required',
      remoteVersion: remote.version,
      minSupported: remote.minSupported,
      downloadUrl: remote.downloadUrl,
      releaseNotes,
    }
  }
  return {
    mode: 'optional',
    remoteVersion: remote.version,
    minSupported: remote.minSupported,
    downloadUrl: remote.downloadUrl,
    releaseNotes,
  }
}

function todayIsoDate(now: number): string {
  return new Date(now).toISOString().slice(0, 10)
}

function readStorage(key: string): string | null {
  try {
    const value = localStorage.getItem(key)
    return typeof value === 'string' ? value : null
  } catch {
    return null
  }
}

function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // 隐私模式或空间不足,静默
  }
}

export function snoozeOptionalNotice(version: string, untilMs: number, now: number = Date.now()): void {
  writeStorage(SNOOZE_VERSION_KEY, version)
  writeStorage(SNOOZE_UNTIL_KEY, String(now + untilMs))
}

export function isOptionalNoticeSnoozed(version: string, now: number = Date.now()): boolean {
  const snoozedVersion = readStorage(SNOOZE_VERSION_KEY)
  if (snoozedVersion !== version) return false
  const untilRaw = readStorage(SNOOZE_UNTIL_KEY)
  if (!untilRaw) return false
  const until = Number.parseInt(untilRaw, 10)
  if (!Number.isFinite(until)) return false
  return now < until
}

export function shouldShowOptionalAutoNotice(notice: UpdateNotice, now: number = Date.now()): boolean {
  if (notice.mode !== 'optional') return false
  return !isOptionalNoticeSnoozed(notice.remoteVersion, now)
}

export function shouldShowRequiredAutoNotice(notice: UpdateNotice, now: number = Date.now()): boolean {
  if (notice.mode !== 'required') return false
  const today = todayIsoDate(now)
  if (readStorage(BLOCKED_DATE_KEY) === today) return false
  writeStorage(BLOCKED_DATE_KEY, today)
  return true
}

export function hasShownRequiredNoticeToday(now: number = Date.now()): boolean {
  return readStorage(BLOCKED_DATE_KEY) === todayIsoDate(now)
}

export function resolveDesktopUpdateCheckError(error: unknown): string {
  if (error instanceof InvalidDesktopUpdateInfoError) {
    return '版本信息格式无效，请稍后再试。'
  }

  if (error instanceof ApiError) {
    if (error.message.includes('无效')) return '版本信息格式无效，请稍后再试。'
    if (error.status === 0) return '网络连接失败，请检查网络后重试。'
    if (error.status >= 500) return '服务器暂时不可用，请稍后再试。'
  }

  if (error instanceof Error) {
    if (error.message.includes('无效版本') || error.message.includes('无效版本数据')) {
      return '版本信息格式无效，请稍后再试。'
    }
    if (error.message.includes('超时') || error.message.includes('timeout')) {
      return '请求超时，请检查网络后重试。'
    }
    if (error.message.includes('网络') || error.message.includes('连接')) {
      return '网络连接失败，请检查网络后重试。'
    }
  }

  const status = readErrorStatus(error)
  if (status === 0) return '网络连接失败，请检查网络后重试。'
  if (status !== null && status >= 500) return '服务器暂时不可用，请稍后再试。'

  if (error instanceof Error && error.message.includes('账号服务')) {
    return '版本信息格式无效，请稍后再试。'
  }

  return '检查更新失败，请稍后再试。'
}

function readErrorStatus(error: unknown): number | null {
  if (!isStringRecord(error)) return null
  if (typeof error.status !== 'number') return null
  return error.status
}

export function _isRecord(value: unknown): value is Record<string, unknown> {
  return isStringRecord(value)
}
