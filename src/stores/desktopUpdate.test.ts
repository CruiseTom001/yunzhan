import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { ApiError } from '@/utils/apiClient'
import {
  DESKTOP_UPDATE_CHECK_INTERVAL_MS,
  DESKTOP_UPDATE_STARTUP_DELAY_MS,
} from '@/utils/desktopUpdateCheck'

vi.mock('@/utils/desktopVersionApi', () => ({
  getDesktopLatestVersion: vi.fn(),
}))

const blocksDesktopUpdateDialog = ref(false)

vi.mock('@/stores/onboarding', () => ({
  useOnboardingStore: () => ({
    get blocksDesktopUpdateDialog() {
      return blocksDesktopUpdateDialog.value
    },
  }),
}))

import { getDesktopLatestVersion } from '@/utils/desktopVersionApi'
import { useDesktopUpdateStore } from '@/stores/desktopUpdate'

const mockedGetLatest = vi.mocked(getDesktopLatestVersion)

const documentListeners = new Map<string, Set<EventListener>>()
let electronInvoke: ReturnType<typeof vi.fn>

function mockDesktopApi(version = '1.2.5') {
  electronInvoke = vi.fn(async (channel: string) => {
    if (channel === 'app:getVersion') return version
    if (channel === 'app:openExternal') return { ok: true }
    return null
  })
  vi.stubGlobal('window', {
    electronAPI: {
      invoke: electronInvoke,
    },
    open: vi.fn(),
  })
  vi.stubGlobal('document', {
    visibilityState: 'visible',
    addEventListener: (type: string, listener: EventListener) => {
      const bucket = documentListeners.get(type) ?? new Set<EventListener>()
      bucket.add(listener)
      documentListeners.set(type, bucket)
    },
    removeEventListener: (type: string, listener: EventListener) => {
      documentListeners.get(type)?.delete(listener)
    },
  })
}

function clearDesktopApi() {
  vi.stubGlobal('window', {})
  documentListeners.clear()
}

const VALID_REMOTE = {
  version: '1.3.0',
  minSupported: '1.2.0',
  downloadUrl: 'https://github.com/CruiseTom001/yunzhan/releases/download/v1.3.0/setup.exe',
  releaseNotes: '新功能',
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  vi.useRealTimers()
  blocksDesktopUpdateDialog.value = false
  documentListeners.clear()
  mockDesktopApi('1.2.5')
})

