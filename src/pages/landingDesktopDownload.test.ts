import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveLandingDesktopDownloadUrl } from '@/utils/desktopDownloadUrl'
import { isDesktopRuntime } from '@/stores/desktopUpdate'

vi.mock('@/utils/desktopVersionApi', () => ({
  getDesktopLatestVersion: vi.fn(),
}))

import { getDesktopLatestVersion } from '@/utils/desktopVersionApi'

const mockedGetLatest = vi.mocked(getDesktopLatestVersion)

const VALID_URL = 'https://github.com/CruiseTom001/yunzhan/releases/download/v1.2.5/yunzhan-setup-1.2.5.exe'

async function loadLandingDesktopDownloadUrl(isElectron: boolean): Promise<string | null> {
  if (isElectron) return null
  try {
    const latest = await getDesktopLatestVersion()
    return resolveLandingDesktopDownloadUrl(latest.downloadUrl)
  } catch {
    return null
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('landing desktop download url loading', () => {
  it('does not save HTTP download urls', async () => {
    mockedGetLatest.mockResolvedValue({
      version: '1.2.5',
      minSupported: '1.2.0',
      downloadUrl: 'http://github.com/CruiseTom001/yunzhan/releases/download/v1.2.5/setup.exe',
      releaseNotes: '',
    })

    await expect(loadLandingDesktopDownloadUrl(false)).resolves.toBeNull()
  })

  it('does not save non-whitelist domains', async () => {
    mockedGetLatest.mockResolvedValue({
      version: '1.2.5',
      minSupported: '1.2.0',
      downloadUrl: 'https://example.com/setup.exe',
      releaseNotes: '',
    })

    await expect(loadLandingDesktopDownloadUrl(false)).resolves.toBeNull()
  })

  it('saves whitelisted HTTPS GitHub download urls on web runtime', async () => {
    mockedGetLatest.mockResolvedValue({
      version: '1.2.5',
      minSupported: '1.2.0',
      downloadUrl: VALID_URL,
      releaseNotes: '',
    })

    await expect(loadLandingDesktopDownloadUrl(false)).resolves.toBe(VALID_URL)
  })

  it('does not load download url in electron runtime', async () => {
    vi.stubGlobal('window', {
      electronAPI: {
        invoke: vi.fn(),
      },
    })
    expect(isDesktopRuntime()).toBe(true)
    await expect(loadLandingDesktopDownloadUrl(true)).resolves.toBeNull()
    expect(mockedGetLatest).not.toHaveBeenCalled()
  })

  it('shows download button only on web runtime when url is available', () => {
    vi.stubGlobal('window', { open: vi.fn() })
    expect(isDesktopRuntime()).toBe(false)

    const desktopDownloadUrl = VALID_URL
    const showDesktopDownloadButton = !isDesktopRuntime() && Boolean(desktopDownloadUrl)
    expect(showDesktopDownloadButton).toBe(true)

    vi.stubGlobal('window', {
      electronAPI: { invoke: vi.fn() },
    })
    expect(isDesktopRuntime()).toBe(true)
    expect(!isDesktopRuntime() && Boolean(desktopDownloadUrl)).toBe(false)
  })
})
