import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import {
  applyTrackedMigrationsUpTo,
} from '../scripts/verify-announcement-phase2-lib.mjs'
import {
  buildGenericReleaseAnnouncementContent,
  extractChangelogEntryFromMarkdown,
  generateReleaseAnnouncementDraft,
} from './announcement-generation.mjs'

const ACTOR_ID = '11111111-1111-4111-8111-111111111111'
const SAMPLE_CHANGELOG = `# 变更日志

## [1.2.6] - 2026-07-29

### 新增
- 公告中心支持按公告类型和版本查看更新信息。[audience:user] (B/C)
`

const FLASH_ENVIRONMENT = {
  AI_PROVIDERS_JSON: JSON.stringify([
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

function aiFetch(content) {
  return async () => new Response(JSON.stringify({
    choices: [{ message: { content } }],
  }))
}

describe('generateReleaseAnnouncementDraft PGLite atomicity', () => {
  /** @type {PGlite | null} */
  let db = null

  beforeEach(async () => {
    db = new PGlite()
    await applyTrackedMigrationsUpTo(db, '012_announcement_release_generation.sql')
  })

  afterEach(async () => {
    if (db) {
      await db.close()
      db = null
    }
  })

  it('rolls back announcement when audit INSERT fails inside CTE', async () => {
    await db.exec(`
      ALTER TABLE audit_logs
        ADD CONSTRAINT audit_logs_deny_fail_action
        CHECK (action <> 'announcement.generate_from_changelog_fail')
    `)

    let caught = null
    try {
      await generateReleaseAnnouncementDraft(db, {
        category: 'desktop_release',
        version: '1.2.6',
        sourceCommit: '0f3cdbe',
        changelogEntry: extractChangelogEntryFromMarkdown(SAMPLE_CHANGELOG, '1.2.6'),
        environment: FLASH_ENVIRONMENT,
        fetchImplementation: aiFetch('本次更新强化了公告中心体验。'),
        auditContext: {
          action: 'announcement.generate_from_changelog_fail',
          actorUserId: ACTOR_ID,
          targetUserId: ACTOR_ID,
        },
      })
    } catch (error) {
      caught = error
    }

    expect(caught).toBeTruthy()
    const announcements = await db.query(
      `SELECT id, source_key FROM announcements WHERE source_key = $1`,
      ['desktop_release:1.2.6'],
    )
    const audits = await db.query(
      `SELECT id FROM audit_logs WHERE action LIKE 'announcement.generate_from_changelog%'`,
    )
    expect(announcements.rows).toHaveLength(0)
    expect(audits.rows).toHaveLength(0)
  })

  it('atomically inserts announcement and one create audit', async () => {
    const result = await generateReleaseAnnouncementDraft(db, {
      category: 'desktop_release',
      version: '1.2.6',
      sourceCommit: '0f3cdbe73add73b47ce0b251fdcc08e6f48a0a0d',
      changelogEntry: extractChangelogEntryFromMarkdown(SAMPLE_CHANGELOG, '1.2.6'),
      environment: FLASH_ENVIRONMENT,
      fetchImplementation: aiFetch('本次更新强化了公告中心体验。'),
      auditContext: {
        action: 'announcement.generate_from_changelog',
        actorUserId: ACTOR_ID,
        targetUserId: ACTOR_ID,
      },
    })

    expect(result.created).toBe(true)
    expect(result.repaired).toBe(false)

    const announcements = await db.query(
      `SELECT source_key, content FROM announcements WHERE source_key = $1`,
      ['desktop_release:1.2.6'],
    )
    const audits = await db.query(
      `SELECT action, actor_user_id::text AS actor, metadata
         FROM audit_logs
        WHERE action = 'announcement.generate_from_changelog'`,
    )
    expect(announcements.rows).toHaveLength(1)
    expect(audits.rows).toHaveLength(1)
    expect(audits.rows[0].metadata).toEqual({
      category: 'desktop_release',
      version: '1.2.6',
      sourceKey: 'desktop_release:1.2.6',
      sourceCommit: '0f3cdbe73add73b47ce0b251fdcc08e6f48a0a0d',
    })
    expect(JSON.stringify(audits.rows[0].metadata)).not.toContain(announcements.rows[0].content)
  })

  it('does not mutate existing inactive draft when repairExistingGeneric=false', async () => {
    const original = '原 inactive 草稿正文，禁止补建修改。'
    await db.query(
      `INSERT INTO announcements (
         title, content, published_at, active, category, version, source_key
       ) VALUES (
         '云栈桌面端 v1.2.6 更新', $1, NOW(), false,
         'desktop_release', '1.2.6', 'desktop_release:1.2.6'
       )`,
      [original],
    )

    const result = await generateReleaseAnnouncementDraft(db, {
      category: 'desktop_release',
      version: '1.2.6',
      changelogEntry: extractChangelogEntryFromMarkdown(SAMPLE_CHANGELOG, '1.2.6'),
      environment: FLASH_ENVIRONMENT,
      repairExistingGeneric: false,
      fetchImplementation: aiFetch('不应调用'),
      auditContext: {
        action: 'announcement.generate_from_changelog',
        actorUserId: ACTOR_ID,
        targetUserId: ACTOR_ID,
      },
    })

    expect(result.created).toBe(false)
    expect(result.repaired).toBe(false)
    expect(result.announcement.content).toBe(original)

    const row = await db.query(
      `SELECT content FROM announcements WHERE source_key = $1`,
      ['desktop_release:1.2.6'],
    )
    const audits = await db.query(
      `SELECT id FROM audit_logs WHERE action = 'announcement.generate_from_changelog'`,
    )
    expect(row.rows[0].content).toBe(original)
    expect(audits.rows).toHaveLength(0)
  })

  it('does not auto-repair inactive generic drafts when repairExistingGeneric=false', async () => {
    const generic = buildGenericReleaseAnnouncementContent('desktop_release', '1.2.6')
    await db.query(
      `INSERT INTO announcements (
         title, content, published_at, active, category, version, source_key
       ) VALUES (
         '云栈桌面端 v1.2.6 更新', $1, NOW(), false,
         'desktop_release', '1.2.6', 'desktop_release:1.2.6'
       )`,
      [generic],
    )

    const result = await generateReleaseAnnouncementDraft(db, {
      category: 'desktop_release',
      version: '1.2.6',
      changelogEntry: extractChangelogEntryFromMarkdown(SAMPLE_CHANGELOG, '1.2.6'),
      environment: FLASH_ENVIRONMENT,
      repairExistingGeneric: false,
      fetchImplementation: aiFetch('不应调用'),
    })

    expect(result.created).toBe(false)
    expect(result.repaired).toBe(false)
    expect(result.announcement.content).toBe(generic)

    const row = await db.query(
      `SELECT content FROM announcements WHERE source_key = $1`,
      ['desktop_release:1.2.6'],
    )
    expect(row.rows[0].content).toBe(generic)
  })

  it('defaults repairExistingGeneric=true and still auto-repairs generic inactive drafts', async () => {
    const generic = buildGenericReleaseAnnouncementContent('desktop_release', '1.2.6')
    await db.query(
      `INSERT INTO announcements (
         title, content, published_at, active, category, version, source_key
       ) VALUES (
         '云栈桌面端 v1.2.6 更新', $1, NOW(), false,
         'desktop_release', '1.2.6', 'desktop_release:1.2.6'
       )`,
      [generic],
    )

    const result = await generateReleaseAnnouncementDraft(db, {
      category: 'desktop_release',
      version: '1.2.6',
      changelogEntry: extractChangelogEntryFromMarkdown(SAMPLE_CHANGELOG, '1.2.6'),
      environment: {},
    })

    expect(result.created).toBe(false)
    expect(result.repaired).toBe(true)
    expect(result.announcement.content).not.toBe(generic)
    expect(result.announcement.content).toContain('公告中心')
  })

  it('ON CONFLICT concurrency yields one draft and at most one create audit', async () => {
    const changelogEntry = extractChangelogEntryFromMarkdown(SAMPLE_CHANGELOG, '1.2.6')
    const options = {
      category: 'desktop_release',
      version: '1.2.6',
      sourceCommit: '0f3cdbe',
      changelogEntry,
      environment: FLASH_ENVIRONMENT,
      fetchImplementation: aiFetch('本次更新强化了公告中心体验。'),
      auditContext: {
        action: 'announcement.generate_from_changelog',
        actorUserId: ACTOR_ID,
        targetUserId: ACTOR_ID,
      },
    }

    const [first, second] = await Promise.all([
      generateReleaseAnnouncementDraft(db, options),
      generateReleaseAnnouncementDraft(db, options),
    ])

    const createdCount = [first, second].filter(item => item.created).length
    const existingCount = [first, second].filter(item => !item.created).length
    expect(createdCount).toBe(1)
    expect(existingCount).toBe(1)
    expect(first.repaired).toBe(false)
    expect(second.repaired).toBe(false)

    const announcements = await db.query(
      `SELECT id FROM announcements WHERE source_key = $1`,
      ['desktop_release:1.2.6'],
    )
    const audits = await db.query(
      `SELECT id FROM audit_logs WHERE action = 'announcement.generate_from_changelog'`,
    )
    expect(announcements.rows).toHaveLength(1)
    expect(audits.rows).toHaveLength(1)
  })
})
