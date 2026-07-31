export const DESKTOP_DOWNLOAD_ALLOWED_HOSTS = [
  'github.com',
  'release-assets.githubusercontent.com',
  'objects.githubusercontent.com',
] as const

export const DESKTOP_DOWNLOAD_URL_MAX_LENGTH = 500
export const DESKTOP_DOWNLOAD_INVALID_MESSAGE = '版本信息格式无效，请稍后再试。'
export const DESKTOP_DOWNLOAD_UNAVAILABLE_MESSAGE = '当前暂无可用的桌面端安装包，请稍后再试。'

export type OpenDesktopDownloadResult =
  | { ok: true }
  | { ok: false; errorMessage: string }

/** Web 端展示下载入口；Electron 桌面端始终隐藏，避免下载自身。 */
export function shouldShowWebDesktopDownloadEntry(isDesktopRuntime: boolean): boolean {
  return !isDesktopRuntime
}

export function isAllowedDesktopDownloadUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  if (value.length === 0 || value.length > DESKTOP_DOWNLOAD_URL_MAX_LENGTH) return false

  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    return false
  }

  if (parsed.protocol !== 'https:') return false
  return DESKTOP_DOWNLOAD_ALLOWED_HOSTS.includes(
    parsed.hostname as typeof DESKTOP_DOWNLOAD_ALLOWED_HOSTS[number],
  )
}

export function resolveLandingDesktopDownloadUrl(downloadUrl: unknown): string | null {
  return isAllowedDesktopDownloadUrl(downloadUrl) ? downloadUrl : null
}

/** 网页端落地页下载：白名单校验后 window.open */
export function openWebDesktopDownloadUrl(url: string): OpenDesktopDownloadResult {
  if (!isAllowedDesktopDownloadUrl(url)) {
    return { ok: false, errorMessage: DESKTOP_DOWNLOAD_INVALID_MESSAGE }
  }
  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener')
  }
  return { ok: true }
}
