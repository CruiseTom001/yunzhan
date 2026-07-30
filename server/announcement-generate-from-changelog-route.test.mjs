import http from 'node:http'
import { beforeEach, describe, expect, it, vi } from 'vitest'

process.env.VERCEL = '1'
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@127.0.0.1:5432/yunzhan_test'
process.env.APP_ORIGIN = process.env.APP_ORIGIN || 'http://127.0.0.1:5173'
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-session-secret-at-least-32-chars!!'

const query = vi.fn()

vi.mock('./db.mjs', () => ({
  pool: {
    query: (...args) => query(...args),
    connect: vi.fn(),
    end: vi.fn(),
  },
  withTransaction: async (callback) => callback({ query }),
}))

vi.mock('./announcement-generation.mjs', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    readChangelogFile: vi.fn(actual.readChangelogFile),
    generateReleaseAnnouncementDraft: vi.fn(actual.generateReleaseAnnouncementDraft),
  }
})

const { default: app } = await import('./index.mjs')
const generation = await import('./announcement-generation.mjs')

function createServer() {
  return http.createServer(app)
}

async function withServer(run) {
  const server = createServer()
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address()
  try {
    return await run(port)
  } finally {
    await new Promise(resolve => server.close(resolve))
  }
}

async function request(port, {
  method = 'GET',
  path,
  cookie,
  body,
}) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    method,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      origin: process.env.APP_ORIGIN,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const text = await response.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = null
  }
  return { status: response.status, json, text }
}

const SUPER_ADMIN_ROW = {
  id: '11111111-1111-4111-8111-111111111111',
  username: 'root',
  display_name: '超管',
  email: 'root@example.com',
  role: 'super_admin',
  status: 'active',
  session_id: '22222222-2222-4222-8222-222222222222',
  created_at: new Date('2026-01-01T00:00:00Z'),
  updated_at: new Date('2026-01-01T00:00:00Z'),
  email_verified_at: new Date('2026-01-01T00:00:00Z'),
  last_login_at: null,
}

const USER_ROW = {
  ...SUPER_ADMIN_ROW,
  id: '33333333-3333-4333-8333-333333333333',
  username: 'user',
  role: 'user',
}

const COOKIE = 'yunzhan_session=abcdefghijklmnopqrstuvwxyz0123456789abcd'
const PATH = '/api/admin/announcements/generate-from-changelog'

function draftAnnouncement(overrides = {}) {
  return {
    id: '9',
    title: '云栈桌面端 v1.2.6 更新',
    content: '云栈桌面端 v1.2.6 已发布。\n\n本次更新：\n新增：\n- 公告中心支持按公告类型和版本查看更新信息。',
    publishedAt: Date.parse('2026-07-29T00:00:00Z'),
    active: false,
    createdAt: Date.parse('2026-07-29T00:00:00Z'),
    updatedAt: Date.parse('2026-07-29T00:00:00Z'),
    category: 'desktop_release',
    version: '1.2.6',
    sourceKey: 'desktop_release:1.2.6',
    sourceCommit: '0f3cdbe73add73b47ce0b251fdcc08e6f48a0a0d',
    generatedByAi: false,
    generationProvider: null,
    generationError: 'AI 摘要无效（ungrounded_term），已保留详细更新条目。',
    ...overrides,
  }
}

