import { describe, expect, it, vi } from 'vitest'
import {
  buildEmptyFilteredReleaseAnnouncementContent,
  buildGenericReleaseAnnouncementContent,
  buildReleaseAnnouncementFallback,
  buildReleaseAnnouncementSourceKey,
  collectFactSnippets,
  composeAnnouncementWithSummary,
  EMPTY_FILTERED_RELEASE_NOTICE,
  extractAudienceMarker,
  extractChangelogEntryFromMarkdown,
  formatChangelogForAnnouncement,
  generateReleaseAnnouncementDraft,
  isGenericReleaseAnnouncementContent,
  polishReleaseAnnouncement,
  readChangelogFile,
  regenerateAnnouncementFromChangelog,
  resolveChangelogPathCandidates,
  repolishAnnouncementDraft,
  resolveAnnouncementAiProviderId,
  shouldIncludeChangelogItem,
  stripQuadrantMarkersFromText,
  validateAiOpeningSummary,
} from './announcement-generation.mjs'

const NOW = new Date('2026-07-29T06:00:00Z')
const FLASH_ENVIRONMENT = {
  AI_PROVIDERS_JSON: JSON.stringify([
    {
      id: 'deepseek-chat',
      name: 'DeepSeek',
      baseUrl: 'https://api.deepseek.com/v1',
      apiKey: 'fake-key-deepseek',
      format: 'chat_completions',
      model: 'deepseek-chat',
    },
    {
      id: 'deepseek-flash',
      name: 'DeepSeek Flash',
      baseUrl: 'https://api.deepseek.com/v1',
      apiKey: 'fake-key-flash',
      format: 'chat_completions',
      model: 'deepseek-flash',
    },
  ]),
}

const SAMPLE_CHANGELOG = `# 变更日志

## [1.2.7] - 2026-07-30

### 修复
- 修复桌面端更新失败后无法正确重试的问题，并区分检查、下载和安装阶段的错误提示。[audience:user] (C)
- 修复切换账号后公告列表、未读数量或最新公告可能残留上一账号状态的问题。[audience:user] (B/C)
- 优化页面切回前台后的背景动画恢复表现。[audience:user] (B)
- 公告草稿生成：source_key 已存在时跳过 AI；重新润色禁止覆盖已生效公告。[audience:admin] (Web)
- 调整 DesktopUpdateDialog 的 installUpdate 重试分支。[audience:internal] (C)
- 调整公告 Store 的过期请求隔离逻辑。[audience:internal] (B/C)
- 调整 ParticleBg 的 visibilitychange 监听流程。[audience:internal] (B)
- 补充 ParticleBg 组件级回归测试。[audience:internal] (B)
- 发版与验证：正式发布禁用 --skip-build；验证脚本移除 shell:true；jsdom 对齐 Node 引擎范围。[audience:internal] (C)

## [1.2.6] - 2026-07-29

### 新增
- 公告中心支持按公告类型和版本查看更新信息。[audience:user] (B/C)
- 网站发布和桌面端发版后自动生成待审核的更新公告草稿，供超管预览、编辑、重新润色与发布。[audience:admin] (Web)

### 修复
- 修复桌面端更新版本判断异常的问题，并在安装更新前保护尚未保存的内容。[audience:user] (C)
- 优化可选更新的下载与安装流程，安装过程出现异常时给出明确提示。[audience:user] (C)
- 修复公告中心未读数量和公告展示异常的问题。[audience:user] (B/C)
- 完善生产依赖审计和桌面安装包产物校验。[audience:internal] (C)

## [1.2.5] - 2026-07-26

### 修复
- 移动端课程正文改为抽屉侧栏。(B)
`

function adminRow(overrides = {}) {
  return {
    id: 7,
    title: '云栈桌面端 v1.2.5 更新',
    content: '云栈桌面端 v1.2.5 已发布。',
    published_at: NOW,
    active: false,
    created_at: NOW,
    updated_at: NOW,
    category: 'desktop_release',
    version: '1.2.5',
    source_key: 'desktop_release:1.2.5',
    source_commit: 'abc1234',
    generated_by_ai: false,
    generation_provider: null,
    generation_error: null,
    ...overrides,
  }
}

function aiFetch(content, requests = []) {
  return async (url, options) => {
    requests.push({ url, options })
    return new Response(JSON.stringify({
      choices: [{ message: { content } }],
    }))
  }
}

describe('extractChangelogEntryFromMarkdown', () => {
  it('extracts the first version entry and excludes the next version', () => {
    const entry = extractChangelogEntryFromMarkdown(SAMPLE_CHANGELOG, '1.2.7')
    expect(entry).toContain('## [1.2.7] - 2026-07-30')
    expect(entry).toContain('ParticleBg')
    expect(entry).toContain('发版与验证')
    expect(entry).not.toContain('## [1.2.6]')
    expect(entry).not.toContain('公告中心支持按公告类型和版本查看更新信息')
    const bullets = entry.split('\n').filter(line => line.trim().startsWith('- '))
    expect(bullets).toHaveLength(9)
  })

  it('extracts a middle version entry', () => {
    const entry = extractChangelogEntryFromMarkdown(SAMPLE_CHANGELOG, '1.2.6')
    expect(entry).toContain('## [1.2.6] - 2026-07-29')
    expect(entry).toContain('公告中心支持按公告类型和版本查看更新信息')
    expect(entry).not.toContain('## [1.2.7]')
    expect(entry).not.toContain('## [1.2.5]')
  })

  it('extracts the last version entry through true EOF', () => {
    const entry = extractChangelogEntryFromMarkdown(SAMPLE_CHANGELOG, '1.2.5')
    expect(entry).toContain('## [1.2.5] - 2026-07-26')
    expect(entry).toContain('移动端课程正文')
    expect(entry).not.toContain('## [1.2.6]')
  })

  it('supports CRLF line endings', () => {
    const crlf = SAMPLE_CHANGELOG.replace(/\n/g, '\r\n')
    const entry = extractChangelogEntryFromMarkdown(crlf, '1.2.7')
    expect(entry).toContain('ParticleBg')
    expect(entry.split('\n').filter(line => line.trim().startsWith('- '))).toHaveLength(9)
  })

  it('supports LF line endings', () => {
    const entry = extractChangelogEntryFromMarkdown(SAMPLE_CHANGELOG.replace(/\r\n/g, '\n'), '1.2.6')
    expect(entry).toContain('### 新增')
  })

  it('returns empty string when version does not exist', () => {
    expect(extractChangelogEntryFromMarkdown(SAMPLE_CHANGELOG, '9.9.9')).toBe('')
  })
})

