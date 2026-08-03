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

const { default: app } = await import('./index.mjs')

const USER_ROW = {
  id: '33333333-3333-4333-8333-333333333333',
  username: 'user',
  display_name: '用户',
  email: 'user@example.com',
  role: 'user',
  status: 'active',
  session_id: '22222222-2222-4222-8222-222222222222',
  created_at: new Date('2026-01-01T00:00:00Z'),
  updated_at: new Date('2026-01-01T00:00:00Z'),
  email_verified_at: new Date('2026-01-01T00:00:00Z'),
  last_login_at: null,
}

const SUPER_ADMIN_ROW = {
  ...USER_ROW,
  id: '11111111-1111-4111-8111-111111111111',
  username: 'root',
  role: 'super_admin',
}

const COOKIE = 'yunzhan_session=abcdefghijklmnopqrstuvwxyz0123456789abcd'
const PUBLISHED_AT = new Date('2026-07-28T08:00:00Z')

const FIXTURE_ROWS = {
  general: {
    id: 1,
    title: '通用公告',
    content: 'general',
    published_at: PUBLISHED_AT,
    category: 'general',
    version: null,
    read: false,
  },
  web_release: {
    id: 2,
    title: '网站更新',
    content: 'web',
    published_at: new Date('2026-07-29T08:00:00Z'),
    category: 'web_release',
    version: '1.2.8',
    read: false,
  },
  desktop_release: {
    id: 3,
    title: '桌面更新',
    content: 'desktop',
    published_at: new Date('2026-07-30T08:00:00Z'),
    category: 'desktop_release',
    version: '1.2.8',
    read: false,
  },
}

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
  headers = {},
  body,
}) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    method,
    headers: {
      origin: process.env.APP_ORIGIN,
      ...(cookie ? { cookie } : {}),
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...headers,
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

function readCategoriesParam(params) {
  return params.find((value) => Array.isArray(value)) ?? []
}

function filterRowsByCategories(categories) {
  return Object.values(FIXTURE_ROWS).filter((row) => categories.includes(row.category))
}

function installPublicAnnouncementQueryMock() {
  query.mockImplementation(async (sql, params = []) => {
    if (String(sql).includes('active_session')) {
      return { rows: [USER_ROW] }
    }

    const categories = readCategoriesParam(params)

    if (String(sql).includes('SELECT COUNT(*)') && String(sql).includes('announcement_reads')) {
      const userId = params[0]
      if (userId !== USER_ROW.id) return { rows: [{ count: 0 }] }
      const unread = filterRowsByCategories(categories).filter((row) => !row.read).length
      return { rows: [{ count: unread }] }
    }

    if (String(sql).includes('SELECT COUNT(*)')) {
      return { rows: [{ count: filterRowsByCategories(categories).length }] }
    }

    if (String(sql).includes('SELECT a.id, a.title, a.content, a.published_at, a.category, a.version')) {
      const userId = params[0]
      if (userId !== USER_ROW.id) return { rows: [] }
      const rows = filterRowsByCategories(categories)
        .sort((a, b) => b.published_at - a.published_at || b.id - a.id)
      return { rows }
    }

    if (String(sql).includes('SELECT a.id, a.title, a.content, a.published_at')
      && String(sql).includes('LIMIT 1')) {
      const userId = params[0]
      if (userId !== USER_ROW.id) return { rows: [] }
      const rows = filterRowsByCategories(categories)
        .filter((row) => !row.read)
        .sort((a, b) => b.published_at - a.published_at || b.id - a.id)
      return { rows: rows.slice(0, 1) }
    }

    if (String(sql).includes('SELECT id')
      && String(sql).includes('FROM announcements')
      && String(sql).includes('category = ANY')) {
      const announcementId = params[0]
      const row = Object.values(FIXTURE_ROWS).find((item) => item.id === announcementId)
      if (!row || !categories.includes(row.category)) {
        return { rows: [] }
      }
      return { rows: [{ id: row.id }] }
    }

    if (String(sql).includes('INSERT INTO announcement_reads')) {
      return { rowCount: 1 }
    }

    if (String(sql).includes('FROM announcements a') && String(sql).includes('generation_provider')) {
      return {
        rows: Object.values(FIXTURE_ROWS).map((row) => ({
          ...row,
          active: true,
          created_at: PUBLISHED_AT,
          updated_at: PUBLISHED_AT,
          source_key: null,
          source_commit: null,
          generated_by_ai: false,
          generation_provider: null,
          generation_error: null,
        })),
      }
    }

    if (String(sql).includes('SELECT COUNT(*)::INTEGER AS count FROM announcements')) {
      return { rows: [{ count: Object.values(FIXTURE_ROWS).length }] }
    }

    return { rows: [] }
  })
}

describe('public announcement routes by client channel', () => {
  beforeEach(() => {
    query.mockReset()
    installPublicAnnouncementQueryMock()
  })

  it('web list includes general and web_release only', async () => {
    await withServer(async (port) => {
      const result = await request(port, {
        path: '/api/announcements?limit=20&offset=0',
        cookie: COOKIE,
      })
      expect(result.status).toBe(200)
      expect(result.json.total).toBe(2)
      expect(result.json.unreadTotal).toBe(2)
      expect(result.json.announcements.map((item) => item.category)).toEqual(['web_release', 'general'])
    })
  })

  it('desktop list includes general and desktop_release only', async () => {
    await withServer(async (port) => {
      const result = await request(port, {
        path: '/api/announcements?limit=20&offset=0',
        cookie: COOKIE,
        headers: { 'x-yunzhan-client': 'desktop' },
      })
      expect(result.status).toBe(200)
      expect(result.json.total).toBe(2)
      expect(result.json.unreadTotal).toBe(2)
      expect(result.json.announcements.map((item) => item.category)).toEqual(['desktop_release', 'general'])
    })
  })

  it('latest returns channel-specific unread announcement', async () => {
    await withServer(async (port) => {
      const webLatest = await request(port, {
        path: '/api/announcements/latest',
        cookie: COOKIE,
      })
      expect(webLatest.json.announcement.title).toBe('网站更新')

      const desktopLatest = await request(port, {
        path: '/api/announcements/latest',
        cookie: COOKIE,
        headers: { 'x-yunzhan-client': 'desktop' },
      })
      expect(desktopLatest.json.announcement.title).toBe('桌面更新')
    })
  })

  it('web cannot mark desktop_release as read', async () => {
    await withServer(async (port) => {
      const result = await request(port, {
        method: 'POST',
        path: '/api/announcements/3/read',
        cookie: COOKIE,
      })
      expect(result.status).toBe(404)
    })
  })

  it('desktop cannot mark web_release as read', async () => {
    await withServer(async (port) => {
      const result = await request(port, {
        method: 'POST',
        path: '/api/announcements/2/read',
        cookie: COOKIE,
        headers: { 'x-yunzhan-client': 'desktop' },
      })
      expect(result.status).toBe(404)
    })
  })

  it('general announcement can be marked read on both channels', async () => {
    await withServer(async (port) => {
      const webResult = await request(port, {
        method: 'POST',
        path: '/api/announcements/1/read',
        cookie: COOKIE,
      })
      expect(webResult.status).toBe(200)

      const desktopResult = await request(port, {
        method: 'POST',
        path: '/api/announcements/1/read',
        cookie: COOKIE,
        headers: { 'x-yunzhan-client': 'desktop' },
      })
      expect(desktopResult.status).toBe(200)
    })
  })

  it('read-all marks visible announcements per channel and is idempotent', async () => {
    await withServer(async (port) => {
      const webResult = await request(port, {
        method: 'POST',
        path: '/api/announcements/read-all',
        cookie: COOKIE,
      })
      expect(webResult.status).toBe(200)
      expect(webResult.json).toEqual({ ok: true })

      // 幂等：再次调用同样 200
      const webAgain = await request(port, {
        method: 'POST',
        path: '/api/announcements/read-all',
        cookie: COOKIE,
      })
      expect(webAgain.status).toBe(200)

      const desktopResult = await request(port, {
        method: 'POST',
        path: '/api/announcements/read-all',
        cookie: COOKIE,
        headers: { 'x-yunzhan-client': 'desktop' },
      })
      expect(desktopResult.status).toBe(200)

      // 断言渠道过滤：web 渠道只含 general+web_release，desktop 只含 general+desktop_release
      const readAllCalls = query.mock.calls
        .map(([sql, params]) => ({ sql: String(sql), params }))
        .filter((call) => call.sql.includes('INSERT INTO announcement_reads') && call.sql.includes('NOT EXISTS'))
      expect(readAllCalls.length).toBeGreaterThanOrEqual(3)
      expect(readAllCalls[0].params[1]).toEqual(['general', 'web_release'])
      expect(readAllCalls[1].params[1]).toEqual(['general', 'web_release'])
      expect(readAllCalls[readAllCalls.length - 1].params[1]).toEqual(['general', 'desktop_release'])
    })
  })

  it('read-all requires authentication', async () => {
    await withServer(async (port) => {
      const result = await request(port, {
        method: 'POST',
        path: '/api/announcements/read-all',
      })
      expect(result.status).toBe(401)
    })
  })

  it('admin list still returns all announcement categories', async () => {
    query.mockImplementation(async (sql) => {
      if (String(sql).includes('active_session')) {
        return { rows: [SUPER_ADMIN_ROW] }
      }
      if (String(sql).includes('SELECT a.id, a.title, a.content, a.published_at, a.active')) {
        return {
          rows: Object.values(FIXTURE_ROWS).map((row) => ({
            ...row,
            active: true,
            created_at: PUBLISHED_AT,
            updated_at: PUBLISHED_AT,
            source_key: null,
            source_commit: null,
            generated_by_ai: false,
            generation_provider: null,
            generation_error: null,
          })),
        }
      }
      if (String(sql).includes('SELECT COUNT(*)::INTEGER AS count FROM announcements')) {
        return { rows: [{ count: 3 }] }
      }
      return { rows: [] }
    })

    await withServer(async (port) => {
      const result = await request(port, {
        path: '/api/admin/announcements?limit=20&offset=0',
        cookie: COOKIE,
      })
      expect(result.status).toBe(200)
      expect(result.json.total).toBe(3)
      expect(result.json.announcements.map((item) => item.category).sort()).toEqual([
        'desktop_release',
        'general',
        'web_release',
      ])
    })
  })
})
