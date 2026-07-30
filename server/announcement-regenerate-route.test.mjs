import http from 'node:http'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.VERCEL = '1'
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@127.0.0.1:5432/yunzhan_test'
process.env.APP_ORIGIN = process.env.APP_ORIGIN || 'http://127.0.0.1:5173'
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-session-secret-at-least-32-chars!!'

const query = vi.fn()
const writeAuditCalls = []

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
    regenerateAnnouncementFromChangelog: vi.fn(actual.regenerateAnnouncementFromChangelog),
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
  id: '11111111-1111-1111-1111-111111111111',
  username: 'root',
  display_name: '超管',
  email: 'root@example.com',
  role: 'super_admin',
  status: 'active',
  session_id: '22222222-2222-2222-2222-222222222222',
  created_at: new Date('2026-01-01T00:00:00Z'),
  updated_at: new Date('2026-01-01T00:00:00Z'),
  email_verified_at: new Date('2026-01-01T00:00:00Z'),
  last_login_at: null,
}

const USER_ROW = {
  ...SUPER_ADMIN_ROW,
  id: '33333333-3333-3333-3333-333333333333',
  username: 'user',
  role: 'user',
}

describe('POST /api/admin/announcements/:id/regenerate-from-changelog', () => {
  beforeEach(() => {
    query.mockReset()
    writeAuditCalls.length = 0
    generation.readChangelogFile.mockReset()
    generation.regenerateAnnouncementFromChangelog.mockReset()
    generation.readChangelogFile.mockImplementation(() => `# 变更日志

## [1.2.7]

### 修复
- 用户可见修复。[audience:user] (B)
`)
    generation.regenerateAnnouncementFromChangelog.mockImplementation(async (...args) => {
      return (await vi.importActual('./announcement-generation.mjs')).regenerateAnnouncementFromChangelog(...args)
    })
  })

  it('rejects unauthenticated users', async () => {
    await withServer(async (port) => {
      const result = await request(port, {
        method: 'POST',
        path: '/api/admin/announcements/7/regenerate-from-changelog',
        body: {},
      })
      expect(result.status).toBe(401)
      expect(query).not.toHaveBeenCalled()
    })
  })

  it('rejects non-super-admin users', async () => {
    query.mockResolvedValueOnce({ rows: [USER_ROW] })
    await withServer(async (port) => {
      const result = await request(port, {
        method: 'POST',
        path: '/api/admin/announcements/7/regenerate-from-changelog',
        cookie: 'yunzhan_session=abcdefghijklmnopqrstuvwxyz0123456789abcd',
        body: {},
      })
      expect(result.status).toBe(403)
    })
  })

  it('returns 400 for invalid announcement id', async () => {
    query.mockResolvedValueOnce({ rows: [SUPER_ADMIN_ROW] })
    await withServer(async (port) => {
      const result = await request(port, {
        method: 'POST',
        path: '/api/admin/announcements/abc/regenerate-from-changelog',
        cookie: 'yunzhan_session=abcdefghijklmnopqrstuvwxyz0123456789abcd',
        body: {},
      })
      expect(result.status).toBe(400)
      expect(generation.regenerateAnnouncementFromChangelog).not.toHaveBeenCalled()
    })
  })

  it('returns clear error when CHANGELOG file is missing and does not UPDATE/audit', async () => {
    query.mockResolvedValueOnce({ rows: [SUPER_ADMIN_ROW] })
    generation.readChangelogFile.mockImplementation(() => {
      const error = new Error('无法定位 CHANGELOG.md。')
      error.statusCode = 500
      throw error
    })
    await withServer(async (port) => {
      const result = await request(port, {
        method: 'POST',
        path: '/api/admin/announcements/7/regenerate-from-changelog',
        cookie: 'yunzhan_session=abcdefghijklmnopqrstuvwxyz0123456789abcd',
        body: {},
      })
      expect(result.status).toBe(500)
      expect(result.json.error).toMatch(/CHANGELOG/)
      expect(generation.regenerateAnnouncementFromChangelog).not.toHaveBeenCalled()
      expect(query.mock.calls.some(call => String(call[0]).includes('INSERT INTO audit_logs'))).toBe(false)
    })
  })

  it('returns 409 for active announcements without UPDATE', async () => {
    query
      .mockResolvedValueOnce({ rows: [SUPER_ADMIN_ROW] })
      .mockResolvedValueOnce({
        rows: [{
          id: 7,
          title: '云栈网站 v1.2.7 更新',
          content: 'x',
          published_at: new Date(),
          active: true,
          created_at: new Date(),
          updated_at: new Date(),
          category: 'web_release',
          version: '1.2.7',
          source_key: 'web_release:1.2.7',
          source_commit: null,
          generated_by_ai: false,
          generation_provider: null,
          generation_error: null,
        }],
      })
    generation.regenerateAnnouncementFromChangelog.mockImplementation(
      async (client, id, options) => {
        const actual = await vi.importActual('./announcement-generation.mjs')
        return actual.regenerateAnnouncementFromChangelog(client, id, options)
      },
    )
    await withServer(async (port) => {
      const result = await request(port, {
        method: 'POST',
        path: '/api/admin/announcements/7/regenerate-from-changelog',
        cookie: 'yunzhan_session=abcdefghijklmnopqrstuvwxyz0123456789abcd',
        body: {},
      })
      expect(result.status).toBe(409)
      expect(query.mock.calls.some(call => String(call[0]).includes('UPDATE announcements'))).toBe(false)
      expect(query.mock.calls.some(call => String(call[0]).includes('INSERT INTO audit_logs'))).toBe(false)
    })
  })

  it('returns 422 when target version is missing from CHANGELOG', async () => {
    query
      .mockResolvedValueOnce({ rows: [SUPER_ADMIN_ROW] })
      .mockResolvedValueOnce({
        rows: [{
          id: 7,
          title: '云栈网站 v1.2.7 更新',
          content: '管理员草稿',
          published_at: new Date(),
          active: false,
          created_at: new Date(),
          updated_at: new Date(),
          category: 'web_release',
          version: '1.2.7',
          source_key: 'web_release:1.2.7',
          source_commit: null,
          generated_by_ai: false,
          generation_provider: null,
          generation_error: null,
        }],
      })
    generation.readChangelogFile.mockReturnValue('## [1.2.6]\n\n- 其他。[audience:user] (B)')
    await withServer(async (port) => {
      const result = await request(port, {
        method: 'POST',
        path: '/api/admin/announcements/7/regenerate-from-changelog',
        cookie: 'yunzhan_session=abcdefghijklmnopqrstuvwxyz0123456789abcd',
        body: {},
      })
      expect(result.status).toBe(422)
      expect(result.json.error).toMatch(/未找到版本/)
      expect(query.mock.calls.some(call => String(call[0]).includes('UPDATE announcements'))).toBe(false)
      expect(query.mock.calls.some(call => String(call[0]).includes('INSERT INTO audit_logs'))).toBe(false)
    })
  })

  it('returns 422 when filtered user content is empty', async () => {
    query
      .mockResolvedValueOnce({ rows: [SUPER_ADMIN_ROW] })
      .mockResolvedValueOnce({
        rows: [{
          id: 7,
          title: '云栈网站 v1.2.7 更新',
          content: '管理员草稿',
          published_at: new Date(),
          active: false,
          created_at: new Date(),
          updated_at: new Date(),
          category: 'web_release',
          version: '1.2.7',
          source_key: 'web_release:1.2.7',
          source_commit: null,
          generated_by_ai: false,
          generation_provider: null,
          generation_error: null,
        }],
      })
    generation.readChangelogFile.mockReturnValue(`## [1.2.7]

### 修复
- 后台入口。[audience:admin] (Web)
- 仅桌面。[audience:user] (C)
`)
    await withServer(async (port) => {
      const result = await request(port, {
        method: 'POST',
        path: '/api/admin/announcements/7/regenerate-from-changelog',
        cookie: 'yunzhan_session=abcdefghijklmnopqrstuvwxyz0123456789abcd',
        body: {},
      })
      expect(result.status).toBe(422)
      expect(query.mock.calls.some(call => String(call[0]).includes('UPDATE announcements'))).toBe(false)
    })
  })

  it('rejects non-release announcements', async () => {
    query
      .mockResolvedValueOnce({ rows: [SUPER_ADMIN_ROW] })
      .mockResolvedValueOnce({
        rows: [{
          id: 7,
          title: '普通公告',
          content: 'hello',
          published_at: new Date(),
          active: false,
          created_at: new Date(),
          updated_at: new Date(),
          category: 'general',
          version: null,
          source_key: null,
          source_commit: null,
          generated_by_ai: false,
          generation_provider: null,
          generation_error: null,
        }],
      })
    await withServer(async (port) => {
      const result = await request(port, {
        method: 'POST',
        path: '/api/admin/announcements/7/regenerate-from-changelog',
        cookie: 'yunzhan_session=abcdefghijklmnopqrstuvwxyz0123456789abcd',
        body: {},
      })
      expect(result.status).toBe(400)
    })
  })

  it('rejects missing version on release draft', async () => {
    query
      .mockResolvedValueOnce({ rows: [SUPER_ADMIN_ROW] })
      .mockResolvedValueOnce({
        rows: [{
          id: 7,
          title: '云栈网站更新',
          content: 'hello',
          published_at: new Date(),
          active: false,
          created_at: new Date(),
          updated_at: new Date(),
          category: 'web_release',
          version: null,
          source_key: 'web_release:broken',
          source_commit: null,
          generated_by_ai: false,
          generation_provider: null,
          generation_error: null,
        }],
      })
    await withServer(async (port) => {
      const result = await request(port, {
        method: 'POST',
        path: '/api/admin/announcements/7/regenerate-from-changelog',
        cookie: 'yunzhan_session=abcdefghijklmnopqrstuvwxyz0123456789abcd',
        body: {},
      })
      expect(result.status).toBe(400)
      expect(result.json.error).toMatch(/版本/)
    })
  })

  it('updates inactive draft and writes audit on success', async () => {
    const updatedRow = {
      id: 7,
      title: '云栈网站 v1.2.7 更新',
      content: '云栈网站 v1.2.7 已发布。\n\n本次更新：\n修复：\n- 用户可见修复。',
      published_at: new Date(),
      active: false,
      created_at: new Date(),
      updated_at: new Date(),
      category: 'web_release',
      version: '1.2.7',
      source_key: 'web_release:1.2.7',
      source_commit: null,
      generated_by_ai: false,
      generation_provider: null,
      generation_error: 'timeout',
    }
    query
      .mockResolvedValueOnce({ rows: [SUPER_ADMIN_ROW] })
      .mockResolvedValueOnce({
        rows: [{
          ...updatedRow,
          content: '旧草稿',
          generation_error: null,
        }],
      })
      .mockResolvedValueOnce({ rows: [updatedRow] })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })

    generation.regenerateAnnouncementFromChangelog.mockResolvedValue({
      id: '7',
      title: updatedRow.title,
      content: updatedRow.content,
      publishedAt: Date.now(),
      active: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      category: 'web_release',
      version: '1.2.7',
      sourceKey: 'web_release:1.2.7',
      sourceCommit: null,
      generatedByAi: false,
      generationProvider: null,
      generationError: 'timeout',
    })

    await withServer(async (port) => {
      const result = await request(port, {
        method: 'POST',
        path: '/api/admin/announcements/7/regenerate-from-changelog',
        cookie: 'yunzhan_session=abcdefghijklmnopqrstuvwxyz0123456789abcd',
        body: {},
      })
      expect(result.status).toBe(200)
      expect(result.json.announcement.content).toContain('用户可见修复')
      expect(generation.regenerateAnnouncementFromChangelog).toHaveBeenCalled()
      expect(query.mock.calls.some(call => String(call[0]).includes('INSERT INTO audit_logs'))).toBe(true)
      const auditCall = query.mock.calls.find(call => String(call[0]).includes('INSERT INTO audit_logs'))
      expect(auditCall[1][1]).toBe('announcement.regenerate_from_changelog')
    })
  })
})

afterAll(() => {
  vi.restoreAllMocks()
})
