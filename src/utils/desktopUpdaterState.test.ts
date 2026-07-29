import { describe, expect, it } from 'vitest'
import {
  canClickDownloadButton,
  canClickInstallButton,
  isUpdaterBusy,
  parseDesktopUpdaterPublicState,
} from '@/utils/desktopUpdaterState'

describe('desktopUpdaterState', () => {
  it('parses updater public state safely', () => {
    expect(parseDesktopUpdaterPublicState({
      status: 'downloading',
      version: '1.3.0',
      percent: 150,
      transferred: 100,
      total: 200,
      bytesPerSecond: 50,
    })).toMatchObject({
      status: 'downloading',
      version: '1.3.0',
      percent: 100,
      transferred: 100,
      total: 200,
      bytesPerSecond: 50,
    })
  })

  it('controls download/install button availability', () => {
    expect(canClickDownloadButton('available')).toBe(true)
    expect(canClickDownloadButton('error')).toBe(true)
    expect(canClickDownloadButton('error', 'version_sync')).toBe(false)
    expect(canClickDownloadButton('downloading')).toBe(false)
    expect(canClickInstallButton('downloaded')).toBe(true)
    expect(canClickInstallButton('error', 'install_failed')).toBe(true)
    expect(canClickInstallButton('available')).toBe(false)
    expect(isUpdaterBusy('checking')).toBe(true)
    expect(isUpdaterBusy('idle')).toBe(false)
  })
})
