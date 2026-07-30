import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
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

const QUADRANT_MARKER_PATTERN = /\s*\(([^)]+)\)\s*$/
const QUADRANT_TOKEN_PATTERN = /^(?:[ABCD]|Web)$/i
const INLINE_QUADRANT_MARKER_PATTERN = /\s*\((?:[ABCD]|Web)(?:\s*\/\s*(?:[ABCD]|Web))*\)/gi
const AUDIENCE_MARKER_PATTERN = /\[audience:(user|all|admin|internal)\]/gi
const ANY_AUDIENCE_MARKER_PATTERN = /\[audience:[^\]]*\]/gi
const VALID_AUDIENCES = new Set(['user', 'all', 'admin', 'internal'])
const USER_AUDIENCES = new Set(['user', 'all'])
const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url))

export const ANNOUNCEMENT_AUDIENCES = Object.freeze(['user', 'all', 'admin', 'internal'])
export const USER_ANNOUNCEMENT_AUDIENCES = Object.freeze(['user', 'all'])
export const EMPTY_FILTERED_RELEASE_NOTICE = '本版本没有用户侧公告内容。'
export const LEGACY_EMPTY_FILTERED_CONTENTS = Object.freeze([
  EMPTY_FILTERED_RELEASE_NOTICE,
  '本版本主要同步基础能力与稳定性调整。',
])

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

export function categoryLabel(category) {
  if (category === 'desktop_release') return '桌面端'
  if (category === 'web_release') return '网站'
  return '公告'
}

/**
 * 按 Markdown 二级版本标题提取条目，避免多行模式下 `$` 歧义。
 * 支持 LF / CRLF；版本不存在时返回空字符串。
 */
export function extractChangelogEntryFromMarkdown(markdown, version) {
  const normalizedVersion = typeof version === 'string' ? version.trim() : ''
  if (!normalizedVersion) return ''
  const source = String(markdown ?? '').replace(/\r\n/g, '\n')
  if (!source.trim()) return ''

  const lines = source.split('\n')
  const headerPrefix = `## [${normalizedVersion}]`
  let startIndex = -1
  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index].startsWith(headerPrefix)) {
      startIndex = index
      break
    }
  }
  if (startIndex < 0) return ''

  let endIndex = lines.length
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    if (/^## \[/.test(lines[index])) {
      endIndex = index
      break
    }
  }

  return lines.slice(startIndex, endIndex).join('\n').trim()
}

/** @deprecated 使用 extractChangelogEntryFromMarkdown；保留别名便于门禁脚本。 */
export function extractVersionSection(markdown, version) {
  const entry = extractChangelogEntryFromMarkdown(markdown, version)
  return entry || null
}

function parseQuadrantMarkers(rawMarker) {
  const tokens = String(rawMarker ?? '')
    .split(/[/,]+/)
    .map(token => token.trim())
    .filter(Boolean)
  const markers = []
  for (const token of tokens) {
    if (!QUADRANT_TOKEN_PATTERN.test(token)) continue
    const normalized = token.toLowerCase() === 'web' ? 'Web' : token.toUpperCase()
    if (!markers.includes(normalized)) markers.push(normalized)
  }
  return markers
}

/**
 * 提取全部 audience 标记（含非法值）。用于门禁与安全过滤。
 */
export function extractAllAudienceMarkers(text) {
  if (typeof text !== 'string' || !text) return []
  return [...text.matchAll(/\[audience:([^\]]+)\]/gi)].map(match => match[1].trim().toLowerCase())
}

/**
 * 校验单条 bullet 的 audience：必须恰好一个合法值，或历史兼容的零标记。
 * @param {{ requireExactlyOne?: boolean }} options requireExactlyOne=true 时用于当前版本门禁。
 */
export function analyzeAudienceMarkersOnLine(text, { requireExactlyOne = false } = {}) {
  const audiences = extractAllAudienceMarkers(text)
  const unknownAudiences = audiences.filter(value => !VALID_AUDIENCES.has(value))
  const validAudiences = audiences.filter(value => VALID_AUDIENCES.has(value))

  if (audiences.length === 0) {
    return {
      ok: !requireExactlyOne,
      reason: requireExactlyOne ? 'missing' : null,
      audience: null,
      audiences,
      unknownAudience: null,
      hasAudience: false,
      hasConflict: false,
      userFacing: !requireExactlyOne,
    }
  }

  if (audiences.length > 1) {
    return {
      ok: false,
      reason: 'multiple',
      audience: null,
      audiences,
      unknownAudience: unknownAudiences[0] ?? null,
      hasAudience: true,
      hasConflict: true,
      userFacing: false,
    }
  }

  if (unknownAudiences.length > 0) {
    return {
      ok: false,
      reason: 'invalid',
      audience: null,
      audiences,
      unknownAudience: unknownAudiences[0],
      hasAudience: true,
      hasConflict: false,
      userFacing: false,
    }
  }

  const audience = validAudiences[0]
  return {
    ok: true,
    reason: null,
    audience,
    audiences,
    unknownAudience: null,
    hasAudience: true,
    hasConflict: false,
    userFacing: USER_AUDIENCES.has(audience),
  }
}

/**
 * 兼容旧调用：仅当恰好一个合法 audience 时返回该值，否则 null。
 * 注意：多标记冲突时返回 null，调用方不得据此把条目当作历史无标记放行。
 */
export function extractAudienceMarker(text) {
  const analysis = analyzeAudienceMarkersOnLine(text)
  if (!analysis.ok || analysis.audiences.length !== 1) return null
  return analysis.audience
}

export function isValidAudience(value) {
  return typeof value === 'string' && VALID_AUDIENCES.has(value)
}

