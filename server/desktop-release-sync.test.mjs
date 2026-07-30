import crypto from 'node:crypto'
import { ReadableStream } from 'node:stream/web'
import { describe, expect, it, vi } from 'vitest'
import {
  assertLatestYmlMatchesRelease,
  isValidSha512Base64,
  parseLatestYml,
} from './latest-yml.mjs'
import { limitedHttpsFetch } from './limited-fetch.mjs'
import {
  assertPublishedReleaseWebhook,
  buildDesktopReleaseNotesFromChangelog,
  extractValidatedGitHubReleaseAssets,
  fetchGitHubReleaseAssetText,
  fetchGitHubReleaseByTag,
  loadAndValidateLatestYmlFromGitHubAsset,
  syncDesktopReleaseFromGitHubRelease,
  verifyGitHubWebhookSignature,
} from './desktop-release-sync.mjs'

const VERSION = '1.2.7'
const EXE_SIZE = 12_000_000
const VALID_SHA512 = Buffer.alloc(64, 7).toString('base64')
const CHANGELOG = `# 变更日志

## [1.2.7] - 2026-07-30

### 修复
- 修复桌面端更新失败后无法正确重试的问题。[audience:user] (C)
- 公告草稿生成：source_key 已存在时跳过 AI。[audience:admin] (Web)
- 调整 ParticleBg 的 visibilitychange 监听流程。[audience:internal] (B)
`

function asset(name, size = 2_000_000) {
  return {
    name,
    size,
    browser_download_url: `https://github.com/CruiseTom001/yunzhan/releases/download/v${VERSION}/${name}`,
  }
}

function releasePayload(overrides = {}) {
  return {
    id: 12345,
    draft: false,
    prerelease: false,
    tag_name: `v${VERSION}`,
    assets: [
      asset(`yunzhan-setup-${VERSION}.exe`, EXE_SIZE),
      asset(`yunzhan-setup-${VERSION}.exe.blockmap`, 1200),
      asset('latest.yml', 200),
      asset('yunzhan-desktop-release.json', 80),
    ],
    ...overrides,
  }
}

function validLatestYml(overrides = {}) {
  return [
    `version: ${overrides.version ?? VERSION}`,
    `path: ${overrides.path ?? `yunzhan-setup-${VERSION}.exe`}`,
    `sha512: ${overrides.sha512 ?? VALID_SHA512}`,
    `size: ${overrides.size ?? EXE_SIZE}`,
  ].join('\n')
}

function streamResponse(chunks, {
  status = 200,
  headers = {},
  delayMs = 0,
} = {}) {
  let index = 0
  const body = new ReadableStream({
    async pull(controller) {
      if (delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs))
      }
      if (index >= chunks.length) {
        controller.close()
        return
      }
      controller.enqueue(Buffer.from(chunks[index]))
      index += 1
    },
    cancel() {
      streamResponse.lastCancelled = true
    },
  })
  return new Response(body, { status, headers })
}

describe('latest.yml shared parser', () => {
  it('parses valid content and rejects bad sha512', () => {
    const parsed = parseLatestYml(validLatestYml())
    expect(parsed).toEqual({
      version: VERSION,
      path: `yunzhan-setup-${VERSION}.exe`,
      sha512: VALID_SHA512,
      size: EXE_SIZE,
    })
    expect(isValidSha512Base64('abc')).toBe(false)
    expect(() => parseLatestYml(validLatestYml({ sha512: 'abc' }))).toThrow(/sha512 无效/)
    expect(() => parseLatestYml([
      `version: ${VERSION}`,
      `path: yunzhan-setup-${VERSION}.exe`,
      `size: ${EXE_SIZE}`,
    ].join('\n'))).toThrow(/缺少/)
  })

  it('asserts version/path/size against release metadata', () => {
    const parsed = parseLatestYml(validLatestYml())
    expect(() => assertLatestYmlMatchesRelease(parsed, {
      expectedVersion: VERSION,
      expectedExeFileName: `yunzhan-setup-${VERSION}.exe`,
      expectedExeSize: EXE_SIZE,
    })).not.toThrow()
    expect(() => assertLatestYmlMatchesRelease(parsed, {
      expectedVersion: '1.2.6',
      expectedExeFileName: `yunzhan-setup-${VERSION}.exe`,
      expectedExeSize: EXE_SIZE,
    })).toThrow(/version=/)
    expect(() => assertLatestYmlMatchesRelease(parsed, {
      expectedVersion: VERSION,
      expectedExeFileName: 'wrong.exe',
      expectedExeSize: EXE_SIZE,
    })).toThrow(/path=/)
    expect(() => assertLatestYmlMatchesRelease(parsed, {
      expectedVersion: VERSION,
      expectedExeFileName: `yunzhan-setup-${VERSION}.exe`,
      expectedExeSize: 999,
    })).toThrow(/size=/)
  })
})