describe('channel filtering and marker cleanup', () => {
  it('excludes pure C from web_release and keeps B/C mixed items', () => {
    expect(shouldIncludeChangelogItem(['C'], 'web_release')).toBe(false)
    expect(shouldIncludeChangelogItem(['B', 'C'], 'web_release')).toBe(true)
    expect(shouldIncludeChangelogItem(['Web'], 'web_release')).toBe(true)
    expect(shouldIncludeChangelogItem([], 'web_release')).toBe(true)

    const webText = formatChangelogForAnnouncement(
      extractChangelogEntryFromMarkdown(SAMPLE_CHANGELOG, '1.2.7'),
      'web_release',
    )
    expect(webText).toContain('切换账号后公告列表')
    expect(webText).toContain('背景动画恢复表现')
    expect(webText).not.toContain('公告草稿生成')
    expect(webText).not.toContain('installUpdate')
    expect(webText).not.toContain('无法正确重试')
    expect(webText).not.toContain('ParticleBg')
    expect(webText).not.toContain('Store')
    expect(webText).not.toContain('visibilitychange')
    expect(webText).not.toContain('组件级回归测试')
    expect(webText).not.toMatch(/\(C\)|\(Web\)|\(B\/C\)|\(B\)|\[audience:/)
  })

  it('excludes D and Web-only from desktop_release', () => {
    expect(shouldIncludeChangelogItem(['Web'], 'desktop_release')).toBe(false)
    expect(shouldIncludeChangelogItem(['D'], 'desktop_release')).toBe(false)
    expect(shouldIncludeChangelogItem(['C'], 'desktop_release')).toBe(true)
    expect(shouldIncludeChangelogItem(['B', 'C'], 'desktop_release')).toBe(true)

    const desktopText = formatChangelogForAnnouncement(
      extractChangelogEntryFromMarkdown(SAMPLE_CHANGELOG, '1.2.7'),
      'desktop_release',
    )
    expect(desktopText).toContain('桌面端更新失败后无法正确重试')
    expect(desktopText).toContain('切换账号后公告列表')
    expect(desktopText).toContain('背景动画恢复表现')
    expect(desktopText).not.toContain('source_key')
    expect(desktopText).not.toContain('installUpdate')
    expect(desktopText).not.toContain('ParticleBg')
    expect(desktopText).not.toContain('Store')
    expect(desktopText).not.toContain('visibilitychange')
    expect(desktopText).not.toContain('组件级回归测试')
    expect(desktopText).not.toMatch(/\(C\)|\(Web\)|\(B\/C\)|\(B\)|\[audience:/)
  })

  it('strips quadrant markers from free text', () => {
    expect(stripQuadrantMarkersFromText('- 修复公告。[audience:user] (B/C)')).toBe('- 修复公告。')
  })
})

const FORBIDDEN_USER_ANNOUNCEMENT_PATTERN = /超管|管理员后台|inactive|best-effort|Release|quitAndInstall|审计|依赖|产物校验|\[audience:|\(B\)|\(C\)|\(Web\)|\(B\/C\)|source_key|Store|ParticleBg|visibilitychange|installUpdate/

describe('1.2.6 and 1.2.7 user announcement drafts', () => {
  function assertCleanUserAnnouncement(content) {
    expect(content).toMatch(/已发布。/)
    expect(content).toContain('本次更新：')
    expect(content.match(/已发布。/g)).toHaveLength(1)
    expect(content.match(/本次更新：/g)).toHaveLength(1)
    expect(content).not.toMatch(FORBIDDEN_USER_ANNOUNCEMENT_PATTERN)
  }

  it('filters 1.2.6 web_release to ordinary website/common user facts only', () => {
    const entry = extractChangelogEntryFromMarkdown(SAMPLE_CHANGELOG, '1.2.6')
    const fallback = buildReleaseAnnouncementFallback({
      category: 'web_release',
      version: '1.2.6',
      changelogEntry: entry,
    })
    expect(fallback.content).toContain('公告中心支持按公告类型和版本查看更新信息')
    expect(fallback.content).toContain('修复公告中心未读数量和公告展示异常的问题')
    expect(fallback.content).not.toContain('桌面端更新版本判断')
    expect(fallback.content).not.toContain('可选更新的下载与安装')
    expect(fallback.content).not.toContain('待审核的更新公告草稿')
    expect(fallback.content).not.toContain('超管')
    expect(fallback.content).not.toContain('生产依赖审计')
    expect(fallback.content).not.toContain('产物校验')
    assertCleanUserAnnouncement(fallback.content)
  })

  it('filters 1.2.6 desktop_release to ordinary desktop/common user facts only', () => {
    const entry = extractChangelogEntryFromMarkdown(SAMPLE_CHANGELOG, '1.2.6')
    const fallback = buildReleaseAnnouncementFallback({
      category: 'desktop_release',
      version: '1.2.6',
      changelogEntry: entry,
    })
    expect(fallback.content).toContain('公告中心支持按公告类型和版本查看更新信息')
    expect(fallback.content).toContain('修复桌面端更新版本判断异常的问题')
    expect(fallback.content).toContain('优化可选更新的下载与安装流程')
    expect(fallback.content).toContain('修复公告中心未读数量和公告展示异常的问题')
    expect(fallback.content).not.toContain('待审核的更新公告草稿')
    expect(fallback.content).not.toContain('超管')
    expect(fallback.content).not.toContain('生产依赖审计')
    expect(fallback.content).not.toContain('产物校验')
    expect(fallback.content).not.toContain('quitAndInstall')
    expect(fallback.content).not.toContain('inactive')
    expect(fallback.content).not.toContain('best-effort')
    assertCleanUserAnnouncement(fallback.content)
  })

  it('keeps 1.2.7 web and desktop final detailed bodies unchanged', () => {
    const entry = extractChangelogEntryFromMarkdown(SAMPLE_CHANGELOG, '1.2.7')
    const web = buildReleaseAnnouncementFallback({
      category: 'web_release',
      version: '1.2.7',
      changelogEntry: entry,
    })
    const desktop = buildReleaseAnnouncementFallback({
      category: 'desktop_release',
      version: '1.2.7',
      changelogEntry: entry,
    })

    expect(web.content).toBe(`云栈网站 v1.2.7 已发布。

本次更新：
修复：
- 修复切换账号后公告列表、未读数量或最新公告可能残留上一账号状态的问题。
- 优化页面切回前台后的背景动画恢复表现。`)

    expect(desktop.content).toBe(`云栈桌面端 v1.2.7 已发布。

本次更新：
修复：
- 修复桌面端更新失败后无法正确重试的问题，并区分检查、下载和安装阶段的错误提示。
- 修复切换账号后公告列表、未读数量或最新公告可能残留上一账号状态的问题。
- 优化页面切回前台后的背景动画恢复表现。`)

    assertCleanUserAnnouncement(web.content)
    assertCleanUserAnnouncement(desktop.content)
  })

  it('accepts the real 1.2.7 grounded summaries with generatedByAi=true', async () => {
    const entry = extractChangelogEntryFromMarkdown(SAMPLE_CHANGELOG, '1.2.7')
    const cases = [
      {
        category: 'web_release',
        summary: '本次修复了切换账号后的公告状态，并改善切回前台后的背景动画。',
      },
      {
        category: 'desktop_release',
        summary: '本次修复了桌面端更新失败后无法正确重试的问题，并改善切换账号后的公告状态。',
      },
    ]

    for (const item of cases) {
      const fallback = buildReleaseAnnouncementFallback({
        category: item.category,
        version: '1.2.7',
        changelogEntry: entry,
      })
      const result = await polishReleaseAnnouncement({
        fallback,
        category: item.category,
        version: '1.2.7',
        environment: FLASH_ENVIRONMENT,
        maxAttempts: 1,
        retryDelayMs: 0,
        fetchImplementation: aiFetch(item.summary),
      })
      expect(result.generatedByAi).toBe(true)
      expect(result.generationError).toBeNull()
      expect(result.content).toContain(item.summary)
      expect(result.content).toContain('本次更新：')
      assertCleanUserAnnouncement(result.content)
    }
  })

  it('rejects invented features and English internal vocabulary while keeping detailed fallback', async () => {
    const entry = extractChangelogEntryFromMarkdown(SAMPLE_CHANGELOG, '1.2.7')
    const fallback = buildReleaseAnnouncementFallback({
      category: 'web_release',
      version: '1.2.7',
      changelogEntry: entry,
    })
    const cases = [
      '登录体验更加可靠，同时会员权益更加丰富。',
      '修复登录问题，并新增积分商城。',
      '公告状态已修复，同时支持团队协作。',
      'Admin Store management is improved.',
      'Backend announcement tools were optimized.',
      'Audit and migration workflow improved.',
    ]

    for (const content of cases) {
      const result = await polishReleaseAnnouncement({
        fallback,
        category: 'web_release',
        version: '1.2.7',
        environment: FLASH_ENVIRONMENT,
        maxAttempts: 1,
        retryDelayMs: 0,
        fetchImplementation: aiFetch(content),
      })
      expect(result.generatedByAi).toBe(false)
      expect(result.content).toBe(fallback.content)
      expect(result.generationError).toMatch(
        /ungrounded_term|ungrounded_feature_claim|no_fact_overlap|internal_vocabulary/,
      )
      assertCleanUserAnnouncement(result.content)
    }
  })
})

describe('release announcement fallback', () => {
  it('builds detailed fallback from changelog without quadrant markers', () => {
    expect(buildReleaseAnnouncementSourceKey('desktop_release', '1.2.5')).toBe('desktop_release:1.2.5')
    const fallback = buildReleaseAnnouncementFallback({
      category: 'desktop_release',
      version: '1.2.5',
      changelogEntry: '## [1.2.5] - 2026-07-26\n\n### 修复\n- 修复桌面更新提示。(C)\n- 修复公告已读计数。(B)',
    })
    expect(fallback.title).toBe('云栈桌面端 v1.2.5 更新')
    expect(fallback.content).toContain('云栈桌面端 v1.2.5 已发布。')
    expect(fallback.content).toContain('修复：')
    expect(fallback.content).toContain('- 修复桌面更新提示。')
    expect(fallback.content).toContain('- 修复公告已读计数。')
    expect(fallback.content).not.toContain('(C)')
    expect(fallback.content).not.toContain('## [1.2.5]')
    expect(fallback.content).not.toContain('具体变更以更新日志为准')
  })

  it('uses explicit empty-filtered copy instead of legacy generic sentence', () => {
    const fallback = buildReleaseAnnouncementFallback({
      category: 'web_release',
      version: '1.2.7',
      changelogEntry: '## [1.2.7]\n\n### 修复\n- 仅桌面项。(C)',
    })
    expect(fallback.content).toBe(buildEmptyFilteredReleaseAnnouncementContent('web_release', '1.2.7'))
    expect(fallback.content).not.toContain('具体变更以更新日志为准')
  })

  it('detects legacy generic content for auto-repair', () => {
    const generic = buildGenericReleaseAnnouncementContent('web_release', '1.2.7')
    expect(isGenericReleaseAnnouncementContent(generic, 'web_release', '1.2.7')).toBe(true)
    expect(isGenericReleaseAnnouncementContent('管理员手写正文', 'web_release', '1.2.7')).toBe(false)
  })

  it('rejects invalid category or version', () => {
    expect(() => buildReleaseAnnouncementSourceKey('general', '1.2.5')).toThrow('公告分类无效')
    expect(() => buildReleaseAnnouncementFallback({ category: 'web_release', version: '1.2' })).toThrow('公告分类或版本无效')
  })
})

describe('announcement AI provider selection', () => {
  it('prefers DeepSeek Flash provider', () => {
    expect(resolveAnnouncementAiProviderId(FLASH_ENVIRONMENT)).toBe('deepseek-flash')
  })

  it('uses explicit provider id when configured', () => {
    expect(resolveAnnouncementAiProviderId({
      ...FLASH_ENVIRONMENT,
      ANNOUNCEMENT_AI_PROVIDER_ID: 'deepseek-chat',
    })).toBe('deepseek-chat')
  })
})

describe('generateReleaseAnnouncementDraft', () => {
  it('creates inactive AI draft with source metadata', async () => {
    const requests = []
    const client = {
      query: vi.fn()
        .mockResolvedValueOnce({ rowCount: 0, rows: [] })
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [adminRow({
            content: '本次更新修复了桌面更新与公告已读问题。',
            generated_by_ai: true,
            generation_provider: 'DeepSeek Flash/deepseek-flash',
          })],
        }),
    }

    const result = await generateReleaseAnnouncementDraft(client, {
      category: 'desktop_release',
      version: '1.2.5',
      sourceCommit: 'ABC1234',
      changelogEntry: '### 修复\n- 修复桌面更新提示。(C)',
      environment: FLASH_ENVIRONMENT,
      fetchImplementation: aiFetch('本次更新修复了桌面更新与公告已读问题。', requests),
    })

    expect(result.created).toBe(true)
    expect(result.announcement.active).toBe(false)
    expect(result.announcement.generatedByAi).toBe(true)
    expect(client.query).toHaveBeenCalledTimes(2)
    expect(requests).toHaveLength(1)
  })

  it('keeps detailed changelog items when AI times out', async () => {
    const client = {
      query: vi.fn()
        .mockResolvedValueOnce({ rowCount: 0, rows: [] })
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [adminRow({
            category: 'web_release',
            version: '1.2.7',
            source_key: 'web_release:1.2.7',
            title: '云栈网站 v1.2.7 更新',
            content: buildReleaseAnnouncementFallback({
              category: 'web_release',
              version: '1.2.7',
              changelogEntry: extractChangelogEntryFromMarkdown(SAMPLE_CHANGELOG, '1.2.7'),
            }).content,
            generated_by_ai: false,
            generation_error: 'AI 供应商响应超时。',
          })],
        }),
    }

    const result = await generateReleaseAnnouncementDraft(client, {
      category: 'web_release',
      version: '1.2.7',
      changelogEntry: extractChangelogEntryFromMarkdown(SAMPLE_CHANGELOG, '1.2.7'),
      environment: FLASH_ENVIRONMENT,
      maxAttempts: 1,
      fetchImplementation: async () => {
        const error = new Error('AI 供应商响应超时。')
        error.statusCode = 504
        throw error
      },
    })

    expect(result.created).toBe(true)
    expect(result.announcement.content).toContain('本次更新：')
    expect(result.announcement.content).toContain('修复：')
    expect(result.announcement.content).toContain('切换账号后公告列表')
    expect(result.announcement.content).toContain('背景动画恢复表现')
    expect(result.announcement.content).not.toContain('具体变更以更新日志为准')
    expect(result.announcement.content).not.toMatch(/\(B\)|\(C\)|\(Web\)|Store|ParticleBg|installUpdate/)
    expect(client.query.mock.calls[1][1][1]).toContain('切换账号后公告列表')
  })

  it('keeps detailed fallback when AI rate-limits or returns invalid content', async () => {
    const fallback = buildReleaseAnnouncementFallback({
      category: 'web_release',
      version: '1.2.7',
      changelogEntry: extractChangelogEntryFromMarkdown(SAMPLE_CHANGELOG, '1.2.7'),
    })

    const rateLimited = await polishReleaseAnnouncement({
      fallback,
      category: 'web_release',
      version: '1.2.7',
      environment: FLASH_ENVIRONMENT,
      maxAttempts: 1,
      retryDelayMs: 0,
      fetchImplementation: async () => new Response('{}', { status: 429 }),
    })
    expect(rateLimited.generatedByAi).toBe(false)
    expect(rateLimited.content).toContain('切换账号后公告列表')
    expect(rateLimited.content).not.toContain('具体变更以更新日志为准')

    const invalid = await polishReleaseAnnouncement({
      fallback,
      category: 'web_release',
      version: '1.2.7',
      environment: FLASH_ENVIRONMENT,
      maxAttempts: 1,
      retryDelayMs: 0,
      fetchImplementation: async () => new Response(JSON.stringify({ choices: [{ message: { content: '' } }] })),
    })
    expect(invalid.generatedByAi).toBe(false)
    expect(invalid.content).toContain('背景动画恢复表现')
  })

  it('does not call AI when non-generic source_key already exists', async () => {
    const requests = []
    const client = {
      query: vi.fn()
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [adminRow({
            content: '管理员已编辑的正文',
          })],
        }),
    }

    const result = await generateReleaseAnnouncementDraft(client, {
      category: 'desktop_release',
      version: '1.2.5',
      changelogEntry: '### 修复\n- 新内容',
      environment: FLASH_ENVIRONMENT,
      fetchImplementation: aiFetch('AI 正文', requests),
    })

    expect(result.created).toBe(false)
    expect(result.repaired).toBe(false)
    expect(requests).toHaveLength(0)
    expect(client.query).toHaveBeenCalledTimes(1)
  })

  it('auto-repairs inactive generic drafts', async () => {
    const generic = buildGenericReleaseAnnouncementContent('web_release', '1.2.7')
    const repairedContent = buildReleaseAnnouncementFallback({
      category: 'web_release',
      version: '1.2.7',
      changelogEntry: extractChangelogEntryFromMarkdown(SAMPLE_CHANGELOG, '1.2.7'),
    }).content
    const requests = []
    const client = {
      query: vi.fn()
        .mockResolvedValueOnce({
          rows: [adminRow({
            category: 'web_release',
            version: '1.2.7',
            source_key: 'web_release:1.2.7',
            title: '云栈网站 v1.2.7 更新',
            content: generic,
            active: false,
          })],
        })
        .mockResolvedValueOnce({
          rows: [adminRow({
            category: 'web_release',
            version: '1.2.7',
            source_key: 'web_release:1.2.7',
            title: '云栈网站 v1.2.7 更新',
            content: repairedContent,
            generated_by_ai: false,
            generation_error: 'timeout',
          })],
        }),
    }

    const result = await generateReleaseAnnouncementDraft(client, {
      category: 'web_release',
      version: '1.2.7',
      changelogEntry: extractChangelogEntryFromMarkdown(SAMPLE_CHANGELOG, '1.2.7'),
      environment: FLASH_ENVIRONMENT,
      providerId: 'deepseek-flash',
      maxAttempts: 1,
      retryDelayMs: 0,
      fetchImplementation: async () => {
        requests.push(1)
        const error = new Error('timeout')
        error.statusCode = 504
        throw error
      },
    })

    expect(result.created).toBe(false)
    expect(result.repaired).toBe(true)
    expect(result.announcement.content).toContain('切换账号后公告列表')
    expect(client.query.mock.calls[1][0]).toContain('AND active = false')
    expect(client.query.mock.calls[1][0]).toContain('AND content = $8')
    expect(client.query.mock.calls[1][1][7]).toBe(generic)
    expect(requests).toHaveLength(1)
  })

  it('does not repair existing inactive drafts when repairExistingGeneric=false', async () => {
    const original = '原 inactive 草稿正文，禁止补建修改。'
    const requests = []
    const client = {
      query: vi.fn().mockResolvedValueOnce({
        rows: [adminRow({
          category: 'desktop_release',
          version: '1.2.6',
          source_key: 'desktop_release:1.2.6',
          content: original,
          active: false,
        })],
      }),
    }

    const result = await generateReleaseAnnouncementDraft(client, {
      category: 'desktop_release',
      version: '1.2.6',
      changelogEntry: extractChangelogEntryFromMarkdown(SAMPLE_CHANGELOG, '1.2.6'),
      environment: FLASH_ENVIRONMENT,
      repairExistingGeneric: false,
      fetchImplementation: aiFetch('不应调用 AI', requests),
    })

    expect(result.created).toBe(false)
    expect(result.repaired).toBe(false)
    expect(result.announcement.content).toBe(original)
    expect(requests).toHaveLength(0)
    expect(client.query).toHaveBeenCalledTimes(1)
    expect(String(client.query.mock.calls[0][0])).toContain('WHERE source_key = $1')
    expect(client.query.mock.calls.some(call => String(call[0]).includes('UPDATE'))).toBe(false)
  })

  it('does not auto-repair inactive generic drafts when repairExistingGeneric=false', async () => {
    const generic = buildGenericReleaseAnnouncementContent('desktop_release', '1.2.6')
    const requests = []
    const client = {
      query: vi.fn().mockResolvedValueOnce({
        rows: [adminRow({
          category: 'desktop_release',
          version: '1.2.6',
          source_key: 'desktop_release:1.2.6',
          content: generic,
          active: false,
        })],
      }),
    }

    const result = await generateReleaseAnnouncementDraft(client, {
      category: 'desktop_release',
      version: '1.2.6',
      changelogEntry: extractChangelogEntryFromMarkdown(SAMPLE_CHANGELOG, '1.2.6'),
      environment: FLASH_ENVIRONMENT,
      repairExistingGeneric: false,
      fetchImplementation: aiFetch('不应调用 AI', requests),
    })

    expect(result.created).toBe(false)
    expect(result.repaired).toBe(false)
    expect(result.announcement.content).toBe(generic)
    expect(requests).toHaveLength(0)
    expect(client.query).toHaveBeenCalledTimes(1)
  })

  it('inserts announcement and audit atomically via CTE when auditContext is provided', async () => {
    const requests = []
    const client = {
      query: vi.fn()
        .mockResolvedValueOnce({ rowCount: 0, rows: [] })
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [adminRow({
            category: 'desktop_release',
            version: '1.2.6',
            source_key: 'desktop_release:1.2.6',
            source_commit: '0f3cdbe',
            content: '云栈桌面端 v1.2.6 已发布。\n\n本次更新：\n新增：\n- 公告中心',
          })],
        }),
    }

    const result = await generateReleaseAnnouncementDraft(client, {
      category: 'desktop_release',
      version: '1.2.6',
      sourceCommit: '0f3cdbe',
      changelogEntry: extractChangelogEntryFromMarkdown(SAMPLE_CHANGELOG, '1.2.6'),
      environment: FLASH_ENVIRONMENT,
      fetchImplementation: aiFetch('本次修复了公告中心状态。', requests),
      auditContext: {
        action: 'announcement.generate_from_changelog',
        actorUserId: '11111111-1111-4111-8111-111111111111',
        targetUserId: '11111111-1111-4111-8111-111111111111',
      },
    })

    expect(result.created).toBe(true)
    expect(requests).toHaveLength(1)
    const insertSql = String(client.query.mock.calls[1][0])
    expect(insertSql).toContain('WITH inserted AS')
    expect(insertSql).toContain('INSERT INTO audit_logs')
    expect(insertSql).toContain('ON CONFLICT (source_key) DO NOTHING')
    expect(insertSql).toContain("jsonb_build_object")
    expect(insertSql).toContain("'sourceKey'")
    expect(JSON.stringify(client.query.mock.calls[1][1])).not.toContain('本次修复了公告中心状态')
  })

  it('does not write audit again when ON CONFLICT returns existing draft', async () => {
    const existingContent = '已存在的桌面草稿正文'
    const client = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [adminRow({
            category: 'desktop_release',
            version: '1.2.6',
            source_key: 'desktop_release:1.2.6',
            content: existingContent,
            active: false,
          })],
        }),
    }

    const result = await generateReleaseAnnouncementDraft(client, {
      category: 'desktop_release',
      version: '1.2.6',
      changelogEntry: extractChangelogEntryFromMarkdown(SAMPLE_CHANGELOG, '1.2.6'),
      environment: {},
      auditContext: {
        action: 'announcement.generate_from_changelog',
        actorUserId: '11111111-1111-4111-8111-111111111111',
        targetUserId: '11111111-1111-4111-8111-111111111111',
      },
    })

    expect(result.created).toBe(false)
    expect(result.repaired).toBe(false)
    expect(result.announcement.content).toBe(existingContent)
    expect(client.query).toHaveBeenCalledTimes(3)
  })

  it('does not auto-repair active announcements', async () => {
    const requests = []
    const client = {
      query: vi.fn().mockResolvedValueOnce({
        rows: [adminRow({
          category: 'web_release',
          version: '1.2.7',
          source_key: 'web_release:1.2.7',
          content: buildGenericReleaseAnnouncementContent('web_release', '1.2.7'),
          active: true,
        })],
      }),
    }

    const result = await generateReleaseAnnouncementDraft(client, {
      category: 'web_release',
      version: '1.2.7',
      changelogEntry: extractChangelogEntryFromMarkdown(SAMPLE_CHANGELOG, '1.2.7'),
      environment: FLASH_ENVIRONMENT,
      fetchImplementation: aiFetch('AI', requests),
    })

    expect(result.repaired).toBe(false)
    expect(requests).toHaveLength(0)
    expect(client.query).toHaveBeenCalledTimes(1)
  })

  it('does not overwrite when conditional update matches zero rows after admin edit', async () => {
    const generic = buildGenericReleaseAnnouncementContent('web_release', '1.2.7')
    const client = {
      query: vi.fn()
        .mockResolvedValueOnce({
          rows: [adminRow({
            category: 'web_release',
            version: '1.2.7',
            source_key: 'web_release:1.2.7',
            content: generic,
            active: false,
          })],
        })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({
          rows: [adminRow({
            category: 'web_release',
            version: '1.2.7',
            source_key: 'web_release:1.2.7',
            content: '管理员刚刚改过的正文',
            active: false,
          })],
        }),
    }

    const result = await generateReleaseAnnouncementDraft(client, {
      category: 'web_release',
      version: '1.2.7',
      changelogEntry: extractChangelogEntryFromMarkdown(SAMPLE_CHANGELOG, '1.2.7'),
      environment: FLASH_ENVIRONMENT,
      maxAttempts: 1,
      retryDelayMs: 0,
      fetchImplementation: async () => {
        throw new Error('timeout')
      },
    })

    expect(result.repaired).toBe(false)
    expect(result.announcement.content).toBe('管理员刚刚改过的正文')
    expect(client.query).toHaveBeenCalledTimes(3)
  })

  it('does not overwrite when draft is published during repair', async () => {
    const generic = buildGenericReleaseAnnouncementContent('web_release', '1.2.7')
    const client = {
      query: vi.fn()
        .mockResolvedValueOnce({
          rows: [adminRow({
            category: 'web_release',
            version: '1.2.7',
            source_key: 'web_release:1.2.7',
            content: generic,
            active: false,
          })],
        })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({
          rows: [adminRow({
            category: 'web_release',
            version: '1.2.7',
            source_key: 'web_release:1.2.7',
            content: generic,
            active: true,
          })],
        }),
    }

    const result = await generateReleaseAnnouncementDraft(client, {
      category: 'web_release',
      version: '1.2.7',
      changelogEntry: extractChangelogEntryFromMarkdown(SAMPLE_CHANGELOG, '1.2.7'),
      environment: FLASH_ENVIRONMENT,
      maxAttempts: 1,
      retryDelayMs: 0,
      fetchImplementation: async () => {
        throw new Error('timeout')
      },
    })

    expect(result.repaired).toBe(false)
    expect(result.announcement.active).toBe(true)
  })
})

