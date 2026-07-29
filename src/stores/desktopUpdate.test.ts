import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { ApiError } from '@/utils/apiClient'
import {
  DESKTOP_UPDATE_CHECK_INTERVAL_MS,
  DESKTOP_UPDATE_STARTUP_DELAY_MS,
} from '@/utils/desktopUpdateCheck'
import { VERSION_SYNC_ERROR_MESSAGE } from '@/utils/desktopUpdaterTypes'
import type { DesktopUpdaterPublicState } from '@/utils/desktopUpdaterTypes'

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

const VALID_REMOTE = {
  version: '1.3.0',
  minSupported: '1.2.0',
  downloadUrl: 'https://github.com/CruiseTom001/yunzhan/releases/download/v1.3.0/yunzhan-setup-1.3.0.exe',
  releaseNotes: '新功能',
}

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

let updaterState = createUpdaterState('idle')
let stateListeners: Array<(state: DesktopUpdaterPublicState) => void> = []
let electronInvoke: ReturnType<typeof vi.fn>
let unsubscribeUpdater: ReturnType<typeof vi.fn>

function emitUpdaterState(state: DesktopUpdaterPublicState) {
  updaterState = state
  stateListeners.forEach((listener) => listener(state))
}

function mockDesktopApi(version = '1.2.5') {
  updaterState = createUpdaterState('idle')
  stateListeners = []

  electronInvoke = vi.fn(async (channel: string) => {
    if (channel === 'app:getVersion') return version
    return null
  })

  unsubscribeUpdater = vi.fn()

  const api = {
    invoke: electronInvoke,
    getUpdaterState: vi.fn(async () => updaterState),
    checkForDesktopUpdate: vi.fn(async () => {
      emitUpdaterState(createUpdaterState('checking'))
      emitUpdaterState(createUpdaterState('available', { version: VALID_REMOTE.version }))
      return updaterState
    }),
    downloadDesktopUpdate: vi.fn(async () => {
      emitUpdaterState(createUpdaterState('downloading', {
        version: VALID_REMOTE.version,
        percent: 50,
        transferred: 500,
        total: 1000,
        bytesPerSecond: 100,
      }))
      emitUpdaterState(createUpdaterState('downloaded', { version: VALID_REMOTE.version, percent: 100 }))
      return updaterState
    }),
    installDesktopUpdate: vi.fn(async () => {
      emitUpdaterState(createUpdaterState('installing', { version: VALID_REMOTE.version }))
      return updaterState
    }),
    onDesktopUpdaterStateChanged: vi.fn((listener: (state: DesktopUpdaterPublicState) => void) => {
      stateListeners.push(listener)
      return () => {
        stateListeners = stateListeners.filter((item) => item !== listener)
        unsubscribeUpdater()
      }
    }),
  }

  vi.stubGlobal('window', {
    electronAPI: api,
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
      downloadUrl: 'https://github.com/CruiseTom001/yunzhan/releases/download/v1.2.5/yunzhan-setup-1.2.5.exe',
      releaseNotes: '',
    })

    window.electronAPI!.checkForDesktopUpdate = vi.fn(async () => {
      emitUpdaterState(createUpdaterState('upToDate'))
      return updaterState
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
      downloadUrl: 'https://github.com/CruiseTom001/yunzhan/releases/download/v1.2.5/yunzhan-setup-1.2.5.exe',
      releaseNotes: '',
    })
    window.electronAPI!.checkForDesktopUpdate = vi.fn(async () => {
      emitUpdaterState(createUpdaterState('upToDate'))
      return updaterState
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
    expect(store.status).toBe('available')
  })

  it('shows up to date when local equals remote', async () => {
    mockedGetLatest.mockResolvedValue({
      version: '1.2.5',
      minSupported: '1.2.0',
      downloadUrl: 'https://github.com/CruiseTom001/yunzhan/releases/download/v1.2.5/yunzhan-setup-1.2.5.exe',
      releaseNotes: '',
    })
    window.electronAPI!.checkForDesktopUpdate = vi.fn(async () => {
      emitUpdaterState(createUpdaterState('upToDate'))
      return updaterState
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
      downloadUrl: 'https://github.com/CruiseTom001/yunzhan/releases/download/v1.2.0/yunzhan-setup-1.2.0.exe',
      releaseNotes: '',
    })
    window.electronAPI!.checkForDesktopUpdate = vi.fn(async () => {
      emitUpdaterState(createUpdaterState('upToDate'))
      return updaterState
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
    expect(store.status).toBe('available')
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

  it('stops when server version and updater version mismatch', async () => {
    mockedGetLatest.mockResolvedValue(VALID_REMOTE)
    window.electronAPI!.checkForDesktopUpdate = vi.fn(async () => {
      emitUpdaterState(createUpdaterState('available', { version: '1.4.0' }))
      return updaterState
    })

    const store = useDesktopUpdateStore()
    store.localVersion = '1.2.5'
    await store.checkForUpdates({ source: 'manual', force: true })
    expect(store.status).toBe('error')
    expect(store.updaterState.errorCode).toBe('version_sync')
    expect(store.errorMessage).toBe(VERSION_SYNC_ERROR_MESSAGE)
    expect(store.hasUpdate).toBe(false)
    expect(store.canDownload).toBe(false)
    expect(store.dialogVisible).toBe(false)
  })

  it('enters version_sync when server has no update but GitHub reports available', async () => {
    mockedGetLatest.mockResolvedValue({
      version: '1.2.5',
      minSupported: '1.2.0',
      downloadUrl: 'https://github.com/CruiseTom001/yunzhan/releases/download/v1.2.5/yunzhan-setup-1.2.5.exe',
      releaseNotes: '',
    })
    window.electronAPI!.checkForDesktopUpdate = vi.fn(async () => {
      emitUpdaterState(createUpdaterState('available', { version: '1.3.0' }))
      return updaterState
    })

    const store = useDesktopUpdateStore()
    store.localVersion = '1.2.5'
    await store.checkForUpdates({ source: 'manual', force: true })
    expect(store.status).toBe('error')
    expect(store.updaterState.errorCode).toBe('version_sync')
    expect(store.hasUpdate).toBe(false)
    expect(store.remoteVersion).toBeNull()
  })

  it('enters version_sync when server has update but GitHub reports upToDate', async () => {
    mockedGetLatest.mockResolvedValue(VALID_REMOTE)
    window.electronAPI!.checkForDesktopUpdate = vi.fn(async () => {
      emitUpdaterState(createUpdaterState('upToDate'))
      return updaterState
    })

    const store = useDesktopUpdateStore()
    store.localVersion = '1.2.5'
    await store.checkForUpdates({ source: 'manual', force: true })
    expect(store.status).toBe('error')
    expect(store.updaterState.errorCode).toBe('version_sync')
    expect(store.accountStatusLabel).not.toContain('当前已是最新版本')
    expect(store.hasUpdate).toBe(false)
  })

  it('allows available only when server and GitHub versions match', async () => {
    mockedGetLatest.mockResolvedValue(VALID_REMOTE)
    const store = useDesktopUpdateStore()
    store.localVersion = '1.2.5'
    await store.checkForUpdates({ source: 'manual', force: true })
    expect(store.status).toBe('available')
    expect(store.remoteVersion).toBe('1.3.0')
    expect(store.hasUpdate).toBe(true)
  })

  it('cleans up listeners on dispose', () => {
    const store = useDesktopUpdateStore()
    store.initialize()
    expect(documentListeners.get('visibilitychange')?.size).toBe(1)
    store.dispose()
    expect(documentListeners.get('visibilitychange')?.size ?? 0).toBe(0)
    expect(unsubscribeUpdater).toHaveBeenCalled()
  })
})

describe('desktopUpdate timers', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockedGetLatest.mockResolvedValue({
      version: '1.2.5',
      minSupported: '1.2.0',
      downloadUrl: 'https://github.com/CruiseTom001/yunzhan/releases/download/v1.2.5/yunzhan-setup-1.2.5.exe',
      releaseNotes: '',
    })
    window.electronAPI!.checkForDesktopUpdate = vi.fn(async () => {
      emitUpdaterState(createUpdaterState('upToDate'))
      return updaterState
    })
  })

  it('runs startup check after 3 seconds', async () => {
    const store = useDesktopUpdateStore()
    store.initialize()

    await vi.advanceTimersByTimeAsync(DESKTOP_UPDATE_STARTUP_DELAY_MS - 1)
    expect(mockedGetLatest).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    await Promise.resolve()
    expect(mockedGetLatest).toHaveBeenCalledTimes(1)
  })

  it('schedules periodic check about 6 hours after the last check', async () => {
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

    expect(store.status).toBe('available')
    expect(store.dialogPending).toBe(true)
    expect(store.shouldRenderDialog).toBe(false)

    blocksDesktopUpdateDialog.value = false
    await Promise.resolve()
    expect(store.shouldRenderDialog).toBe(true)
  })
})

