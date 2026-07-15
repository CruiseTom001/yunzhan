import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  decideUpdateNotice,
  getIgnoredVersion,
  hasShownModalToday,
  rememberIgnoredVersion,
  shouldShowBanner,
  shouldShowModalAndPersist,
} from './desktopUpdateCheck'
import type { DesktopLatestVersion } from './desktopVersionApi'

let values: Map<string, string>

beforeEach(() => {
  values = new Map()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const LATEST_OK: DesktopLatestVersion = {
  version: '1.2.0',
  minSupported: '1.1.0',
  downloadUrl: 'https://x/setup.exe',
  releaseNotes: 'changes',
}

describe('decideUpdateNotice', () => {
  it('returns null when local >= remote', () => {
    expect(decideUpdateNotice('1.2.0', LATEST_OK)).toBeNull()
    expect(decideUpdateNotice('1.3.0', LATEST_OK)).toBeNull()
  })
  it('returns banner when local < remote and local >= minSupported', () => {
    const result = decideUpdateNotice('1.1.0', LATEST_OK)
    expect(result?.mode).toBe('banner')
    expect(result?.remoteVersion).toBe('1.2.0')
    expect(result?.downloadUrl).toBe('https://x/setup.exe')
  })
  it('returns modal when local < minSupported', () => {
    const result = decideUpdateNotice('1.0.0', LATEST_OK)
    expect(result?.mode).toBe('modal')
  })
  it('returns null when remote version missing', () => {
    expect(decideUpdateNotice('1.1.0', {
      version: null, minSupported: '1.1.0', downloadUrl: 'https://x', releaseNotes: '',
    })).toBeNull()
  })
  it('returns null when downloadUrl missing', () => {
    expect(decideUpdateNotice('1.1.0', {
      version: '1.2.0', minSupported: '1.1.0', downloadUrl: null, releaseNotes: '',
    })).toBeNull()
  })
  it('returns null when remote version malformed', () => {
    expect(decideUpdateNotice('1.1.0', {
      version: 'v1.2.0', minSupported: '1.1.0', downloadUrl: 'https://x', releaseNotes: '',
    })).toBeNull()
  })
  it('falls back local to 0.0.0 when malformed', () => {
    const result = decideUpdateNotice('garbage', LATEST_OK)
    expect(result?.mode).toBe('modal')
  })
})

describe('shouldShowBanner', () => {
  const bannerNotice = decideUpdateNotice('1.1.0', LATEST_OK)!
  it('shows when remote version not ignored', () => {
    expect(shouldShowBanner(bannerNotice, null)).toBe(true)
    expect(shouldShowBanner(bannerNotice, '2.0.0')).toBe(true)
  })
  it('hides when remote version matches ignored', () => {
    expect(shouldShowBanner(bannerNotice, '1.2.0')).toBe(false)
  })
  it('returns false for modal notice', () => {
    const modalNotice = decideUpdateNotice('1.0.0', LATEST_OK)!
    expect(shouldShowBanner(modalNotice, null)).toBe(false)
  })
})

describe('rememberIgnoredVersion / getIgnoredVersion', () => {
  it('persists version to localStorage', () => {
    rememberIgnoredVersion('1.2.0')
    expect(getIgnoredVersion()).toBe('1.2.0')
  })
})

describe('shouldShowModalAndPersist', () => {
  it('shows modal first time same day and persists date', () => {
    const modalNotice = decideUpdateNotice('1.0.0', LATEST_OK)!
    expect(shouldShowModalAndPersist(modalNotice)).toBe(true)
    expect(hasShownModalToday()).toBe(true)
  })
  it('does not show modal twice same day', () => {
    const modalNotice = decideUpdateNotice('1.0.0', LATEST_OK)!
    expect(shouldShowModalAndPersist(modalNotice)).toBe(true)
    expect(shouldShowModalAndPersist(modalNotice)).toBe(false)
  })
  it('returns false for banner notice', () => {
    const bannerNotice = decideUpdateNotice('1.1.0', LATEST_OK)!
    expect(shouldShowModalAndPersist(bannerNotice)).toBe(false)
  })
})