export function stripAudienceMarkers(text) {
  return String(text ?? '')
    .replace(/\[audience:(user|all|admin|internal)\]/gi, '')
    .replace(/\[audience:[^\]]*\]/gi, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

export function stripQuadrantMarkersFromText(text) {
  return normalizeWhitespace(
    stripAudienceMarkers(
      String(text ?? '').replace(/\s*\((?:[ABCD]|Web)(?:\s*\/\s*(?:[ABCD]|Web))*\)/gi, ''),
    ),
  )
}

export function announcementContainsInternalMarkers(text) {
  if (typeof text !== 'string' || !text) return false
  return /\((?:[ABCD]|Web)(?:\s*\/\s*(?:[ABCD]|Web))*\)/i.test(text)
    || /\[audience:/i.test(text)
}

export function shouldIncludeChangelogItem(markers, category) {
  if (!Array.isArray(markers) || markers.length === 0) return true
  const set = new Set(markers)

  if (category === 'web_release') {
    // 排除纯桌面专属 C；保留 A/B/Web/未标记，以及 B/C 等混合标记
    return !(set.size === 1 && set.has('C'))
  }

  if (category === 'desktop_release') {
    // 排除 D 与纯 Web；保留 A/B/C/未标记
    if ([...set].every(marker => marker === 'D' || marker === 'Web')) return false
    return set.has('A') || set.has('B') || set.has('C')
  }

  return true
}

function shouldIncludeAudience(audience) {
  // 历史版本无标记：兼容为 user，禁止关键词推断
  if (!audience) return true
  return USER_AUDIENCES.has(audience)
}

/**
 * 按渠道 + 受众过滤 CHANGELOG 条目，并去掉内部标记。
 * 返回面向用户的明细文本；无适用条目时返回空字符串。
 */
export function formatChangelogForAnnouncement(changelogEntry, category) {
  const source = normalizeWhitespace(changelogEntry)
  if (!source) return ''

  const sections = []
  let currentSection = null

  for (const rawLine of source.split('\n')) {
    const line = rawLine.trim()
    if (!line) continue
    if (line.startsWith('## [')) continue

    if (line.startsWith('### ')) {
      if (currentSection && currentSection.items.length > 0) sections.push(currentSection)
      currentSection = {
        title: line.slice(4).trim(),
        items: [],
      }
      continue
    }

    if (!line.startsWith('- ') && !line.startsWith('* ') && !/^\d+\.\s+/.test(line)) {
      continue
    }

    const audienceAnalysis = analyzeAudienceMarkersOnLine(line)
    // 多标记 / 非法标记：安全排除，绝不取第一个
    if (audienceAnalysis.hasConflict || audienceAnalysis.unknownAudience) continue
    if (!shouldIncludeAudience(audienceAnalysis.audience)) continue

    const markerMatch = line.match(QUADRANT_MARKER_PATTERN)
    const markers = markerMatch ? parseQuadrantMarkers(markerMatch[1]) : []
    if (!shouldIncludeChangelogItem(markers, category)) continue

    const cleaned = stripQuadrantMarkersFromText(line)
    if (!cleaned) continue
    if (!currentSection) {
      currentSection = { title: '', items: [] }
    }
    currentSection.items.push(cleaned)
  }

  if (currentSection && currentSection.items.length > 0) sections.push(currentSection)

  const blocks = sections.map((section) => {
    if (section.title) {
      return `${section.title}：\n${section.items.join('\n')}`
    }
    return section.items.join('\n')
  }).filter(Boolean)

  const text = blocks.join('\n').trim()
  if (!text) return ''
  if (text.length <= ANNOUNCEMENT_CHANGELOG_MAX_LENGTH) return text
  return `${text.slice(0, ANNOUNCEMENT_CHANGELOG_MAX_LENGTH).trimEnd()}…`
}

/**
 * 列出版本段内原始 bullet，供门禁与测试使用。
 */
export function listChangelogBulletLines(sectionMarkdown) {
  if (!sectionMarkdown) return []
  return String(sectionMarkdown)
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('- ') || line.startsWith('* ') || /^\d+\.\s+\S/.test(line))
}

export function analyzeChangelogBulletsForAudience(sectionMarkdown) {
  const bullets = listChangelogBulletLines(sectionMarkdown)
  return bullets.map((line) => {
    const analysis = analyzeAudienceMarkersOnLine(line, { requireExactlyOne: true })
    return {
      line,
      audience: analysis.audience,
      audiences: analysis.audiences,
      unknownAudience: analysis.unknownAudience,
      hasAudience: analysis.hasAudience && analysis.audiences.length === 1 && !analysis.unknownAudience,
      hasConflict: analysis.hasConflict === true,
      hasExactAudience: analysis.ok === true,
      userFacing: analysis.userFacing === true,
      reason: analysis.reason,
    }
  })
}

function assertAnnouncementContent(content) {
  const normalized = normalizeWhitespace(content)
  if (normalized.length < 1 || normalized.length > ANNOUNCEMENT_CONTENT_MAX_LENGTH) {
    throw createHttpError('公告内容需为 1-4000 个字符。', 400)
  }
  return normalized
}

export function buildGenericReleaseAnnouncementContent(category, version) {
  const label = categoryLabel(category)
  const normalizedVersion = typeof version === 'string' ? version.trim() : ''
  return `云栈${label} v${normalizedVersion} 已发布。\n\n本次更新包含稳定性改进与问题修复，具体变更以更新日志为准。`
}

export function buildEmptyFilteredReleaseAnnouncementContent(_category, _version) {
  return EMPTY_FILTERED_RELEASE_NOTICE
}

export function isEmptyFilteredReleaseContent(content) {
  const normalized = normalizeWhitespace(content)
  if (!normalized) return false
  if (LEGACY_EMPTY_FILTERED_CONTENTS.some(item => normalized === item || normalized.endsWith(item))) {
    return true
  }
  return /本版本主要同步基础能力与稳定性调整/.test(normalized)
    && !normalized.includes('\n- ')
}

export function isGenericReleaseAnnouncementContent(content, category, version) {
  const normalized = normalizeWhitespace(content)
  if (!normalized) return false
  const generic = normalizeWhitespace(buildGenericReleaseAnnouncementContent(category, version))
  return normalized === generic
}

export function buildReleaseAnnouncementFallback({ category, version, changelogEntry = '' }) {
  const normalizedVersion = typeof version === 'string' ? version.trim() : ''
  if (!RELEASE_ANNOUNCEMENT_CATEGORIES.has(category) || !ANNOUNCEMENT_VERSION_PATTERN.test(normalizedVersion)) {
    throw createHttpError('公告分类或版本无效。', 400)
  }
  const label = categoryLabel(category)
  const title = `云栈${label} v${normalizedVersion} 更新`
  const headline = `云栈${label} v${normalizedVersion} 已发布。`
  const factBlock = formatChangelogForAnnouncement(changelogEntry, category)
  const content = factBlock
    ? `${headline}\n\n本次更新：\n${factBlock}`
    : buildEmptyFilteredReleaseAnnouncementContent(category, normalizedVersion)
  return {
    title,
    content: assertAnnouncementContent(content),
    headline,
    factBlock,
    hasUserFacingContent: Boolean(factBlock),
  }
}

/**
 * 校验 changelog 条目存在且过滤后有用户侧内容；否则抛出明确错误（不调用 AI / 不 UPDATE）。
 */
export function assertRegeneratableChangelog({
  changelogMarkdown,
  category,
  version,
}) {
  if (typeof changelogMarkdown !== 'string' || !changelogMarkdown.trim()) {
    throw createHttpError('无法读取 CHANGELOG.md，已拒绝覆盖公告草稿。', 500)
  }
  const entry = extractChangelogEntryFromMarkdown(changelogMarkdown, version)
  if (!entry) {
    throw createHttpError(`CHANGELOG 中未找到版本 ${version}。`, 422)
  }
  const fallback = buildReleaseAnnouncementFallback({
    category,
    version,
    changelogEntry: entry,
  })
  if (!fallback.hasUserFacingContent || isEmptyFilteredReleaseContent(fallback.content)) {
    throw createHttpError(
      `版本 ${version} 在 ${category} 渠道下没有可展示的用户侧更新内容，已拒绝覆盖原草稿。`,
      422,
    )
  }
  return { entry, fallback }
}

function sanitizeGenerationError(error) {
  const message = error instanceof Error ? error.message : String(error)
  return message
    .replace(/Bearer\s+[^,\s]+/gi, 'Bearer ***')
    .replace(/sk-[a-z0-9_-]+/gi, 'sk-***')
    .slice(0, GENERATION_ERROR_MAX_LENGTH)
}

const ANNOUNCEMENT_AI_MAX_ATTEMPTS = 3
const ANNOUNCEMENT_AI_RETRY_DELAY_MS = 1500
const TRANSIENT_AI_STATUS_CODES = new Set([429, 503, 504])

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function isTransientAiError(error) {
  const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : null
  if (statusCode !== null && TRANSIENT_AI_STATUS_CODES.has(statusCode)) return true
  const message = error instanceof Error ? error.message : String(error)
  return /HTTP (429|503|504)/.test(message)
}

export function resolveAnnouncementAiProviderCandidates(environment = process.env) {
  const explicit = environment.ANNOUNCEMENT_AI_PROVIDER_ID
  if (typeof explicit === 'string' && explicit.trim()) return [explicit.trim()]
  const providers = loadServerAiProviders(environment)
  if (providers.length === 0) return []
  const matches = providers.map((provider) => {
    const haystack = `${provider.id} ${provider.name} ${provider.model}`.toLowerCase()
    return { provider, haystack }
  })
  const ordered = []
  const pushUnique = (id) => {
    if (id && !ordered.includes(id)) ordered.push(id)
  }
  const deepseekV4Flash = matches.find(item => item.haystack.includes('deepseek-v4-flash'))
  if (deepseekV4Flash) pushUnique(deepseekV4Flash.provider.id)
  const deepseekFlash = matches.find(item => item.haystack.includes('deepseek') && item.haystack.includes('flash'))
  if (deepseekFlash) pushUnique(deepseekFlash.provider.id)
  const deepseekChat = matches.find(item => item.haystack.includes('deepseek-chat'))
  if (deepseekChat) pushUnique(deepseekChat.provider.id)
  const flash = matches.find(item => item.provider.model.toLowerCase().includes('flash'))
  if (flash) pushUnique(flash.provider.id)
  for (const provider of providers) pushUnique(provider.id)
  return ordered
}

export function resolveAnnouncementAiProviderId(environment = process.env) {
  return resolveAnnouncementAiProviderCandidates(environment)[0]
}

function buildProviderSummary(result) {
  return `${result.providerName}/${result.model}`.slice(0, GENERATION_PROVIDER_MAX_LENGTH)
}

const BULLET_LINE_PATTERN = /^(?:[-*]|\d+\.)\s+/
const INTERNAL_VOCABULARY_PATTERN = new RegExp(
  [
    '管理员',
    '超管',
    '后台',
    '审计',
    '单元测试',
    '回归测试',
    '构建脚本',
    '发版脚本',
    '测试框架',
    '内部实现',
    '数据库迁移',
    'API\\s*路由',
    // 中文“构建/迁移/脚本”单独出现时仍视为内部表述
    '构建',
    '迁移',
    '脚本',
    'source_key',
    'source_commit',
    String.raw`\badmins?\b`,
    String.raw`\badministrators?\b`,
    String.raw`\bsuper\s*admins?\b`,
    String.raw`\bbackends?\b`,
    String.raw`\bback[\s-]?office\b`,
    String.raw`\baudits?\b`,
    String.raw`\bmigrations?\b`,
    String.raw`\bbuild\s+scripts?\b`,
    String.raw`\brelease\s+scripts?\b`,
    String.raw`\btest\s+frameworks?\b`,
    String.raw`\bunit\s+tests?\b`,
    String.raw`\bregression\s+tests?\b`,
    String.raw`\bCI\s*\/\s*CD\b`,
    String.raw`\bGitHub\s+Actions\b`,
    String.raw`\bsource_key\b`,
    String.raw`\bsource_commit\b`,
    String.raw`\binternal\s+implementations?\b`,
  ].join('|'),
  'i',
)
const FEATURE_CLAIM_PATTERN = /(?:新增|上线|推出|开放|支持)([\u4e00-\u9fffA-Za-z0-9_-]{2,24})/g
/** 允许出现在摘要中、即使事实未逐字包含的通用表达 */
const SUMMARY_GENERIC_ALLOWLIST = new Set([
  '本次', '更新', '修复', '优化', '改进', '问题', '体验', '更加', '顺畅', '可靠',
  '进行', '多项', '主要', '包含', '同步', '基础', '能力', '稳定', '提升', '调整',
  '使用', '已经', '发布', '版本', '云栈', '网站', '桌面', '桌面端', '相关', '内容',
  '功能', '用户', '可以', '以及', '和', '与', '了', '的', '在', '为', '并', '等',
  '中', '对', '将', '把', '被', '让', '更', '也', '都', '会', '能', '已', '后',
  '前', '时', '好', '新', '同时', '丰富', '表现', '整体', '正确', '区分', '阶段',
  '错误', '提示', '可能', '残留', '恢复', '改善', '解决', '处理', '导致', '避免',
  'this', 'update', 'fix', 'fixed', 'improve', 'improved', 'better', 'more',
  'and', 'the', 'a', 'an', 'to', 'for', 'with', 'is', 'are', 'was', 'were', 'of',
  'in', 'on', 'at', 'by', 'from', 'into', 'or', 'as', 'it', 'its', 'be', 'been',
])
const SUMMARY_STOP_WORDS = SUMMARY_GENERIC_ALLOWLIST

export function collectFactSnippets(detailedContent) {
  return normalizeWhitespace(detailedContent)
    .split('\n')
    .map(line => line.trim())
    .filter(line => BULLET_LINE_PATTERN.test(line))
    .map(line => stripQuadrantMarkersFromText(line.replace(BULLET_LINE_PATTERN, '')))
    .filter(Boolean)
}

function extractSignificantTokens(text) {
  const source = String(text ?? '')
  const tokens = new Set()
  for (const match of source.matchAll(/[\u4e00-\u9fff]{2,8}|[A-Za-z][A-Za-z0-9_-]{2,24}/g)) {
    const token = match[0]
    if (SUMMARY_GENERIC_ALLOWLIST.has(token) || SUMMARY_GENERIC_ALLOWLIST.has(token.toLowerCase())) {
      continue
    }
    if (/^\d+$/.test(token)) continue
    tokens.add(token)
  }
  return [...tokens]
}

function collectFactOverlapNeedles(facts) {
  const needles = new Set()
  for (const fact of facts) {
    for (const token of extractSignificantTokens(fact)) {
      if (token.length >= 2) needles.add(token)
    }
    const compact = String(fact).replace(/\s+/g, '')
    for (let index = 0; index < compact.length - 1; index += 1) {
      const gram = compact.slice(index, index + 2)
      if (/^[\u4e00-\u9fff]{2}$/.test(gram) && !SUMMARY_GENERIC_ALLOWLIST.has(gram)) {
        needles.add(gram)
      }
    }
  }
  return [...needles]
}

function hasFactOverlap(summary, facts) {
  if (!Array.isArray(facts) || facts.length === 0) return true
  const summaryText = String(summary ?? '')
  const needles = collectFactOverlapNeedles(facts)
  if (needles.length === 0) return false
  return needles.some(needle => summaryText.includes(needle))
}

const CHINESE_PARTICLE_CHARS = new Set([
  '了', '的', '在', '为', '并', '把', '被', '让', '与', '和', '及', '也', '都',
  '很', '再', '还', '又', '就', '才', '只', '吗', '呢', '吧', '啊', '呀', '已',
])

/**
 * 摘要中每个显著名词都必须能在事实中找到依据；命中一词后夹带新名词一律拒绝。
 */
export function findUngroundedSummaryTerms(summary, factsText) {
  const text = String(summary ?? '')
  const facts = String(factsText ?? '')
  const ungrounded = []

  for (const match of text.matchAll(/[A-Za-z][A-Za-z0-9_-]{2,47}/g)) {
    const term = match[0]
    if (SUMMARY_GENERIC_ALLOWLIST.has(term.toLowerCase())) continue
    if (/^v?\d/.test(term)) continue
    if (!new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(facts)
      && !facts.toLowerCase().includes(term.toLowerCase())) {
      ungrounded.push(term)
    }
  }

  for (const match of text.matchAll(/[\u4e00-\u9fff]{2,}/g)) {
    const run = match[0]
    let index = 0
    while (index < run.length) {
      let advanced = false
      for (let length = Math.min(4, run.length - index); length >= 2; length -= 1) {
        const piece = run.slice(index, index + length)
        if (SUMMARY_GENERIC_ALLOWLIST.has(piece)) {
          index += length
          advanced = true
          break
        }
      }
      if (advanced) continue

      if (CHINESE_PARTICLE_CHARS.has(run[index])) {
        index += 1
        continue
      }

      let matchedLength = 0
      for (let length = Math.min(12, run.length - index); length >= 2; length -= 1) {
        const piece = run.slice(index, index + length)
        if (facts.includes(piece)) {
          matchedLength = length
          break
        }
      }
      if (matchedLength > 0) {
        index += matchedLength
        continue
      }

      const bad = run.slice(index, Math.min(index + 2, run.length))
      if (bad.length >= 2 && !SUMMARY_GENERIC_ALLOWLIST.has(bad)) {
        ungrounded.push(bad)
      }
      index += Math.max(1, bad.length)
    }
  }

  return [...new Set(ungrounded)]
}

function isVagueSummaryOnly(summary) {
  const text = normalizeWhitespace(summary)
  if (!text) return true
  if (LEGACY_EMPTY_FILTERED_CONTENTS.includes(text)) return true
  if (text.includes('稳定性改进与问题修复') && !BULLET_LINE_PATTERN.test(text)) return true
  if (text.includes('基础能力与稳定性调整') && !BULLET_LINE_PATTERN.test(text)) return true
  if (/多项体验优化|使用更加顺畅|整体体验提升|多项优化与修复/.test(text)) return true
  if (/^(本版本)?(主要)?(同步|包含)?(基础能力与)?(稳定性|可靠|体验)?(调整|提升|改进)?(与|和)?(问题)?(修复)?[。.!！]*$/u.test(text)) {
    return true
  }
  return collectFactOverlapNeedles([text]).length === 0
}

/**
 * 在清理标记之前校验 AI 原始输出。
 */
export function validateAiOpeningSummary(rawSummary, detailedContent, { rejectedLines = [] } = {}) {
  const text = typeof rawSummary === 'string' ? normalizeWhitespace(rawSummary) : ''
  if (!text) return { ok: false, reason: 'empty' }

  // 必须先检查原始标记，禁止先 strip 再校验
  if (/\[audience:/i.test(text)) return { ok: false, reason: 'audience_marker' }
  if (/\((?:[ABCD]|Web)(?:\s*\/\s*(?:[ABCD]|Web))*\)/i.test(text)) {
    return { ok: false, reason: 'channel_marker' }
  }
  if (/^#{1,6}\s/m.test(text) || /^(?:[-*]|\d+\.)\s+/m.test(text)) {
    return { ok: false, reason: 'markdown_structure' }
  }
  if (INTERNAL_VOCABULARY_PATTERN.test(text)) {
    return { ok: false, reason: 'internal_vocabulary' }
  }
  if (isEmptyFilteredReleaseContent(text)) return { ok: false, reason: 'forbidden_fallback' }

  const facts = collectFactSnippets(detailedContent)
  const factsText = facts.join('\n')
  if (facts.length > 0 && isVagueSummaryOnly(text)) {
    return { ok: false, reason: 'vague_summary' }
  }

  for (const raw of rejectedLines) {
    const hint = stripQuadrantMarkersFromText(String(raw).replace(BULLET_LINE_PATTERN, ''))
    if (hint.length < 8) continue
    const needles = [
      hint.slice(0, Math.min(28, hint.length)),
      ...hint.split(/[：:，,。；;]/).map(part => part.trim()).filter(part => part.length >= 8),
    ]
    if (needles.some(needle => needle && text.includes(needle))) {
      return { ok: false, reason: 'reintroduced_admin' }
    }
  }

  // 功能性断言必须能在用户事实中找到依据
  FEATURE_CLAIM_PATTERN.lastIndex = 0
  for (const match of text.matchAll(FEATURE_CLAIM_PATTERN)) {
    const claim = String(match[1] ?? '').trim()
    if (claim.length < 2) continue
    if (!factsText.includes(claim)) {
      return { ok: false, reason: 'ungrounded_feature_claim' }
    }
  }

  // 至少与事实有重合，且摘要中每个显著名词都有事实依据
  if (facts.length > 0) {
    if (!hasFactOverlap(text, facts)) {
      return { ok: false, reason: 'no_fact_overlap' }
    }
    const ungrounded = findUngroundedSummaryTerms(text, factsText)
    if (ungrounded.length > 0) {
      return { ok: false, reason: 'ungrounded_term', ungroundedTerms: ungrounded }
    }
  }

  return { ok: true, summary: text }
}

/**
 * 结构：版本发布行 + 可选 AI 摘要 + 「本次更新：」 + 确定性事实列表。
 * 确保「已发布。」与「本次更新：」各只出现一次。
 */
export function composeAnnouncementWithSummary(summary, fallback) {
  const opening = typeof summary === 'string' ? normalizeWhitespace(summary) : ''

  if (fallback && typeof fallback === 'object' && typeof fallback.headline === 'string') {
    const headline = normalizeWhitespace(fallback.headline)
    const factBlock = normalizeWhitespace(fallback.factBlock || '')
    if (!factBlock) {
      return opening ? `${headline}\n\n${opening}` : headline
    }
    if (opening) {
      return `${headline}\n\n${opening}\n\n本次更新：\n${factBlock}`
    }
    return `${headline}\n\n本次更新：\n${factBlock}`
  }

  // 兼容旧调用：第二参为完整详细正文字符串
  const detailed = normalizeWhitespace(fallback)
  if (!opening) return detailed
  if (!detailed) return opening

  const headlineMatch = detailed.match(/^云栈(?:网站|桌面端) v\d+\.\d+\.\d+ 已发布。/)
  const headline = headlineMatch ? headlineMatch[0] : ''
  let rest = headline ? detailed.slice(headline.length).trim() : detailed
  rest = rest.replace(/^本次更新：\s*/, '')
  if (headline) {
    return opening
      ? `${headline}\n\n${opening}\n\n本次更新：\n${rest}`
      : `${headline}\n\n本次更新：\n${rest}`
  }
  return `${opening}\n\n${detailed}`
}

function buildAiSummaryInput({ category, version, fallbackContent }) {
  const label = categoryLabel(category)
  const versionLine = version ? `版本：v${version}` : ''
  const facts = collectFactSnippets(fallbackContent).map(item => `- ${item}`).join('\n')
  return [
    `产品：云栈${label}`,
    versionLine,
    '请仅输出 1-2 句中文开场摘要，概括下列已确认的用户侧更新。',
    '不要输出列表、标题、Markdown、象限标记或 audience 标记。',
    '不要提及管理员后台、审计、构建脚本、测试框架或内部实现。',
    '不要编造下列未列出的功能。',
    '',
    '已确认的用户侧更新：',
    facts || fallbackContent,
  ].filter(Boolean).join('\n')
}

function buildAiRepolishInput({ category, version, fallbackContent }) {
  const label = categoryLabel(category)
  const versionLine = version ? `版本：v${version}\n` : ''
  return [
    `公告类型：${label}更新`,
    versionLine,
    '可用变更事实（只能基于以下内容润色，禁止编造功能）：',
    fallbackContent,
    '',
    '请只输出公告正文，不要保留开发象限标记或 audience 标记。',
  ].filter(Boolean).join('\n')
}

function collectRejectedAdminLines(changelogEntry, category) {
  const rejected = []
  for (const line of listChangelogBulletLines(changelogEntry)) {
    const audienceAnalysis = analyzeAudienceMarkersOnLine(line)
    if (audienceAnalysis.hasConflict || audienceAnalysis.unknownAudience) {
      rejected.push(line)
      continue
    }
    if (audienceAnalysis.audience && !USER_AUDIENCES.has(audienceAnalysis.audience)) {
      rejected.push(line)
      continue
    }
    const markerMatch = line.match(QUADRANT_MARKER_PATTERN)
    const markers = markerMatch ? parseQuadrantMarkers(markerMatch[1]) : []
    if (!shouldIncludeChangelogItem(markers, category)) {
      rejected.push(line)
    }
  }
  return rejected
}

/**
 * mode=changelog（默认，方案 A）：AI 只生成开场摘要，详细条目来自 fallback。
 * mode=repolish：允许 AI 重写全文，但仍拒绝空泛/内部标记结果。
 */
export async function polishReleaseAnnouncement({
  fallback,
  category,
  version,
  environment = process.env,
  fetchImplementation,
  providerId,
  maxAttempts = ANNOUNCEMENT_AI_MAX_ATTEMPTS,
  retryDelayMs = ANNOUNCEMENT_AI_RETRY_DELAY_MS,
  mode = 'changelog',
  rejectedLines = [],
}) {
  if (isEmptyFilteredReleaseContent(fallback.content)) {
    return {
      content: fallback.content,
      generatedByAi: false,
      generationProvider: null,
      generationError: EMPTY_FILTERED_RELEASE_NOTICE,
    }
  }

  const providerQueue = providerId ? [providerId] : resolveAnnouncementAiProviderCandidates(environment)
  const candidates = providerQueue.length > 0 ? providerQueue : [undefined]
  let lastError = null

  for (const candidateId of candidates) {
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        const aiInput = mode === 'repolish'
          ? buildAiRepolishInput({ category, version, fallbackContent: fallback.content })
          : buildAiSummaryInput({ category, version, fallbackContent: fallback.content })
        const result = await requestAnnouncementPolish({
          content: aiInput,
          environment,
          fetchImplementation,
          providerId: candidateId,
        })
        const rawAiContent = typeof result.content === 'string' ? result.content : ''

        if (mode === 'repolish') {
          const rawValidation = validateAiOpeningSummary(rawAiContent, fallback.content, { rejectedLines })
          // repolish 允许较长正文，但仍拒绝原始标记与内部词；空泛检测对全文过严时仅检查标记/内部词
          if (/\[audience:/i.test(rawAiContent)
            || /\((?:[ABCD]|Web)(?:\s*\/\s*(?:[ABCD]|Web))*\)/i.test(rawAiContent)
            || INTERNAL_VOCABULARY_PATTERN.test(rawAiContent)) {
            throw createHttpError('AI 返回内容包含内部标记或内部表述。', 502)
          }
          const polishedText = stripQuadrantMarkersFromText(rawAiContent)
          if (!polishedText || isEmptyFilteredReleaseContent(polishedText)) {
            throw createHttpError('AI 返回内容无效。', 502)
          }
          // 若校验因 markdown 列表失败但 repolish 本就可含结构，仅在标记类失败时拒绝；上面已拦截标记
          void rawValidation
          return {
            content: assertAnnouncementContent(polishedText),
            generatedByAi: true,
            generationProvider: buildProviderSummary(result),
            generationError: null,
          }
        }

        // changelog 模式：先校验原始输出，通过后再清理并组合
        const validation = validateAiOpeningSummary(rawAiContent, fallback.content, { rejectedLines })
        if (!validation.ok) {
          return {
            content: fallback.content,
            generatedByAi: false,
            generationProvider: null,
            generationError: `AI 摘要无效（${validation.reason}），已保留详细更新条目。`,
          }
        }
        const cleanedSummary = stripQuadrantMarkersFromText(validation.summary)
        return {
          content: assertAnnouncementContent(
            composeAnnouncementWithSummary(cleanedSummary, fallback),
          ),
          generatedByAi: true,
          generationProvider: buildProviderSummary(result),
          generationError: null,
        }
      } catch (error) {
        lastError = error
        const canRetry = isTransientAiError(error) && attempt < maxAttempts - 1
        if (!canRetry) break
        if (retryDelayMs > 0) await sleep(retryDelayMs * (attempt + 1))
      }
    }
  }

  return {
    content: fallback.content,
    generatedByAi: false,
    generationProvider: null,
    generationError: sanitizeGenerationError(lastError) || 'AI 润色失败，已使用降级文本。',
  }
}

const ADMIN_RETURNING_COLUMNS = `
  id, title, content, published_at, active, created_at, updated_at,
  category, version, source_key, source_commit,
  generated_by_ai, generation_provider, generation_error
`

async function polishFromChangelogEntry({
  category,
  version,
  changelogEntry,
  environment,
  fetchImplementation,
  providerId,
  maxAttempts,
  retryDelayMs,
}) {
  const fallback = buildReleaseAnnouncementFallback({
    category,
    version,
    changelogEntry,
  })
  const polished = await polishReleaseAnnouncement({
    fallback,
    category,
    version,
    environment,
    fetchImplementation,
    providerId,
    maxAttempts,
    retryDelayMs,
    mode: 'changelog',
    rejectedLines: collectRejectedAdminLines(changelogEntry, category),
  })
  return { fallback, polished }
}

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
    maxAttempts,
    retryDelayMs,
    repairExistingGeneric = true,
    auditContext = null,
  },
) {
  const sourceKey = buildReleaseAnnouncementSourceKey(category, version)
  const normalizedVersion = version.trim()
  const commit = readAnnouncementCommitInput(sourceCommit)
  if (!commit.ok) throw createHttpError('source_commit 无效。', 400)
  const normalizedAudit = normalizeAnnouncementAuditContext(auditContext)

  const existing = await client.query(
    `SELECT ${ADMIN_RETURNING_COLUMNS}
       FROM announcements
      WHERE source_key = $1`,
    [sourceKey],
  )

  if (existing.rows.length > 0) {
    const current = mapAdminAnnouncementRow(existing.rows[0])
    if (current.active) {
      return { announcement: current, created: false, repaired: false }
    }

    // 超管“补建”等显式关闭修复时：已存在 inactive 草稿一律原样返回，不 AI、不 UPDATE
    if (!repairExistingGeneric) {
      return { announcement: current, created: false, repaired: false }
    }

    const canAutoRepair = isGenericReleaseAnnouncementContent(
      current.content,
      category,
      normalizedVersion,
    )
    if (!canAutoRepair) {
      return { announcement: current, created: false, repaired: false }
    }

    const preview = buildReleaseAnnouncementFallback({
      category,
      version: normalizedVersion,
      changelogEntry,
    })
    // 无用户侧详细内容时绝不覆盖旧通用草稿
    if (!preview.hasUserFacingContent || isEmptyFilteredReleaseContent(preview.content)) {
      return { announcement: current, created: false, repaired: false, skipped: true }
    }

    const { fallback, polished } = await polishFromChangelogEntry({
      category,
      version: normalizedVersion,
      changelogEntry,
      environment,
      fetchImplementation,
      providerId,
      maxAttempts,
      retryDelayMs,
    })

    if (isEmptyFilteredReleaseContent(polished.content) || collectFactSnippets(polished.content).length === 0) {
      return { announcement: current, created: false, repaired: false, skipped: true }
    }

    const updated = await client.query(
      `UPDATE announcements
          SET title = $2,
              content = $3,
              source_commit = COALESCE($4, source_commit),
              generated_by_ai = $5,
              generation_provider = $6,
              generation_error = $7,
              updated_at = NOW()
        WHERE source_key = $1
          AND active = false
          AND content = $8
        RETURNING ${ADMIN_RETURNING_COLUMNS}`,
      [
        sourceKey,
        fallback.title,
        polished.content,
        commit.value,
        polished.generatedByAi,
        polished.generationProvider,
        polished.generationError,
        current.content,
      ],
    )

    if (updated.rows.length > 0) {
      return {
        announcement: mapAdminAnnouncementRow(updated.rows[0]),
        created: false,
        repaired: true,
      }
    }

    const recheck = await client.query(
      `SELECT ${ADMIN_RETURNING_COLUMNS}
         FROM announcements
        WHERE source_key = $1`,
      [sourceKey],
    )
    if (recheck.rows.length === 0) {
      throw createHttpError('公告草稿生成失败。', 500)
    }
    return {
      announcement: mapAdminAnnouncementRow(recheck.rows[0]),
      created: false,
      repaired: false,
    }
  }

  const preview = buildReleaseAnnouncementFallback({
    category,
    version: normalizedVersion,
    changelogEntry,
  })
  if (!preview.hasUserFacingContent || isEmptyFilteredReleaseContent(preview.content)) {
    return {
      announcement: {
        id: null,
        title: preview.title,
        content: EMPTY_FILTERED_RELEASE_NOTICE,
        publishedAt: Date.now(),
        active: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        category,
        version: normalizedVersion,
        sourceKey,
        sourceCommit: commit.value ?? null,
        generatedByAi: false,
        generationProvider: null,
        generationError: EMPTY_FILTERED_RELEASE_NOTICE,
      },
      created: false,
      repaired: false,
      skipped: true,
    }
  }

  // AI 在事务外完成；仅最终写入使用短 SQL / CTE，避免长事务占用连接
  const { fallback, polished } = await polishFromChangelogEntry({
    category,
    version: normalizedVersion,
    changelogEntry,
    environment,
    fetchImplementation,
    providerId,
    maxAttempts,
    retryDelayMs,
  })

  const insertParams = [
    fallback.title,
    polished.content,
    category,
    normalizedVersion,
    sourceKey,
    commit.value,
    polished.generatedByAi,
    polished.generationProvider,
    polished.generationError,
  ]

  let inserted
  if (normalizedAudit) {
    inserted = await client.query(
      `WITH inserted AS (
         INSERT INTO announcements (
           title, content, published_at, active, created_by,
           category, version, source_key, source_commit,
           generated_by_ai, generation_provider, generation_error
         ) VALUES (
           $1, $2, NOW(), false, NULL,
           $3, $4, $5, $6,
           $7, $8, $9
         )
         ON CONFLICT (source_key) DO NOTHING
         RETURNING ${ADMIN_RETURNING_COLUMNS}
       ),
       _audit AS (
         INSERT INTO audit_logs (actor_user_id, action, target_user_id, metadata)
         SELECT
           $10::uuid,
           $11,
           $12::uuid,
           jsonb_build_object(
             'category', inserted.category,
             'version', inserted.version,
             'sourceKey', inserted.source_key,
             'sourceCommit', inserted.source_commit
           )
         FROM inserted
         RETURNING id
       )
       SELECT * FROM inserted`,
      [
        ...insertParams,
        normalizedAudit.actorUserId,
        normalizedAudit.action,
        normalizedAudit.targetUserId,
      ],
    )
  } else {
    inserted = await client.query(
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
      insertParams,
    )
  }

  if (inserted.rows.length > 0) {
    return { announcement: mapAdminAnnouncementRow(inserted.rows[0]), created: true, repaired: false }
  }

  const conflictExisting = await client.query(
    `SELECT ${ADMIN_RETURNING_COLUMNS}
       FROM announcements
      WHERE source_key = $1`,
    [sourceKey],
  )
  if (conflictExisting.rows.length === 0) {
    throw createHttpError('公告草稿生成失败。', 500)
  }
  return {
    announcement: mapAdminAnnouncementRow(conflictExisting.rows[0]),
    created: false,
    repaired: false,
  }
}

