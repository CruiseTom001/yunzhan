import { describe, expect, it } from 'vitest'
import {
  canStartDownload,
  canStartInstall,
  containsSensitiveErrorText,
  createInitialUpdaterState,
  getPublicUpdaterState,
  mapDownloadProgress,
  mapUpdaterError,
  sanitizeUpdaterState,
} from './desktop-updater-state.cjs'

describe('desktop-updater-state', () => {
  it('sanitizes public updater state fields only', () => {
    const state = sanitizeUpdaterState({
      status: 'downloading',
      version: ' 1.3.0 ',
      percent: 120,
      transferred: -1,
      total: 1000,
      bytesPerSecond: 500,
      errorCode: 'network_error',
      errorMessage: '网络失败',
      secretPath: 'C:\\Users\\secret\\setup.exe',
    })

    expect(state.status).toBe('downloading')
    expect(state.version).toBe('1.3.0')
    expect(state.percent).toBe(100)
    expect(state.transferred).toBeNull()
    expect(state.total).toBe(1000)
    expect(getPublicUpdaterState(state)).toEqual({
      status: 'downloading',
      version: '1.3.0',
      percent: 100,
      transferred: null,
      total: 1000,
      bytesPerSecond: 500,
      errorCode: 'network_error',
      errorMessage: '网络失败',
    })
  })

  it('maps common updater errors without leaking paths', () => {
    expect(mapUpdaterError(new Error('net::ERR_INTERNET_DISCONNECTED')).errorCode).toBe('network_error')
    expect(mapUpdaterError(new Error('404 latest.yml not found')).errorCode).toBe('feed_missing')
    expect(mapUpdaterError(new Error('sha512 checksum mismatch')).errorCode).toBe('checksum_failed')
    expect(mapUpdaterError(new Error('already the latest version')).errorCode).toBe('already_latest')
    expect(mapUpdaterError(new Error('download failed')).errorCode).toBe('download_failed')
    expect(mapUpdaterError(new Error('quitAndInstall failed')).errorCode).toBe('install_failed')
    expect(mapUpdaterError(new Error('开发环境不执行自动更新')).errorCode).toBe('dev_disabled')

    const mapped = mapUpdaterError(new Error('C:\\Users\\secret\\AppData\\setup.exe failed'))
    expect(mapped.errorMessage).not.toContain('C:\\Users')
    expect(containsSensitiveErrorText(mapped.errorMessage)).toBe(false)
  })

  it('maps download progress with numeric bounds', () => {
    expect(mapDownloadProgress({ percent: -5, transferred: 10, total: 100, bytesPerSecond: 20 })).toEqual({
      percent: 0,
      transferred: 10,
      total: 100,
      bytesPerSecond: 20,
    })
    expect(mapDownloadProgress(null)).toEqual({
      percent: null,
      transferred: null,
      total: null,
      bytesPerSecond: null,
    })
  })

  it('guards download and install transitions', () => {
    const enabled = true
    expect(canStartDownload(createInitialUpdaterState(), enabled).ok).toBe(false)
    expect(canStartDownload({ ...createInitialUpdaterState(), status: 'available' }, enabled).ok).toBe(true)
    expect(canStartDownload({ ...createInitialUpdaterState(), status: 'downloading' }, enabled).ok).toBe(false)
    expect(canStartDownload({ ...createInitialUpdaterState(), status: 'downloaded' }, enabled).ok).toBe(false)
    expect(canStartDownload({ ...createInitialUpdaterState(), status: 'error' }, enabled).ok).toBe(true)
    expect(canStartDownload({ ...createInitialUpdaterState(), status: 'available' }, false).ok).toBe(false)

    expect(canStartInstall({ ...createInitialUpdaterState(), status: 'downloading' }, enabled).ok).toBe(false)
    expect(canStartInstall({ ...createInitialUpdaterState(), status: 'downloaded' }, enabled).ok).toBe(true)
    expect(canStartInstall({
      ...createInitialUpdaterState(),
      status: 'error',
      errorCode: 'install_failed',
    }, enabled).ok).toBe(true)
    expect(canStartInstall({ ...createInitialUpdaterState(), status: 'downloaded' }, false).ok).toBe(false)
  })
})
