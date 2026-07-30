import { describe, expect, it, vi } from 'vitest'
import {
  generateReleaseAnnouncementPair,
  resolvePairGenerateChangelogContext,
} from './generate-release-announcement-pair.mjs'

const CHANGELOG = `# 变更日志

## [1.2.8] - 2026-07-30

### 新增
- 网站公告中心支持筛选。[audience:user] (B)
- 桌面端更新提示更清晰。[audience:user] (C)
- 后台审计入口调整。[audience:admin] (Web)
- 构建脚本清理。[audience:internal] (Web)
`

const WEB_ONLY_CHANGELOG = `# 变更日志

## [1.2.8] - 2026-07-30

### 修复
- 仅网站侧修复。[audience:user] (Web)
`

function announcement(category, {
  active = false,
  id = category === 'web_release' ? '1' : '2',
} = {}) {
  return {
    id,
    title: `${category} title`,
    content: `${category} content`,
    publishedAt: 1,
    active,
    createdAt: 1,
    updatedAt: 1,
    category,
    version: '1.2.8',
    sourceKey: `${category}:1.2.8`,
    sourceCommit: null,
    generatedByAi: false,
    generationProvider: null,
    generationError: null,
  }
}

describe('resolvePairGenerateChangelogContext', () => {
  it('requires version or sourceCommit', async () => {
    await expect(resolvePairGenerateChangelogContext({})).rejects.toMatchObject({
      statusCode: 400,
      code: 'version_or_commit_required',
    })
  })

  it('resolves version-only from provided changelog markdown', async () => {
    const result = await resolvePairGenerateChangelogContext({
      version: '1.2.8',
      changelogMarkdown: CHANGELOG,
    })
    expect(result.version).toBe('1.2.8')
    expect(result.sourceCommit).toBeNull()
    expect(result.changelogEntry).toContain('网站公告中心')
  })

  it('rejects version/commit mismatch from GitHub package.json', async () => {
    const fetchImplementation = vi.fn(async (url) => {
      if (String(url).includes('package.json')) {
        return new Response(JSON.stringify({ version: '1.2.7' }), { status: 200 })
      }
      return new Response(CHANGELOG, { status: 200 })
    })
    await expect(resolvePairGenerateChangelogContext({
      version: '1.2.8',
      sourceCommit: 'abcdef1',
      fetchImplementation,
    })).rejects.toMatchObject({
      statusCode: 400,
      code: 'version_commit_mismatch',
    })
  })

  it('resolves commit-only safely from GitHub without local guessing', async () => {
    const fetchImplementation = vi.fn(async (url) => {
      if (String(url).includes('package.json')) {
        return new Response(JSON.stringify({ name: 'yunzhan', version: '1.2.8' }), { status: 200 })
      }
      return new Response(CHANGELOG, { status: 200 })
    })
    const result = await resolvePairGenerateChangelogContext({
      sourceCommit: 'Abcdef1',
      fetchImplementation,
    })
    expect(result.version).toBe('1.2.8')
    expect(result.sourceCommit).toBe('abcdef1')
    expect(fetchImplementation).toHaveBeenCalled()
  })

  it('fails commit-only resolve when changelog lacks the package version', async () => {
    const fetchImplementation = vi.fn(async (url) => {
      if (String(url).includes('package.json')) {
        return new Response(JSON.stringify({ version: '9.9.9' }), { status: 200 })
      }
      return new Response('# 变更日志\n\n## [1.2.8]\n\n- x\n', { status: 200 })
    })
    await expect(resolvePairGenerateChangelogContext({
      sourceCommit: 'abcdef1',
      fetchImplementation,
    })).rejects.toMatchObject({
      statusCode: 422,
      code: 'changelog_version_missing',
    })
  })
})

