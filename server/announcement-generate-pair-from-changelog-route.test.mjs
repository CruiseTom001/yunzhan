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

vi.mock('./generate-release-announcement-pair.mjs', () => ({
  generateReleaseAnnouncementPair: vi.fn(),
}))

const { default: app } = await import('./index.mjs')
const pairModule = await import('./generate-release-announcement-pair.mjs')

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
const PATH = '/api/admin/announcements/generate-pair-from-changelog'

function pairPayload(overrides = {}) {
  return {
    version: '1.2.8',
    sourceCommit: 'abcdef1',
    results: {
      web: {
        status: 'created',
        announcement: {
          id: '1',
          title: '网站',
          content: '网站内容',
          publishedAt: 1,
          active: false,
          createdAt: 1,
          updatedAt: 1,
          category: 'web_release',
          version: '1.2.8',
          sourceKey: 'web_release:1.2.8',
          sourceCommit: 'abcdef1',
          generatedByAi: false,
          generationProvider: null,
          generationError: null,
        },
        message: '网站端草稿已创建（仍为未发布）。',
      },
      desktop: {
        status: 'created',
        announcement: {
          id: '2',
          title: '桌面',
          content: '桌面内容',
          publishedAt: 1,
          active: false,
          createdAt: 1,
          updatedAt: 1,
          category: 'desktop_release',
          version: '1.2.8',
          sourceKey: 'desktop_release:1.2.8',
          sourceCommit: 'abcdef1',
          generatedByAi: false,
          generationProvider: null,
          generationError: null,
        },
        message: '桌面端草稿已创建（仍为未发布）。',
      },
    },
    ...overrides,
  }
}

describe('POST /api/admin/announcements/generate-pair-from-changelog', () => {
  beforeEach(() => {
    query.mockReset()
    pairModule.generateReleaseAnnouncementPair.mockReset()
  })

  it('rejects unauthenticated users', async () => {
    await withServer(async (port) => {
      const result = await request(port, {
        method: 'POST',
        path: PATH,
        body: { version: '1.2.8' },
      })
      expect(result.status).toBe(401)
      expect(pairModule.generateReleaseAnnouncementPair).not.toHaveBeenCalled()
    })
  })

  it('rejects non-super-admin users', async () => {
    query.mockResolvedValueOnce({ rows: [USER_ROW] })
    await withServer(async (port) => {
      const result = await request(port, {
        method: 'POST',
        path: PATH,
        cookie: COOKIE,
        body: { version: '1.2.8' },
      })
      expect(result.status).toBe(403)
      expect(pairModule.generateReleaseAnnouncementPair).not.toHaveBeenCalled()
    })
  })

  it('rejects extra fields including category and sourceKey', async () => {
    query.mockResolvedValueOnce({ rows: [SUPER_ADMIN_ROW] })
    await withServer(async (port) => {
      const result = await request(port, {
        method: 'POST',
        path: PATH,
        cookie: COOKIE,
        body: {
          version: '1.2.8',
          category: 'web_release',
          sourceKey: 'web_release:1.2.8',
        },
      })
      expect(result.status).toBe(400)
      expect(result.json.error).toMatch(/补建参数无效/)
      expect(pairModule.generateReleaseAnnouncementPair).not.toHaveBeenCalled()
    })
  })

  it('rejects empty body without version or sourceCommit', async () => {
    query.mockResolvedValueOnce({ rows: [SUPER_ADMIN_ROW] })
    await withServer(async (port) => {
      const result = await request(port, {
        method: 'POST',
        path: PATH,
        cookie: COOKIE,
        body: {},
      })
      expect(result.status).toBe(400)
      expect(result.json.error).toMatch(/至少填写一个/)
      expect(pairModule.generateReleaseAnnouncementPair).not.toHaveBeenCalled()
    })
  })

  it('rejects invalid version and sourceCommit', async () => {
    query
      .mockResolvedValueOnce({ rows: [SUPER_ADMIN_ROW] })
      .mockResolvedValueOnce({ rows: [SUPER_ADMIN_ROW] })
    await withServer(async (port) => {
      const badVersion = await request(port, {
        method: 'POST',
        path: PATH,
        cookie: COOKIE,
        body: { version: '1.2' },
      })
      expect(badVersion.status).toBe(400)

      const badCommit = await request(port, {
        method: 'POST',
        path: PATH,
        cookie: COOKIE,
        body: { sourceCommit: 'zzz' },
      })
      expect(badCommit.status).toBe(400)
      expect(pairModule.generateReleaseAnnouncementPair).not.toHaveBeenCalled()
    })
  })

  it('returns pair payload for successful create', async () => {
    query.mockResolvedValueOnce({ rows: [SUPER_ADMIN_ROW] })
    const payload = pairPayload()
    pairModule.generateReleaseAnnouncementPair.mockResolvedValueOnce(payload)
    await withServer(async (port) => {
      const result = await request(port, {
        method: 'POST',
        path: PATH,
        cookie: COOKIE,
        body: { version: '1.2.8', sourceCommit: 'Abcdef1' },
      })
      expect(result.status).toBe(200)
      expect(result.json).toEqual(payload)
      expect(pairModule.generateReleaseAnnouncementPair).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          version: '1.2.8',
          sourceCommit: 'abcdef1',
          actorUserId: SUPER_ADMIN_ROW.id,
        }),
      )
    })
  })

  it('maps version/commit mismatch to 400', async () => {
    query.mockResolvedValueOnce({ rows: [SUPER_ADMIN_ROW] })
    const error = new Error('版本号与 Source Commit 对应的 package.json 版本不一致。')
    error.statusCode = 400
    error.code = 'version_commit_mismatch'
    pairModule.generateReleaseAnnouncementPair.mockRejectedValueOnce(error)
    await withServer(async (port) => {
      const result = await request(port, {
        method: 'POST',
        path: PATH,
        cookie: COOKIE,
        body: { version: '1.2.8', sourceCommit: 'abcdef1' },
      })
      expect(result.status).toBe(400)
      expect(result.json.error).toMatch(/不一致/)
    })
  })

  it('returns partial success payload when one channel fails', async () => {
    query.mockResolvedValueOnce({ rows: [SUPER_ADMIN_ROW] })
    const payload = pairPayload({
      results: {
        web: {
          status: 'failed',
          announcement: null,
          message: '网站端生成失败：AI boom',
        },
        desktop: {
          status: 'created',
          announcement: {
            id: '2',
            title: '桌面',
            content: '桌面内容',
            publishedAt: 1,
            active: false,
            createdAt: 1,
            updatedAt: 1,
            category: 'desktop_release',
            version: '1.2.8',
            sourceKey: 'desktop_release:1.2.8',
            sourceCommit: null,
            generatedByAi: false,
            generationProvider: null,
            generationError: null,
          },
          message: '桌面端草稿已创建（仍为未发布）。',
        },
      },
    })
    pairModule.generateReleaseAnnouncementPair.mockResolvedValueOnce(payload)
    await withServer(async (port) => {
      const result = await request(port, {
        method: 'POST',
        path: PATH,
        cookie: COOKIE,
        body: { version: '1.2.8' },
      })
      expect(result.status).toBe(200)
      expect(result.json.results.web.status).toBe('failed')
      expect(result.json.results.desktop.status).toBe('created')
    })
  })
})