describe('limitedHttpsFetch', () => {
  const hosts = new Set(['github.com', 'objects.githubusercontent.com', 'api.github.com'])

  it('rejects oversized Content-Length without reading body and cancels body', async () => {
    let readerOpened = false
    let bodyCancelled = false
    const body = {
      getReader() {
        readerOpened = true
        return {
          read: async () => ({ done: true, value: undefined }),
          cancel: async () => {},
          releaseLock() {},
        }
      },
      cancel: async () => {
        bodyCancelled = true
      },
    }
    const fetchImplementation = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      headers: {
        get(name) {
          return name.toLowerCase() === 'content-length' ? '99999' : null
        },
      },
      body,
    })
    await expect(limitedHttpsFetch('https://github.com/a', {
      fetchImplementation,
      maxBytes: 100,
      allowedHosts: hosts,
      errorPrefix: '测试',
    })).rejects.toMatchObject({ code: 'size_limit', statusCode: 400 })
    expect(readerOpened).toBe(false)
    expect(bodyCancelled).toBe(true)
  })

  it('rejects chunked bodies that exceed the limit and cancels the reader', async () => {
    streamResponse.lastCancelled = false
    const fetchImplementation = vi.fn().mockResolvedValue(
      streamResponse(['aaaa', 'bbbb', 'cccc'], {
        headers: {},
      }),
    )
    await expect(limitedHttpsFetch('https://github.com/a', {
      fetchImplementation,
      maxBytes: 6,
      timeoutMs: 5_000,
      allowedHosts: hosts,
      errorPrefix: '测试',
    })).rejects.toMatchObject({ code: 'size_limit' })
    expect(streamResponse.lastCancelled).toBe(true)
  })

  it('times out when body never finishes', async () => {
    const body = new ReadableStream({
      pull() {
        return new Promise(() => {})
      },
      cancel() {
        streamResponse.lastCancelled = true
      },
    })
    streamResponse.lastCancelled = false
    const fetchImplementation = vi.fn().mockResolvedValue(new Response(body, { status: 200 }))
    await expect(limitedHttpsFetch('https://github.com/a', {
      fetchImplementation,
      maxBytes: 1000,
      timeoutMs: 40,
      allowedHosts: hosts,
      errorPrefix: '测试',
    })).rejects.toMatchObject({ code: 'timeout', statusCode: 504 })
    expect(streamResponse.lastCancelled).toBe(true)
  })

  it('fails within total timeoutMs across multiple slow redirects (does not reset)', async () => {
    const hopDelayMs = 35
    const timeoutMs = 80
    const fetchImplementation = vi.fn().mockImplementation((_url, options) => new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        resolve(new Response(null, {
          status: 302,
          headers: { location: 'https://github.com/next' },
        }))
      }, hopDelayMs)
      const onAbort = () => {
        clearTimeout(timer)
        const error = new Error('aborted')
        error.name = 'AbortError'
        reject(error)
      }
      if (options?.signal?.aborted) {
        onAbort()
        return
      }
      options?.signal?.addEventListener('abort', onAbort, { once: true })
    }))

    const startedAt = Date.now()
    await expect(limitedHttpsFetch('https://github.com/a', {
      fetchImplementation,
      maxBytes: 100,
      timeoutMs,
      maxRedirects: 5,
      allowedHosts: hosts,
      errorPrefix: '测试',
    })).rejects.toMatchObject({ code: 'timeout', statusCode: 504 })
    const elapsedMs = Date.now() - startedAt
    expect(elapsedMs).toBeLessThan(timeoutMs + 120)
    // 若每次重定向重置 80ms，5 次慢跳转会远超；这里应在总超时附近失败。
    expect(elapsedMs).toBeLessThan(hopDelayMs * 5)
    expect(fetchImplementation.mock.calls.length).toBeLessThanOrEqual(3)
  })

  it('does not reset timeout budget after a redirect', async () => {
    // 使用更大的时间窗口，避免机器抖动导致第二次 fetch 尚未发起就已超时。
    // 首跳 120ms + 次跳 120ms = 240ms > 总超时 200ms：共享预算应超时；
    // 若重定向后重置超时，次跳会在新的 200ms 内成功返回。
    const timeoutMs = 200
    let call = 0
    const fetchImplementation = vi.fn().mockImplementation((_url, options) => new Promise((resolve, reject) => {
      call += 1
      const delayMs = 120
      const timer = setTimeout(() => {
        if (call === 1) {
          resolve(new Response(null, {
            status: 302,
            headers: { location: 'https://github.com/final' },
          }))
          return
        }
        resolve(new Response('ok', { status: 200 }))
      }, delayMs)
      const onAbort = () => {
        clearTimeout(timer)
        const error = new Error('aborted')
        error.name = 'AbortError'
        reject(error)
      }
      if (options?.signal?.aborted) {
        onAbort()
        return
      }
      options?.signal?.addEventListener('abort', onAbort, { once: true })
    }))

    const startedAt = Date.now()
    await expect(limitedHttpsFetch('https://github.com/a', {
      fetchImplementation,
      maxBytes: 100,
      timeoutMs,
      allowedHosts: hosts,
      errorPrefix: '测试',
    })).rejects.toMatchObject({ code: 'timeout', statusCode: 504 })
    expect(Date.now() - startedAt).toBeLessThan(timeoutMs + 200)
    expect(fetchImplementation).toHaveBeenCalledTimes(2)
  })

  it('rejects redirects to non-GitHub hosts and redirect floods', async () => {
    const evil = vi.fn().mockResolvedValue(new Response(null, {
      status: 302,
      headers: { location: 'https://evil.example/x' },
    }))
    await expect(limitedHttpsFetch('https://github.com/a', {
      fetchImplementation: evil,
      maxBytes: 100,
      allowedHosts: hosts,
      errorPrefix: '测试',
    })).rejects.toMatchObject({ code: 'fetch_host_not_allowed' })

    const loop = vi.fn().mockResolvedValue(new Response(null, {
      status: 302,
      headers: { location: 'https://github.com/b' },
    }))
    await expect(limitedHttpsFetch('https://github.com/a', {
      fetchImplementation: loop,
      maxBytes: 100,
      maxRedirects: 1,
      allowedHosts: hosts,
      errorPrefix: '测试',
    })).rejects.toMatchObject({ code: 'redirect_limit' })
  })
})