afterEach(() => {
  const store = useDesktopUpdateStore()
  store.dispose()
  clearDesktopApi()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('desktopUpdate store', () => {
  it('does not check updates on web runtime', async () => {
    clearDesktopApi()
    vi.stubGlobal('window', {})
    vi.stubGlobal('document', {
      visibilityState: 'visible',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })

    const store = useDesktopUpdateStore()
    store.initialize()
    await store.checkForUpdates({ source: 'startup', force: true })
    expect(mockedGetLatest).not.toHaveBeenCalled()
    store.dispose()
  })

  it('checks once on startup and respects 6h throttle', async () => {
    mockedGetLatest.mockResolvedValue({
      version: '1.2.5',
      minSupported: '1.2.0',
      downloadUrl: 'https://github.com/CruiseTom001/yunzhan/releases/download/v1.2.5/setup.exe',
      releaseNotes: '',
    })

    const store = useDesktopUpdateStore()
    await store.checkForUpdates({ source: 'startup' })
    expect(mockedGetLatest).toHaveBeenCalledTimes(1)
    expect(store.status).toBe('upToDate')

    await store.checkForUpdates({ source: 'periodic' })
    expect(mockedGetLatest).toHaveBeenCalledTimes(1)

    store.lastCheckedAt = Date.now() - DESKTOP_UPDATE_CHECK_INTERVAL_MS - 1000
    await store.checkForUpdates({ source: 'periodic' })
    expect(mockedGetLatest).toHaveBeenCalledTimes(2)
  })

  it('manual check bypasses throttle', async () => {
    mockedGetLatest.mockResolvedValue({
      version: '1.2.5',
      minSupported: '1.2.0',
      downloadUrl: 'https://github.com/CruiseTom001/yunzhan/releases/download/v1.2.5/setup.exe',
      releaseNotes: '',
    })

    const store = useDesktopUpdateStore()
    await store.checkForUpdates({ source: 'startup' })
    await store.checkForUpdates({ source: 'manual', force: true })
    expect(mockedGetLatest).toHaveBeenCalledTimes(2)
  })

  it('deduplicates concurrent checks into one promise', async () => {
    let resolveRemote: ((value: typeof VALID_REMOTE) => void) | null = null
    mockedGetLatest.mockImplementation(() => new Promise((resolve) => {
      resolveRemote = resolve
    }))

    const store = useDesktopUpdateStore()
    store.localVersion = '1.2.5'
    const first = store.checkForUpdates({ source: 'manual', force: true })
    const second = store.checkForUpdates({ source: 'manual', force: true })
    await Promise.resolve()
    expect(mockedGetLatest).toHaveBeenCalledTimes(1)

    resolveRemote?.(VALID_REMOTE)
    await Promise.all([first, second])
    expect(store.status).toBe('updateAvailable')
  })

  it('shows up to date when local equals remote', async () => {
    mockedGetLatest.mockResolvedValue({
      version: '1.2.5',
      minSupported: '1.2.0',
      downloadUrl: 'https://github.com/CruiseTom001/yunzhan/releases/download/v1.2.5/setup.exe',
      releaseNotes: '',
    })

    const store = useDesktopUpdateStore()
    store.localVersion = '1.2.5'
    await store.checkForUpdates({ source: 'manual', force: true })
    expect(store.status).toBe('upToDate')
    expect(store.dialogVisible).toBe(false)
  })

  it('does not prompt downgrade when local is newer than remote', async () => {
    mockedGetLatest.mockResolvedValue({
      version: '1.2.0',
      minSupported: '1.1.0',
      downloadUrl: 'https://github.com/CruiseTom001/yunzhan/releases/download/v1.2.0/setup.exe',
      releaseNotes: '',
    })

    const store = useDesktopUpdateStore()
    store.localVersion = '1.2.5'
    await store.checkForUpdates({ source: 'manual', force: true })
    expect(store.status).toBe('upToDate')
  })

  it('opens dialog on manual check when update available', async () => {
    mockedGetLatest.mockResolvedValue(VALID_REMOTE)
    const store = useDesktopUpdateStore()
    store.localVersion = '1.2.5'
    await store.checkForUpdates({ source: 'manual', force: true })
    expect(store.status).toBe('updateAvailable')
    expect(store.shouldRenderDialog).toBe(true)
    expect(store.noticeMode).toBe('optional')
  })

  it('marks required update state for account page', async () => {
    mockedGetLatest.mockResolvedValue({
      ...VALID_REMOTE,
      minSupported: '1.3.0',
    })
    const store = useDesktopUpdateStore()
    store.localVersion = '1.2.5'
    await store.checkForUpdates({ source: 'manual', force: true })
    expect(store.noticeMode).toBe('required')
    expect(store.accountStatusLabel).toContain('需要更新')
  })

  it('surfaces readable error on network failure', async () => {
    mockedGetLatest.mockRejectedValue(new ApiError('网络错误', 0, null))
    const store = useDesktopUpdateStore()
    store.localVersion = '1.2.5'
    await store.checkForUpdates({ source: 'manual', force: true })
    expect(store.status).toBe('error')
    expect(store.errorMessage).toContain('网络')
  })

  it('rejects invalid download URLs from server payload', async () => {
    mockedGetLatest.mockResolvedValue({
      version: '1.3.0',
      minSupported: '1.2.0',
      downloadUrl: 'https://example.com/setup.exe',
      releaseNotes: '',
    })
    const store = useDesktopUpdateStore()
    store.localVersion = '1.2.5'
    await store.checkForUpdates({ source: 'manual', force: true })
    expect(store.status).toBe('error')
    expect(store.errorMessage).toContain('版本信息')
    expect(store.errorMessage).not.toContain('网络')
  })

  it('cleans up listeners on dispose', () => {
    const store = useDesktopUpdateStore()
    store.initialize()
    expect(documentListeners.get('visibilitychange')?.size).toBe(1)
    store.dispose()
    expect(documentListeners.get('visibilitychange')?.size ?? 0).toBe(0)
  })
})

describe('desktopUpdate timers', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('runs startup check after 3 seconds', async () => {
    mockedGetLatest.mockResolvedValue({
      version: '1.2.5',
      minSupported: '1.2.0',
      downloadUrl: 'https://github.com/CruiseTom001/yunzhan/releases/download/v1.2.5/setup.exe',
      releaseNotes: '',
    })

    const store = useDesktopUpdateStore()
    store.initialize()

    await vi.advanceTimersByTimeAsync(DESKTOP_UPDATE_STARTUP_DELAY_MS - 1)
    expect(mockedGetLatest).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    await Promise.resolve()
    expect(mockedGetLatest).toHaveBeenCalledTimes(1)
  })

  it('schedules periodic check about 6 hours after the last check', async () => {
    mockedGetLatest.mockResolvedValue({
      version: '1.2.5',
      minSupported: '1.2.0',
      downloadUrl: 'https://github.com/CruiseTom001/yunzhan/releases/download/v1.2.5/setup.exe',
      releaseNotes: '',
    })

    const store = useDesktopUpdateStore()
    store.initialize()
    await vi.advanceTimersByTimeAsync(DESKTOP_UPDATE_STARTUP_DELAY_MS)
    await Promise.resolve()
    expect(mockedGetLatest).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(DESKTOP_UPDATE_CHECK_INTERVAL_MS - 1)
    expect(mockedGetLatest).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1)
    await Promise.resolve()
    expect(mockedGetLatest).toHaveBeenCalledTimes(2)
  })

  it('clears startup and periodic timers on dispose', async () => {
    mockedGetLatest.mockResolvedValue({
      version: '1.2.5',
      minSupported: '1.2.0',
      downloadUrl: 'https://github.com/CruiseTom001/yunzhan/releases/download/v1.2.5/setup.exe',
      releaseNotes: '',
    })

    const store = useDesktopUpdateStore()
    store.initialize()
    store.dispose()

    await vi.advanceTimersByTimeAsync(DESKTOP_UPDATE_STARTUP_DELAY_MS + DESKTOP_UPDATE_CHECK_INTERVAL_MS)
    await Promise.resolve()
    expect(mockedGetLatest).not.toHaveBeenCalled()
  })
})