describe('desktopUpdate download and install flow', () => {
  beforeEach(() => {
    mockedGetLatest.mockResolvedValue(VALID_REMOTE)
  })

  it('transitions available -> downloading -> downloaded via updater IPC', async () => {
    const store = useDesktopUpdateStore()
    store.localVersion = '1.2.5'
    await store.checkForUpdates({ source: 'manual', force: true })
    expect(store.status).toBe('available')

    await store.downloadUpdate()
    expect(store.status).toBe('downloaded')
    expect(store.updaterState.percent).toBe(100)

    await store.installUpdate()
    expect(store.status).toBe('installing')
  })

  it('prevents duplicate download clicks while busy', async () => {
    const store = useDesktopUpdateStore()
    store.localVersion = '1.2.5'
    await store.checkForUpdates({ source: 'manual', force: true })

    window.electronAPI!.downloadDesktopUpdate = vi.fn(async () => {
      emitUpdaterState(createUpdaterState('downloading', { percent: 10 }))
      await new Promise((resolve) => setTimeout(resolve, 20))
      emitUpdaterState(createUpdaterState('downloaded', { percent: 100 }))
      return updaterState
    })

    const first = store.downloadUpdate()
    const second = store.downloadUpdate()
    await Promise.all([first, second])
    expect(window.electronAPI!.downloadDesktopUpdate).toHaveBeenCalledTimes(1)
  })

  it('only allows install in downloaded state', async () => {
    const store = useDesktopUpdateStore()
    store.localVersion = '1.2.5'
    await store.checkForUpdates({ source: 'manual', force: true })
    await store.installUpdate()
    expect(window.electronAPI!.installDesktopUpdate).not.toHaveBeenCalled()

    await store.downloadUpdate()
    await store.installUpdate()
    expect(window.electronAPI!.installDesktopUpdate).toHaveBeenCalledTimes(1)
  })

  it('allows retry after error', async () => {
    const store = useDesktopUpdateStore()
    store.localVersion = '1.2.5'
    await store.checkForUpdates({ source: 'manual', force: true })

    window.electronAPI!.downloadDesktopUpdate = vi.fn(async () => {
      emitUpdaterState(createUpdaterState('error', {
        errorCode: 'download_failed',
        errorMessage: '下载失败，请稍后重试。',
      }))
      return updaterState
    })
    await store.downloadUpdate()
    expect(store.status).toBe('error')

    window.electronAPI!.downloadDesktopUpdate = vi.fn(async () => {
      emitUpdaterState(createUpdaterState('downloaded', { percent: 100 }))
      return updaterState
    })
    await store.downloadUpdate()
    expect(store.status).toBe('downloaded')
  })

  it('allows closing optional dialog while downloading without cancelling download', async () => {
    const store = useDesktopUpdateStore()
    store.localVersion = '1.2.5'
    await store.checkForUpdates({ source: 'manual', force: true })
    store.applyUpdaterState(createUpdaterState('downloading', {
      version: VALID_REMOTE.version,
      percent: 20,
    }))
    store.syncDialogVisibility()

    store.dismissNotice()
    expect(store.dialogVisible).toBe(false)
    expect(store.status).toBe('downloading')
  })

  it('blocks closing required dialog while downloading', async () => {
    mockedGetLatest.mockResolvedValue({
      ...VALID_REMOTE,
      minSupported: '1.3.0',
    })
    const store = useDesktopUpdateStore()
    store.localVersion = '1.2.5'
    await store.checkForUpdates({ source: 'manual', force: true })
    store.applyUpdaterState(createUpdaterState('downloading', {
      version: VALID_REMOTE.version,
      percent: 20,
    }))
    store.syncDialogVisibility()

    store.closeDialog()
    expect(store.dialogVisible).toBe(true)
  })

  it('still applies downloaded state after optional dialog was closed during download', async () => {
    const store = useDesktopUpdateStore()
    store.initialize()
    store.localVersion = '1.2.5'
    await store.checkForUpdates({ source: 'manual', force: true })
    store.applyUpdaterState(createUpdaterState('downloading', { percent: 50 }))
    store.dismissNotice()

    store.applyUpdaterState(createUpdaterState('downloaded', {
      version: VALID_REMOTE.version,
      percent: 100,
    }))
    expect(store.status).toBe('downloaded')
    expect(store.hasUpdate).toBe(true)
    store.dispose()
  })
})
