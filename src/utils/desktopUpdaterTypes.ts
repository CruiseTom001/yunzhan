export type DesktopUpdaterStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'installing'
  | 'upToDate'
  | 'error'

export interface DesktopUpdaterPublicState {
  status: DesktopUpdaterStatus
  version: string | null
  percent: number | null
  transferred: number | null
  total: number | null
  bytesPerSecond: number | null
  errorCode: string | null
  errorMessage: string | null
}

export const DESKTOP_UPDATER_STATUSES: readonly DesktopUpdaterStatus[] = [
  'idle',
  'checking',
  'available',
  'downloading',
  'downloaded',
  'installing',
  'upToDate',
  'error',
]

export const VERSION_SYNC_ERROR_MESSAGE = '版本发布信息尚未同步，请稍后再试。'
