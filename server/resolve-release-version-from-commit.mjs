/**
 * 从 GitHub 官方仓库指定 commit 安全解析发版版本与 CHANGELOG。
 */
import { ANNOUNCEMENT_COMMIT_PATTERN, ANNOUNCEMENT_VERSION_PATTERN } from './announcements.mjs'
import { extractChangelogEntryFromMarkdown } from './announcement-generation.mjs'
import { limitedHttpsFetch } from './limited-fetch.mjs'

export const GITHUB_COMMIT_RESOLVE_TIMEOUT_MS = 10_000
export const GITHUB_PACKAGE_JSON_MAX_BYTES = 64 * 1024
export const GITHUB_CHANGELOG_MAX_BYTES = 512 * 1024
export const GITHUB_COMMIT_ALLOWED_HOSTS = new Set(['raw.githubusercontent.com'])
export const GITHUB_COMMIT_REPO_SLUG = 'CruiseTom001/yunzhan'

function createHttpError(message, statusCode, code) {
  const error = new Error(message)
  error.statusCode = statusCode
  if (typeof code === 'string') error.code = code
  return error
}

function normalizeCommitSha(value) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().toLowerCase()
  if (!ANNOUNCEMENT_COMMIT_PATTERN.test(trimmed)) return null
  return trimmed
}

function parsePackageJsonVersion(text) {
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    throw createHttpError('无法解析 commit 对应的 package.json。', 502, 'package_json_invalid')
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw createHttpError('commit 对应的 package.json 无效。', 502, 'package_json_invalid')
  }
  const version = typeof parsed.version === 'string' ? parsed.version.trim() : ''
  if (!ANNOUNCEMENT_VERSION_PATTERN.test(version)) {
    throw createHttpError('commit 对应的 package.json 版本无效。', 400, 'package_json_version_invalid')
  }
  return version
}

/**
 * @param {string} sourceCommit
 * @param {{
 *   expectedVersion?: string | null,
 *   fetchImplementation?: typeof fetch,
 *   timeoutMs?: number,
 * }} [options]
 */
export async function resolveReleaseVersionFromGitHubCommit(sourceCommit, {
  expectedVersion = null,
  fetchImplementation = fetch,
  timeoutMs = GITHUB_COMMIT_RESOLVE_TIMEOUT_MS,
} = {}) {
  const commit = normalizeCommitSha(sourceCommit)
  if (!commit) {
    throw createHttpError('sourceCommit 无效，需为 7-40 位十六进制 Git SHA。', 400, 'source_commit_invalid')
  }
  if (expectedVersion != null && expectedVersion !== '') {
    if (typeof expectedVersion !== 'string' || !ANNOUNCEMENT_VERSION_PATTERN.test(expectedVersion.trim())) {
      throw createHttpError('版本号无效，需为 x.y.z。', 400, 'invalid_version')
    }
  }

  const packageUrl = `https://raw.githubusercontent.com/${GITHUB_COMMIT_REPO_SLUG}/${commit}/package.json`
  const changelogUrl = `https://raw.githubusercontent.com/${GITHUB_COMMIT_REPO_SLUG}/${commit}/CHANGELOG.md`

  let packageBuffer
  let changelogBuffer
  try {
    ;[packageBuffer, changelogBuffer] = await Promise.all([
      limitedHttpsFetch(packageUrl, {
        fetchImplementation,
        maxBytes: GITHUB_PACKAGE_JSON_MAX_BYTES,
        timeoutMs,
        maxRedirects: 2,
        allowedHosts: GITHUB_COMMIT_ALLOWED_HOSTS,
        redirectMode: 'manual',
        headers: { Accept: 'application/json, text/plain;q=0.9, */*;q=0.8', 'User-Agent': 'yunzhan-announcement-pair' },
        errorPrefix: '读取 package.json',
      }),
      limitedHttpsFetch(changelogUrl, {
        fetchImplementation,
        maxBytes: GITHUB_CHANGELOG_MAX_BYTES,
        timeoutMs,
        maxRedirects: 2,
        allowedHosts: GITHUB_COMMIT_ALLOWED_HOSTS,
        redirectMode: 'manual',
        headers: { Accept: 'text/plain, text/markdown;q=0.9, */*;q=0.8', 'User-Agent': 'yunzhan-announcement-pair' },
        errorPrefix: '读取 CHANGELOG.md',
      }),
    ])
  } catch (error) {
    if (error && typeof error === 'object' && Number.isInteger(error.statusCode)) {
      throw error
    }
    const message = error instanceof Error ? error.message : String(error)
    throw createHttpError(`从 GitHub 解析版本失败：${message}`, 502, 'github_resolve_failed')
  }

  const version = parsePackageJsonVersion(packageBuffer.toString('utf8'))
  if (expectedVersion && expectedVersion.trim() !== version) {
    throw createHttpError(
      `输入版本 ${expectedVersion.trim()} 与 commit 对应 package.json 版本 ${version} 不一致。`,
      400,
      'version_commit_mismatch',
    )
  }

  const changelogMarkdown = changelogBuffer.toString('utf8')
  const changelogEntry = extractChangelogEntryFromMarkdown(changelogMarkdown, version)
  if (!changelogEntry) {
    throw createHttpError(`CHANGELOG 中未找到版本 ${version}。`, 422, 'changelog_version_missing')
  }

  return {
    version,
    sourceCommit: commit,
    changelogMarkdown,
    changelogEntry,
  }
}