function normalizeAnnouncementAuditContext(auditContext) {
  if (auditContext == null) return null
  if (typeof auditContext !== 'object' || Array.isArray(auditContext)) {
    throw createHttpError('审计上下文无效。', 400)
  }
  const action = typeof auditContext.action === 'string' ? auditContext.action.trim() : ''
  const actorUserId = typeof auditContext.actorUserId === 'string' ? auditContext.actorUserId.trim() : ''
  const targetUserId = typeof auditContext.targetUserId === 'string' ? auditContext.targetUserId.trim() : ''
  if (!action || action.length > 64) {
    throw createHttpError('审计动作无效。', 400)
  }
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  if (!uuidPattern.test(actorUserId) || !uuidPattern.test(targetUserId)) {
    throw createHttpError('审计用户 ID 无效。', 400)
  }
  // 元数据仅由 inserted 行派生，忽略调用方传入的正文/密钥类字段
  return {
    action,
    actorUserId: actorUserId.toLowerCase(),
    targetUserId: targetUserId.toLowerCase(),
  }
}

export async function repolishAnnouncementDraft(
  client,
  announcementId,
  {
    environment = process.env,
    fetchImplementation,
    providerId,
    maxAttempts,
    retryDelayMs,
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
    maxAttempts,
    retryDelayMs,
    mode: 'repolish',
  })

  // AI 失败时保留原正文，但仍记录 generation_error
  const contentToSave = polished.generatedByAi ? polished.content : currentAnnouncement.content

  const updated = await client.query(
    `UPDATE announcements
        SET content = $2,
            generated_by_ai = $3,
            generation_provider = $4,
            generation_error = $5,
            updated_at = NOW()
      WHERE id = $1 AND active = false
      RETURNING ${ADMIN_RETURNING_COLUMNS}`,
    [
      announcementId,
      contentToSave,
      polished.generatedByAi,
      polished.generationProvider,
      polished.generationError,
    ],
  )

  if (updated.rows.length === 0) {
    const recheck = await client.query(
      `SELECT active FROM announcements WHERE id = $1`,
      [announcementId],
    )
    if (recheck.rows.length === 0) {
      throw createHttpError('公告不存在。', 404)
    }
    if (recheck.rows[0].active === true) {
      throw createHttpError('公告已生效，不能重新润色。', 409)
    }
    throw createHttpError('公告更新失败。', 500)
  }

  return mapAdminAnnouncementRow(updated.rows[0])
}

