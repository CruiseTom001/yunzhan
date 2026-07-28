import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearOnboardingCache,
  readOnboardingCache,
  writeOnboardingCache,
} from '@/utils/onboardingStorage'

const userId = 'user-onboarding-test'
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
  clearOnboardingCache(userId)
  vi.unstubAllGlobals()
})

describe('onboardingStorage', () => {
  it('reads and writes cache records per user', () => {
    writeOnboardingCache(userId, {
      status: 'pending',
      version: 0,
      stepId: 'welcome',
      updatedAt: 1_700_000_000_000,
    })

    expect(readOnboardingCache(userId)).toEqual({
      status: 'pending',
      version: 0,
      stepId: 'welcome',
      updatedAt: 1_700_000_000_000,
    })
  })

  it('rejects invalid cache payloads', () => {
    localStorage.setItem(`yunzhan:onboarding:${userId}`, JSON.stringify({ status: 'bad' }))
    expect(readOnboardingCache(userId)).toBeNull()
  })
})