describe('verifyGitHubWebhookSignature', () => {
  const secret = 'test-webhook-secret'
  const rawBody = Buffer.from('{"action":"published"}')

  function sign(body, key = secret) {
    return `sha256=${crypto.createHmac('sha256', key).update(body).digest('hex')}`
  }

  it('requires secret and valid signature', () => {
    expect(() => verifyGitHubWebhookSignature({
      rawBody,
      signatureHeader: sign(rawBody),
      secret: '',
    })).toThrow(/未配置/)
    expect(() => verifyGitHubWebhookSignature({
      rawBody,
      signatureHeader: sign(rawBody, 'wrong'),
      secret,
    })).toThrow(/校验失败/)
    expect(() => verifyGitHubWebhookSignature({
      rawBody,
      signatureHeader: sign(rawBody),
      secret,
    })).not.toThrow()
  })
})

describe('GitHub release asset validation', () => {
  it('returns latestYmlDownloadUrl/exeSize/exeFileName', () => {
    const result = extractValidatedGitHubReleaseAssets(releasePayload())
    expect(result.latestYmlDownloadUrl).toContain('latest.yml')
    expect(result.exeSize).toBe(EXE_SIZE)
    expect(result.exeFileName).toBe(`yunzhan-setup-${VERSION}.exe`)
  })

  it('rejects draft/prerelease/missing/illegal URLs', () => {
    expect(() => extractValidatedGitHubReleaseAssets(releasePayload({ draft: true }))).toThrow(/草稿/)
    expect(() => extractValidatedGitHubReleaseAssets(releasePayload({
      assets: releasePayload().assets.filter(item => item.name !== 'latest.yml'),
    }))).toThrow(/缺少 Release 资产/)
  })
})

