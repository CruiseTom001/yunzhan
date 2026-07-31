// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import AppHeader from '@/components/layout/AppHeader.vue'
import { useAuthStore } from '@/stores/auth'
import { DESKTOP_DOWNLOAD_UNAVAILABLE_MESSAGE } from '@/utils/desktopDownloadUrl'

vi.mock('@/utils/desktopVersionApi', () => ({
  getDesktopLatestVersion: vi.fn(),
}))

import { getDesktopLatestVersion } from '@/utils/desktopVersionApi'

const mockedGetLatest = vi.mocked(getDesktopLatestVersion)
const VALID_URL = 'https://github.com/CruiseTom001/yunzhan/releases/download/v1.2.11/yunzhan-setup-1.2.11.exe'

async function mountHeader() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: { template: '<div />' } },
      { path: '/account', name: 'account', component: { template: '<div />' } },
      { path: '/landing', name: 'landing', component: { template: '<div />' } },
    ],
  })
  await router.push('/')
  await router.isReady()

  const wrapper = mount(AppHeader, {
    global: {
      plugins: [router],
    },
  })
  await flushPromises()
  return wrapper
}

describe('AppHeader web desktop download entry', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    window.open = vi.fn(() => null) as unknown as typeof window.open
    delete (window as { electronAPI?: unknown }).electronAPI

    const auth = useAuthStore()
    auth.user = {
      id: '1',
      username: 'alice',
      displayName: 'Alice',
      email: 'alice@example.com',
      emailVerifiedAt: Date.now(),
      role: 'user',
      status: 'active',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastLoginAt: Date.now(),
    }
    auth.status = 'authenticated'
  })

  afterEach(() => {
    delete (window as { electronAPI?: unknown }).electronAPI
    document.body.innerHTML = ''
  })

  it('shows download entry for logged-in web users in desktop and mobile menus', async () => {
    mockedGetLatest.mockResolvedValue({
      version: '1.2.11',
      minSupported: '1.2.5',
      downloadUrl: VALID_URL,
      releaseNotes: '',
    })

    const wrapper = await mountHeader()
    const labels = wrapper.findAll('button').map((button) => button.text())
    expect(labels.some((text) => text.includes('下载桌面端'))).toBe(true)

    await wrapper.get('button[aria-label="打开导航菜单"]').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('下载桌面端')
  })

  it('hides download entry on Electron runtime', async () => {
    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      value: { invoke: vi.fn() },
    })
    mockedGetLatest.mockResolvedValue({
      version: '1.2.11',
      minSupported: '1.2.5',
      downloadUrl: VALID_URL,
      releaseNotes: '',
    })

    const wrapper = await mountHeader()
    expect(wrapper.text()).not.toContain('下载桌面端')
    expect(mockedGetLatest).not.toHaveBeenCalled()
  })

  it('shows unavailable message without opening a blank page', async () => {
    mockedGetLatest.mockResolvedValue({
      version: null,
      minSupported: null,
      downloadUrl: null,
      releaseNotes: null,
    })

    const wrapper = await mountHeader()
    const button = wrapper.findAll('button').find((item) => item.text().includes('下载桌面端'))
    expect(button).toBeTruthy()
    await button!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain(DESKTOP_DOWNLOAD_UNAVAILABLE_MESSAGE)
    expect(window.open).not.toHaveBeenCalled()
  })
})

describe('AppHeader account menu light theme', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    delete (window as { electronAPI?: unknown }).electronAPI
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
    document.documentElement.setAttribute('data-theme', 'light')
    const auth = useAuthStore()
    auth.user = {
      id: '1',
      username: 'alice',
      displayName: 'Alice',
      email: 'alice@example.com',
      emailVerifiedAt: Date.now(),
      role: 'user',
      status: 'active',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastLoginAt: Date.now(),
    }
    auth.status = 'authenticated'
  })

  afterEach(() => {
    delete (window as { electronAPI?: unknown }).electronAPI
    document.body.innerHTML = ''
    document.documentElement.removeAttribute('data-theme')
  })

  it('defines light patches for account menu items in style.css (with !important)', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/style.css'), 'utf8')
    expect(css).toContain('[data-theme="light"] .account-menu-item:not(.text-red-300)')
    expect(css).toContain('[data-theme="light"] .account-menu-item:hover:not(:disabled):not(.text-red-300)')
    expect(css).toContain('[data-theme="light"] .account-menu-item:focus-visible:not(:disabled):not(.text-red-300)')
    expect(css).toContain('[data-theme="light"] .mobile-account-action')
    const patchStart = css.indexOf('[data-theme="light"] .account-menu-item:not(.text-red-300)')
    const patchRule = css.slice(patchStart, css.indexOf('}', patchStart))
    expect(patchRule).toContain('!important')
    expect(patchRule).toContain('var(--text-secondary)')
  })

  it('light patch beats the scoped rule so hover never turns white', () => {
    // 级联模拟：scoped 编译产物（普通声明）+ 浅色补丁（!important），断言补丁胜出
    const styleEl = document.createElement('style')
    styleEl.textContent = [
      `.account-menu-item[data-v-sim] { color: rgb(156, 163, 175); }`,
      `[data-theme="light"] .account-menu-item:not(.text-red-300) { color: #344253 !important; }`,
      `[data-theme="light"] .account-menu-item:hover:not(:disabled):not(.text-red-300) { color: #17202b !important; background-color: #eef3f7 !important; }`,
    ].join('\n')
    document.head.appendChild(styleEl)
    const item = document.createElement('button')
    item.className = 'account-menu-item'
    item.setAttribute('data-v-sim', '')
    item.innerText = '账号设置'
    document.body.appendChild(item)

    expect(getComputedStyle(item).color).toBe('rgb(52, 66, 83)') // --text-secondary

    // 深色主题下保留 scoped 原值（补丁不命中）
    document.documentElement.setAttribute('data-theme', 'dark')
    expect(getComputedStyle(item).color).toBe('rgb(156, 163, 175)') // gray-400

    styleEl.remove()
    item.remove()
  })

  it('mounts the real AppHeader and opens the account menu with visible items', async () => {
    const wrapper = await mountHeader()
    const userButton = wrapper.findAll('button').find((button) => button.text().includes('Alice'))
    expect(userButton).toBeTruthy()
    await userButton!.trigger('click')
    await flushPromises()

    const items = wrapper.findAll('.account-menu-item')
    expect(items.length).toBeGreaterThanOrEqual(1)
    expect(wrapper.text()).toContain('账号设置')
    expect(wrapper.text()).toContain('退出登录')
  })
})
