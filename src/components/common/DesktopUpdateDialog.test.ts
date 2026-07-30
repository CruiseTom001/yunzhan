// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import DesktopUpdateDialog from './DesktopUpdateDialog.vue'
import { useDesktopUpdateStore } from '@/stores/desktopUpdate'
import type { DesktopUpdaterPublicState } from '@/utils/desktopUpdaterTypes'
import { resetAppQuitGuardsForTests } from '@/utils/appQuitGuard'

vi.mock('@/utils/authDialogFocus', () => ({
  lockBodyScroll: vi.fn(),
  trapFocus: vi.fn(),
  unlockBodyScroll: vi.fn(),
}))

vi.mock('@/utils/desktopVersionApi', () => ({
  getDesktopLatestVersion: vi.fn(async () => ({
    version: '1.2.5',
    minSupported: '1.2.0',
    downloadUrl: 'https://github.com/CruiseTom001/yunzhan/releases/download/v1.2.5/yunzhan-setup-1.2.5.exe',
    releaseNotes: '',
  })),
}))

const onboardingBlocked = { value: false }
vi.mock('@/stores/onboarding', () => ({
  useOnboardingStore: () => ({
    get blocksDesktopUpdateDialog() {
      return onboardingBlocked.value
    },
  }),
}))

function createUpdaterState(
  status: DesktopUpdaterPublicState['status'],
  extras: Partial<DesktopUpdaterPublicState> = {},
): DesktopUpdaterPublicState {
  return {
    status,
    version: null,
    percent: null,
    transferred: null,
    total: null,
    bytesPerSecond: null,
    errorCode: null,
    errorMessage: null,
    ...extras,
  }
}

function createMockDesktopApi(version = '1.2.5') {
  return {
    invoke: vi.fn(async (channel: string) => {
      if (channel === 'app:getVersion') return version
      return null
    }),
    getUpdaterState: vi.fn(async () => createUpdaterState('idle')),
    checkForDesktopUpdate: vi.fn(async () => createUpdaterState('upToDate')),
    downloadDesktopUpdate: vi.fn(async () => createUpdaterState('downloaded', { percent: 100 })),
    installDesktopUpdate: vi.fn(async () => createUpdaterState('installing')),
    onDesktopUpdaterStateChanged: vi.fn(() => vi.fn()),
  }
}

type MockDesktopApi = ReturnType<typeof createMockDesktopApi>

function installMockDesktopApi(api: MockDesktopApi) {
  Object.defineProperty(window, 'electronAPI', {
    value: api,
    configurable: true,
    writable: true,
  })
}

function removeMockDesktopApi() {
  delete (window as { electronAPI?: unknown }).electronAPI
}

function makeNotice() {
  return {
    remoteVersion: '1.3.0',
    minSupported: '1.2.0',
    downloadUrl: 'https://github.com/CruiseTom001/yunzhan/releases/download/v1.3.0/yunzhan-setup-1.3.0.exe',
    releaseNotes: '',
    mode: 'optional' as const,
  }
}

const mountedWrappers: VueWrapper[] = []

async function mountErrorDialog(errorCode: string) {
  const store = useDesktopUpdateStore()
  store.localVersion = '1.2.5'
  store.activeNotice = makeNotice()
  store.noticeMode = 'optional'
  store.applyUpdaterState(createUpdaterState('error', {
    errorCode,
    errorMessage: '操作失败',
  }))
  store.dialogPending = true
  store.dialogVisible = true

  const wrapper = mount(DesktopUpdateDialog, {
    global: {
      stubs: { Teleport: true },
    },
  })
  mountedWrappers.push(wrapper)
  await flushPromises()
  return { store, wrapper }
}

describe('DesktopUpdateDialog primary action', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    onboardingBlocked.value = false
    resetAppQuitGuardsForTests()
  })

  afterEach(() => {
    while (mountedWrappers.length > 0) {
      mountedWrappers.pop()?.unmount()
    }
    removeMockDesktopApi()
    document.body.innerHTML = ''
  })

  it('shows retry button for error status', async () => {
    const api = createMockDesktopApi()
    installMockDesktopApi(api)

    const { wrapper } = await mountErrorDialog('install_failed')

    const button = wrapper.find('.update-dialog-primary')
    expect(button.exists()).toBe(true)
    expect(button.text()).toContain('重试')
    expect(button.attributes('disabled')).toBeUndefined()
  })

  it('calls installUpdate when errorCode is install_failed', async () => {
    const api = createMockDesktopApi()
    installMockDesktopApi(api)

    const { store, wrapper } = await mountErrorDialog('install_failed')
    const installSpy = vi.spyOn(store, 'installUpdate')

    await wrapper.find('.update-dialog-primary').trigger('click')
    await flushPromises()

    expect(installSpy).toHaveBeenCalledTimes(1)
    expect(api.installDesktopUpdate).toHaveBeenCalledTimes(1)
    expect(api.checkForDesktopUpdate).not.toHaveBeenCalled()
    expect(api.downloadDesktopUpdate).not.toHaveBeenCalled()
  })

  it.each([
    'download_failed',
    'download_cancelled',
    'checksum_failed',
  ])('calls downloadUpdate when errorCode is %s', async (errorCode) => {
    const api = createMockDesktopApi()
    installMockDesktopApi(api)

    const { store, wrapper } = await mountErrorDialog(errorCode)
    const downloadSpy = vi.spyOn(store, 'downloadUpdate')

    await wrapper.find('.update-dialog-primary').trigger('click')
    await flushPromises()

    expect(downloadSpy).toHaveBeenCalledTimes(1)
    expect(api.downloadDesktopUpdate).toHaveBeenCalledTimes(1)
    expect(api.installDesktopUpdate).not.toHaveBeenCalled()
    expect(api.checkForDesktopUpdate).not.toHaveBeenCalled()
  })

  it('calls checkForUpdates with manual force when errorCode is check_failed', async () => {
    const api = createMockDesktopApi()
    installMockDesktopApi(api)

    const { store, wrapper } = await mountErrorDialog('check_failed')
    const checkSpy = vi.spyOn(store, 'checkForUpdates')

    await wrapper.find('.update-dialog-primary').trigger('click')
    await flushPromises()

    expect(checkSpy).toHaveBeenCalledTimes(1)
    expect(checkSpy).toHaveBeenCalledWith({ source: 'manual', force: true })
    expect(api.checkForDesktopUpdate).toHaveBeenCalledTimes(1)
    expect(api.installDesktopUpdate).not.toHaveBeenCalled()
    expect(api.downloadDesktopUpdate).not.toHaveBeenCalled()
  })

  it('calls checkForUpdates and never downloads when errorCode is version_sync', async () => {
    const api = createMockDesktopApi()
    installMockDesktopApi(api)

    const { store, wrapper } = await mountErrorDialog('version_sync')
    const checkSpy = vi.spyOn(store, 'checkForUpdates')
    const downloadSpy = vi.spyOn(store, 'downloadUpdate')

    await wrapper.find('.update-dialog-primary').trigger('click')
    await flushPromises()

    expect(checkSpy).toHaveBeenCalledTimes(1)
    expect(checkSpy).toHaveBeenCalledWith({ source: 'manual', force: true })
    expect(api.checkForDesktopUpdate).toHaveBeenCalledTimes(1)
    expect(downloadSpy).not.toHaveBeenCalled()
    expect(api.downloadDesktopUpdate).not.toHaveBeenCalled()
    expect(api.installDesktopUpdate).not.toHaveBeenCalled()
  })
})