describe('latest.yml download validation', () => {
  it('accepts matching latest.yml and rejects mismatches / oversized body', async () => {
    const okFetch = vi.fn().mockResolvedValue(new Response(validLatestYml(), {
      status: 200,
      headers: { 'content-length': String(Buffer.byteLength(validLatestYml())) },
    }))
    await expect(loadAndValidateLatestYmlFromGitHubAsset({
      latestYmlDownloadUrl: `https://github.com/CruiseTom001/yunzhan/releases/download/v${VERSION}/latest.yml`,
      expectedVersion: VERSION,
      expectedExeFileName: `yunzhan-setup-${VERSION}.exe`,
      expectedExeSize: EXE_SIZE,
      fetchImplementation: okFetch,
    })).resolves.toMatchObject({ version: VERSION, size: EXE_SIZE })

    const badVersion = vi.fn().mockResolvedValue(new Response(validLatestYml({ version: '1.2.6' }), { status: 200 }))
    await expect(loadAndValidateLatestYmlFromGitHubAsset({
      latestYmlDownloadUrl: `https://github.com/CruiseTom001/yunzhan/releases/download/v${VERSION}/latest.yml`,
      expectedVersion: VERSION,
      expectedExeFileName: `yunzhan-setup-${VERSION}.exe`,
      expectedExeSize: EXE_SIZE,
      fetchImplementation: badVersion,
    })).rejects.toThrow(/version=/)

    const oversized = vi.fn().mockResolvedValue(new Response('x'.repeat(70 * 1024), {
      status: 200,
      headers: { 'content-length': String(70 * 1024) },
    }))
    await expect(fetchGitHubReleaseAssetText(
      `https://github.com/CruiseTom001/yunzhan/releases/download/v${VERSION}/latest.yml`,
      { fetchImplementation: oversized, maxBytes: 64 * 1024 },
    )).rejects.toMatchObject({ code: 'size_limit' })
  })
})

describe('GitHub API fetch limits', () => {
  it('times out and rejects oversized / illegal JSON', async () => {
    const slow = vi.fn().mockImplementation((_url, options) => new Promise((_resolve, reject) => {
      const onAbort = () => {
        const error = new Error('aborted')
        error.name = 'AbortError'
        reject(error)
      }
      if (options?.signal?.aborted) {
        onAbort()
        return
      }
      options?.signal?.addEventListener('abort', onAbort, { once: true })
    }))
    await expect(fetchGitHubReleaseByTag(VERSION, {
      fetchImplementation: slow,
      timeoutMs: 40,
    })).rejects.toMatchObject({ code: 'timeout' })

    const big = vi.fn().mockResolvedValue(new Response('x'.repeat(100), {
      status: 200,
      headers: { 'content-length': String(2 * 1024 * 1024) },
    }))
    await expect(fetchGitHubReleaseByTag(VERSION, {
      fetchImplementation: big,
    })).rejects.toMatchObject({ code: 'size_limit' })

    const badJson = vi.fn().mockResolvedValue(new Response('{', { status: 200 }))
    await expect(fetchGitHubReleaseByTag(VERSION, {
      fetchImplementation: badJson,
    })).rejects.toThrow(/非法 JSON/)
  })
})

describe('assertPublishedReleaseWebhook', () => {
  it('ignores non-release events and rejects wrong repository', () => {
    expect(assertPublishedReleaseWebhook({ action: 'published', repository: { full_name: 'CruiseTom001/yunzhan' }, release: {} }, {
      eventName: 'ping',
    }).ignored).toBe(true)
    expect(() => assertPublishedReleaseWebhook({
      action: 'published',
      repository: { full_name: 'other/repo' },
      release: {},
    }, { eventName: 'release' })).toThrow(/仓库不匹配/)
  })
})