describe('generateReleaseAnnouncementPair', () => {
  it('creates web and desktop inactive drafts in one call', async () => {
    const draft = vi.fn()
      .mockResolvedValueOnce({
        created: true,
        repaired: false,
        announcement: announcement('web_release'),
      })
      .mockResolvedValueOnce({
        created: true,
        repaired: false,
        announcement: announcement('desktop_release'),
      })

    const result = await generateReleaseAnnouncementPair({ query: vi.fn() }, {
      version: '1.2.8',
      actorUserId: '00000000-0000-4000-8000-000000000001',
      changelogMarkdown: CHANGELOG,
      generateDraft: draft,
    })

    expect(result.version).toBe('1.2.8')
    expect(result.results.web.status).toBe('created')
    expect(result.results.desktop.status).toBe('created')
    expect(draft).toHaveBeenCalledTimes(2)
    expect(draft.mock.calls[0][1].category).toBe('web_release')
    expect(draft.mock.calls[1][1].category).toBe('desktop_release')
    expect(draft.mock.calls[0][1].repairExistingGeneric).toBe(false)
    expect(draft.mock.calls[0][1].auditContext.action).toBe('announcement.generate_pair_from_changelog')
  })

  it('supports web already_exists and desktop created', async () => {
    const draft = vi.fn()
      .mockResolvedValueOnce({
        created: false,
        repaired: false,
        announcement: announcement('web_release'),
      })
      .mockResolvedValueOnce({
        created: true,
        repaired: false,
        announcement: announcement('desktop_release'),
      })
    const result = await generateReleaseAnnouncementPair({ query: vi.fn() }, {
      version: '1.2.8',
      actorUserId: '00000000-0000-4000-8000-000000000001',
      changelogMarkdown: CHANGELOG,
      generateDraft: draft,
    })
    expect(result.results.web.status).toBe('already_exists')
    expect(result.results.desktop.status).toBe('created')
  })

  it('supports desktop already_exists and web created', async () => {
    const draft = vi.fn()
      .mockResolvedValueOnce({
        created: true,
        repaired: false,
        announcement: announcement('web_release'),
      })
      .mockResolvedValueOnce({
        created: false,
        repaired: false,
        announcement: announcement('desktop_release'),
      })
    const result = await generateReleaseAnnouncementPair({ query: vi.fn() }, {
      version: '1.2.8',
      actorUserId: '00000000-0000-4000-8000-000000000001',
      changelogMarkdown: CHANGELOG,
      generateDraft: draft,
    })
    expect(result.results.web.status).toBe('created')
    expect(result.results.desktop.status).toBe('already_exists')
  })

  it('returns skipped when a channel has no user-facing content', async () => {
    const draft = vi.fn()
      .mockResolvedValueOnce({
        created: false,
        repaired: false,
        skipped: true,
        announcement: {
          ...announcement('web_release'),
          id: null,
          generationError: '本版本没有用户侧公告内容。',
        },
      })
      .mockResolvedValueOnce({
        created: true,
        repaired: false,
        announcement: announcement('desktop_release'),
      })
    const result = await generateReleaseAnnouncementPair({ query: vi.fn() }, {
      version: '1.2.8',
      actorUserId: '00000000-0000-4000-8000-000000000001',
      changelogMarkdown: WEB_ONLY_CHANGELOG,
      generateDraft: draft,
    })
    expect(result.results.web.status).toBe('skipped')
    expect(result.results.web.announcement).toBeNull()
    expect(result.results.web.message).toBe('本版本没有用户侧公告内容。')
    expect(result.results.desktop.status).toBe('created')
    expect(result.results.desktop.announcement).toEqual(announcement('desktop_release'))
  })

  it('normalizes skipped placeholder announcement with id:null to announcement:null', async () => {
    const draft = vi.fn()
      .mockResolvedValueOnce({
        created: false,
        repaired: false,
        skipped: true,
        announcement: {
          id: null,
          title: '',
          content: '',
          publishedAt: 0,
          active: false,
          createdAt: 0,
          updatedAt: 0,
          category: 'web_release',
          version: '1.2.8',
          sourceKey: 'web_release:1.2.8',
          sourceCommit: null,
          generatedByAi: false,
          generationProvider: null,
          generationError: '本版本没有用户侧公告内容。',
        },
      })
      .mockResolvedValueOnce({
        created: true,
        repaired: false,
        announcement: announcement('desktop_release'),
      })
    const pairJson = await generateReleaseAnnouncementPair({ query: vi.fn() }, {
      version: '1.2.8',
      actorUserId: '00000000-0000-4000-8000-000000000001',
      changelogMarkdown: WEB_ONLY_CHANGELOG,
      generateDraft: draft,
    })
    expect(JSON.parse(JSON.stringify(pairJson))).toEqual({
      version: '1.2.8',
      sourceCommit: null,
      results: {
        web: {
          status: 'skipped',
          announcement: null,
          message: '本版本没有用户侧公告内容。',
        },
        desktop: {
          status: 'created',
          announcement: announcement('desktop_release'),
          message: '桌面端草稿已创建（仍为未发布）。',
        },
      },
    })
  })

  it('does not lose the other channel when one fails', async () => {
    const draft = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('AI boom'), { statusCode: 502 }))
      .mockResolvedValueOnce({
        created: true,
        repaired: false,
        announcement: announcement('desktop_release'),
      })
    const result = await generateReleaseAnnouncementPair({ query: vi.fn() }, {
      version: '1.2.8',
      actorUserId: '00000000-0000-4000-8000-000000000001',
      changelogMarkdown: CHANGELOG,
      generateDraft: draft,
    })
    expect(result.results.web.status).toBe('failed')
    expect(result.results.web.message).toContain('AI boom')
    expect(result.results.desktop.status).toBe('created')
  })

  it('marks published announcement as already_exists', async () => {
    const draft = vi.fn()
      .mockResolvedValueOnce({
        created: false,
        repaired: false,
        announcement: announcement('web_release', { active: true }),
      })
      .mockResolvedValueOnce({
        created: false,
        repaired: false,
        announcement: announcement('desktop_release'),
      })
    const result = await generateReleaseAnnouncementPair({ query: vi.fn() }, {
      version: '1.2.8',
      actorUserId: '00000000-0000-4000-8000-000000000001',
      changelogMarkdown: CHANGELOG,
      generateDraft: draft,
    })
    expect(result.results.web.status).toBe('already_exists')
    expect(result.results.web.message).toContain('已发布')
    expect(result.results.desktop.status).toBe('already_exists')
  })

  it('repeat calls keep already_exists and do not invent new statuses', async () => {
    const draft = vi.fn().mockResolvedValue({
      created: false,
      repaired: false,
      announcement: announcement('web_release'),
    })
    const first = await generateReleaseAnnouncementPair({ query: vi.fn() }, {
      version: '1.2.8',
      actorUserId: '00000000-0000-4000-8000-000000000001',
      changelogMarkdown: CHANGELOG,
      generateDraft: draft,
    })
    const second = await generateReleaseAnnouncementPair({ query: vi.fn() }, {
      version: '1.2.8',
      actorUserId: '00000000-0000-4000-8000-000000000001',
      changelogMarkdown: CHANGELOG,
      generateDraft: draft,
    })
    expect(first.results.web.status).toBe('already_exists')
    expect(second.results.web.status).toBe('already_exists')
    expect(draft).toHaveBeenCalledTimes(4)
  })
})