describe('desktopUpdate onboarding interaction', () => {
  it('keeps update state but hides dialog while onboarding blocks it', async () => {
    mockedGetLatest.mockResolvedValue(VALID_REMOTE)
    blocksDesktopUpdateDialog.value = true

    const store = useDesktopUpdateStore()
    store.localVersion = '1.2.5'
    await store.checkForUpdates({ source: 'manual', force: true })

    expect(store.status).toBe('updateAvailable')
    expect(store.dialogPending).toBe(true)
    expect(store.shouldRenderDialog).toBe(false)

    blocksDesktopUpdateDialog.value = false
    await Promise.resolve()
    expect(store.shouldRenderDialog).toBe(true)
  })
})

describe('desktopUpdate openDownload', () => {
  it('does not open downloads on web runtime', async () => {
    clearDesktopApi()
    vi.stubGlobal('window', { open: vi.fn() })

    const store = useDesktopUpdateStore()
    store.downloadUrl = VALID_REMOTE.downloadUrl
    await store.openDownload()

    expect(window.open).not.toHaveBeenCalled()
    expect(store.downloadErrorMessage).toBe('')
  })

  it('surfaces invalid download url without calling ipc', async () => {
    const store = useDesktopUpdateStore()
    store.downloadUrl = 'https://example.com/setup.exe'
    await store.openDownload()

    expect(electronInvoke).not.toHaveBeenCalled()
    expect(store.downloadErrorMessage).toContain('版本信息')
    expect(window.open).not.toHaveBeenCalled()
  })

  it('surfaces ipc failure without falling back to window.open', async () => {
    electronInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'app:openExternal') throw new Error('ipc failed')
      return null
    })

    const store = useDesktopUpdateStore()
    store.downloadUrl = VALID_REMOTE.downloadUrl
    await store.openDownload()

    expect(store.downloadErrorMessage).toContain('无法打开下载链接')
    expect(window.open).not.toHaveBeenCalled()
  })

  it('surfaces ipc ok:false without falling back to window.open', async () => {
    electronInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'app:openExternal') return { ok: false }
      return null
    })

    const store = useDesktopUpdateStore()
    store.downloadUrl = VALID_REMOTE.downloadUrl
    await store.openDownload()

    expect(store.downloadErrorMessage).toContain('无法打开下载链接')
    expect(window.open).not.toHaveBeenCalled()
  })

  it('clears download error when starting a new check', async () => {
    electronInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'app:openExternal') return { ok: false }
      return null
    })

    const store = useDesktopUpdateStore()
    store.localVersion = '1.2.5'
    store.downloadUrl = VALID_REMOTE.downloadUrl
    await store.openDownload()
    expect(store.downloadErrorMessage).toContain('无法打开下载链接')

    mockedGetLatest.mockResolvedValue({
      version: '1.2.5',
      minSupported: '1.2.0',
      downloadUrl: VALID_REMOTE.downloadUrl,
      releaseNotes: '',
    })
    await store.checkForUpdates({ source: 'manual', force: true })
    expect(store.downloadErrorMessage).toBe('')
  })

  it('clears download error when dismissing or closing update notice', async () => {
    mockedGetLatest.mockResolvedValue(VALID_REMOTE)
    const store = useDesktopUpdateStore()
    store.localVersion = '1.2.5'
    await store.checkForUpdates({ source: 'manual', force: true })

    electronInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'app:openExternal') return { ok: false }
      return null
    })
    await store.openDownload()
    expect(store.downloadErrorMessage).not.toBe('')

    store.dismissNotice()
    expect(store.downloadErrorMessage).toBe('')

    mockedGetLatest.mockResolvedValue({
      ...VALID_REMOTE,
      minSupported: '1.3.0',
    })
    await store.checkForUpdates({ source: 'manual', force: true })
    await store.openDownload()
    store.closeDialog()
    expect(store.downloadErrorMessage).toBe('')
  })
})
