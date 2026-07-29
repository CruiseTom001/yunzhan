import { describe, expect, it } from 'vitest'
import { isAllowedDesktopDownloadUrl } from './download-url-validation.cjs'

describe('electron download-url-validation', () => {
  it('accepts GitHub release HTTPS URLs on allowed hosts', () => {
    expect(isAllowedDesktopDownloadUrl('https://github.com/CruiseTom001/yunzhan/releases/download/v1.2.5/setup.exe')).toBe(true)
  })

  it('rejects non-HTTPS and unknown hosts', () => {
    expect(isAllowedDesktopDownloadUrl('http://github.com/foo')).toBe(false)
    expect(isAllowedDesktopDownloadUrl('https://example.com/setup.exe')).toBe(false)
  })

  it('rejects invalid parameter types', () => {
    expect(isAllowedDesktopDownloadUrl(null)).toBe(false)
    expect(isAllowedDesktopDownloadUrl(undefined)).toBe(false)
    expect(isAllowedDesktopDownloadUrl(123)).toBe(false)
  })
})
