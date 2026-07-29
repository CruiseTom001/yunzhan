import { loadServerAiProviders, requestAnnouncementPolish } from './ai-provider.mjs'
import {
  ANNOUNCEMENT_VERSION_PATTERN,
  RELEASE_ANNOUNCEMENT_CATEGORIES,
  mapAdminAnnouncementRow,
  readAnnouncementCommitInput,
} from './announcements.mjs'

const ANNOUNCEMENT_CONTENT_MAX_LENGTH = 4000
const ANNOUNCEMENT_CHANGELOG_MAX_LENGTH = 2800
const GENERATION_ERROR_MAX_LENGTH = 400
const GENERATION_PROVIDER_MAX_LENGTH = 120

function createHttpError(message, statusCode) {
  const error = new Error(message)
  error.statusCode = statusCode
  return error
}

function normalizeWhitespace(value) {
  return String(value ?? '').replace(/\r\n/g, '\n').trim()
}

export function buildReleaseAnnouncementSourceKey(category, version) {
  if (!RELEASE_ANNOUNCEMENT_CATEGORIES.has(category)) {
    throw createHttpError('公告分类无效。', 400)
  }
  if (typeof version !== 'string' || !ANNOUNCEMENT_VERSION_PATTERN.test(version.trim())) {
    throw createHttpError('公告版本无效。', 400)
  }
  return `${category}:${version.trim()}`
}

function categoryLabel(category) {
  if (category === 'desktop_release') return '桌面端'
  if (category === 'web_release') return '网站'
  return '公告'
}

function normalizeChangelogEntry(changelogEntry) {
  const lines = normalizeWhitespace(changelogEntry)
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
  const normalized = []
  for (const line of lines) {
    if (line.startsWith('## [')) continue
    if (line.startsWith('### ')) {
      normalized.push(`${line.slice(4).trim()}：`)
      continue
    }
    normalized.push(line)
  }
  const text = normalized.join('\n').trim()
  if (text.length <= ANNOUNCEMENT_CHANGELOG_MAX_LENGTH) return text
  return `${text.slice(0, ANNOUNCEMENT_CHANGELOG_MAX_LENGTH).trimEnd()}…`
}

function assertAnnouncementContent(content) {
  const normalized = normalizeWhitespace(content)
  if (normalized.length < 1 || normalized.length > ANNOUNCEMENT_CONTENT_MAX_LENGTH) {
    throw createHttpError('公告内容需为 1-4000 个字符。', 400)
  }
  return normalized
}

export function buildReleaseAnnouncementFallback({ category, version, changelogEntry = '' }) {
  const normalizedVersion = typeof version === 'string' ? version.trim() : ''
  if (!RELEASE_ANNOUNCEMENT_CATEGORIES.has(category) || !ANNOUNCEMENT_VERSION_PATTERN.test(normalizedVersion)) {
    throw createHttpError('公告分类或版本无效。', 400)
  }
  const label = categoryLabel(category)
  const title = `云栈${label} v${normalizedVersion} 更新`
  const changes = normalizeChangelogEntry(changelogEntry)
  const content = changes
    ? `云栈${label} v${normalizedVersion} 已发布。\n\n本次更新：\n${changes}`
    : `云栈${label} v${normalizedVersion} 已发布。\n\n本次更新包含稳定性改进与问题修复，具体变更以更新日志为准。`
  return {
    title,
    content: assertAnnouncementContent(content),
  }
}

