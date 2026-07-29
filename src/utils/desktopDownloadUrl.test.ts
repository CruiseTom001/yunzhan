import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  isAllowedDesktopDownloadUrl,
  openAllowedDesktopDownloadUrl,
  resolveLandingDesktopDownloadUrl,
} from './desktopDownloadUrl'

const VALID_URL = 'https://github.com/CruiseTom001/yunzhan/releases/download/v1.2.5/setup.exe'

let electronInvoke: ReturnType<typeof vi.fn>
let windowOpen: ReturnType<typeof vi.fn>

function mockElectron() {
  electronInvoke = vi.fn(async (channel: string) => {
    if (channel === 'app:openExternal') return { ok: true }
    return null
  })
  windowOpen = vi.fn()
  vi.stubGlobal('window', {
    electronAPI: { invoke: electronInvoke },
    open: windowOpen,
  })
}

function mockWeb() {
  electronInvoke = vi.fn()
  windowOpen = vi.fn()
  vi.stubGlobal('window', { open: windowOpen })
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('desktopDownloadUrl', () => {
  it('accepts GitHub release HTTPS URLs on allowed hosts', () => {
    expect(isAllowedDesktopDownloadUrl(VALID_URL)).toBe(true)
    expect(isAllowedDesktopDownloadUrl('https://release-assets.githubusercontent.com/github-production-release-asset/abc')).toBe(true)
    expect(isAllowedDesktopDownloadUrl('https://objects.githubusercontent.com/github-production-release-asset/abc')).toBe(true)
  })

  it('rejects non-HTTPS URLs', () => {
    expect(isAllowedDesktopDownloadUrl('http://github.com/foo/bar')).toBe(false)
  })

  it('rejects unknown hosts', () => {
    expect(isAllowedDesktopDownloadUrl('https://example.com/setup.exe')).toBe(false)
    expect(isAllowedDesktopDownloadUrl('https://evil-github.com/setup.exe')).toBe(false)
  })

  it('rejects javascript and invalid values', () => {
    expect(isAllowedDesktopDownloadUrl('javascript:alert(1)')).toBe(false)
    expect(isAllowedDesktopDownloadUrl(null)).toBe(false)
    expect(isAllowedDesktopDownloadUrl('')).toBe(false)
  })
})

describe('resolveLandingDesktopDownloadUrl', () => {
  it('accepts whitelisted HTTPS GitHub URLs', () => {
    expect(resolveLandingDesktopDownloadUrl(VALID_URL)).toBe(VALID_URL)
  })

  it('rejects HTTP and non-whitelist domains', () => {
    expect(resolveLandingDesktopDownloadUrl('http://github.com/foo/setup.exe')).toBeNull()
    expect(resolveLandingDesktopDownloadUrl('https://example.com/setup.exe')).toBeNull()
    expect(resolveLandingDesktopDownloadUrl(undefined)).toBeNull()
  })
})

describe('openAllowedDesktopDownloadUrl', () => {
  it('opens via app:openExternal on desktop runtime', async () => {
    mockElectron()
    const result = await openAllowedDesktopDownloadUrl(VALID_URL)
    expect(result.ok).toBe(true)
    expect(electronInvoke).toHaveBeenCalledWith('app:openExternal', VALID_URL)
    expect(windowOpen).not.toHaveBeenCalled()
  })

  it('does not fall back to window.open when ipc throws', async () => {
    mockElectron()
    electronInvoke.mockRejectedValueOnce(new Error('ipc failed'))

    const result = await openAllowedDesktopDownloadUrl(VALID_URL)
    expect(result.ok).toBe(false)
    if (result.ok === false) {
      expect(result.errorMessage).toContain('无法打开下载链接')
    }
    expect(windowOpen).not.toHaveBeenCalled()
  })

  it('does not fall back to window.open when ipc returns ok:false', async () => {
    mockElectron()
    electronInvoke.mockResolvedValueOnce({ ok: false })

    const result = await openAllowedDesktopDownloadUrl(VALID_URL)
    expect(result.ok).toBe(false)
    expect(windowOpen).not.toHaveBeenCalled()
  })

  it('uses window.open on web runtime for whitelisted HTTPS URLs', async () => {
    mockWeb()
    const result = await openAllowedDesktopDownloadUrl(VALID_URL)
    expect(result.ok).toBe(true)
    expect(windowOpen).toHaveBeenCalledWith(VALID_URL, '_blank', 'noopener')
    expect(electronInvoke).not.toHaveBeenCalled()
  })

  it('rejects invalid URLs without opening anything', async () => {
    mockWeb()
    const result = await openAllowedDesktopDownloadUrl('https://example.com/setup.exe')
    expect(result.ok).toBe(false)
    expect(windowOpen).not.toHaveBeenCalled()

    mockElectron()
    const desktopResult = await openAllowedDesktopDownloadUrl('http://github.com/setup.exe')
    expect(desktopResult.ok).toBe(false)
    expect(electronInvoke).not.toHaveBeenCalled()
  })

  it('resolves without throwing on failure', async () => {
    mockElectron()
    electronInvoke.mockRejectedValueOnce(new Error('ipc failed'))
    await expect(openAllowedDesktopDownloadUrl(VALID_URL)).resolves.toMatchObject({ ok: false })
  })
})
