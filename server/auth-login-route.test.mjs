import http from 'node:http'
import { beforeEach, describe, expect, it, vi } from 'vitest'

process.env.VERCEL = '1'
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@127.0.0.1:5432/yunzhan_test'
process.env.APP_ORIGIN = process.env.APP_ORIGIN || 'http://127.0.0.1:5173'
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-session-secret-at-least-32-chars!!'

const query = vi.fn()

vi.mock('bcryptjs', () => ({
  default: {
    compare: vi.fn(async () => true),
    hash: vi.fn(async () => 'hashed'),
  },
}))

vi.mock('./db.mjs', () => ({
  pool: {
    query: (...args) => query(...args),
    connect: vi.fn(),
    end: vi.fn(),
  },
  withTransaction: async (callback) => callback({ query }),
}))

const { default: app } = await import('./index.mjs')

const ACTIVE_USER = {
  id: '33333333-3333-4333-8333-333333333333',
  username: 'user',
  display_name: '用户',
  email: 'user@example.com',
  password_hash: 'hashed',
  role: 'user',
  status: 'active',
  created_at: new Date('2026-01-01T00:00:00Z'),
  updated_at: new Date('2026-01-01T00:00:00Z'),
  email_verified_at: new Date('2026-01-01T00:00:00Z'),
  last_login_at: null,
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

async function loginRequest(port, body) {
  const response = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: process.env.APP_ORIGIN,
    },
    body: JSON.stringify(body),
  })
  const text = await response.text()
  const json = text ? JSON.parse(text) : null
  return {
    status: response.status,
    json,
    setCookie: response.headers.get('set-cookie') ?? '',
  }
}

describe('POST /api/auth/login remember cookie', () => {
  beforeEach(() => {
    query.mockReset()
    query.mockImplementation(async (sql) => {
      if (String(sql).includes('FROM login_attempts')) {
        return { rows: [{ attempt_count: 0 }] }
      }
      if (String(sql).includes('SELECT * FROM users WHERE email')) {
        return { rows: [ACTIVE_USER] }
      }
      if (String(sql).includes('SELECT * FROM users WHERE LOWER(username)')) {
        return { rows: [] }
      }
      if (String(sql).includes('DELETE FROM login_attempts')) {
        return { rowCount: 1 }
      }
      if (String(sql).includes('DELETE FROM sessions WHERE expires_at')) {
        return { rowCount: 0 }
      }
      if (String(sql).includes('INSERT INTO sessions')) {
        return { rowCount: 1 }
      }
      if (String(sql).includes('UPDATE users SET last_login_at')) {
        return { rowCount: 1 }
      }
      if (String(sql).includes('INSERT INTO audit_logs')) {
        return { rowCount: 1 }
      }
      if (String(sql).includes('active_session')) {
        return { rows: [ACTIVE_USER] }
      }
      if (String(sql).includes('DELETE FROM sessions WHERE token_hash')) {
        return { rowCount: 1 }
      }
      return { rows: [] }
    })
  })

  it('sets Max-Age cookie when remember=true', async () => {
    await withServer(async (port) => {
      const result = await loginRequest(port, {
        username: 'user@example.com',
        password: 'ValidPass123',
        remember: true,
      })
      expect(result.status).toBe(200)
      expect(result.setCookie).toContain('Max-Age=')
      expect(result.setCookie).toContain('HttpOnly')
      expect(result.setCookie).toContain('Path=/')
      expect(result.json.token).toBeUndefined()
      expect(result.json.user.username).toBe('user')
    })
  })

  it('sets session cookie without Max-Age when remember=false', async () => {
    await withServer(async (port) => {
      const result = await loginRequest(port, {
        username: 'user@example.com',
        password: 'ValidPass123',
        remember: false,
      })
      expect(result.status).toBe(200)
      expect(result.setCookie).not.toMatch(/Max-Age=/i)
      expect(result.setCookie).not.toMatch(/Expires=/i)
      expect(result.setCookie).toContain('HttpOnly')
    })
  })

  it('defaults to persistent cookie when remember is omitted', async () => {
    await withServer(async (port) => {
      const result = await loginRequest(port, {
        username: 'user@example.com',
        password: 'ValidPass123',
      })
      expect(result.status).toBe(200)
      expect(result.setCookie).toContain('Max-Age=')
    })
  })

  it('returns 400 for invalid remember type', async () => {
    await withServer(async (port) => {
      const result = await loginRequest(port, {
        username: 'user@example.com',
        password: 'ValidPass123',
        remember: 'yes',
      })
      expect(result.status).toBe(400)
      expect(result.json.error).toMatch(/保持登录/)
    })
  })

  it('keeps login failure behavior for invalid credentials', async () => {
    query.mockImplementation(async (sql) => {
      if (String(sql).includes('FROM login_attempts')) return { rows: [{ attempt_count: 0 }] }
      if (String(sql).includes('SELECT * FROM users')) return { rows: [] }
      if (String(sql).includes('INSERT INTO login_attempts')) return { rowCount: 1 }
      return { rows: [] }
    })
    await withServer(async (port) => {
      const result = await loginRequest(port, {
        username: 'user@example.com',
        password: 'ValidPass123',
        remember: false,
      })
      expect(result.status).toBe(401)
      expect(result.setCookie).toBe('')
    })
  })
})

describe('POST /api/auth/logout', () => {
  beforeEach(() => {
    query.mockReset()
    query.mockImplementation(async (sql) => {
      if (String(sql).includes('active_session')) {
        return { rows: [{ ...ACTIVE_USER, session_id: '22222222-2222-4222-8222-222222222222' }] }
      }
      if (String(sql).includes('DELETE FROM sessions WHERE token_hash')) {
        return { rowCount: 1 }
      }
      return { rows: [] }
    })
  })

  it('clears session cookie on logout', async () => {
    await withServer(async (port) => {
      const response = await fetch(`http://127.0.0.1:${port}/api/auth/logout`, {
        method: 'POST',
        headers: {
          cookie: 'yunzhan_session=abcdefghijklmnopqrstuvwxyz0123456789abcd',
          origin: process.env.APP_ORIGIN,
        },
      })
      expect(response.status).toBe(200)
      const setCookie = response.headers.get('set-cookie') ?? ''
      expect(setCookie).toContain('yunzhan_session=')
      expect(setCookie.toLowerCase()).toMatch(/max-age=0|expires=/)
    })
  })
})
