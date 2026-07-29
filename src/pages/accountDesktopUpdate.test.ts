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
  downloadUrl: 'https://github.com/CruiseTom001/yunzhan/releases/download/v1.3.0/setup.exe',
  releaseNotes: '新功能',
}

let electronInvoke: ReturnType<typeof vi.fn>

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  electronInvoke = vi.fn(async (channel: string) => {
    if (channel === 'app:getVersion') return '1.2.5'
    if (channel === 'app:openExternal') return { ok: true }
    return null
  })
  vi.stubGlobal('window', {
    electronAPI: { invoke: electronInvoke },
    open: vi.fn(),
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
    electronInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'app:openExternal') return { ok: false }
      return null
    })

    const store = useDesktopUpdateStore()
    store.localVersion = '1.2.5'
    mockedGetLatest.mockResolvedValue(VALID_REMOTE)
    await store.checkForUpdates({ source: 'manual', force: true })
    await store.openDownload()

    expect(store.downloadErrorMessage).toBe('无法打开下载链接，请稍后再试。')
  })
})
