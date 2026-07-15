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
  createAdminAnnouncement,
  getLatestUnread,
  listAdminAnnouncements,
  markAnnouncementRead,
  updateAdminAnnouncement,
} from './announcementApi'

const mockedApiRequest = vi.mocked(apiRequest)

const VALID_ANNOUNCEMENT = {
  id: 'a-1',
  title: '系统维护通知',
  content: '我们将在本周日凌晨 2-4 点进行系统维护',
  publishedAt: 1700000000000,
}

const VALID_ADMIN_ANNOUNCEMENT = {
  ...VALID_ANNOUNCEMENT,
  active: true,
  createdAt: 1700000000000,
  updatedAt: 1700000000000,
}

function mockResponse(payload: unknown): ReturnType<typeof apiRequest> {
  return Promise.resolve(payload)
}

beforeEach(() => {
  mockedApiRequest.mockReset()
})

describe('announcementApi type guards', () => {
  it('returns null when no unread announcement', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({ announcement: null }))
    const result = await getLatestUnread()
    expect(result).toBeNull()
  })

  it('returns announcement when unread exists', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({ announcement: VALID_ANNOUNCEMENT }))
    const result = await getLatestUnread()
    expect(result?.id).toBe('a-1')
    expect(result?.title).toBe('系统维护通知')
  })

  it('rejects latest unread with invalid announcement shape', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({ announcement: { id: 12, title: 'x' } }))
    await expect(getLatestUnread()).rejects.toThrow('无效公告数据')
  })

  it('rejects latest unread with non-string title', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({
      announcement: { ...VALID_ANNOUNCEMENT, title: 42 },
    }))
    await expect(getLatestUnread()).rejects.toThrow('无效公告数据')
  })

  it('accepts ok payload for mark read', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({ ok: true }))
    await expect(markAnnouncementRead('a-1')).resolves.toBeUndefined()
  })

  it('rejects mark read when ok missing', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({ ok: false }))
    await expect(markAnnouncementRead('a-1')).rejects.toThrow('无效结果')
  })

  it('parses admin announcement list', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({
      announcements: [VALID_ADMIN_ANNOUNCEMENT, { ...VALID_ADMIN_ANNOUNCEMENT, id: 'a-2', active: false }],
      total: 2, limit: 50, offset: 0,
    }))
    const result = await listAdminAnnouncements({ limit: 50, offset: 0 })
    expect(result.total).toBe(2)
    expect(result.announcements).toHaveLength(2)
    expect(result.announcements[0].active).toBe(true)
    expect(result.announcements[1].active).toBe(false)
  })

  it('rejects admin list without announcements array', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({ total: 0, limit: 50, offset: 0 }))
    await expect(listAdminAnnouncements()).rejects.toThrow('无效公告列表')
  })

  it('rejects admin list with non-boolean active', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({
      announcements: [{ ...VALID_ADMIN_ANNOUNCEMENT, active: 'yes' }],
      total: 1, limit: 50, offset: 0,
    }))
    await expect(listAdminAnnouncements()).rejects.toThrow('包含无效数据')
  })

  it('builds admin list query with limit/offset', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({
      announcements: [], total: 0, limit: 30, offset: 10,
    }))
    await listAdminAnnouncements({ limit: 30, offset: 10 })
    const calledPath = mockedApiRequest.mock.calls[0]?.[0] as string
    expect(calledPath).toContain('limit=30')
    expect(calledPath).toContain('offset=10')
  })

  it('creates announcement from valid response', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({ announcement: VALID_ADMIN_ANNOUNCEMENT }))
    const result = await createAdminAnnouncement({
      title: '系统维护通知',
      content: '内容',
      active: true,
    })
    expect(result.id).toBe('a-1')
  })

  it('rejects create with invalid announcement', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({ announcement: null }))
    await expect(createAdminAnnouncement({ title: 'x', content: 'y' })).rejects.toThrow('无效公告数据')
  })

  it('updates announcement via patch', async () => {
    const updated = { ...VALID_ADMIN_ANNOUNCEMENT, title: '更新后' }
    mockedApiRequest.mockReturnValueOnce(mockResponse({ announcement: updated }))
    const result = await updateAdminAnnouncement('a-1', { title: '更新后' })
    expect(result.title).toBe('更新后')
    const calledOptions = mockedApiRequest.mock.calls[0]?.[1] as RequestInit
    expect(calledOptions.method).toBe('PATCH')
  })

  it('rejects update when response missing announcement', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({ ok: true }))
    await expect(updateAdminAnnouncement('a-1', { active: false })).rejects.toThrow('无效公告数据')
  })
})
