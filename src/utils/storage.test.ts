import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  isValidProgressPayload,
  loadProgressSnapshot,
  normalizeProgress,
  saveProgressToLocal,
  setProgressStorageScope,
} from './storage'

const ACCOUNT_A = '123e4567-e89b-42d3-a456-426614174000'
const ACCOUNT_B = '123e4567-e89b-42d3-a456-426614174001'
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
  setProgressStorageScope(null)
  vi.unstubAllGlobals()
})

describe('progress payload validation', () => {
  it('accepts a valid partial progress payload', () => {
    expect(isValidProgressPayload({
      completedChapters: { 'linux-basics': [0, 1] },
      achievements: ['first-step'],
      totalTimeSpent: 120,
    })).toBe(true)
  })

  it('rejects malformed nested progress fields', () => {
    expect(isValidProgressPayload({ completedChapters: { 'linux-basics': ['zero'] } })).toBe(false)
    expect(isValidProgressPayload({ commandHistory: [{ command: 'pwd', source: 'unknown' }] })).toBe(false)
    expect(isValidProgressPayload({ totalTimeSpent: -1 })).toBe(false)
  })

  it('normalizes damaged cache data without leaking invalid values', () => {
    const normalized = normalizeProgress({
      completedChapters: { 'linux-basics': [0, 0, 1], broken: ['x'] },
      achievements: ['first-step', 123],
      userProfile: null,
    })

    expect(normalized.completedChapters).toEqual({ 'linux-basics': [0, 1] })
    expect(normalized.achievements).toEqual(['first-step'])
    expect(normalized.userProfile.name).toBe('本地学习者')
  })
})

describe('account-scoped progress storage', () => {
  it('keeps local cache isolated between accounts', () => {
    setProgressStorageScope(ACCOUNT_A)
    saveProgressToLocal(normalizeProgress({ completedChapters: { git: [0] } }), 100)

    setProgressStorageScope(ACCOUNT_B)
    expect(loadProgressSnapshot().progress.completedChapters).toEqual({})
    saveProgressToLocal(normalizeProgress({ completedChapters: { docker: [1] } }), 200)

    setProgressStorageScope(ACCOUNT_A)
    expect(loadProgressSnapshot().progress.completedChapters).toEqual({ git: [0] })
    expect(loadProgressSnapshot().updatedAt).toBe(100)
  })

  it('rejects malformed account ids before deriving storage keys', () => {
    expect(() => setProgressStorageScope('------------------------------------')).toThrow('账号 ID 无效')
  })
})