describe('regenerateAnnouncementFromChangelog', () => {
  it('rejects active announcements with 409', async () => {
    const client = {
      query: vi.fn().mockResolvedValueOnce({
        rows: [adminRow({
          active: true,
          category: 'web_release',
          version: '1.2.7',
        })],
      }),
    }
    await expect(regenerateAnnouncementFromChangelog(client, 7, {
      changelogMarkdown: SAMPLE_CHANGELOG,
      environment: FLASH_ENVIRONMENT,
      fetchImplementation: aiFetch('AI'),
    })).rejects.toMatchObject({ statusCode: 409 })
  })

  it('regenerates inactive release drafts from changelog', async () => {
    const detailed = buildReleaseAnnouncementFallback({
      category: 'web_release',
      version: '1.2.7',
      changelogEntry: extractChangelogEntryFromMarkdown(SAMPLE_CHANGELOG, '1.2.7'),
    })
    const client = {
      query: vi.fn()
        .mockResolvedValueOnce({
          rows: [adminRow({
            active: false,
            category: 'web_release',
            version: '1.2.7',
            source_key: 'web_release:1.2.7',
            content: buildGenericReleaseAnnouncementContent('web_release', '1.2.7'),
          })],
        })
        .mockResolvedValueOnce({
          rows: [adminRow({
            active: false,
            category: 'web_release',
            version: '1.2.7',
            title: detailed.title,
            content: detailed.content,
            generated_by_ai: false,
            generation_error: 'timeout',
          })],
        }),
    }

    const result = await regenerateAnnouncementFromChangelog(client, 7, {
      changelogMarkdown: SAMPLE_CHANGELOG,
      environment: FLASH_ENVIRONMENT,
      maxAttempts: 1,
      retryDelayMs: 0,
      fetchImplementation: async () => {
        throw new Error('timeout')
      },
    })

    expect(result.content).toContain('切换账号后公告列表')
    expect(result.content).not.toContain('具体变更以更新日志为准')
    expect(client.query.mock.calls[1][0]).toContain('WHERE id = $1 AND active = false')
  })
})

