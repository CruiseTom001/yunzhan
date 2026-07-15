import { compareVersions, isSemver } from './semver'
import type { DesktopLatestVersion } from './desktopVersionApi'

const IGNORED_KEY = 'yunzhan:ignoredUpdateVersion'
const BLOCKED_DATE_KEY = 'yunzhan:lastBlockedPromptDate'

export type UpdateNoticeMode = 'banner' | 'modal'

export interface UpdateNotice {
  mode: UpdateNoticeMode
  remoteVersion: string
  minSupported: string
  downloadUrl: string
  releaseNotes: string
}

function isStringRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function safeLocalVersion(value: unknown): string {
  if (typeof value !== 'string' || !isSemver(value)) return '0.0.0'
  return value
}

/**
 * 根据本地版本与远端版本数据,决定是否提示以及提示层级。
 * - local >= remote:不提示(null)
 * - local < remote 且 local >= minSupported:L2 横幅(banner)
 * - local < minSupported:L3 阻塞弹窗(modal)
 * 远端信息缺字段或版本格式非法时静默(null,不阻断用户)。
 */
export function decideUpdateNotice(local: unknown, remote: DesktopLatestVersion): UpdateNotice | null {
  if (!remote.version || !remote.minSupported || !remote.downloadUrl) return null
  if (!isSemver(remote.version) || !isSemver(remote.minSupported)) return null
  const localVersion = safeLocalVersion(local)
  if (compareVersions(localVersion, remote.version) >= 0) return null
  const releaseNotes = typeof remote.releaseNotes === 'string' ? remote.releaseNotes : ''
  if (compareVersions(localVersion, remote.minSupported) < 0) {
    return {
      mode: 'modal',
      remoteVersion: remote.version,
      minSupported: remote.minSupported,
      downloadUrl: remote.downloadUrl,
      releaseNotes,
    }
  }
  return {
    mode: 'banner',
    remoteVersion: remote.version,
    minSupported: remote.minSupported,
    downloadUrl: remote.downloadUrl,
    releaseNotes,
  }
}

/**
 * 判断是否应显示本次横幅提示。
 * 被用户忽略的远端版本不再显示。
 */
export function shouldShowBanner(notice: UpdateNotice, ignoredVersion: string | null): boolean {
  if (notice.mode !== 'banner') return false
  return ignoredVersion !== notice.remoteVersion
}

/**
 * 记录用户忽略的远端版本到 localStorage。
 */
export function rememberIgnoredVersion(version: string): void {
  try {
    localStorage.setItem(IGNORED_KEY, version)
  } catch {
    // 隐私模式或空间不足,静默
  }
}

function readIgnoredVersion(): string | null {
  try {
    const value = localStorage.getItem(IGNORED_KEY)
    return typeof value === 'string' ? value : null
  } catch {
    return null
  }
}

/**
 * 返回当前已忽略的远端版本号(供组件判断横幅是否隐藏)。
 */
export function getIgnoredVersion(): string | null {
  return readIgnoredVersion()
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * 判断是否应显示阻塞弹窗。同一天至多一次。
 * 返回 true 时会把当天日期写入 localStorage。
 */
export function shouldShowModalAndPersist(notice: UpdateNotice): boolean {
  if (notice.mode !== 'modal') return false
  const today = todayIsoDate()
  try {
    if (localStorage.getItem(BLOCKED_DATE_KEY) === today) return false
    localStorage.setItem(BLOCKED_DATE_KEY, today)
  } catch {
    // localStorage 不可用时每次都允许弹,符合"安全默认"——让用户能看到升级提示
  }
  return true
}

/** 判断 localStorage 中是否已记录今天弹窗(供测试与组件复用)。 */
export function hasShownModalToday(): boolean {
  try {
    return localStorage.getItem(BLOCKED_DATE_KEY) === todayIsoDate()
  } catch {
    return false
  }
}

/** 用于测试:把外部传入的 storage 抽象绕开真实 localStorage(此处仅供测试场景装饰)。 */
export function _isRecord(value: unknown): value is Record<string, unknown> {
  return isStringRecord(value)
}
