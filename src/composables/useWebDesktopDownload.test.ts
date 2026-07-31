// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useWebDesktopDownload } from '@/composables/useWebDesktopDownload'
import {
  DESKTOP_DOWNLOAD_UNAVAILABLE_MESSAGE,
  shouldShowWebDesktopDownloadEntry,
} from '@/utils/desktopDownloadUrl'

vi.mock('@/utils/desktopVersionApi', () => ({
  getDesktopLatestVersion: vi.fn(),
}))

import { getDesktopLatestVersion } from '@/utils/desktopVersionApi'

const mockedGetLatest = vi.mocked(getDesktopLatestVersion)
const VALID_URL = 'https://github.com/CruiseTom001/yunzhan/releases/download/v1.2.11/yunzhan-setup-1.2.11.exe'

function stubWebWindow(extras: Record<string, unknown> = {}) {
  vi.stubGlobal('window', {
    open: vi.fn(() => null),
    ...extras,
  })
}

function stubElectronWindow() {
  vi.stubGlobal('window', {
    open: vi.fn(() => null),
    electronAPI: { invoke: vi.fn() },
  })
}

describe('useWebDesktopDownload', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    stubWebWindow()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows entry for web guests and keeps download independent of auth state', async () => {
    mockedGetLatest.mockResolvedValue({
      version: '1.2.11',
      minSupported: '1.2.5',
      downloadUrl: VALID_URL,
      releaseNotes: '',
    })

    const guest = useWebDesktopDownload()
    expect(shouldShowWebDesktopDownloadEntry(false)).toBe(true)
    expect(guest.showEntry.value).toBe(true)

    await guest.loadDownloadUrl()
    const openSpy = vi.mocked(window.open)
    const result = await guest.downloadDesktop()

    expect(result).toEqual({ ok: true })
    expect(openSpy).toHaveBeenCalledWith(VALID_URL, '_blank', 'noopener')
    expect(guest.errorMessage.value).toBe('')
  })

  it('keeps the entry for logged-in web users and does not clear session markers', async () => {
    localStorage.setItem('yunzhan:session-marker', 'keep-me')
    mockedGetLatest.mockResolvedValue({
      version: '1.2.11',
      minSupported: '1.2.5',
      downloadUrl: VALID_URL,
      releaseNotes: '',
    })

    const loggedIn = useWebDesktopDownload()
    expect(loggedIn.showEntry.value).toBe(true)
    await loggedIn.downloadDesktop()

    expect(window.open).toHaveBeenCalledWith(VALID_URL, '_blank', 'noopener')
    expect(localStorage.getItem('yunzhan:session-marker')).toBe('keep-me')
    localStorage.removeItem('yunzhan:session-marker')
  })

  it('hides the entry on Electron and never opens a download URL', async () => {
    stubElectronWindow()
    mockedGetLatest.mockResolvedValue({
      version: '1.2.11',
      minSupported: '1.2.5',
      downloadUrl: VALID_URL,
      releaseNotes: '',
    })

    const desktop = useWebDesktopDownload()
    expect(shouldShowWebDesktopDownloadEntry(true)).toBe(false)
    expect(desktop.showEntry.value).toBe(false)

    await desktop.loadDownloadUrl()
    const result = await desktop.downloadDesktop()

    expect(mockedGetLatest).not.toHaveBeenCalled()
    expect(window.open).not.toHaveBeenCalled()
    expect(result.ok).toBe(false)
    expect(desktop.errorMessage.value).toBe(DESKTOP_DOWNLOAD_UNAVAILABLE_MESSAGE)
  })

  it('shows a clear error and does not open a blank page when no desktop version is available', async () => {
    mockedGetLatest.mockResolvedValue({
      version: null,
      minSupported: null,
      downloadUrl: null,
      releaseNotes: null,
    })

    const download = useWebDesktopDownload()
    const result = await download.downloadDesktop()

    expect(result).toEqual({
      ok: false,
      errorMessage: DESKTOP_DOWNLOAD_UNAVAILABLE_MESSAGE,
    })
    expect(download.errorMessage.value).toBe(DESKTOP_DOWNLOAD_UNAVAILABLE_MESSAGE)
    expect(window.open).not.toHaveBeenCalled()
  })

  it('rejects non-whitelist URLs without navigating away', async () => {
    mockedGetLatest.mockResolvedValue({
      version: '1.2.11',
      minSupported: '1.2.5',
      downloadUrl: 'https://example.com/setup.exe',
      releaseNotes: '',
    })

    const download = useWebDesktopDownload()
    const result = await download.downloadDesktop()

    expect(result.ok).toBe(false)
    expect(window.open).not.toHaveBeenCalled()
    expect(download.errorMessage.value).toBe(DESKTOP_DOWNLOAD_UNAVAILABLE_MESSAGE)
  })
})
