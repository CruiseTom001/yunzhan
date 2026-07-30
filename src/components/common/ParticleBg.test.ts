// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick, ref } from 'vue'
import ParticleBg from './ParticleBg.vue'
import { usePreferencesStore } from '@/stores/preferences'

function createMockEngine() {
  return {
    setReduceMotion: vi.fn(),
    setPageHidden: vi.fn(),
    setViewportVisible: vi.fn(),
    setTheme: vi.fn(),
    resize: vi.fn(),
    handlePointerMove: vi.fn(),
    handlePointerLeave: vi.fn(),
    handlePointerDown: vi.fn(),
    tick: vi.fn(),
    draw: vi.fn(),
    shouldAnimate: vi.fn(() => true),
    dispose: vi.fn(),
  }
}

type MockEngine = ReturnType<typeof createMockEngine>

let mockEngine: MockEngine

vi.mock('@/utils/particleBackground', () => ({
  createParticleBackgroundEngine: vi.fn(() => mockEngine),
  PARTICLE_BG_MAX_DEVICE_PIXEL_RATIO: 2,
}))

vi.mock('@/stores/theme', () => ({
  useTheme: () => ({
    theme: ref('dark'),
  }),
}))

class MockIntersectionObserver {
  constructor(private callback: IntersectionObserverCallback) {}
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}

const mountedWrappers: VueWrapper[] = []
let rafMock: ReturnType<typeof vi.fn>
let cancelRafMock: ReturnType<typeof vi.fn>

function stubMatchMedia(matches: boolean) {
  vi.stubGlobal('matchMedia', vi.fn(() => ({
    matches,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  })))
}

function setDocumentHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', {
    value: hidden,
    configurable: true,
  })
}

function dispatchVisibilityChange() {
  document.dispatchEvent(new Event('visibilitychange'))
}

function mountParticleBg() {
  const wrapper = mount(ParticleBg)
  mountedWrappers.push(wrapper)
  return wrapper
}

describe('ParticleBg visibilitychange listener', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    window.localStorage.clear()
    mockEngine = createMockEngine()

    stubMatchMedia(false)
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)
    rafMock = vi.fn(() => 1)
    cancelRafMock = vi.fn()
    vi.stubGlobal('requestAnimationFrame', rafMock)
    vi.stubGlobal('cancelAnimationFrame', cancelRafMock)
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ({
      setTransform: vi.fn(),
      canvas: {},
    }) as unknown as ReturnType<typeof HTMLCanvasElement.prototype.getContext>)
  })

  afterEach(() => {
    while (mountedWrappers.length > 0) {
      mountedWrappers.pop()?.unmount()
    }
    Reflect.deleteProperty(document, 'hidden')
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  it('registers visibilitychange listener even when initial reduceMotion is true', () => {
    stubMatchMedia(true)
    const addSpy = vi.spyOn(document, 'addEventListener')
    const removeSpy = vi.spyOn(document, 'removeEventListener')

    const wrapper = mountParticleBg()

    const registered = addSpy.mock.calls.filter((call) => call[0] === 'visibilitychange')
    expect(registered).toHaveLength(1)
    expect(rafMock).not.toHaveBeenCalled()

    wrapper.unmount()

    const removed = removeSpy.mock.calls.filter((call) => call[0] === 'visibilitychange')
    expect(removed).toHaveLength(1)
    expect(mockEngine.dispose).toHaveBeenCalledTimes(1)
  })

  it('stops animation when page becomes hidden after enabling motion', async () => {
    stubMatchMedia(true)
    mountParticleBg()

    const preferencesStore = usePreferencesStore()
    preferencesStore.setReduceMotion(false)
    await nextTick()

    expect(rafMock.mock.calls.length).toBeGreaterThan(0)
    const scheduledBeforeHide = rafMock.mock.calls.length

    setDocumentHidden(true)
    dispatchVisibilityChange()

    expect(mockEngine.setPageHidden).toHaveBeenCalledWith(true)
    expect(cancelRafMock).toHaveBeenCalled()
    expect(rafMock.mock.calls.length).toBe(scheduledBeforeHide)
  })

  it('resumes animation when page becomes visible again and reduceMotion is off', () => {
    mountParticleBg()

    expect(rafMock.mock.calls.length).toBeGreaterThan(0)
    const scheduledBeforeHide = rafMock.mock.calls.length

    setDocumentHidden(true)
    dispatchVisibilityChange()
    expect(mockEngine.setPageHidden).toHaveBeenLastCalledWith(true)
    expect(rafMock.mock.calls.length).toBe(scheduledBeforeHide)

    setDocumentHidden(false)
    dispatchVisibilityChange()

    expect(mockEngine.setPageHidden).toHaveBeenLastCalledWith(false)
    expect(rafMock.mock.calls.length).toBeGreaterThan(scheduledBeforeHide)
  })

  it('does not respond to visibilitychange after unmount', () => {
    const wrapper = mountParticleBg()
    wrapper.unmount()

    const callsBefore = mockEngine.setPageHidden.mock.calls.length
    setDocumentHidden(true)
    dispatchVisibilityChange()

    expect(mockEngine.setPageHidden.mock.calls.length).toBe(callsBefore)
  })
})
