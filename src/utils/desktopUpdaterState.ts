import {
  DESKTOP_UPDATER_STATUSES,
  type DesktopUpdaterPublicState,
  type DesktopUpdaterStatus,
} from '@/utils/desktopUpdaterTypes'

function isUpdaterStatus(value: unknown): value is DesktopUpdaterStatus {
  return typeof value === 'string' && DESKTOP_UPDATER_STATUSES.includes(value as DesktopUpdaterStatus)
}

function readOptionalNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return value
}

export function parseDesktopUpdaterPublicState(value: unknown): DesktopUpdaterPublicState {
  const fallback: DesktopUpdaterPublicState = {
    status: 'idle',
    version: null,
    percent: null,
    transferred: null,
    total: null,
    bytesPerSecond: null,
    errorCode: null,
    errorMessage: null,
  }
  if (typeof value !== 'object' || value === null) return fallback

  const record = value as Record<string, unknown>
  const status = isUpdaterStatus(record.status) ? record.status : 'idle'
  const version = typeof record.version === 'string' && record.version.trim()
    ? record.version.trim()
    : null
  const errorCode = typeof record.errorCode === 'string' && record.errorCode.trim()
    ? record.errorCode.trim()
    : null
  const errorMessage = typeof record.errorMessage === 'string' && record.errorMessage.trim()
    ? record.errorMessage.trim()
    : null

  let percent = readOptionalNumber(record.percent)
  if (percent !== null) {
    percent = Math.max(0, Math.min(100, percent))
  }

  const transferred = readOptionalNumber(record.transferred)
  const total = readOptionalNumber(record.total)
  const bytesPerSecond = readOptionalNumber(record.bytesPerSecond)

  return {
    status,
    version,
    percent,
    transferred: transferred !== null && transferred >= 0 ? transferred : null,
    total: total !== null && total >= 0 ? total : null,
    bytesPerSecond: bytesPerSecond !== null && bytesPerSecond >= 0 ? bytesPerSecond : null,
    errorCode,
    errorMessage,
  }
}

export function canClickInstallButton(
  status: DesktopUpdaterStatus,
  errorCode: string | null = null,
): boolean {
  if (status === 'downloaded') return true
  return status === 'error' && errorCode === 'install_failed'
}

export function canClickDownloadButton(
  status: DesktopUpdaterStatus,
  errorCode: string | null = null,
): boolean {
  if (errorCode === 'version_sync') return false
  return status === 'available' || status === 'error'
}

export function isUpdaterBusy(status: DesktopUpdaterStatus): boolean {
  return status === 'checking' || status === 'downloading' || status === 'installing'
}
