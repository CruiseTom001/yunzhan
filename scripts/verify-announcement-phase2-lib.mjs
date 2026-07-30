import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  generateReleaseAnnouncementDraft,
  repolishAnnouncementDraft,
} from '../server/announcement-generation.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const migrationsDirectory = path.resolve(__dirname, '../server/migrations')
export const migration012 = '012_announcement_release_generation.sql'

export const VERIFY_LEGACY_TITLE = '__verify_phase2_legacy__'
export const VERIFY_DESKTOP_SOURCE_KEY = 'desktop_release:9.9.9'
export const VERIFY_WEB_SOURCE_KEY = 'web_release:9.9.8'

export const FLASH_ENVIRONMENT = {
  AI_PROVIDERS_JSON: JSON.stringify([
    {
      id: 'deepseek-flash',
      name: 'DeepSeek Flash',
      baseUrl: 'https://api.deepseek.com/v1',
      apiKey: 'verify-fake-key',
      format: 'chat_completions',
      model: 'deepseek-flash',
    },
  ]),
}

export function assertCondition(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

export function rowCount(result) {
  if (typeof result.rowCount === 'number') return result.rowCount
  return Array.isArray(result.rows) ? result.rows.length : 0
}

export async function readMigrationFiles() {
  const files = (await fs.readdir(migrationsDirectory))
    .filter(file => file.endsWith('.sql'))
    .sort()
  return files
}

export async function applySql(db, sql, label) {
  try {
    if (typeof db.exec === 'function') {
      await db.exec(sql)
      return
    }
    await db.query(sql)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`${label} 失败：${message}`)
  }
}

export async function applyMigrationFile(db, filename) {
  const sql = await fs.readFile(path.join(migrationsDirectory, filename), 'utf8')
  await applySql(db, sql, filename)
}

export async function ensureSchemaMigrationsTable(db) {
  await applySql(db, `
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `, 'schema_migrations')
}

export async function applyTrackedMigrationsUpTo(db, lastFilenameInclusive) {
  await ensureSchemaMigrationsTable(db)
  const files = await readMigrationFiles()
  for (const file of files) {
    if (file > lastFilenameInclusive) break
    const applied = await db.query('SELECT 1 FROM schema_migrations WHERE filename = $1', [file])
    if (rowCount(applied) > 0) {
      console.info(`[verify:phase2] skipped ${file}`)
      continue
    }
    await applyMigrationFile(db, file)
    await db.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file])
    console.info(`[verify:phase2] applied ${file}`)
  }
}

export async function columnExists(db, tableName, columnName) {
  const result = await db.query(
    `SELECT 1
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
        AND column_name = $2`,
    [tableName, columnName],
  )
  return rowCount(result) > 0
}

function aiFetch(content) {
  return async () => new Response(JSON.stringify({
    choices: [{ message: { content } }],
  }))
}

