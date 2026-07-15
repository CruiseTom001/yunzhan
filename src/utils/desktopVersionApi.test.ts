import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/utils/apiClient', () => ({
  ApiError: class ApiError extends Error {
    constructor(message: string, public readonly status: number, public readonly payload: unknown) {
      super(message)
    }
  },
  apiRequest: vi.fn(),
}))

import { apiRequest } from '@/utils/apiClient'
import {
  createAdminDesktopRelease,
  deleteAdminDesktopRelease,
  getDesktopLatestVersion,
  listAdminDesktopReleases,
  updateAdminDesktopRelease,
} from './desktopVersionApi'

const mockedApiRequest = vi.mocked(apiRequest)

const VALID_LATEST = {
  version: '1.2.0',
  minSupported: '1.1.0',
  downloadUrl: 'https://x/setup.exe',
  releaseNotes: 'n',
}
const VALID_RECORD = {
  id: 1,
  version: '1.2.0',
  minSupported: '1.1.0',
  downloadUrl: 'https://x/setup.exe',
  releaseNotes: 'n',
  enabled: true,
  createdAt: 1700000000000,
  updatedAt: 1700000000000,
}

function mockResponse(payload: unknown): ReturnType<typeof apiRequest> {
  return Promise.resolve(payload)
}

beforeEach(() => {
  mockedApiRequest.mockReset()
})

describe('desktopVersionApi', () => {
  it('returns null fields when latest version payload reports null', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({ version: null, minSupported: null, downloadUrl: null, releaseNotes: null }))
    const result = await getDesktopLatestVersion()
    expect(result.version).toBeNull()
  })
  it('parses latest version fields', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse(VALID_LATEST))
    const result = await getDesktopLatestVersion()
    expect(result.version).toBe('1.2.0')
    expect(result.minSupported).toBe('1.1.0')
  })
  it('rejects latest with bad version shape', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({ version: 1, minSupported: 'x', downloadUrl: null, releaseNotes: null }))
    await expect(getDesktopLatestVersion()).rejects.toThrow('无效')
  })
  it('parses admin list', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({ releases: [VALID_RECORD], total: 1, limit: 50, offset: 0 }))
    const result = await listAdminDesktopReleases({ limit: 50, offset: 0 })
    expect(result.total).toBe(1)
    expect(result.releases[0].enabled).toBe(true)
  })
  it('rejects admin list with missing releases', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({ total: 0, limit: 50, offset: 0 }))
    await expect(listAdminDesktopReleases()).rejects.toThrow('无效')
  })
  it('creates release from valid response', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({ release: VALID_RECORD }))
    const result = await createAdminDesktopRelease({
      version: '1.2.0', minSupported: '1.1.0', downloadUrl: 'https://x/setup.exe', releaseNotes: 'n', enabled: true,
    })
    expect(result.version).toBe('1.2.0')
  })
  it('rejects create with bad response', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({ release: null }))
    await expect(createAdminDesktopRelease({ version: '1.2.0', minSupported: '1.1.0', downloadUrl: 'https://x' })).rejects.toThrow('无效')
  })
  it('updates via patch', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({ release: { ...VALID_RECORD, releaseNotes: 'new' } }))
    const result = await updateAdminDesktopRelease(1, { releaseNotes: 'new' })
    expect(result.releaseNotes).toBe('new')
    const opts = mockedApiRequest.mock.calls[0]?.[1] as RequestInit
    expect(opts.method).toBe('PATCH')
  })
  it('deletes release', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({ ok: true }))
    await expect(deleteAdminDesktopRelease(1)).resolves.toBeUndefined()
    const opts = mockedApiRequest.mock.calls[0]?.[1] as RequestInit
    expect(opts.method).toBe('DELETE')
  })
  it('rejects delete when ok missing', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({ ok: false }))
    await expect(deleteAdminDesktopRelease(1)).rejects.toThrow('无效')
  })
})
