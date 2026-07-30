/**
 * 成对补建网站端 + 桌面端更新公告草稿。
 */
import {
  EMPTY_FILTERED_RELEASE_NOTICE,
  extractChangelogEntryFromMarkdown,
  generateReleaseAnnouncementDraft,
  readChangelogFile,
} from './announcement-generation.mjs'
import { ANNOUNCEMENT_COMMIT_PATTERN, ANNOUNCEMENT_VERSION_PATTERN } from './announcements.mjs'
import { resolveReleaseVersionFromGitHubCommit } from './resolve-release-version-from-commit.mjs'

const PAIR_CHANNELS = [
  { key: 'web', category: 'web_release', label: '网站端' },
  { key: 'desktop', category: 'desktop_release', label: '桌面端' },
]

function createHttpError(message, statusCode, code) {
  const error = new Error(message)
  error.statusCode = statusCode
  if (typeof code === 'string') error.code = code
  return error
}

function normalizeOptionalCommit(value) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'string') return null
  const trimmed = value.trim().toLowerCase()
  if (!ANNOUNCEMENT_COMMIT_PATTERN.test(trimmed)) return null
  return trimmed
}

/**
 * @param {{
 *   version?: string | null,
 *   sourceCommit?: string | null,
 *   changelogMarkdown?: string | null,
 *   fetchImplementation?: typeof fetch,
 * }} input
 */
export async function resolvePairGenerateChangelogContext(input = {}) {
  const hasVersion = typeof input.version === 'string' && input.version.trim() !== ''
  const hasCommit = input.sourceCommit !== null
    && input.sourceCommit !== undefined
    && String(input.sourceCommit).trim() !== ''

  if (!hasVersion && !hasCommit) {
    throw createHttpError('版本号与 Source Commit 至少填写一个。', 400, 'version_or_commit_required')
  }

  let version = null
  if (hasVersion) {
    version = input.version.trim()
    if (!ANNOUNCEMENT_VERSION_PATTERN.test(version)) {
      throw createHttpError('版本号无效，需为 x.y.z。', 400, 'invalid_version')
    }
  }

  let sourceCommit = null
  if (hasCommit) {
    sourceCommit = normalizeOptionalCommit(input.sourceCommit)
    if (!sourceCommit) {
      throw createHttpError('sourceCommit 无效，需为 7-40 位十六进制 Git SHA。', 400, 'source_commit_invalid')
    }
  }

  if (sourceCommit) {
    const resolved = await resolveReleaseVersionFromGitHubCommit(sourceCommit, {
      expectedVersion: version,
      fetchImplementation: input.fetchImplementation,
    })
    return {
      version: resolved.version,
      sourceCommit: resolved.sourceCommit,
      changelogMarkdown: resolved.changelogMarkdown,
      changelogEntry: resolved.changelogEntry,
    }
  }

  const changelogMarkdown = typeof input.changelogMarkdown === 'string' && input.changelogMarkdown.trim()
    ? input.changelogMarkdown
    : readChangelogFile()
  const changelogEntry = extractChangelogEntryFromMarkdown(changelogMarkdown, version)
  if (!changelogEntry) {
    throw createHttpError(`CHANGELOG 中未找到版本 ${version}。`, 422, 'changelog_version_missing')
  }
  return {
    version,
    sourceCommit: null,
    changelogMarkdown,
    changelogEntry,
  }
}

function mapChannelResult(result, channelLabel) {
  if (result?.skipped) {
    const skippedMessage = (
      typeof result.announcement?.generationError === 'string' && result.announcement.generationError.trim()
        ? result.announcement.generationError.trim()
        : EMPTY_FILTERED_RELEASE_NOTICE
    ) || `${channelLabel}无用户侧更新内容，已跳过。`
    return {
      status: 'skipped',
      announcement: null,
      message: skippedMessage,
    }
  }
  if (result?.created) {
    if (!result.announcement) {
      return {
        status: 'failed',
        announcement: null,
        message: `${channelLabel}生成失败：缺少公告对象。`,
      }
    }
    const degraded = typeof result.announcement.generationError === 'string' && result.announcement.generationError.trim()
      ? `（AI 已降级：${result.announcement.generationError.trim()}）`
      : ''
    return {
      status: 'created',
      announcement: result.announcement,
      message: `${channelLabel}草稿已创建（仍为未发布）。${degraded}`.trim(),
    }
  }
  if (result?.announcement?.active === true) {
    return {
      status: 'already_exists',
      announcement: result.announcement,
      message: `${channelLabel}公告已发布，未覆盖。`,
    }
  }
  if (result?.announcement) {
    return {
      status: 'already_exists',
      announcement: result.announcement,
      message: `${channelLabel}草稿已存在，未重复创建，也未修改正文。`,
    }
  }
  return {
    status: 'failed',
    announcement: null,
    message: `${channelLabel}生成失败。`,
  }
}

function mapChannelFailure(error, channelLabel) {
  const message = error instanceof Error ? error.message : String(error)
  return {
    status: 'failed',
    announcement: null,
    message: `${channelLabel}生成失败：${message}`,
  }
}

/**
 * @param {import('pg').Pool | { query: Function }} client
 * @param {{
 *   version?: string | null,
 *   sourceCommit?: string | null,
 *   actorUserId: string,
 *   environment?: NodeJS.ProcessEnv,
 *   fetchImplementation?: typeof fetch,
 *   changelogMarkdown?: string | null,
 * }} options
 */
export async function generateReleaseAnnouncementPair(client, {
  version = null,
  sourceCommit = null,
  actorUserId,
  environment = process.env,
  fetchImplementation,
  changelogMarkdown = null,
  generateDraft = generateReleaseAnnouncementDraft,
}) {
  if (typeof actorUserId !== 'string' || !actorUserId.trim()) {
    throw createHttpError('审计上下文无效。', 400, 'audit_invalid')
  }

  const context = await resolvePairGenerateChangelogContext({
    version,
    sourceCommit,
    changelogMarkdown,
    fetchImplementation,
  })

  const results = {
    web: null,
    desktop: null,
  }

  for (const channel of PAIR_CHANNELS) {
    try {
      const draftResult = await generateDraft(client, {
        category: channel.category,
        version: context.version,
        sourceCommit: context.sourceCommit,
        changelogEntry: context.changelogEntry,
        environment,
        fetchImplementation,
        repairExistingGeneric: false,
        auditContext: {
          action: 'announcement.generate_pair_from_changelog',
          actorUserId: actorUserId.trim(),
          targetUserId: actorUserId.trim(),
        },
      })
      results[channel.key] = mapChannelResult(draftResult, channel.label)
    } catch (error) {
      results[channel.key] = mapChannelFailure(error, channel.label)
    }
  }

  return {
    version: context.version,
    sourceCommit: context.sourceCommit,
    results,
  }
}
