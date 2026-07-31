/**
 * @vitest-environment jsdom
 */
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '@/App.vue'
import AuthPanel from '@/components/auth/AuthPanel.vue'
import SessionNoticeBanner from '@/components/common/SessionNoticeBanner.vue'
import { useAuthStore } from '@/stores/auth'
import { ApiError } from '@/utils/apiClient'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import LandingPage from '@/pages/LandingPage.vue'
import { DESKTOP_AUTO_LOGIN_PERSIST_WARNING } from '@/utils/desktopAuthPreferences'

import {
  readSessionNoticeTopPx,
  SESSION_NOTICE_HEADER_OFFSET,
  SESSION_NOTICE_Z_INDEX,
} from '@/utils/sessionNoticeLayout'

const LANDING_HEADER_HEIGHT_PX = 64

vi.stubGlobal('__APP_VERSION__', '1.2.9')

vi.mock('@/components/common/ParticleBg.vue', () => ({
  default: { template: '<div class="particle-bg-stub" />' },
}))

vi.mock('@/components/auth/AuthDialog.vue', () => ({
  default: { template: '<div class="auth-dialog-stub" />' },
}))

vi.mock('@/utils/desktopVersionApi', () => ({
  getDesktopLatestVersion: vi.fn().mockRejectedValue(new Error('skip download lookup')),
}))

const AUTH_USER = {
  id: '33333333-3333-4333-8333-333333333333',
  username: 'user',
  displayName: '用户',
  email: 'user@example.com',
  emailVerifiedAt: Date.now(),
  role: 'user' as const,
  status: 'active' as const,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  lastLoginAt: Date.now(),
}

const { apiRequestMock, clearDesktopAutoLoginSessionMock } = vi.hoisted(() => ({
  apiRequestMock: vi.fn(),
  clearDesktopAutoLoginSessionMock: vi.fn(),
}))

vi.mock('@/utils/apiClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/apiClient')>()
  return {
    ...actual,
    apiRequest: apiRequestMock,
  }
})

vi.mock('@/utils/desktopAuthPreferences', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/desktopAuthPreferences')>()
  return {
    ...actual,
    isDesktopRuntime: vi.fn(() => true),
    clearDesktopAutoLoginSession: clearDesktopAutoLoginSessionMock,
  }
})

vi.mock('@/stores/progress', () => ({
  useProgressStore: () => ({
    bindAccount: vi.fn(async () => {}),
    addTimeSpent: vi.fn(),
    progress: { lastRoute: '/' },
    updateLastRoute: vi.fn(),
    unbindAccount: vi.fn(async () => {}),
  }),
}))

vi.mock('@/stores/onboarding', () => ({
  useOnboardingStore: () => ({
    loadStatus: 'ready',
    blocksAnnouncements: false,
    tryAutoStart: vi.fn(),
    initialize: vi.fn(async () => {}),
    resetForLogout: vi.fn(),
    shouldDeferLastRouteRestore: false,
  }),
}))

vi.mock('@/stores/desktopUpdate', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/stores/desktopUpdate')>()
  return {
    ...actual,
    useDesktopUpdateStore: () => ({
      initialize: vi.fn(),
      dispose: vi.fn(),
    }),
  }
})

vi.mock('@/components/layout/AppHeader.vue', () => ({
  default: {
    name: 'AppHeaderStub',
    template: '<header class="app-header-stub fixed top-0 z-50 h-16">Header</header>',
  },
}))

vi.mock('@/components/common/AnnouncementModal.vue', () => ({
  default: { template: '<div />' },
}))
vi.mock('@/components/common/AnnouncementCenterDialog.vue', () => ({
  default: { template: '<div />' },
}))
vi.mock('@/components/onboarding/OnboardingTour.vue', () => ({
  default: { template: '<div />' },
}))
vi.mock('@/components/common/ConceptPopover.vue', () => ({
  default: { template: '<div />' },
}))
vi.mock('@/components/common/GlobalSearch.vue', () => ({
  default: { template: '<div />' },
}))
vi.mock('@/components/ai/FloatingTerminal.vue', () => ({
  default: { template: '<div />' },
}))

async function createNoticeRouter(initialPath: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/landing',
        name: 'landing',
        component: { template: '<main class="landing-page-stub">Landing</main>' },
        meta: { public: true, hideChrome: true },
      },
      {
        path: '/',
        name: 'home',
        component: { template: '<main class="home-page-stub">Home</main>' },
      },
    ],
  })
  await router.push(initialPath)
  await router.isReady()
  return router
}