describe('repolishAnnouncementDraft', () => {
  it('rejects active announcements', async () => {
    const client = {
      query: vi.fn().mockResolvedValueOnce({ rows: [adminRow({ active: true })] }),
    }
    await expect(repolishAnnouncementDraft(client, 7, {
      environment: FLASH_ENVIRONMENT,
      fetchImplementation: aiFetch('AI 正文'),
    })).rejects.toMatchObject({ statusCode: 400 })
  })

  it('rejects repolish when announcement becomes active during AI call', async () => {
    const current = adminRow({ active: false })
    const client = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [current] })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [{ active: true }] }),
    }

    await expect(repolishAnnouncementDraft(client, 7, {
      environment: FLASH_ENVIRONMENT,
      fetchImplementation: aiFetch('AI 正文'),
    })).rejects.toMatchObject({ statusCode: 409, message: '公告已生效，不能重新润色。' })
  })
})

describe('polishReleaseAnnouncement resilience', () => {
  it('retries transient HTTP 503 and succeeds', async () => {
    let attempts = 0
    const result = await polishReleaseAnnouncement({
      fallback: buildReleaseAnnouncementFallback({
        category: 'web_release',
        version: '1.2.6',
        changelogEntry: '### 修复\n- 修复公告',
      }),
      category: 'web_release',
      version: '1.2.6',
      environment: FLASH_ENVIRONMENT,
      maxAttempts: 3,
      retryDelayMs: 0,
      fetchImplementation: async () => {
        attempts += 1
        if (attempts < 2) {
          return new Response('{}', { status: 503 })
        }
        return new Response(JSON.stringify({
          choices: [{ message: { content: '本次修复了公告相关问题。' } }],
        }))
      },
    })

    expect(attempts).toBe(2)
    expect(result.generatedByAi).toBe(true)
    expect(result.content).toContain('公告')
    expect(result.content).toContain('本次更新：')
  })

  it('retries transient HTTP 529 and keeps detailed fallback after exhaustion', async () => {
    let attempts = 0
    const result = await polishReleaseAnnouncement({
      fallback: buildReleaseAnnouncementFallback({
        category: 'web_release',
        version: '1.2.6',
        changelogEntry: '### 修复\n- 修复公告展示',
      }),
      category: 'web_release',
      version: '1.2.6',
      environment: FLASH_ENVIRONMENT,
      maxAttempts: 2,
      retryDelayMs: 0,
      fetchImplementation: async () => {
        attempts += 1
        return new Response('{}', { status: 529 })
      },
    })

    expect(attempts).toBeGreaterThanOrEqual(2)
    expect(result.generatedByAi).toBe(false)
    expect(result.content).toContain('修复公告展示')
    expect(result.generationError).toMatch(/HTTP 529/)
    expect(result.generationError).toContain('请稍后重试')
    expect(result.generationError).not.toMatch(/sk-/)
  })

  it('falls through to next provider when deepseek-flash keeps returning 503', async () => {
    const requestedModels = []
    const result = await polishReleaseAnnouncement({
      fallback: buildReleaseAnnouncementFallback({
        category: 'web_release',
        version: '1.2.6',
        changelogEntry: '### 修复\n- 修复公告展示',
      }),
      category: 'web_release',
      version: '1.2.6',
      environment: FLASH_ENVIRONMENT,
      maxAttempts: 1,
      retryDelayMs: 0,
      fetchImplementation: async (_url, options) => {
        const body = JSON.parse(String(options.body))
        requestedModels.push(body.model)
        if (body.model === 'deepseek-flash') {
          return new Response('{}', { status: 503 })
        }
        return new Response(JSON.stringify({
          choices: [{ message: { content: '本次修复了公告展示问题。' } }],
        }))
      },
    })

    expect(requestedModels).toEqual(['deepseek-flash', 'deepseek-chat'])
    expect(result.generatedByAi).toBe(true)
    expect(result.content).toContain('修复公告展示')
  })
})