async function expectQueryFailure(db, sql, params, expectedFragment) {
  try {
    await db.query(sql, params)
    throw new Error(`预期失败但执行成功：${expectedFragment}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('预期失败但执行成功')) throw error
    assertCondition(message.toLowerCase().includes(expectedFragment.toLowerCase()), `预期包含 "${expectedFragment}"，实际：${message}`)
  }
}

export async function cleanupVerificationArtifacts(db) {
  await db.query(
    `DELETE FROM announcements
      WHERE title = $1
         OR source_key = ANY($2::text[])`,
    [VERIFY_LEGACY_TITLE, [VERIFY_DESKTOP_SOURCE_KEY, VERIFY_WEB_SOURCE_KEY]],
  )
}

export async function runPhase2Verification(db, { label = 'verify:phase2' } = {}) {
  const files = await readMigrationFiles()
  assertCondition(files.includes(migration012), `缺少迁移文件 ${migration012}`)

  const hasCategoryColumn = await columnExists(db, 'announcements', 'category')
  let legacyId
  let legacySnapshot

  if (!hasCategoryColumn) {
    await applyTrackedMigrationsUpTo(db, '011_user_onboarding.sql')
    const legacyInsert = await db.query(
      `INSERT INTO announcements (title, content, published_at, active, created_at, updated_at)
       VALUES ($1, $2, TIMESTAMPTZ '2026-01-01T00:00:00Z', true, NOW(), NOW())
       RETURNING id, title, content, active, published_at`,
      [VERIFY_LEGACY_TITLE, '系统将于今晚维护。'],
    )
    assertCondition(rowCount(legacyInsert) === 1, '旧公告种子数据写入失败')
    legacyId = legacyInsert.rows[0].id
    legacySnapshot = {
      title: legacyInsert.rows[0].title,
      content: legacyInsert.rows[0].content,
      active: legacyInsert.rows[0].active,
      publishedAt: new Date(legacyInsert.rows[0].published_at).toISOString(),
    }
  } else {
    await applyTrackedMigrationsUpTo(db, '011_user_onboarding.sql')
    await cleanupVerificationArtifacts(db)
    const legacyInsert = await db.query(
      `INSERT INTO announcements (title, content, published_at, active, created_at, updated_at, category)
       VALUES ($1, $2, TIMESTAMPTZ '2026-01-01T00:00:00Z', true, NOW(), NOW(), 'general')
       RETURNING id, title, content, active, published_at`,
      [VERIFY_LEGACY_TITLE, '系统将于今晚维护。'],
    )
    assertCondition(rowCount(legacyInsert) === 1, '旧公告种子数据写入失败')
    legacyId = legacyInsert.rows[0].id
    legacySnapshot = {
      title: legacyInsert.rows[0].title,
      content: legacyInsert.rows[0].content,
      active: legacyInsert.rows[0].active,
      publishedAt: new Date(legacyInsert.rows[0].published_at).toISOString(),
    }
    console.info(`[${label}] 检测到 announcements.category 已存在，将在已迁移库上验证 012 幂等与草稿链路`)
  }

  const migration012Sql = await fs.readFile(path.join(migrationsDirectory, migration012), 'utf8')
  await applySql(db, migration012Sql, `${migration012} (第 1 次)`)
  console.info(`[${label}] applied ${migration012} (1/2)`)

  const legacyAfterFirst = await db.query(
    `SELECT title, content, active, published_at, category, source_key, version, generated_by_ai
       FROM announcements
      WHERE id = $1`,
    [legacyId],
  )
  const legacyRow = legacyAfterFirst.rows[0]
  assertCondition(legacyRow.title === legacySnapshot.title, '旧公告 title 被改写')
  assertCondition(legacyRow.content === legacySnapshot.content, '旧公告 content 被改写')
  assertCondition(legacyRow.active === legacySnapshot.active, '旧公告 active 被改写')
  assertCondition(new Date(legacyRow.published_at).toISOString() === legacySnapshot.publishedAt, '旧公告 published_at 被改写')
  assertCondition(legacyRow.category === 'general', '旧公告 category 默认值应为 general')
  assertCondition(legacyRow.source_key === null, '旧公告 source_key 应保持 NULL')
  assertCondition(legacyRow.version === null, '旧公告 version 应保持 NULL')
  assertCondition(legacyRow.generated_by_ai === false, '旧公告 generated_by_ai 应为 false')

  await applySql(db, migration012Sql, `${migration012} (第 2 次)`)
  console.info(`[${label}] applied ${migration012} (2/2)`)

  const legacyAfterSecond = await db.query(
    `SELECT title, content, active, category, source_key, version, generated_by_ai
       FROM announcements
      WHERE id = $1`,
    [legacyId],
  )
  const legacyRowSecond = legacyAfterSecond.rows[0]
  assertCondition(legacyRowSecond.title === legacySnapshot.title, '第二次迁移后旧公告 title 变化')
  assertCondition(legacyRowSecond.category === 'general', '第二次迁移后旧公告 category 变化')

  await expectQueryFailure(
    db,
    `INSERT INTO announcements (title, content, category, active)
     VALUES ($1, $2, $3, false)`,
    ['非法分类', '测试', 'invalid_category'],
    'announcements_category_check',
  )

  // 方案 A：AI 只写开场摘要，且每个显著名词必须能在用户事实中落地
  const aiContent = '本次修复了桌面更新提示。'
  const firstDraft = await generateReleaseAnnouncementDraft(db, {
    category: 'desktop_release',
    version: '9.9.9',
    sourceCommit: 'abc1234',
    changelogEntry: '### 修复\n- 修复桌面更新提示',
    environment: FLASH_ENVIRONMENT,
    fetchImplementation: aiFetch(aiContent),
  })
  assertCondition(firstDraft.created === true, '首次草稿生成应 created=true')
  assertCondition(firstDraft.announcement.active === false, '草稿应为 inactive')
  assertCondition(firstDraft.announcement.sourceKey === VERIFY_DESKTOP_SOURCE_KEY, 'source_key 不匹配')
  assertCondition(firstDraft.announcement.generatedByAi === true, 'AI 成功路径应标记 generatedByAi=true')
  assertCondition(firstDraft.announcement.content.includes(aiContent), 'AI 开场摘要未写入')
  assertCondition(firstDraft.announcement.content.includes('修复桌面更新提示'), '确定性详细条目应保留')
  assertCondition(firstDraft.announcement.content.includes('云栈桌面端 v9.9.9 已发布。'), '版本发布行缺失')
  assertCondition(firstDraft.announcement.content.includes('本次更新：'), '本次更新区块缺失')

  const duplicateDraft = await generateReleaseAnnouncementDraft(db, {
    category: 'desktop_release',
    version: '9.9.9',
    sourceCommit: 'abc1234',
    environment: FLASH_ENVIRONMENT,
    fetchImplementation: aiFetch('不应覆盖已有草稿'),
  })
  assertCondition(duplicateDraft.created === false, '重复 source_key 应 created=false')
  assertCondition(duplicateDraft.announcement.id === firstDraft.announcement.id, '重复 source_key 应返回同一草稿')

  const fallbackDraft = await generateReleaseAnnouncementDraft(db, {
    category: 'web_release',
    version: '9.9.8',
    sourceCommit: 'def5678',
    changelogEntry: '### 新增\n- 公告中心',
    environment: {},
  })
  assertCondition(fallbackDraft.created === true, '降级草稿应成功创建')
  assertCondition(fallbackDraft.announcement.generatedByAi === false, '无 AI 配置时应 generatedByAi=false')
  assertCondition(fallbackDraft.announcement.generationError !== null, '无 AI 配置时应记录 generation_error')
  assertCondition(fallbackDraft.announcement.content.includes('云栈网站 v9.9.8 已发布'), '降级正文应来自 CHANGELOG 模板')

  const repolished = await repolishAnnouncementDraft(db, firstDraft.announcement.id, {
    environment: FLASH_ENVIRONMENT,
    fetchImplementation: aiFetch('重新润色后的桌面端更新说明。'),
  })
  assertCondition(repolished.generatedByAi === true, '重新润色后应 generatedByAi=true')
  assertCondition(repolished.content === '重新润色后的桌面端更新说明。', '重新润色正文未更新')

  await db.query(
    `UPDATE announcements SET active = true, published_at = NOW() WHERE id = $1`,
    [firstDraft.announcement.id],
  )
  let repolishBlocked = false
  try {
    await repolishAnnouncementDraft(db, firstDraft.announcement.id, {
      environment: FLASH_ENVIRONMENT,
      fetchImplementation: aiFetch('不应润色生效公告'),
    })
  } catch (error) {
    repolishBlocked = error instanceof Error && error.message.includes('生效公告不能重新润色')
  }
  assertCondition(repolishBlocked, '生效公告重新润色应被拒绝')

  await expectQueryFailure(
    db,
    `INSERT INTO announcements (title, content, category, active, source_key)
     VALUES ($1, $2, $3, false, $4)`,
    ['重复 key', '测试', 'desktop_release', VERIFY_DESKTOP_SOURCE_KEY],
    'duplicate key',
  )

  await cleanupVerificationArtifacts(db)

  const versionResult = await db.query('SELECT version() AS version')
  const serverVersion = versionResult.rows[0]?.version
  if (serverVersion) {
    console.info(`[${label}] PostgreSQL: ${serverVersion}`)
  }
  console.info(`[${label}] OK: 迁移幂等、旧数据保留、约束与草稿生成链路全部通过`)
}