export function extractChangelogEntryFromMarkdown(markdown, version) {
  const normalizedVersion = typeof version === 'string' ? version.trim() : ''
  if (!normalizedVersion) return ''
  const source = normalizeWhitespace(markdown)
  if (!source) return ''
  const pattern = new RegExp(`^## \\[${escapeRegExp(normalizedVersion)}\\][\\s\\S]*?(?=\\n## \\[|$)`, 'm')
  const match = source.match(pattern)
  return match ? match[0].trim() : ''
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function sanitizeGenerationError(error) {
  const message = error instanceof Error ? error.message : String(error)
  return message
    .replace(/Bearer\s+[^,\s]+/gi, 'Bearer ***')
    .replace(/sk-[a-z0-9_-]+/gi, 'sk-***')
    .slice(0, GENERATION_ERROR_MAX_LENGTH)
}

export function resolveAnnouncementAiProviderId(environment = process.env) {
  const explicit = environment.ANNOUNCEMENT_AI_PROVIDER_ID
  if (typeof explicit === 'string' && explicit.trim()) return explicit.trim()
  const providers = loadServerAiProviders(environment)
  const matches = providers.map((provider) => {
    const haystack = `${provider.id} ${provider.name} ${provider.model}`.toLowerCase()
    return { provider, haystack }
  })
  const deepseekFlash = matches.find(item => item.haystack.includes('deepseek') && item.haystack.includes('flash'))
  if (deepseekFlash) return deepseekFlash.provider.id
  const flash = matches.find(item => item.provider.model.toLowerCase().includes('flash'))
  return flash?.provider.id
}

function buildProviderSummary(result) {
  return `${result.providerName}/${result.model}`.slice(0, GENERATION_PROVIDER_MAX_LENGTH)
}

function buildAiInput({ category, version, fallbackContent }) {
  const label = categoryLabel(category)
  const versionLine = version ? `版本：v${version}\n` : ''
  return [
    `公告类型：${label}更新`,
    versionLine,
    '可用变更事实：',
    fallbackContent,
    '',
    '请只输出公告正文。',
  ].filter(Boolean).join('\n')
}

export async function polishReleaseAnnouncement({
  fallback,
  category,
  version,
  environment = process.env,
  fetchImplementation,
  providerId,
}) {
  const resolvedProviderId = providerId ?? resolveAnnouncementAiProviderId(environment)
  try {
    const result = await requestAnnouncementPolish({
      content: buildAiInput({ category, version, fallbackContent: fallback.content }),
      environment,
      fetchImplementation,
      providerId: resolvedProviderId,
    })
    return {
      content: assertAnnouncementContent(result.content),
      generatedByAi: true,
      generationProvider: buildProviderSummary(result),
      generationError: null,
    }
  } catch (error) {
    return {
      content: fallback.content,
      generatedByAi: false,
      generationProvider: null,
      generationError: sanitizeGenerationError(error) || 'AI 润色失败，已使用降级文本。',
    }
  }
}

const ADMIN_RETURNING_COLUMNS = `
  id, title, content, published_at, active, created_at, updated_at,
  category, version, source_key, source_commit,
  generated_by_ai, generation_provider, generation_error
`

export async function generateReleaseAnnouncementDraft(
  client,
  {
    category,
    version,
    sourceCommit = null,
    changelogEntry = '',
    environment = process.env,
    fetchImplementation,
    providerId,
  },
) {
  const sourceKey = buildReleaseAnnouncementSourceKey(category, version)
  const normalizedVersion = version.trim()
  const commit = readAnnouncementCommitInput(sourceCommit)
  if (!commit.ok) throw createHttpError('source_commit 无效。', 400)
  const fallback = buildReleaseAnnouncementFallback({
    category,
    version: normalizedVersion,
    changelogEntry,
  })
  const polished = await polishReleaseAnnouncement({
    fallback,
    category,
    version: normalizedVersion,
    environment,
    fetchImplementation,
    providerId,
  })

  const inserted = await client.query(
    `INSERT INTO announcements (
       title, content, published_at, active, created_by,
       category, version, source_key, source_commit,
       generated_by_ai, generation_provider, generation_error
     ) VALUES (
       $1, $2, NOW(), false, NULL,
       $3, $4, $5, $6,
       $7, $8, $9
     )
     ON CONFLICT (source_key) DO NOTHING
     RETURNING ${ADMIN_RETURNING_COLUMNS}`,
    [
      fallback.title,
      polished.content,
      category,
      normalizedVersion,
      sourceKey,
      commit.value,
      polished.generatedByAi,
      polished.generationProvider,
      polished.generationError,
    ],
  )

  if (inserted.rows.length > 0) {
    return { announcement: mapAdminAnnouncementRow(inserted.rows[0]), created: true }
  }

  const existing = await client.query(
    `SELECT ${ADMIN_RETURNING_COLUMNS}
       FROM announcements
      WHERE source_key = $1`,
    [sourceKey],
  )
  if (existing.rows.length === 0) {
    throw createHttpError('公告草稿生成失败。', 500)
  }
  return { announcement: mapAdminAnnouncementRow(existing.rows[0]), created: false }
}

export async function repolishAnnouncementDraft(
  client,
  announcementId,
  {
    environment = process.env,
    fetchImplementation,
    providerId,
  } = {},
) {
  const current = await client.query(
    `SELECT ${ADMIN_RETURNING_COLUMNS}
       FROM announcements
      WHERE id = $1`,
    [announcementId],
  )
  const row = current.rows[0]
  if (!row) throw createHttpError('公告不存在。', 404)
  const currentAnnouncement = mapAdminAnnouncementRow(row)
  if (currentAnnouncement.active) {
    throw createHttpError('生效公告不能重新润色，请先下线。', 400)
  }

  const polished = await polishReleaseAnnouncement({
    fallback: { title: currentAnnouncement.title, content: currentAnnouncement.content },
    category: currentAnnouncement.category,
    version: currentAnnouncement.version,
    environment,
    fetchImplementation,
    providerId,
  })

  const updated = await client.query(
    `UPDATE announcements
        SET content = $2,
            generated_by_ai = $3,
            generation_provider = $4,
            generation_error = $5,
            updated_at = NOW()
      WHERE id = $1
      RETURNING ${ADMIN_RETURNING_COLUMNS}`,
    [
      announcementId,
      polished.content,
      polished.generatedByAi,
      polished.generationProvider,
      polished.generationError,
    ],
  )
  return mapAdminAnnouncementRow(updated.rows[0])
}