describe('audience filtering', () => {
  it('keeps audience:user and audience:all for web', () => {
    const entry = `### 修复\n- 用户可见修复。[audience:user] (B)\n- 全员影响修复。[audience:all] (B)\n- 后台入口。[audience:admin] (Web)\n- 构建脚本。[audience:internal] (Web)`
    const text = formatChangelogForAnnouncement(entry, 'web_release')
    expect(text).toContain('用户可见修复')
    expect(text).toContain('全员影响修复')
    expect(text).not.toContain('后台入口')
    expect(text).not.toContain('构建脚本')
    expect(text).not.toMatch(/\[audience:/)
  })

  it('keeps audience:user for desktop while still applying channel filter', () => {
    const entry = `### 修复\n- 桌面更新修复。[audience:user] (C)\n- 网站专属修复。[audience:user] (Web)\n- 管理后台。[audience:admin] (C)`
    const text = formatChangelogForAnnouncement(entry, 'desktop_release')
    expect(text).toContain('桌面更新修复')
    expect(text).not.toContain('网站专属修复')
    expect(text).not.toContain('管理后台')
  })

  it('treats historical bullets without audience as user-compatible', () => {
    const text = formatChangelogForAnnouncement('### 修复\n- 历史无标记修复。(B)', 'web_release')
    expect(text).toContain('历史无标记修复')
  })

  it('does not generate vague announcement when all bullets are admin/internal', () => {
    const fallback = buildReleaseAnnouncementFallback({
      category: 'web_release',
      version: '1.2.7',
      changelogEntry: '### 修复\n- 后台入口。[audience:admin] (Web)\n- 构建脚本。[audience:internal] (Web)',
    })
    expect(fallback.hasUserFacingContent).toBe(false)
    expect(fallback.content).toBe(EMPTY_FILTERED_RELEASE_NOTICE)
  })
})

describe('empty changelog guards', () => {
  it('does not UPDATE when changelog markdown is empty', async () => {
    const client = {
      query: vi.fn().mockResolvedValueOnce({
        rows: [adminRow({
          active: false,
          category: 'web_release',
          version: '1.2.7',
          source_key: 'web_release:1.2.7',
          content: '管理员草稿正文',
        })],
      }),
    }
    await expect(regenerateAnnouncementFromChangelog(client, 7, {
      changelogMarkdown: '',
      environment: FLASH_ENVIRONMENT,
      fetchImplementation: aiFetch('不应调用'),
    })).rejects.toMatchObject({ statusCode: 500 })
    expect(client.query).toHaveBeenCalledTimes(1)
  })

  it('does not UPDATE when target version is missing', async () => {
    const client = {
      query: vi.fn().mockResolvedValueOnce({
        rows: [adminRow({
          active: false,
          category: 'web_release',
          version: '1.2.7',
          source_key: 'web_release:1.2.7',
        })],
      }),
    }
    await expect(regenerateAnnouncementFromChangelog(client, 7, {
      changelogMarkdown: '## [1.2.6]\n\n- 其他版本。[audience:user] (B)',
      environment: FLASH_ENVIRONMENT,
      fetchImplementation: aiFetch('不应调用'),
    })).rejects.toMatchObject({ statusCode: 422, message: expect.stringContaining('未找到版本') })
    expect(client.query).toHaveBeenCalledTimes(1)
  })

  it('does not UPDATE when channel+audience filter yields no user content', async () => {
    const client = {
      query: vi.fn().mockResolvedValueOnce({
        rows: [adminRow({
          active: false,
          category: 'web_release',
          version: '1.2.7',
          source_key: 'web_release:1.2.7',
          content: '保留的管理员草稿',
        })],
      }),
    }
    await expect(regenerateAnnouncementFromChangelog(client, 7, {
      changelogMarkdown: '## [1.2.7]\n\n### 修复\n- 仅桌面。[audience:user] (C)\n- 后台。[audience:admin] (Web)',
      environment: FLASH_ENVIRONMENT,
      fetchImplementation: aiFetch('不应调用'),
    })).rejects.toMatchObject({ statusCode: 422 })
    expect(client.query).toHaveBeenCalledTimes(1)
  })

  it('skips creating vague draft when filtered content is empty', async () => {
    const requests = []
    const client = {
      query: vi.fn().mockResolvedValueOnce({ rows: [] }),
    }
    const result = await generateReleaseAnnouncementDraft(client, {
      category: 'web_release',
      version: '1.2.7',
      changelogEntry: '### 修复\n- 后台入口。[audience:admin] (Web)',
      environment: FLASH_ENVIRONMENT,
      fetchImplementation: aiFetch('AI', requests),
    })
    expect(result.skipped).toBe(true)
    expect(result.created).toBe(false)
    expect(requests).toHaveLength(0)
    expect(client.query).toHaveBeenCalledTimes(1)
  })

  it('does not auto-repair generic draft when filtered content is empty', async () => {
    const requests = []
    const generic = buildGenericReleaseAnnouncementContent('web_release', '1.2.7')
    const client = {
      query: vi.fn().mockResolvedValueOnce({
        rows: [adminRow({
          category: 'web_release',
          version: '1.2.7',
          source_key: 'web_release:1.2.7',
          content: generic,
          active: false,
        })],
      }),
    }
    const result = await generateReleaseAnnouncementDraft(client, {
      category: 'web_release',
      version: '1.2.7',
      changelogEntry: '### 修复\n- 构建脚本。[audience:internal] (Web)',
      environment: FLASH_ENVIRONMENT,
      fetchImplementation: aiFetch('AI', requests),
    })
    expect(result.repaired).toBe(false)
    expect(result.skipped).toBe(true)
    expect(result.announcement.content).toBe(generic)
    expect(requests).toHaveLength(0)
    expect(client.query).toHaveBeenCalledTimes(1)
  })
})

describe('AI scheme A validation', () => {
  it('uses detailed fallback when AI returns vague summary', async () => {
    const fallback = buildReleaseAnnouncementFallback({
      category: 'web_release',
      version: '1.2.7',
      changelogEntry: extractChangelogEntryFromMarkdown(SAMPLE_CHANGELOG, '1.2.7'),
    })
    const result = await polishReleaseAnnouncement({
      fallback,
      category: 'web_release',
      version: '1.2.7',
      environment: FLASH_ENVIRONMENT,
      maxAttempts: 1,
      retryDelayMs: 0,
      fetchImplementation: aiFetch('本版本主要包含稳定性提升与问题修复。'),
    })
    expect(result.generatedByAi).toBe(false)
    expect(result.content).toContain('切换账号后公告列表')
    expect(result.content).toContain('背景动画恢复表现')
  })

  it('rejects AI summary that reintroduces admin/internal lines', async () => {
    const fallback = buildReleaseAnnouncementFallback({
      category: 'web_release',
      version: '1.2.7',
      changelogEntry: extractChangelogEntryFromMarkdown(SAMPLE_CHANGELOG, '1.2.7'),
    })
    const result = await polishReleaseAnnouncement({
      fallback,
      category: 'web_release',
      version: '1.2.7',
      environment: FLASH_ENVIRONMENT,
      maxAttempts: 1,
      retryDelayMs: 0,
      rejectedLines: ['- 公告草稿生成：source_key 已存在时跳过 AI；重新润色禁止覆盖已生效公告。[audience:admin] (Web)'],
      fetchImplementation: aiFetch('本次还优化了公告草稿生成：source_key 已存在时跳过 AI。'),
    })
    expect(result.generatedByAi).toBe(false)
    expect(result.content).not.toContain('source_key')
  })

  it('rejects AI summary containing internal markers', () => {
    const detailed = buildReleaseAnnouncementFallback({
      category: 'web_release',
      version: '1.2.7',
      changelogEntry: '### 修复\n- 用户修复。[audience:user] (B)',
    }).content
    expect(validateAiOpeningSummary('新增能力。[audience:admin] (Web)', detailed).ok).toBe(false)
  })

  it('composes summary without duplicating headline or 本次更新', () => {
    const fallback = buildReleaseAnnouncementFallback({
      category: 'web_release',
      version: '1.2.7',
      changelogEntry: '### 修复\n- 修复切换账号后公告列表状态残留的问题。[audience:user] (B)',
    })
    const composed = composeAnnouncementWithSummary('本次修复了切换账号后的公告列表状态。', fallback)
    expect(composed.match(/已发布。/g)).toHaveLength(1)
    expect(composed.match(/本次更新：/g)).toHaveLength(1)
    expect(composed).toContain('本次修复了切换账号后的公告列表状态。')
    expect(composed).toContain('修复切换账号后公告列表状态残留的问题')
    expect(collectFactSnippets(composed)).toEqual(['修复切换账号后公告列表状态残留的问题。'])
    expect(collectFactSnippets('本次更新：\n1. 编号事实一项\n2. 第二项')).toEqual([
      '编号事实一项',
      '第二项',
    ])
  })

  it('does not put admin/internal lines into AI request body', async () => {
    const bodies = []
    const fallback = buildReleaseAnnouncementFallback({
      category: 'web_release',
      version: '1.2.7',
      changelogEntry: extractChangelogEntryFromMarkdown(SAMPLE_CHANGELOG, '1.2.7'),
    })
    await polishReleaseAnnouncement({
      fallback,
      category: 'web_release',
      version: '1.2.7',
      environment: FLASH_ENVIRONMENT,
      maxAttempts: 1,
      retryDelayMs: 0,
      fetchImplementation: async (_url, options) => {
        bodies.push(JSON.parse(String(options.body)))
        return new Response(JSON.stringify({
          choices: [{ message: { content: '本次修复了切换账号后的公告状态，并改善切回前台后的背景动画。' } }],
        }))
      },
    })
    const prompt = JSON.stringify(bodies[0])
    expect(prompt).toContain('切换账号后公告列表')
    expect(prompt).not.toContain('source_key')
    expect(prompt).not.toContain('组件级回归测试')
    expect(prompt).not.toContain('[audience:')
    expect(prompt).not.toContain('ParticleBg')
    expect(prompt).not.toContain('installUpdate')
  })
})

describe('polishReleaseAnnouncement raw AI validation integration', () => {
  const userFactsFallback = () => buildReleaseAnnouncementFallback({
    category: 'web_release',
    version: '1.2.7',
    changelogEntry: `### 修复
- 修复登录状态失效问题。[audience:user] (B)
- 修复切换账号后公告列表可能残留上一账号状态的问题。[audience:user] (B/C)`,
  })

  it('rejects raw AI output that still contains audience and channel markers', async () => {
    const fallback = userFactsFallback()
    const result = await polishReleaseAnnouncement({
      fallback,
      category: 'web_release',
      version: '1.2.7',
      environment: FLASH_ENVIRONMENT,
      maxAttempts: 1,
      retryDelayMs: 0,
      fetchImplementation: aiFetch('修复登录。[audience:admin] (Web)'),
    })
    expect(result.generatedByAi).toBe(false)
    expect(result.generationError).toMatch(/audience_marker|channel_marker/)
    expect(result.content).toBe(fallback.content)
    expect(result.content).toContain('修复登录状态失效问题')
    expect(result.content).not.toContain('[audience:')
  })

  it('rejects raw AI output that mentions admin backend convenience', async () => {
    const fallback = userFactsFallback()
    const result = await polishReleaseAnnouncement({
      fallback,
      category: 'web_release',
      version: '1.2.7',
      environment: FLASH_ENVIRONMENT,
      maxAttempts: 1,
      retryDelayMs: 0,
      fetchImplementation: aiFetch('管理员后台配置更加方便。'),
    })
    expect(result.generatedByAi).toBe(false)
    expect(result.generationError).toMatch(/internal_vocabulary/)
    expect(result.content).toBe(fallback.content)
  })

  it('rejects vague experience-only summaries via polishReleaseAnnouncement', async () => {
    const fallback = userFactsFallback()
    const result = await polishReleaseAnnouncement({
      fallback,
      category: 'web_release',
      version: '1.2.7',
      environment: FLASH_ENVIRONMENT,
      maxAttempts: 1,
      retryDelayMs: 0,
      fetchImplementation: aiFetch('本次进行了多项体验优化，使用更加顺畅。'),
    })
    expect(result.generatedByAi).toBe(false)
    expect(result.generationError).toMatch(/vague_summary/)
    expect(result.content).toContain('修复登录状态失效问题')
  })

  it('rejects invented membership feature not present in CHANGELOG facts', async () => {
    const fallback = userFactsFallback()
    const result = await polishReleaseAnnouncement({
      fallback,
      category: 'web_release',
      version: '1.2.7',
      environment: FLASH_ENVIRONMENT,
      maxAttempts: 1,
      retryDelayMs: 0,
      fetchImplementation: aiFetch('新增会员功能，登录体验更好。'),
    })
    expect(result.generatedByAi).toBe(false)
    expect(result.generationError).toMatch(/ungrounded_feature_claim|ungrounded_term|no_fact_overlap/)
    expect(result.content).not.toContain('会员')
  })

  it('rejects summaries that hitchhike on one fact word then invent new nouns', async () => {
    const fallback = userFactsFallback()
    const cases = [
      '登录体验更加可靠，同时会员权益更加丰富。',
      '修复登录问题，并新增积分商城。',
      '公告状态已修复，同时支持团队协作。',
    ]
    for (const content of cases) {
      const result = await polishReleaseAnnouncement({
        fallback,
        category: 'web_release',
        version: '1.2.7',
        environment: FLASH_ENVIRONMENT,
        maxAttempts: 1,
        retryDelayMs: 0,
        fetchImplementation: aiFetch(content),
      })
      expect(result.generatedByAi).toBe(false)
      expect(result.generationError).toMatch(/ungrounded_term|ungrounded_feature_claim/)
      expect(result.content).toBe(fallback.content)
    }
  })

  it('accepts a fully grounded summary without invented nouns', async () => {
    const fallback = userFactsFallback()
    const result = await polishReleaseAnnouncement({
      fallback,
      category: 'web_release',
      version: '1.2.7',
      environment: FLASH_ENVIRONMENT,
      maxAttempts: 1,
      retryDelayMs: 0,
      fetchImplementation: aiFetch('修复登录状态失效问题。'),
    })
    expect(result.generatedByAi).toBe(true)
    expect(result.generationError).toBeNull()
    expect(result.content).toContain('修复登录状态失效问题。')
  })

  it('accepts a grounded multi-fact summary and keeps single headline structure', async () => {
    const fallback = userFactsFallback()
    const result = await polishReleaseAnnouncement({
      fallback,
      category: 'web_release',
      version: '1.2.7',
      environment: FLASH_ENVIRONMENT,
      maxAttempts: 1,
      retryDelayMs: 0,
      fetchImplementation: aiFetch('本次修复了登录状态失效，并改善切换账号后的公告状态。'),
    })
    expect(result.generatedByAi).toBe(true)
    expect(result.generationError).toBeNull()
    expect(result.content.match(/已发布。/g)).toHaveLength(1)
    expect(result.content.match(/本次更新：/g)).toHaveLength(1)
    expect(result.content).toContain('本次修复了登录状态失效')
    expect(result.content).toContain('修复登录状态失效问题')
    expect(result.content).toContain('切换账号后公告列表')
    expect(result.content).not.toMatch(/\[audience:|\(Web\)|\(B\)|Store|ParticleBg/)
  })

  it('rejects English internal vocabulary even when user fact words also appear', async () => {
    const fallback = buildReleaseAnnouncementFallback({
      category: 'web_release',
      version: '1.2.7',
      changelogEntry: `### 修复
- 修复公告列表状态残留问题。[audience:user] (B)
- 优化 Store 页面加载表现。[audience:user] (B)`,
    })
    const cases = [
      'Admin Store management is improved.',
      'Backend announcement tools were optimized.',
      'Audit and migration workflow improved.',
    ]
    for (const content of cases) {
      const result = await polishReleaseAnnouncement({
        fallback,
        category: 'web_release',
        version: '1.2.7',
        environment: FLASH_ENVIRONMENT,
        maxAttempts: 1,
        retryDelayMs: 0,
        fetchImplementation: aiFetch(content),
      })
      expect(result.generatedByAi).toBe(false)
      expect(result.generationError).toMatch(/internal_vocabulary/)
      expect(result.content).toBe(fallback.content)
    }
  })
})

describe('changelog path resolution', () => {
  it('lists local and vercel-like candidates', () => {
    const candidates = resolveChangelogPathCandidates('/app', '/var/task')
    expect(candidates.some(item => item.replace(/\\/g, '/').endsWith('/CHANGELOG.md'))).toBe(true)
  })

  it('throws when changelog file does not exist', () => {
    expect(() => readChangelogFile('/missing-root-dir-for-changelog', {
      existsSync: () => false,
      readFileSync: () => '',
    })).toThrow(/无法定位 CHANGELOG/)
  })
})

describe('repolish regression', () => {
  it('returns 404 when announcement is deleted during repolish', async () => {
    const client = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [adminRow({ active: false })] })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [] }),
    }
    await expect(repolishAnnouncementDraft(client, 7, {
      environment: FLASH_ENVIRONMENT,
      fetchImplementation: aiFetch('新正文'),
    })).rejects.toMatchObject({ statusCode: 404 })
  })

  it('keeps original content and records generation_error when AI fails', async () => {
    const client = {
      query: vi.fn()
        .mockResolvedValueOnce({
          rows: [adminRow({ active: false, content: '原正文保留' })],
        })
        .mockResolvedValueOnce({
          rows: [adminRow({
            active: false,
            content: '原正文保留',
            generated_by_ai: false,
            generation_error: 'AI 供应商返回错误：HTTP 503。',
          })],
        }),
    }
    const result = await repolishAnnouncementDraft(client, 7, {
      environment: FLASH_ENVIRONMENT,
      maxAttempts: 1,
      retryDelayMs: 0,
      fetchImplementation: async () => new Response('{}', { status: 503 }),
    })
    expect(client.query.mock.calls[1][1][1]).toBe('原正文保留')
    expect(client.query.mock.calls[1][1][2]).toBe(false)
    expect(String(client.query.mock.calls[1][1][4])).toMatch(/503|AI/)
    expect(result.content).toBe('原正文保留')
  })
})

