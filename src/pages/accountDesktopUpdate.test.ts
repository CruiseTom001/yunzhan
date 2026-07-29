import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useDesktopUpdateStore } from '@/stores/desktopUpdate'

vi.mock('@/utils/desktopVersionApi', () => ({
  getDesktopLatestVersion: vi.fn(),
}))

vi.mock('@/stores/onboarding', () => ({
  useOnboardingStore: () => ({
    get blocksDesktopUpdateDialog() {
      return false
    },
  }),
}))

import { getDesktopLatestVersion } from '@/utils/desktopVersionApi'

const mockedGetLatest = vi.mocked(getDesktopLatestVersion)

const VALID_REMOTE = {
  version: '1.3.0',
  minSupported: '1.2.0',
  downloadUrl: 'https://github.com/CruiseTom001/yunzhan/releases/download/v1.3.0/yunzhan-setup-1.3.0.exe',
  releaseNotes: '新功能',
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  vi.stubGlobal('window', {
    electronAPI: {
      invoke: vi.fn(async (channel: string) => (channel === 'app:getVersion' ? '1.2.5' : null)),
      getUpdaterState: vi.fn(async () => ({
        status: 'available',
        version: '1.3.0',
        percent: null,
        transferred: null,
        total: null,
        bytesPerSecond: null,
        errorCode: null,
        errorMessage: null,
      })),
      checkForDesktopUpdate: vi.fn(async () => ({
        status: 'available',
        version: '1.3.0',
        percent: null,
        transferred: null,
        total: null,
        bytesPerSecond: null,
        errorCode: null,
        errorMessage: null,
      })),
      downloadDesktopUpdate: vi.fn(async () => ({
        status: 'error',
        version: '1.3.0',
        percent: null,
        transferred: null,
        total: null,
        bytesPerSecond: null,
        errorCode: 'download_failed',
        errorMessage: '下载失败，请稍后重试。',
      })),
      installDesktopUpdate: vi.fn(),
      onDesktopUpdaterStateChanged: vi.fn(() => () => {}),
    },
  })
  vi.stubGlobal('document', {
    visibilityState: 'visible',
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })
})

afterEach(() => {
  useDesktopUpdateStore().dispose()
  vi.unstubAllGlobals()
})

describe('account desktop update download failure', () => {
  it('exposes download failure message for account page alert rendering', async () => {
    const store = useDesktopUpdateStore()
    store.localVersion = '1.2.5'
    mockedGetLatest.mockResolvedValue(VALID_REMOTE)
    await store.checkForUpdates({ source: 'manual', force: true })
    await store.downloadUpdate()

    expect(store.status).toBe('error')
    expect(store.displayErrorMessage).toBe('下载失败，请稍后重试。')
  })
})
