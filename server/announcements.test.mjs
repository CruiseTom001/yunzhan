import { describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_ANNOUNCEMENT_CATEGORY,
  findVisibleAnnouncement,
  listVisibleAnnouncements,
  mapAdminAnnouncementRow,
  mapPublicAnnouncementRow,
  markVisibleAnnouncementRead,
  parseAnnouncementCategory,
  readAnnouncementCategoryInput,
  readAnnouncementSourceKeyInput,
  readAnnouncementVersionInput,
} from './announcements.mjs'

describe('announcements helpers', () => {
  it('maps public announcement rows with defaults', () => {
    const mapped = mapPublicAnnouncementRow({
      id: 12,
      title: '标题',
      content: '正文',
      published_at: new Date('2026-07-28T08:00:00Z'),
      read: false,
      category: 'general',
      version: null,
    })
    expect(mapped).toEqual({
      id: '12',
      title: '标题',
      content: '正文',
      publishedAt: new Date('2026-07-28T08:00:00Z').getTime(),
      read: false,
      category: 'general',
      version: null,
    })
  })

  it('falls back to general for invalid category', () => {
    expect(parseAnnouncementCategory('invalid')).toBe(DEFAULT_ANNOUNCEMENT_CATEGORY)
    expect(parseAnnouncementCategory('web_release')).toBe('web_release')
  })

  it('lists only visible announcements with read state, category, version and totals', async () => {
    const publishedAt = new Date('2026-07-28T08:00:00Z')
    const client = {
      query: vi.fn()
        .mockResolvedValueOnce({
          rows: [{
            id: 12,
            title: '标题',
            content: '正文',
            published_at: publishedAt,
            category: 'desktop_release',
            version: '1.2.5',
            read: false,
          }],
        })
        .mockResolvedValueOnce({ rows: [{ count: 1 }] })
        .mockResolvedValueOnce({ rows: [{ count: 1 }] }),
    }

    const result = await listVisibleAnnouncements(client, 'user-1', { limit: 20, offset: 0 })
    expect(result.announcements).toHaveLength(1)
    expect(result.announcements[0].read).toBe(false)
    expect(result.announcements[0].category).toBe('desktop_release')
    expect(result.announcements[0].version).toBe('1.2.5')
    expect(result.total).toBe(1)
    expect(result.unreadTotal).toBe(1)
    expect(result.limit).toBe(20)
    expect(result.offset).toBe(0)
    expect(client.query.mock.calls[0][0]).toContain('a.category, a.version')
    expect(client.query.mock.calls[0][0]).toContain('a.active = true')
    expect(client.query.mock.calls[0][0]).toContain('a.published_at <= NOW()')
  })

  it('maps admin announcement rows with generation metadata', () => {
    const mapped = mapAdminAnnouncementRow({
      id: 9,
      title: '云栈桌面端 v1.2.5 更新',
      content: '正文',
      published_at: new Date('2026-07-29T06:00:00Z'),
      active: false,
      created_at: new Date('2026-07-29T05:00:00Z'),
      updated_at: new Date('2026-07-29T05:30:00Z'),
      category: 'desktop_release',
      version: '1.2.5',
      source_key: 'desktop_release:1.2.5',
      source_commit: 'abc1234',
      generated_by_ai: true,
      generation_provider: 'DeepSeek/deepseek-flash',
      generation_error: null,
    })
    expect(mapped).toMatchObject({
      id: '9',
      active: false,
      category: 'desktop_release',
      version: '1.2.5',
      sourceKey: 'desktop_release:1.2.5',
      sourceCommit: 'abc1234',
      generatedByAi: true,
      generationProvider: 'DeepSeek/deepseek-flash',
      generationError: null,
    })
  })

  it('validates phase 2 admin input fields', () => {
    expect(readAnnouncementCategoryInput('desktop_release')).toEqual({ ok: true, value: 'desktop_release' })
    expect(readAnnouncementCategoryInput('invalid').ok).toBe(false)
    expect(readAnnouncementVersionInput('1.2.5')).toEqual({ ok: true, value: '1.2.5' })
    expect(readAnnouncementVersionInput('1.2').ok).toBe(false)
    expect(readAnnouncementSourceKeyInput('desktop_release:1.2.5')).toEqual({ ok: true, value: 'desktop_release:1.2.5' })
    expect(readAnnouncementSourceKeyInput('bad key').ok).toBe(false)
  })

  it('returns false when marking read for invisible announcement', async () => {
    const client = {
      query: vi.fn().mockResolvedValueOnce({ rows: [] }),
    }
    await expect(markVisibleAnnouncementRead(client, 'user-1', 99)).resolves.toBe(false)
    expect(client.query).toHaveBeenCalledOnce()
  })

  it('marks visible announcement read idempotently', async () => {
    const client = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [{ id: 12 }] })
        .mockResolvedValueOnce({ rowCount: 1 }),
    }
    await expect(markVisibleAnnouncementRead(client, 'user-1', 12)).resolves.toBe(true)
    expect(client.query.mock.calls[1][0]).toContain('ON CONFLICT')
  })

  it('findVisibleAnnouncement filters inactive and future rows in SQL', async () => {
    const client = {
      query: vi.fn().mockResolvedValueOnce({ rows: [{ id: 3 }] }),
    }
    await expect(findVisibleAnnouncement(client, 3)).resolves.toEqual({ id: 3 })
    expect(client.query.mock.calls[0][0]).toContain('active = true')
    expect(client.query.mock.calls[0][0]).toContain('published_at <= NOW()')
  })
})