describe('insert conflict and metadata regression', () => {
  it('inserts with ON CONFLICT DO NOTHING and correct source metadata', async () => {
    const requests = []
    const client = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [adminRow({
            category: 'desktop_release',
            version: '1.2.5',
            source_key: 'desktop_release:1.2.5',
            source_commit: 'abc1234',
            generated_by_ai: true,
            generation_provider: 'DeepSeek Flash/deepseek-flash',
          })],
        }),
    }
    await generateReleaseAnnouncementDraft(client, {
      category: 'desktop_release',
      version: '1.2.5',
      sourceCommit: 'ABC1234',
      changelogEntry: '### 修复\n- 修复桌面更新提示。[audience:user] (C)',
      environment: FLASH_ENVIRONMENT,
      fetchImplementation: aiFetch('本次修复了桌面更新提示。', requests),
    })
    const insertSql = client.query.mock.calls[1][0]
    const insertParams = client.query.mock.calls[1][1]
    expect(insertSql).toContain('ON CONFLICT (source_key) DO NOTHING')
    expect(insertParams[3]).toBe('1.2.5')
    expect(insertParams[4]).toBe('desktop_release:1.2.5')
    expect(insertParams[5]).toBe('abc1234')
    expect(insertParams[7]).toContain('DeepSeek')
    expect(JSON.stringify(requests[0].options.body)).toContain('产品更新公告')
    expect(extractAudienceMarker('- x [audience:all] (B)')).toBe('all')
  })
})
