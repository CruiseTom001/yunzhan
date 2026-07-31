// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