describe('POST /api/admin/announcements/generate-from-changelog', () => {
  beforeEach(() => {
    query.mockReset()
    generation.readChangelogFile.mockReset()
    generation.generateReleaseAnnouncementDraft.mockReset()
    generation.readChangelogFile.mockReturnValue(`# 变更日志

## [1.2.6] - 2026-07-29

### 新增
- 公告中心支持按公告类型和版本查看更新信息。[audience:user] (B/C)
`)
  })

  it('rejects unauthenticated users', async () => {
    await withServer(async (port) => {
      const result = await request(port, {
        method: 'POST',
        path: PATH,
        body: { category: 'desktop_release', version: '1.2.6' },
      })
      expect(result.status).toBe(401)
      expect(generation.generateReleaseAnnouncementDraft).not.toHaveBeenCalled()
    })
  })

  it('rejects non-super-admin users', async () => {
    query.mockResolvedValueOnce({ rows: [USER_ROW] })
    await withServer(async (port) => {
      const result = await request(port, {
        method: 'POST',
        path: PATH,
        cookie: COOKIE,
        body: { category: 'desktop_release', version: '1.2.6' },
      })
      expect(result.status).toBe(403)
      expect(generation.generateReleaseAnnouncementDraft).not.toHaveBeenCalled()
    })
  })

  it('rejects extra fields including client sourceKey', async () => {
    query.mockResolvedValueOnce({ rows: [SUPER_ADMIN_ROW] })
    await withServer(async (port) => {
      const result = await request(port, {
        method: 'POST',
        path: PATH,
        cookie: COOKIE,
        body: {
          category: 'desktop_release',
          version: '1.2.6',
          sourceKey: 'desktop_release:1.2.6',
        },
      })
      expect(result.status).toBe(400)
      expect(result.json.error).toMatch(/补建参数无效/)
      expect(generation.generateReleaseAnnouncementDraft).not.toHaveBeenCalled()
    })
  })

  it('rejects invalid category, version and sourceCommit', async () => {
    query
      .mockResolvedValueOnce({ rows: [SUPER_ADMIN_ROW] })
      .mockResolvedValueOnce({ rows: [SUPER_ADMIN_ROW] })
      .mockResolvedValueOnce({ rows: [SUPER_ADMIN_ROW] })
    await withServer(async (port) => {
      const badCategory = await request(port, {
        method: 'POST',
        path: PATH,
        cookie: COOKIE,
        body: { category: 'general', version: '1.2.6' },
      })
      expect(badCategory.status).toBe(400)

      const badVersion = await request(port, {
        method: 'POST',
        path: PATH,
        cookie: COOKIE,
        body: { category: 'desktop_release', version: '1.2' },
      })
      expect(badVersion.status).toBe(400)

      const badCommit = await request(port, {
        method: 'POST',
        path: PATH,
        cookie: COOKIE,
        body: {
          category: 'desktop_release',
          version: '1.2.6',
          sourceCommit: 'not-a-sha',
        },
      })
      expect(badCommit.status).toBe(400)
      expect(generation.generateReleaseAnnouncementDraft).not.toHaveBeenCalled()
    })
  })

  it('returns 422 when CHANGELOG version is missing', async () => {
    query.mockResolvedValueOnce({ rows: [SUPER_ADMIN_ROW] })
    generation.readChangelogFile.mockReturnValue('## [1.2.5]\n\n- 历史。[audience:user] (B)\n')
    await withServer(async (port) => {
      const result = await request(port, {
        method: 'POST',
        path: PATH,
        cookie: COOKIE,
        body: { category: 'desktop_release', version: '1.2.6' },
      })
      expect(result.status).toBe(422)
      expect(result.json.error).toMatch(/未找到版本 1\.2\.6/)
      expect(generation.generateReleaseAnnouncementDraft).not.toHaveBeenCalled()
    })
  })

  it('returns 422 when filtered changelog has no user-facing content', async () => {
    query.mockResolvedValueOnce({ rows: [SUPER_ADMIN_ROW] })
    generation.generateReleaseAnnouncementDraft.mockResolvedValueOnce({
      announcement: {
        ...draftAnnouncement({ id: null, content: '本版本没有用户侧公告内容。' }),
        generationError: '本版本没有用户侧公告内容。',
      },
      created: false,
      repaired: false,
      skipped: true,
    })
    await withServer(async (port) => {
      const result = await request(port, {
        method: 'POST',
        path: PATH,
        cookie: COOKIE,
        body: { category: 'desktop_release', version: '1.2.6' },
      })
      expect(result.status).toBe(422)
      expect(result.json.error).toMatch(/没有用户侧公告内容/)
      expect(result.json.skipped).toBe(true)
      expect(query.mock.calls.some(call => String(call[0]).includes('INSERT INTO audit_logs'))).toBe(false)
    })
  })

  it('creates inactive draft with server-side sourceKey and returns 201', async () => {
    const created = draftAnnouncement({ generatedByAi: true, generationError: null })
    query.mockResolvedValueOnce({ rows: [SUPER_ADMIN_ROW] })
    generation.generateReleaseAnnouncementDraft.mockResolvedValueOnce({
      announcement: created,
      created: true,
      repaired: false,
    })
    await withServer(async (port) => {
      const result = await request(port, {
        method: 'POST',
        path: PATH,
        cookie: COOKIE,
        body: {
          category: 'desktop_release',
          version: '1.2.6',
          sourceCommit: '0F3CDBE73ADD73B47CE0B251FDCC08E6F48A0A0D',
        },
      })
      expect(result.status).toBe(201)
      expect(result.json.created).toBe(true)
      expect(result.json.repaired).toBe(false)
      expect(result.json.skipped).toBe(false)
      expect(result.json.announcement.active).toBe(false)
      expect(result.json.announcement.sourceKey).toBe('desktop_release:1.2.6')
      expect(generation.generateReleaseAnnouncementDraft).toHaveBeenCalledTimes(1)
      const call = generation.generateReleaseAnnouncementDraft.mock.calls[0][1]
      expect(call.category).toBe('desktop_release')
      expect(call.version).toBe('1.2.6')
      expect(call.sourceCommit).toBe('0f3cdbe73add73b47ce0b251fdcc08e6f48a0a0d')
      expect(call.changelogEntry).toContain('公告中心支持按公告类型和版本查看更新信息')
      expect(call.repairExistingGeneric).toBe(false)
      expect(call.auditContext).toEqual({
        action: 'announcement.generate_from_changelog',
        actorUserId: SUPER_ADMIN_ROW.id,
        targetUserId: SUPER_ADMIN_ROW.id,
      })
      expect(call).not.toHaveProperty('sourceKey')
      // 审计由 generateReleaseAnnouncementDraft 内 CTE 原子写入，路由层不再单独写 audit_logs
      expect(query.mock.calls.some(callItem => String(callItem[0]).includes('INSERT INTO audit_logs'))).toBe(false)
    })
  })

  it('keeps detailed fallback when AI fails and still creates draft', async () => {
    const created = draftAnnouncement()
    query.mockResolvedValueOnce({ rows: [SUPER_ADMIN_ROW] })
    generation.generateReleaseAnnouncementDraft.mockResolvedValueOnce({
      announcement: created,
      created: true,
      repaired: false,
    })
    await withServer(async (port) => {
      const result = await request(port, {
        method: 'POST',
        path: PATH,
        cookie: COOKIE,
        body: { category: 'desktop_release', version: '1.2.6' },
      })
      expect(result.status).toBe(201)
      expect(result.json.announcement.generatedByAi).toBe(false)
      expect(result.json.announcement.generationError).toMatch(/已保留详细更新条目/)
      expect(result.json.announcement.content).toContain('本次更新：')
      expect(result.json.announcement.active).toBe(false)
    })
  })

  it('returns 200 created=false repaired=false for existing inactive draft without audit', async () => {
    const existing = draftAnnouncement({ id: '2' })
    query.mockResolvedValueOnce({ rows: [SUPER_ADMIN_ROW] })
    generation.generateReleaseAnnouncementDraft.mockResolvedValueOnce({
      announcement: existing,
      created: false,
      repaired: true, // 即便底层误报 repaired，路由强制对外返回 false
    })
    await withServer(async (port) => {
      const result = await request(port, {
        method: 'POST',
        path: PATH,
        cookie: COOKIE,
        body: { category: 'desktop_release', version: '1.2.6' },
      })
      expect(result.status).toBe(200)
      expect(result.json.created).toBe(false)
      expect(result.json.repaired).toBe(false)
      expect(result.json.announcement.id).toBe('2')
      expect(generation.generateReleaseAnnouncementDraft.mock.calls[0][1].repairExistingGeneric).toBe(false)
      expect(query.mock.calls.some(call => String(call[0]).includes('INSERT INTO audit_logs'))).toBe(false)
    })
  })

  it('passes repairExistingGeneric=false so inactive generic drafts are not auto-repaired', async () => {
    const generic = '云栈桌面端 v1.2.6 已发布，请查看本次更新说明。'
    query.mockResolvedValueOnce({ rows: [SUPER_ADMIN_ROW] })
    generation.generateReleaseAnnouncementDraft.mockResolvedValueOnce({
      announcement: draftAnnouncement({ id: '3', content: generic }),
      created: false,
      repaired: false,
    })
    await withServer(async (port) => {
      const result = await request(port, {
        method: 'POST',
        path: PATH,
        cookie: COOKIE,
        body: { category: 'desktop_release', version: '1.2.6' },
      })
      expect(result.status).toBe(200)
      expect(result.json.created).toBe(false)
      expect(result.json.repaired).toBe(false)
      expect(result.json.announcement.content).toBe(generic)
      expect(generation.generateReleaseAnnouncementDraft.mock.calls[0][1].repairExistingGeneric).toBe(false)
    })
  })

  it('returns 409 for existing active draft without overwrite or audit', async () => {
    query.mockResolvedValueOnce({ rows: [SUPER_ADMIN_ROW] })
    generation.generateReleaseAnnouncementDraft.mockResolvedValueOnce({
      announcement: draftAnnouncement({ active: true }),
      created: false,
      repaired: false,
    })
    await withServer(async (port) => {
      const result = await request(port, {
        method: 'POST',
        path: PATH,
        cookie: COOKIE,
        body: { category: 'desktop_release', version: '1.2.6' },
      })
      expect(result.status).toBe(409)
      expect(result.json.error).toMatch(/已经发布，不能补建覆盖/)
      expect(query.mock.calls.some(call => String(call[0]).includes('INSERT INTO audit_logs'))).toBe(false)
    })
  })
})
