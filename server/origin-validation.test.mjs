import { describe, expect, it } from 'vitest'
import { isDesktopOriginAllowed, isElectronFileOrigin } from './origin-validation.mjs'

describe('isElectronFileOrigin', () => {
  it('accepts null origin (Electron file:// page)', () => {
    expect(isElectronFileOrigin('null')).toBe(true)
  })

  it('accepts undefined origin (no Origin header)', () => {
    expect(isElectronFileOrigin(undefined)).toBe(true)
  })

  it('accepts empty string origin', () => {
    expect(isElectronFileOrigin('')).toBe(true)
  })

  it('accepts file:// scheme origin', () => {
    expect(isElectronFileOrigin('file://')).toBe(true)
    expect(isElectronFileOrigin('file:///C:/Users/app/index.html')).toBe(true)
  })

  it('rejects https:// scheme origin (normal web)', () => {
    expect(isElectronFileOrigin('https://yunzhan.vercel.app')).toBe(false)
  })

  it('rejects malicious https:// origin', () => {
    expect(isElectronFileOrigin('https://evil.example')).toBe(false)
  })

  it('rejects http:// scheme origin', () => {
    expect(isElectronFileOrigin('http://localhost:5173')).toBe(false)
  })
})

describe('isDesktopOriginAllowed', () => {
  it('allows null origin with desktop client header and feature enabled', () => {
    expect(isDesktopOriginAllowed('null', 'desktop', true)).toBe(true)
  })

  it('allows file:// origin with desktop client header', () => {
    expect(isDesktopOriginAllowed('file://', 'desktop', true)).toBe(true)
  })

  it('allows undefined origin with desktop client header', () => {
    expect(isDesktopOriginAllowed(undefined, 'desktop', true)).toBe(true)
  })

  it('allows empty origin with desktop client header', () => {
    expect(isDesktopOriginAllowed('', 'desktop', true)).toBe(true)
  })

  it('rejects when ALLOW_ELECTRON_FILE_ORIGIN is disabled', () => {
    expect(isDesktopOriginAllowed('null', 'desktop', false)).toBe(false)
    expect(isDesktopOriginAllowed('file://', 'desktop', false)).toBe(false)
    expect(isDesktopOriginAllowed(undefined, 'desktop', false)).toBe(false)
  })

  it('rejects when X-Yunzhan-Client header is missing', () => {
    expect(isDesktopOriginAllowed('null', undefined, true)).toBe(false)
  })

  it('rejects when X-Yunzhan-Client header has wrong value', () => {
    expect(isDesktopOriginAllowed('null', 'web', true)).toBe(false)
    expect(isDesktopOriginAllowed('null', 'mobile', true)).toBe(false)
  })

  it('rejects https://evil.example even with desktop header', () => {
    expect(isDesktopOriginAllowed('https://evil.example', 'desktop', true)).toBe(false)
  })

  it('rejects normal web origin even with desktop header (defense in depth)', () => {
    // A normal web origin should never pass the desktop check,
    // even if someone spoofs the header.
    expect(isDesktopOriginAllowed('https://yunzhan.vercel.app', 'desktop', true)).toBe(false)
  })
})