import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveLandingDesktopDownloadUrl } from '@/utils/desktopDownloadUrl'

vi.mock('@/utils/desktopVersionApi', () => ({
  getDesktopLatestVersion: vi.fn(),
}))

import { getDesktopLatestVersion } from '@/utils/desktopVersionApi'

const mockedGetLatest = vi.mocked(getDesktopLatestVersion)

const VALID_URL = 'https://github.com/CruiseTom001/yunzhan/releases/download/v1.2.5/setup.exe'

async function loadLandingDesktopDownloadUrl(): Promise<string | null> {
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

    await expect(loadLandingDesktopDownloadUrl()).resolves.toBeNull()
  })

  it('does not save non-whitelist domains', async () => {
    mockedGetLatest.mockResolvedValue({
      version: '1.2.5',
      minSupported: '1.2.0',
      downloadUrl: 'https://example.com/setup.exe',
      releaseNotes: '',
    })

    await expect(loadLandingDesktopDownloadUrl()).resolves.toBeNull()
  })

  it('saves whitelisted HTTPS GitHub download urls', async () => {
    mockedGetLatest.mockResolvedValue({
      version: '1.2.5',
      minSupported: '1.2.0',
      downloadUrl: VALID_URL,
      releaseNotes: '',
    })

    await expect(loadLandingDesktopDownloadUrl()).resolves.toBe(VALID_URL)
  })
})