async function mountNoticeBanner(initialPath: string, pinia = createPinia()) {
  setActivePinia(pinia)
  const router = await createNoticeRouter(initialPath)
  const wrapper = mount(SessionNoticeBanner, {
    global: {
      plugins: [pinia, router],
    },
  })
  return { wrapper, router, pinia }
}

function applyProjectTheme(theme: 'light' | 'dark') {
  document.documentElement.setAttribute('data-theme', theme)
  const themeVars = theme === 'light'
    ? {
      '--bg-elevated': '#e9eef3',
      '--text-primary': '#17202b',
      '--text-secondary': '#344253',
      '--border-card': '#ccd5df',
      '--border-light': '#c2ccd7',
      '--border-hover': '#adb9c6',
      '--bg-card-hover': '#eef3f7',
      '--accent-cyan': '#0891b2',
      '--shadow': '0 4px 24px rgba(0, 0, 0, 0.08)',
    }
    : {
      '--bg-elevated': 'rgba(255, 255, 255, 0.03)',
      '--text-primary': '#ffffff',
      '--text-secondary': '#e2e8f0',
      '--border-card': 'rgba(255, 255, 255, 0.04)',
      '--border-light': 'rgba(255, 255, 255, 0.06)',
      '--border-hover': 'rgba(255, 255, 255, 0.08)',
      '--bg-card-hover': 'rgba(255, 255, 255, 0.025)',
      '--accent-cyan': '#00f0ff',
      '--shadow': '0 4px 24px rgba(0, 0, 0, 0.3)',
    }
  for (const [name, value] of Object.entries(themeVars)) {
    document.documentElement.style.setProperty(name, value)
  }
}

function readTopOffsetPx(element: HTMLElement): number {
  const inlineTop = element.style.top
  if (inlineTop) return readSessionNoticeTopPx(inlineTop)
  const dataTop = element.getAttribute('data-session-notice-top')
  if (dataTop) return readSessionNoticeTopPx(dataTop)
  const computedTop = getComputedStyle(element).top
  if (computedTop && computedTop !== 'auto') return readSessionNoticeTopPx(computedTop)
  return element.getBoundingClientRect().top
}

function readZIndex(element: HTMLElement): number {
  if (element.style.zIndex) return Number.parseInt(element.style.zIndex, 10)
  const value = getComputedStyle(element).zIndex
  if (value === 'auto') return 0
  return Number.parseInt(value, 10)
}

async function mountLandingPageWithBanner(pinia = createPinia()) {
  setActivePinia(pinia)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/landing',
        name: 'landing',
        component: LandingPage,
        meta: { public: true, hideChrome: true },
      },
    ],
  })
  await router.push('/landing')
  await router.isReady()
  useAuthStore().sessionNotice = '自动登录信息已失效，请重新登录。'

  const wrapper = mount({
    components: { LandingPage, SessionNoticeBanner },
    template: `
      <div class="landing-layout-test-root">
        <SessionNoticeBanner />
        <LandingPage />
      </div>
    `,
  }, {
    global: {
      plugins: [pinia, router],
    },
  })
  await flushPromises()
  return { wrapper, router, pinia }
}

