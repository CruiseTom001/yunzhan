import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const localStorageMock = {
  store: new Map<string, string>(),
  getItem(key: string) {
    return this.store.get(key) ?? null
  },
  setItem(key: string, value: string) {
    this.store.set(key, value)
  },
  removeItem(key: string) {
    this.store.delete(key)
  },
  clear() {
    this.store.clear()
  },
}

const matchMediaMock = vi.fn((query: string) => ({
  matches: false,
  media: query,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  addListener: vi.fn(),
  removeListener: vi.fn(),
  onchange: null,
  dispatchEvent: vi.fn(),
}))

vi.stubGlobal('window', {
  localStorage: localStorageMock,
  matchMedia: matchMediaMock,
})

import { usePreferencesStore } from '@/stores/preferences'

describe('preferences store', () => {
  beforeEach(() => {
    localStorageMock.clear()
    matchMediaMock.mockClear()
    setActivePinia(createPinia())
  })

  it('defaults to system reduce-motion when no override is set', () => {
    const store = usePreferencesStore()
    expect(store.reduceMotion).toBe(store.systemPrefersReduceMotion)
    expect(store.reduceMotionOverride).toBeNull()
  })

  it('allows user override and persists it', () => {
    const store = usePreferencesStore()
    store.setReduceMotion(true)
    expect(store.reduceMotion).toBe(true)
    expect(localStorageMock.store.get('yunzhan-preferences')).toContain('"reduceMotion":true')

    store.setReduceMotion(false)
    expect(store.reduceMotion).toBe(false)
    expect(localStorageMock.store.get('yunzhan-preferences')).toContain('"reduceMotion":false')
  })

  it('clears override when set to null and falls back to system', () => {
    const store = usePreferencesStore()
    store.setReduceMotion(true)
    store.setReduceMotion(null)
    expect(store.reduceMotionOverride).toBeNull()
    expect(store.reduceMotion).toBe(store.systemPrefersReduceMotion)
  })
})
