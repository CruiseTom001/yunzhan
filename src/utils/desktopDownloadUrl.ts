export const DESKTOP_DOWNLOAD_ALLOWED_HOSTS = [
  'github.com',
  'release-assets.githubusercontent.com',
  'objects.githubusercontent.com',
] as const

export const DESKTOP_DOWNLOAD_URL_MAX_LENGTH = 500
export const DESKTOP_DOWNLOAD_INVALID_MESSAGE = '版本信息格式无效，请稍后再试。'
export const DESKTOP_DOWNLOAD_OPEN_FAILED_MESSAGE = '无法打开下载链接，请稍后再试。'

export type OpenDesktopDownloadResult =
  | { ok: true }
  | { ok: false; errorMessage: string }

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

function isElectronRuntime(): boolean {
  return typeof window !== 'undefined' && Boolean(window.electronAPI)
}

export function resolveLandingDesktopDownloadUrl(downloadUrl: unknown): string | null {
  return isAllowedDesktopDownloadUrl(downloadUrl) ? downloadUrl : null
}

export async function openAllowedDesktopDownloadUrl(url: string): Promise<OpenDesktopDownloadResult> {
  if (!isAllowedDesktopDownloadUrl(url)) {
    return { ok: false, errorMessage: DESKTOP_DOWNLOAD_INVALID_MESSAGE }
  }

  if (isElectronRuntime()) {
    try {
      const result = await window.electronAPI!.invoke<{ ok?: boolean }>('app:openExternal', url)
      if (result && typeof result === 'object' && result.ok === true) {
        return { ok: true }
      }
      return { ok: false, errorMessage: DESKTOP_DOWNLOAD_OPEN_FAILED_MESSAGE }
    } catch {
      return { ok: false, errorMessage: DESKTOP_DOWNLOAD_OPEN_FAILED_MESSAGE }
    }
  }

  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener')
  }
  return { ok: true }
}
