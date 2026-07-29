import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  isAllowedDesktopDownloadUrl,
  openWebDesktopDownloadUrl,
  resolveLandingDesktopDownloadUrl,
} from './desktopDownloadUrl'

const VALID_URL = 'https://github.com/CruiseTom001/yunzhan/releases/download/v1.2.5/yunzhan-setup-1.2.5.exe'

let windowOpen: ReturnType<typeof vi.fn>

function mockWeb() {
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

describe('openWebDesktopDownloadUrl', () => {
  it('uses window.open on web runtime for whitelisted HTTPS URLs', () => {
    mockWeb()
    const result = openWebDesktopDownloadUrl(VALID_URL)
    expect(result.ok).toBe(true)
    expect(windowOpen).toHaveBeenCalledWith(VALID_URL, '_blank', 'noopener')
  })

  it('rejects invalid URLs without opening anything', () => {
    mockWeb()
    const result = openWebDesktopDownloadUrl('https://example.com/setup.exe')
    expect(result.ok).toBe(false)
    expect(windowOpen).not.toHaveBeenCalled()
  })
})
