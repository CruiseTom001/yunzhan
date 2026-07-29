import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  decideUpdateNotice,
  DESKTOP_UPDATE_SNOOZE_MS,
  hasShownRequiredNoticeToday,
  InvalidDesktopUpdateInfoError,
  isOptionalNoticeSnoozed,
  resolveDesktopUpdateCheckError,
  shouldShowOptionalAutoNotice,
  shouldShowRequiredAutoNotice,
  snoozeOptionalNotice,
} from './desktopUpdateCheck'
import { ApiError } from './apiClient'
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
  downloadUrl: 'https://github.com/CruiseTom001/yunzhan/releases/download/v1.2.0/setup.exe',
  releaseNotes: 'changes',
}

describe('decideUpdateNotice', () => {
  it('returns null when local >= remote', () => {
    expect(decideUpdateNotice('1.2.0', LATEST_OK)).toBeNull()
    expect(decideUpdateNotice('1.3.0', LATEST_OK)).toBeNull()
  })

  it('returns optional when local < remote and local >= minSupported', () => {
    const result = decideUpdateNotice('1.1.0', LATEST_OK)
    expect(result?.mode).toBe('optional')
    expect(result?.remoteVersion).toBe('1.2.0')
  })

  it('returns required when local < minSupported', () => {
    const result = decideUpdateNotice('1.0.0', LATEST_OK)
    expect(result?.mode).toBe('required')
  })

  it('returns null when remote version missing or malformed', () => {
    expect(decideUpdateNotice('1.1.0', {
      version: null, minSupported: '1.1.0', downloadUrl: 'https://github.com/x', releaseNotes: '',
    })).toBeNull()
    expect(decideUpdateNotice('1.1.0', {
      version: 'v1.2.0', minSupported: '1.1.0', downloadUrl: 'https://github.com/x', releaseNotes: '',
    })).toBeNull()
  })
})

describe('optional snooze', () => {
  const optionalNotice = decideUpdateNotice('1.1.0', LATEST_OK)!

  it('snoozes optional notice for 24 hours', () => {
    const now = 1_700_000_000_000
    snoozeOptionalNotice('1.2.0', DESKTOP_UPDATE_SNOOZE_MS, now)
    expect(isOptionalNoticeSnoozed('1.2.0', now + 1000)).toBe(true)
    expect(isOptionalNoticeSnoozed('1.2.0', now + DESKTOP_UPDATE_SNOOZE_MS)).toBe(false)
  })

  it('allows auto popup when not snoozed', () => {
    expect(shouldShowOptionalAutoNotice(optionalNotice)).toBe(true)
  })

  it('blocks auto popup while snoozed but not for other versions', () => {
    snoozeOptionalNotice('1.2.0', DESKTOP_UPDATE_SNOOZE_MS)
    expect(shouldShowOptionalAutoNotice(optionalNotice)).toBe(false)
    expect(shouldShowOptionalAutoNotice({
      ...optionalNotice,
      remoteVersion: '1.3.0',
    })).toBe(true)
  })
})

describe('required auto notice', () => {
  it('shows required notice first time same day and blocks repeats', () => {
    const requiredNotice = decideUpdateNotice('1.0.0', LATEST_OK)!
    expect(shouldShowRequiredAutoNotice(requiredNotice)).toBe(true)
    expect(shouldShowRequiredAutoNotice(requiredNotice)).toBe(false)
    expect(hasShownRequiredNoticeToday()).toBe(true)
  })
})

describe('resolveDesktopUpdateCheckError', () => {
  it('maps network and server errors to readable messages', () => {
    expect(resolveDesktopUpdateCheckError(new ApiError('网络错误', 0, null))).toContain('网络')
    expect(resolveDesktopUpdateCheckError(new ApiError('server', 503, null))).toContain('服务器')
    expect(resolveDesktopUpdateCheckError(new ApiError('无效版本数据', 400, null))).toContain('版本信息')
  })

  it('maps invalid update info before ApiError status zero', () => {
    expect(resolveDesktopUpdateCheckError(new InvalidDesktopUpdateInfoError())).toContain('版本信息')
    expect(resolveDesktopUpdateCheckError(new InvalidDesktopUpdateInfoError())).not.toContain('网络')
  })

  it('does not classify invalid payload as network failure when status is zero', () => {
    const invalidWithStatusZero = Object.assign(new InvalidDesktopUpdateInfoError(), { status: 0 })
    expect(resolveDesktopUpdateCheckError(invalidWithStatusZero)).toContain('版本信息')
    expect(resolveDesktopUpdateCheckError(invalidWithStatusZero)).not.toContain('网络')
  })
})
