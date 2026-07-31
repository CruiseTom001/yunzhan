import { describe, expect, it } from 'vitest'
import { decideUpdateNotice } from '@/utils/desktopUpdateCheck'
import { VERSION_SYNC_ERROR_MESSAGE } from '@/utils/desktopUpdaterTypes'
import {
  applyVersionSyncErrorState,
  isVersionSyncError,
  reconcileDesktopUpdateSources,
  versionsMatchForUpdate,
} from '@/utils/desktopUpdateVersionSync'

const REMOTE = {
  version: '1.3.0',
  minSupported: '1.2.0',
  downloadUrl: 'https://github.com/CruiseTom001/yunzhan/releases/download/v1.3.0/yunzhan-setup-1.3.0.exe',
  releaseNotes: 'notes',
}

describe('desktopUpdateVersionSync', () => {
  it('matches versions only when equal', () => {
    const notice = decideUpdateNotice('1.2.5', REMOTE)!
    expect(versionsMatchForUpdate(notice, '1.3.0')).toBe(true)
    expect(versionsMatchForUpdate(notice, '1.4.0')).toBe(false)
    expect(versionsMatchForUpdate(notice, null)).toBe(false)
  })

  it('flags version_sync when server has no update but GitHub reports available', () => {
    const outcome = reconcileDesktopUpdateSources(null, {
      status: 'available',
      version: '1.3.0',
      percent: null,
      transferred: null,
      total: null,
      bytesPerSecond: null,
      errorCode: null,
      errorMessage: null,
    })
    expect(outcome.kind).toBe('version_sync_error')
  })

  it('flags version_sync when server has update but GitHub reports upToDate', () => {
    const notice = decideUpdateNotice('1.2.5', REMOTE)!
    const outcome = reconcileDesktopUpdateSources(notice, {
      status: 'upToDate',
      version: null,
      percent: null,
      transferred: null,
      total: null,
      bytesPerSecond: null,
      errorCode: null,
      errorMessage: null,
    })
    expect(outcome.kind).toBe('version_sync_error')
  })

  it('flags version_sync when server and GitHub versions differ', () => {
    const notice = decideUpdateNotice('1.2.5', REMOTE)!
    const outcome = reconcileDesktopUpdateSources(notice, {
      status: 'available',
      version: '1.4.0',
      percent: null,
      transferred: null,
      total: null,
      bytesPerSecond: null,
      errorCode: null,
      errorMessage: null,
    })
    expect(outcome.kind).toBe('version_sync_error')
  })

  it('allows available only when server, GitHub, and versions align', () => {
    const notice = decideUpdateNotice('1.2.5', REMOTE)!
    const outcome = reconcileDesktopUpdateSources(notice, {
      status: 'available',
      version: '1.3.0',
      percent: null,
      transferred: null,
      total: null,
      bytesPerSecond: null,
      errorCode: null,
      errorMessage: null,
    })
    expect(outcome).toEqual({ kind: 'available', notice })
  })

  it('allows downloaded state when server and updater versions align', () => {
    const notice = decideUpdateNotice('1.2.5', REMOTE)!
    const outcome = reconcileDesktopUpdateSources(notice, {
      status: 'downloaded',
      version: '1.3.0',
      percent: 100,
      transferred: null,
      total: null,
      bytesPerSecond: null,
      errorCode: null,
      errorMessage: null,
    })
    expect(outcome).toEqual({ kind: 'available', notice })
  })

  it('marks version_sync error state for store consumption', () => {
    const next = applyVersionSyncErrorState({
      status: 'available',
      version: '1.3.0',
      percent: null,
      transferred: null,
      total: null,
      bytesPerSecond: null,
      errorCode: null,
      errorMessage: null,
    })
    expect(next.status).toBe('error')
    expect(next.errorCode).toBe('version_sync')
    expect(next.errorMessage).toBe(VERSION_SYNC_ERROR_MESSAGE)
    expect(isVersionSyncError(next)).toBe(true)
  })
})
