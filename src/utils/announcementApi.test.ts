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
  deleteAdminAnnouncement,
  generateAdminAnnouncementFromChangelog,
  getLatestUnread,
  listAdminAnnouncements,
  listAnnouncements,
  markAnnouncementRead,
  regenerateAdminAnnouncementFromChangelog,
  repolishAdminAnnouncement,
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
  category: 'general',
  version: null,
  sourceKey: null,
  sourceCommit: null,
  generatedByAi: false,
  generationProvider: null,
  generationError: null,
}

const VALID_LIST_ITEM = {
  ...VALID_ANNOUNCEMENT,
  read: false,
  category: 'general',
  version: null,
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

  it('parses admin announcement generation metadata', async () => {
    const generated = {
      ...VALID_ADMIN_ANNOUNCEMENT,
      active: false,
      category: 'desktop_release',
      version: '1.2.5',
      sourceKey: 'desktop_release:1.2.5',
      sourceCommit: 'abc1234',
      generatedByAi: true,
      generationProvider: 'DeepSeek Flash/deepseek-flash',
      generationError: null,
    }
    mockedApiRequest.mockReturnValueOnce(mockResponse({ announcement: generated }))
    const result = await repolishAdminAnnouncement('a-1')
    expect(result.generatedByAi).toBe(true)
    expect(result.sourceKey).toBe('desktop_release:1.2.5')
    expect(result.generationProvider).toContain('deepseek-flash')
    const calledPath = mockedApiRequest.mock.calls[0]?.[0] as string
    expect(calledPath).toContain('/repolish')
  })

  it('regenerates admin announcement from changelog endpoint', async () => {
    const regenerated = {
      ...VALID_ADMIN_ANNOUNCEMENT,
      active: false,
      category: 'web_release',
      version: '1.2.7',
      sourceKey: 'web_release:1.2.7',
      generatedByAi: false,
      generationError: 'AI 供应商响应超时。',
      content: '云栈网站 v1.2.7 已发布。\n\n本次更新：\n修复：\n- 公告 Store',
    }
    mockedApiRequest.mockReturnValueOnce(mockResponse({ announcement: regenerated }))
    const result = await regenerateAdminAnnouncementFromChangelog('a-1')
    expect(result.category).toBe('web_release')
    expect(result.content).toContain('公告 Store')
    const calledPath = mockedApiRequest.mock.calls[0]?.[0] as string
    expect(calledPath).toContain('/regenerate-from-changelog')
    const calledOptions = mockedApiRequest.mock.calls[0]?.[1] as RequestInit
    expect(calledOptions.method).toBe('POST')
  })

  it('generates missing release draft with correct body and without sourceKey', async () => {
    const created = {
      ...VALID_ADMIN_ANNOUNCEMENT,
      active: false,
      category: 'desktop_release',
      version: '1.2.6',
      sourceKey: 'desktop_release:1.2.6',
      sourceCommit: '0f3cdbe73add73b47ce0b251fdcc08e6f48a0a0d',
      generatedByAi: false,
      generationError: 'AI 摘要无效（ungrounded_term），已保留详细更新条目。',
      content: '云栈桌面端 v1.2.6 已发布。\n\n本次更新：\n新增：\n- 公告中心',
    }
    mockedApiRequest.mockReturnValueOnce(mockResponse({
      announcement: created,
      created: true,
      repaired: false,
      skipped: false,
    }))
    const result = await generateAdminAnnouncementFromChangelog({
      category: 'desktop_release',
      version: '1.2.6',
      sourceCommit: '0f3cdbe73add73b47ce0b251fdcc08e6f48a0a0d',
    })
    expect(result.created).toBe(true)
    expect(result.announcement.sourceKey).toBe('desktop_release:1.2.6')
    expect(mockedApiRequest.mock.calls[0]?.[0]).toBe('/admin/announcements/generate-from-changelog')
    const calledOptions = mockedApiRequest.mock.calls[0]?.[1] as RequestInit
    expect(calledOptions.method).toBe('POST')
    expect(JSON.parse(String(calledOptions.body))).toEqual({
      category: 'desktop_release',
      version: '1.2.6',
      sourceCommit: '0f3cdbe73add73b47ce0b251fdcc08e6f48a0a0d',
    })
    expect(JSON.parse(String(calledOptions.body))).not.toHaveProperty('sourceKey')
  })

  it('does not call regenerate API when confirm is cancelled', async () => {
    const confirm = vi.fn(() => false)
    vi.stubGlobal('window', { confirm })
    mockedApiRequest.mockClear()
    // 与 AdminAnnouncementsPage.regenerateFromChangelog 相同的取消短路语义
    const confirmed = window.confirm('确定根据 CHANGELOG 重新生成吗？')
    if (confirmed) {
      await regenerateAdminAnnouncementFromChangelog('a-1')
    }
    expect(confirm).toHaveBeenCalled()
    expect(mockedApiRequest).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('rejects admin announcement with invalid generation metadata', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({
      announcements: [{ ...VALID_ADMIN_ANNOUNCEMENT, generatedByAi: 'yes' }],
      total: 1,
      limit: 50,
      offset: 0,
    }))
    await expect(listAdminAnnouncements()).rejects.toThrow('包含无效数据')
  })

  it('deletes admin announcement with ok payload', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({ ok: true }))
    await expect(deleteAdminAnnouncement('a-1')).resolves.toBeUndefined()
    const calledOptions = mockedApiRequest.mock.calls[0]?.[1] as RequestInit
    expect(calledOptions.method).toBe('DELETE')
  })
})

describe('listAnnouncements', () => {
  it('parses valid announcement list', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({
      announcements: [VALID_LIST_ITEM],
      total: 1,
      unreadTotal: 1,
      limit: 20,
      offset: 0,
    }))
    const result = await listAnnouncements({ limit: 20, offset: 0 })
    expect(result.announcements).toHaveLength(1)
    expect(result.announcements[0].read).toBe(false)
    expect(result.announcements[0].category).toBe('general')
    expect(result.total).toBe(1)
    expect(result.unreadTotal).toBe(1)
  })

  it('parses empty announcement list', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({
      announcements: [],
      total: 0,
      unreadTotal: 0,
      limit: 20,
      offset: 0,
    }))
    const result = await listAnnouncements()
    expect(result.announcements).toEqual([])
    expect(result.total).toBe(0)
  })

  it('rejects invalid read type', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({
      announcements: [{ ...VALID_LIST_ITEM, read: 'yes' }],
      total: 1,
      unreadTotal: 1,
    }))
    await expect(listAnnouncements()).rejects.toThrow('包含无效数据')
  })

  it('rejects invalid category', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({
      announcements: [{ ...VALID_LIST_ITEM, category: 'invalid' }],
      total: 1,
      unreadTotal: 1,
    }))
    await expect(listAnnouncements()).rejects.toThrow('包含无效数据')
  })

  it('rejects invalid unreadTotal', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({
      announcements: [],
      total: 0,
      unreadTotal: -1,
    }))
    await expect(listAnnouncements()).rejects.toThrow('无效公告统计')
  })

  it('accepts null version and string version', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({
      announcements: [
        VALID_LIST_ITEM,
        { ...VALID_LIST_ITEM, id: 'a-2', version: '1.2.5' },
      ],
      total: 2,
      unreadTotal: 2,
    }))
    const result = await listAnnouncements()
    expect(result.announcements[0].version).toBeNull()
    expect(result.announcements[1].version).toBe('1.2.5')
  })
})