describe('SessionNoticeBanner placement and theme', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    applyProjectTheme('dark')
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('prefers-reduced-motion'),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
  })

  it('uses landing placement on hideChrome routes', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const authStore = useAuthStore()
    authStore.sessionNotice = '自动登录信息已失效，请重新登录。'
    const { wrapper } = await mountNoticeBanner('/landing', pinia)

    expect(wrapper.find('[data-session-notice-placement="landing"]').exists()).toBe(true)
    expect(wrapper.find('.session-notice-shell--landing').exists()).toBe(true)
  })

  it('uses chrome placement below the fixed header on regular pages', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const authStore = useAuthStore()
    authStore.sessionNotice = DESKTOP_AUTO_LOGIN_PERSIST_WARNING
    const { wrapper } = await mountNoticeBanner('/', pinia)

    expect(wrapper.find('[data-session-notice-placement="chrome"]').exists()).toBe(true)
    expect(wrapper.find('.session-notice-shell--chrome').exists()).toBe(true)
    const shell = wrapper.find('.session-notice-shell--chrome').element as HTMLElement
    expect(readTopOffsetPx(shell)).toBe(readSessionNoticeTopPx(SESSION_NOTICE_HEADER_OFFSET))
    expect(readTopOffsetPx(shell)).toBeGreaterThanOrEqual(LANDING_HEADER_HEIGHT_PX)
    expect(readZIndex(shell)).toBe(SESSION_NOTICE_Z_INDEX)
  })

  it('positions banner below the real Landing fixed header without overlapping', async () => {
    const { wrapper } = await mountLandingPageWithBanner()

    const landingHeader = wrapper.find('header.fixed.top-0.left-0.right-0.z-50')
    expect(landingHeader.exists()).toBe(true)
    const landingNav = landingHeader.find('nav.h-16')
    expect(landingNav.exists()).toBe(true)

    const bannerShell = wrapper.find('.session-notice-shell--landing').element as HTMLElement
    expect(bannerShell.getAttribute('data-session-notice-top')).toBe(SESSION_NOTICE_HEADER_OFFSET)
    expect(readTopOffsetPx(bannerShell)).toBeGreaterThanOrEqual(LANDING_HEADER_HEIGHT_PX)
    expect(readZIndex(bannerShell)).toBe(SESSION_NOTICE_Z_INDEX)
    expect(readZIndex(bannerShell)).toBeLessThan(50)
  })

  it('keeps landing offset below header on mobile viewport', async () => {
    const originalInnerWidth = window.innerWidth
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 375 })
    window.dispatchEvent(new Event('resize'))

    try {
      const { wrapper } = await mountLandingPageWithBanner()
      const bannerShell = wrapper.find('.session-notice-shell--landing').element as HTMLElement
      expect(readTopOffsetPx(bannerShell)).toBeGreaterThanOrEqual(LANDING_HEADER_HEIGHT_PX)
    } finally {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalInnerWidth })
      window.dispatchEvent(new Event('resize'))
    }
  })

  it('uses project theme variables in component styles', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/common/SessionNoticeBanner.vue'), 'utf8')
    expect(source).toContain('var(--bg-elevated)')
    expect(source).toContain('var(--text-primary)')
    expect(source).toContain('var(--text-secondary)')
    expect(source).toContain('var(--border-card)')
    expect(source).toContain('var(--shadow)')
    expect(source).toContain('session-notice-shell--chrome')
    expect(source).toContain('session-notice-shell--landing')
    expect(source).toContain('SESSION_NOTICE_HEADER_OFFSET')
    expect(source).toContain('SESSION_NOTICE_Z_INDEX')
    expect(source).not.toContain('top: 0.75rem')
    expect(source).not.toContain('top: 0.5rem')
    expect(source).not.toContain('--color-surface-primary')
    expect(source).not.toContain('--color-ink-primary')
    expect(source).not.toContain('prefers-color-scheme')
  })

  it('follows data-theme light variables without prefers-color-scheme', async () => {
    applyProjectTheme('light')
    const pinia = createPinia()
    setActivePinia(pinia)
    useAuthStore().sessionNotice = DESKTOP_AUTO_LOGIN_PERSIST_WARNING
    const { wrapper } = await mountNoticeBanner('/', pinia)

    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(getComputedStyle(document.documentElement).getPropertyValue('--bg-elevated').trim()).toBe('#e9eef3')
    expect(getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim()).toBe('#17202b')
    expect(wrapper.html()).not.toContain('prefers-color-scheme')
  })

  it('follows data-theme dark variables', async () => {
    applyProjectTheme('dark')
    const pinia = createPinia()
    setActivePinia(pinia)
    useAuthStore().sessionNotice = DESKTOP_AUTO_LOGIN_PERSIST_WARNING
    const { wrapper } = await mountNoticeBanner('/landing', pinia)

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim()).toBe('#ffffff')
    expect(wrapper.find('[role="status"]').exists()).toBe(true)
  })
})

