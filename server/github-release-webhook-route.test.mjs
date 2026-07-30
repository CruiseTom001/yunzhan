import crypto from 'node:crypto'
import http from 'node:http'
import { beforeEach, describe, expect, it, vi } from 'vitest'

process.env.VERCEL = '1'
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@127.0.0.1:5432/yunzhan_test'
process.env.APP_ORIGIN = process.env.APP_ORIGIN || 'http://127.0.0.1:5173'
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-session-secret-at-least-32-chars!!'
process.env.GITHUB_RELEASE_WEBHOOK_SECRET = 'unit-test-github-webhook-secret'

const query = vi.fn()

vi.mock('./db.mjs', () => ({
  pool: {
    query: (...args) => query(...args),
    connect: vi.fn(),
    end: vi.fn(),
  },
  withTransaction: async (callback) => callback({ query }),
}))

vi.mock('./desktop-release-sync.mjs', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    syncDesktopReleaseFromGitHubRelease: vi.fn(actual.syncDesktopReleaseFromGitHubRelease),
    fetchGitHubReleaseAssetText: vi.fn(async () => JSON.stringify({
      schemaVersion: 1,
      version: '1.2.7',
      minSupported: '1.2.5',
    })),
    buildDesktopReleaseNotesFromChangelog: vi.fn(() => '修复桌面端更新失败后无法正确重试的问题。'),
  }
})

const { default: app } = await import('./index.mjs')
const sync = await import('./desktop-release-sync.mjs')

const PATH = '/api/integrations/github/releases'
const SECRET = process.env.GITHUB_RELEASE_WEBHOOK_SECRET

function sign(rawBody) {
  return `sha256=${crypto.createHmac('sha256', SECRET).update(rawBody).digest('hex')}`
}

function releaseBody(overrides = {}) {
  const version = '1.2.7'
  const body = {
    action: 'published',
    repository: { full_name: 'CruiseTom001/yunzhan' },
    release: {
      id: 99,
      draft: false,
      prerelease: false,
      tag_name: `v${version}`,
      assets: [
        {
          name: `yunzhan-setup-${version}.exe`,
          size: 12_000_000,
          browser_download_url: `https://github.com/CruiseTom001/yunzhan/releases/download/v${version}/yunzhan-setup-${version}.exe`,
        },
        {
          name: `yunzhan-setup-${version}.exe.blockmap`,
          size: 1000,
          browser_download_url: `https://github.com/CruiseTom001/yunzhan/releases/download/v${version}/yunzhan-setup-${version}.exe.blockmap`,
        },
        {
          name: 'latest.yml',
          size: 200,
          browser_download_url: `https://github.com/CruiseTom001/yunzhan/releases/download/v${version}/latest.yml`,
        },
        {
          name: 'yunzhan-desktop-release.json',
          size: 80,
          browser_download_url: `https://github.com/CruiseTom001/yunzhan/releases/download/v${version}/yunzhan-desktop-release.json`,
        },
      ],
    },
    ...overrides,
  }
  return Buffer.from(JSON.stringify(body))
}

async function withServer(run) {
  const server = http.createServer(app)
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address()
  try {
    return await run(port)
  } finally {
    await new Promise(resolve => server.close(resolve))
  }
}

async function postWebhook(port, {
  rawBody,
  signature,
  event = 'release',
  delivery = '11111111-1111-4111-8111-111111111111',
}) {
  const response = await fetch(`http://127.0.0.1:${port}${PATH}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-hub-signature-256': signature,
      'x-github-event': event,
      'x-github-delivery': delivery,
    },
    body: rawBody,
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

describe('POST /api/integrations/github/releases', () => {
  beforeEach(() => {
    query.mockReset()
    sync.syncDesktopReleaseFromGitHubRelease.mockClear()
    process.env.GITHUB_RELEASE_WEBHOOK_SECRET = SECRET
  })

  it('returns 503 when secret is missing', async () => {
    const previous = process.env.GITHUB_RELEASE_WEBHOOK_SECRET
    delete process.env.GITHUB_RELEASE_WEBHOOK_SECRET
    await withServer(async (port) => {
      const rawBody = releaseBody()
      const result = await postWebhook(port, {
        rawBody,
        signature: sign(rawBody),
      })
      expect(result.status).toBe(503)
      expect(result.json.code).toBe('webhook_secret_missing')
    })
    process.env.GITHUB_RELEASE_WEBHOOK_SECRET = previous
  })

  it('rejects missing or wrong signatures', async () => {
    await withServer(async (port) => {
      const rawBody = releaseBody()
      const missing = await postWebhook(port, { rawBody, signature: '' })
      expect(missing.status).toBe(401)

      const wrong = await postWebhook(port, {
        rawBody,
        signature: sign(Buffer.from('{"action":"tampered"}')),
      })
      expect(wrong.status).toBe(401)
    })
  })

  it('ignores non-release and non-published events after signature verification', async () => {
    await withServer(async (port) => {
      const pingBody = Buffer.from(JSON.stringify({ zen: 'ok' }))
      const ping = await postWebhook(port, {
        rawBody: pingBody,
        signature: sign(pingBody),
        event: 'ping',
      })
      expect(ping.status).toBe(202)
      expect(ping.json.ignored).toBe(true)

      const createdBody = releaseBody({ action: 'created' })
      const created = await postWebhook(port, {
        rawBody: createdBody,
        signature: sign(createdBody),
      })
      expect(created.status).toBe(202)
      expect(created.json.reason).toBe('action_not_published')
    })
  })

  it('creates disabled desktop release for published event', async () => {
    sync.syncDesktopReleaseFromGitHubRelease.mockResolvedValueOnce({
      created: true,
      alreadyExists: false,
      release: {
        id: 1,
        version: '1.2.7',
        minSupported: '1.2.5',
        downloadUrl: 'https://github.com/CruiseTom001/yunzhan/releases/download/v1.2.7/yunzhan-setup-1.2.7.exe',
        releaseNotes: '修复桌面端更新失败后无法正确重试的问题。',
        enabled: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    })
    await withServer(async (port) => {
      const rawBody = releaseBody()
      const result = await postWebhook(port, {
        rawBody,
        signature: sign(rawBody),
      })
      expect(result.status).toBe(201)
      expect(result.json.created).toBe(true)
      expect(result.json.release.enabled).toBe(false)
      expect(sync.syncDesktopReleaseFromGitHubRelease).toHaveBeenCalledTimes(1)
    })
  })

  it('returns alreadyExists for duplicate version without overwrite', async () => {
    sync.syncDesktopReleaseFromGitHubRelease.mockResolvedValueOnce({
      created: false,
      alreadyExists: true,
      release: {
        id: 2,
        version: '1.2.7',
        minSupported: '1.2.5',
        downloadUrl: 'https://github.com/CruiseTom001/yunzhan/releases/download/v1.2.7/yunzhan-setup-1.2.7.exe',
        releaseNotes: '旧说明',
        enabled: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    })
    await withServer(async (port) => {
      const rawBody = releaseBody()
      const result = await postWebhook(port, {
        rawBody,
        signature: sign(rawBody),
      })
      expect(result.status).toBe(200)
      expect(result.json.alreadyExists).toBe(true)
      expect(result.json.release.releaseNotes).toBe('旧说明')
    })
  })
})