describe('buildDesktopReleaseNotesFromChangelog', () => {
  it('keeps only desktop user-facing notes', () => {
    const notes = buildDesktopReleaseNotesFromChangelog(VERSION, CHANGELOG)
    expect(notes).toContain('桌面端更新失败')
    expect(notes).not.toContain('ParticleBg')
  })
})

describe('syncDesktopReleaseFromGitHubRelease end-to-end validation', () => {
  it('creates only when manifest and latest.yml both match', async () => {
    const queries = []
    const client = {
      query: vi.fn(async (sql, params) => {
        queries.push({ sql: String(sql), params })
        if (String(sql).includes('WHERE version = $1') && !String(sql).includes('WITH inserted')) {
          return { rows: [] }
        }
        if (String(sql).includes('WITH inserted AS')) {
          return {
            rows: [{
              id: 1,
              version: VERSION,
              min_supported: '1.2.5',
              download_url: `https://github.com/CruiseTom001/yunzhan/releases/download/v${VERSION}/yunzhan-setup-${VERSION}.exe`,
              release_notes: '修复桌面端更新失败后无法正确重试的问题。',
              enabled: 0,
              created_at: new Date(),
              updated_at: new Date(),
            }],
          }
        }
        return { rows: [] }
      }),
    }
    const fetchImplementation = vi.fn(async (url) => {
      if (String(url).includes('yunzhan-desktop-release.json')) {
        return new Response(JSON.stringify({
          schemaVersion: 1,
          version: VERSION,
          minSupported: '1.2.5',
        }), { status: 200 })
      }
      if (String(url).includes('latest.yml')) {
        return new Response(validLatestYml(), { status: 200 })
      }
      throw new Error(`unexpected url ${url}`)
    })

    const result = await syncDesktopReleaseFromGitHubRelease(client, releasePayload(), {
      changelogMarkdown: CHANGELOG,
      fetchImplementation,
      audit: {
        action: 'desktop_release.sync_from_github',
        actorUserId: null,
        targetUserId: null,
        metadata: { source: 'test' },
      },
    })
    expect(result.created).toBe(true)
    expect(result.release.enabled).toBe(false)
    expect(queries.some(item => item.sql.includes('WITH inserted AS'))).toBe(true)
  })

  it('does not write DB when latest.yml mismatches', async () => {
    const client = { query: vi.fn() }
    const fetchImplementation = vi.fn(async (url) => {
      if (String(url).includes('yunzhan-desktop-release.json')) {
        return new Response(JSON.stringify({
          schemaVersion: 1,
          version: VERSION,
          minSupported: '1.2.5',
        }), { status: 200 })
      }
      return new Response(validLatestYml({ size: 1 }), { status: 200 })
    })
    await expect(syncDesktopReleaseFromGitHubRelease(client, releasePayload(), {
      changelogMarkdown: CHANGELOG,
      fetchImplementation,
      audit: {
        action: 'desktop_release.sync_from_github',
        actorUserId: null,
        targetUserId: null,
        metadata: { source: 'test' },
      },
    })).rejects.toThrow(/size=/)
    expect(client.query).not.toHaveBeenCalled()
  })

  it('does not write desktop_releases or audit_logs when asset fetch times out', async () => {
    const client = { query: vi.fn() }
    const fetchImplementation = vi.fn((_url, options) => new Promise((_resolve, reject) => {
      const onAbort = () => {
        const error = new Error('aborted')
        error.name = 'AbortError'
        reject(error)
      }
      if (options?.signal?.aborted) {
        onAbort()
        return
      }
      options?.signal?.addEventListener('abort', onAbort, { once: true })
    }))
    await expect(syncDesktopReleaseFromGitHubRelease(client, releasePayload(), {
      changelogMarkdown: CHANGELOG,
      fetchImplementation,
      timeoutMs: 40,
      audit: {
        action: 'desktop_release.sync_from_github',
        actorUserId: null,
        targetUserId: null,
        metadata: { source: 'test' },
      },
    })).rejects.toMatchObject({ code: 'timeout', statusCode: 504 })
    expect(client.query).not.toHaveBeenCalled()
  })
})
