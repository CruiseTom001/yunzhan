import { VERSION_SYNC_ERROR_MESSAGE, type DesktopUpdaterPublicState } from '@/utils/desktopUpdaterTypes'
import type { UpdateNotice } from '@/utils/desktopUpdateCheck'

export type VersionSyncOutcome =
  | { kind: 'no_update' }
  | { kind: 'available'; notice: UpdateNotice }
  | { kind: 'version_sync_error' }
  | { kind: 'updater_error'; state: DesktopUpdaterPublicState }

export function versionsMatchForUpdate(
  notice: UpdateNotice,
  updaterVersion: string | null,
): boolean {
  if (!updaterVersion) return false
  return notice.remoteVersion === updaterVersion
}

export function reconcileDesktopUpdateSources(
  notice: UpdateNotice | null,
  updaterState: DesktopUpdaterPublicState,
): VersionSyncOutcome {
  if (updaterState.status === 'error') {
    return { kind: 'updater_error', state: updaterState }
  }

  if (!notice) {
    if (updaterState.status === 'available') {
      return { kind: 'version_sync_error' }
    }
    return { kind: 'no_update' }
  }

  if (updaterState.status === 'upToDate') {
    return { kind: 'version_sync_error' }
  }

  if (updaterState.status !== 'available' && updaterState.status !== 'downloaded') {
    return { kind: 'no_update' }
  }

  if (!versionsMatchForUpdate(notice, updaterState.version)) {
    return { kind: 'version_sync_error' }
  }

  return { kind: 'available', notice }
}

export function applyVersionSyncErrorState(
  updaterState: DesktopUpdaterPublicState,
): DesktopUpdaterPublicState {
  return {
    ...updaterState,
    status: 'error',
    errorCode: 'version_sync',
    errorMessage: VERSION_SYNC_ERROR_MESSAGE,
  }
}

export function isVersionSyncError(state: DesktopUpdaterPublicState): boolean {
  return state.status === 'error' && state.errorCode === 'version_sync'
}