export async function regenerateAnnouncementFromChangelog(
  client,
  announcementId,
  {
    changelogMarkdown,
    environment = process.env,
    fetchImplementation,
    providerId,
    maxAttempts,
    retryDelayMs,
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
    throw createHttpError('已发布公告不能从更新日志重新生成。', 409)
  }
  if (!RELEASE_ANNOUNCEMENT_CATEGORIES.has(currentAnnouncement.category)) {
    throw createHttpError('仅更新类公告草稿支持从更新日志重新生成。', 400)
  }
  if (!currentAnnouncement.version || !ANNOUNCEMENT_VERSION_PATTERN.test(currentAnnouncement.version)) {
    throw createHttpError('公告缺少有效版本号，无法从更新日志重新生成。', 400)
  }

  // 先校验 CHANGELOG，失败时绝不调用 AI / UPDATE
  const { entry, fallback } = assertRegeneratableChangelog({
    changelogMarkdown,
    category: currentAnnouncement.category,
    version: currentAnnouncement.version,
  })

  const polished = await polishReleaseAnnouncement({
    fallback,
    category: currentAnnouncement.category,
    version: currentAnnouncement.version,
    environment,
    fetchImplementation,
    providerId,
    maxAttempts,
    retryDelayMs,
    mode: 'changelog',
    rejectedLines: collectRejectedAdminLines(entry, currentAnnouncement.category),
  })

  if (isEmptyFilteredReleaseContent(polished.content) || collectFactSnippets(polished.content).length === 0) {
    throw createHttpError('过滤后没有可写入的用户侧更新内容，已拒绝覆盖原草稿。', 422)
  }

  const updated = await client.query(
    `UPDATE announcements
        SET title = $2,
            content = $3,
            generated_by_ai = $4,
            generation_provider = $5,
            generation_error = $6,
            updated_at = NOW()
      WHERE id = $1 AND active = false
      RETURNING ${ADMIN_RETURNING_COLUMNS}`,
    [
      announcementId,
      fallback.title,
      polished.content,
      polished.generatedByAi,
      polished.generationProvider,
      polished.generationError,
    ],
  )

  if (updated.rows.length === 0) {
    const recheck = await client.query(
      `SELECT active FROM announcements WHERE id = $1`,
      [announcementId],
    )
    if (recheck.rows.length === 0) {
      throw createHttpError('公告不存在。', 404)
    }
    if (recheck.rows[0].active === true) {
      throw createHttpError('已发布公告不能从更新日志重新生成。', 409)
    }
    throw createHttpError('公告更新失败。', 500)
  }

  return mapAdminAnnouncementRow(updated.rows[0])
}