describe('App session notice integration', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    apiRequestMock.mockReset()
    clearDesktopAutoLoginSessionMock.mockReset()
    document.documentElement.setAttribute('data-theme', 'dark')
  })

  async function mountAppAt(path: string, pinia = createPinia()) {
    setActivePinia(pinia)
    const router = await createNoticeRouter(path)
    const wrapper = mount(App, {
      global: {
        plugins: [pinia, router],
      },
    })
    return { wrapper, router, pinia }
  }

  it('shows 401 notice on Landing when cleanup completes asynchronously', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    apiRequestMock.mockRejectedValueOnce(new ApiError('未登录', 401, null))
    let resolveCleanup: ((value: unknown) => void) | null = null
    clearDesktopAutoLoginSessionMock.mockImplementationOnce(() => new Promise((resolve) => {
      resolveCleanup = resolve
    }))

    const { wrapper, router } = await mountAppAt('/landing', pinia)
    const authStore = useAuthStore()
    const initPromise = authStore.initialize()
    await initPromise
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('landing')
    expect(wrapper.find('[data-session-notice-root]').exists()).toBe(false)

    resolveCleanup?.({
      rememberIdentifier: true,
      autoLogin: false,
      identifier: 'user@example.com',
      autoLoginAvailable: true,
      autoLoginDisabledReason: null,
      warning: null,
      hadAutoLogin: true,
    })
    await flushPromises()

    expect(wrapper.find('[data-session-notice-root]').exists()).toBe(true)
    expect(wrapper.find('[data-session-notice-placement="landing"]').exists()).toBe(true)
    expect(wrapper.find('[role="status"]').text()).toContain('自动登录信息已失效，请重新登录。')
    expect(wrapper.text()).not.toContain('yunzhan_session')
  })

  it('shows notice on regular pages after auth initialization warning', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    apiRequestMock.mockRejectedValueOnce(new ApiError('未登录', 401, null))
    clearDesktopAutoLoginSessionMock.mockResolvedValueOnce({
      rememberIdentifier: true,
      autoLogin: false,
      identifier: 'user@example.com',
      autoLoginAvailable: true,
      autoLoginDisabledReason: null,
      warning: null,
      hadAutoLogin: true,
    })

    const { wrapper } = await mountAppAt('/', pinia)
    const authStore = useAuthStore()
    await authStore.initialize()
    await flushPromises()

    expect(wrapper.find('[data-session-notice-placement="chrome"]').exists()).toBe(true)
    expect(wrapper.find('[role="status"]').text()).toContain('自动登录信息已失效，请重新登录。')
  })
})

describe('AuthPanel with global session notice', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      value: {
        invoke: vi.fn(async (channel: string) => {
          if (channel === 'auth:getDesktopLoginPreferences') {
            return {
              rememberIdentifier: true,
              autoLogin: true,
              identifier: 'user@example.com',
              autoLoginAvailable: true,
              autoLoginDisabledReason: null,
            }
          }
          return null
        }),
      },
    })
  })

  it('keeps warning visible after login dialog completes and navigation', async () => {
    const router = await createNoticeRouter('/landing')
    const authStore = useAuthStore()
    const loginSpy = vi.spyOn(authStore, 'login').mockImplementation(async () => {
      authStore.user = AUTH_USER
      authStore.status = 'authenticated'
      authStore.sessionNotice = DESKTOP_AUTO_LOGIN_PERSIST_WARNING
      return AUTH_USER
    })

    const panel = mount(AuthPanel, { props: { initialMode: 'login' } })
    const banner = mount(SessionNoticeBanner, { global: { plugins: [router] } })
    await flushPromises()

    await panel.find('#login-identifier').setValue('user@example.com')
    await panel.find('#login-password').setValue('ValidPass123')
    await panel.find('form.auth-form').trigger('submit.prevent')
    await router.push('/')
    await flushPromises()

    expect(loginSpy).toHaveBeenCalledTimes(1)
    expect(authStore.status).toBe('authenticated')
    expect(banner.find('[data-session-notice-placement="chrome"]').exists()).toBe(true)
    expect(banner.find('[role="status"]').text()).toContain(DESKTOP_AUTO_LOGIN_PERSIST_WARNING)

    await banner.get('[aria-label="关闭提示"]').trigger('click')
    expect(banner.find('[role="status"]').exists()).toBe(false)
  })

  it('does not show a previously dismissed notice after logout reopens login dialog', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const router = await createNoticeRouter('/landing')
    const authStore = useAuthStore()
    authStore.sessionNotice = DESKTOP_AUTO_LOGIN_PERSIST_WARNING

    const banner = mount(SessionNoticeBanner, { global: { plugins: [pinia, router] } })
    await banner.get('[aria-label="关闭提示"]').trigger('click')

    authStore.user = null
    authStore.status = 'anonymous'

    const panel = mount(AuthPanel, { props: { initialMode: 'login' } })
    await flushPromises()

    expect(banner.find('[role="status"]').exists()).toBe(false)
    expect(panel.text()).not.toContain(DESKTOP_AUTO_LOGIN_PERSIST_WARNING)
  })
})