export function resolveChangelogPathCandidates(cwd = process.cwd(), moduleDir = MODULE_DIR) {
  return [
    path.resolve(cwd, 'CHANGELOG.md'),
    path.resolve(moduleDir, '..', 'CHANGELOG.md'),
    path.resolve(moduleDir, 'CHANGELOG.md'),
    path.resolve(cwd, '..', 'CHANGELOG.md'),
    path.resolve(cwd, '..', '..', 'CHANGELOG.md'),
  ]
}

export function resolveChangelogFilePath({
  cwd = process.cwd(),
  moduleDir = MODULE_DIR,
  rootDir,
  existsSync = fs.existsSync,
} = {}) {
  if (typeof rootDir === 'string' && rootDir.trim()) {
    const explicit = path.join(rootDir, 'CHANGELOG.md')
    if (existsSync(explicit)) return explicit
    throw createHttpError(`无法定位 CHANGELOG.md：${explicit}`, 500)
  }
  const candidates = resolveChangelogPathCandidates(cwd, moduleDir)
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  throw createHttpError(
    `无法定位 CHANGELOG.md。已尝试：${candidates.join('；')}`,
    500,
  )
}

/**
 * 读取 CHANGELOG.md。找不到或读失败时抛出明确错误，绝不静默返回空串。
 */
export function readChangelogFile(rootDir, options = {}) {
  const {
    cwd = process.cwd(),
    moduleDir = MODULE_DIR,
    existsSync = fs.existsSync,
    readFileSync = fs.readFileSync,
  } = options

  // 兼容旧调用：readChangelogFile(root) / readChangelogFile()
  const resolvedRoot = typeof rootDir === 'string' ? rootDir : undefined
  try {
    const changelogPath = resolveChangelogFilePath({
      cwd,
      moduleDir,
      rootDir: resolvedRoot,
      existsSync,
    })
    const content = readFileSync(changelogPath, 'utf8')
    if (typeof content !== 'string') {
      throw createHttpError('CHANGELOG.md 内容无效。', 500)
    }
    return content
  } catch (error) {
    if (Number.isInteger(error?.statusCode)) throw error
    throw createHttpError(
      `读取 CHANGELOG.md 失败：${error instanceof Error ? error.message : String(error)}`,
      500,
    )
  }
}
