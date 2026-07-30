/**
 * 桌面发版清单（desktop-release.json / yunzhan-desktop-release.json）校验。
 * 仅允许 schemaVersion / version / minSupported，禁止猜测 minSupported。
 */
import fs from 'node:fs'

export const DESKTOP_RELEASE_MANIFEST_SCHEMA_VERSION = 1
export const DESKTOP_RELEASE_MANIFEST_FILE_NAME = 'yunzhan-desktop-release.json'
export const DESKTOP_RELEASE_SOURCE_FILE_NAME = 'desktop-release.json'
export const DESKTOP_RELEASE_MANIFEST_MAX_BYTES = 8 * 1024
export const DESKTOP_RELEASE_REPO_FULL_NAME = 'CruiseTom001/yunzhan'
export const DESKTOP_RELEASE_SEMVER_PATTERN = /^\d+\.\d+\.\d+$/

const ALLOWED_KEYS = new Set(['schemaVersion', 'version', 'minSupported'])

export function createDesktopReleaseHttpError(message, statusCode, code = 'desktop_release_error') {
  const error = new Error(message)
  error.statusCode = statusCode
  error.code = code
  return error
}

export function compareSemver(a, b) {
  if (!DESKTOP_RELEASE_SEMVER_PATTERN.test(a) || !DESKTOP_RELEASE_SEMVER_PATTERN.test(b)) {
    return 0
  }
  const [aMajor, aMinor, aPatch] = a.split('.').map(Number)
  const [bMajor, bMinor, bPatch] = b.split('.').map(Number)
  if (aMajor !== bMajor) return aMajor < bMajor ? -1 : 1
  if (aMinor !== bMinor) return aMinor < bMinor ? -1 : 1
  if (aPatch !== bPatch) return aPatch < bPatch ? -1 : 1
  return 0
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * @param {unknown} value
 * @param {{ expectedVersion?: string | null }} [options]
 */
export function parseDesktopReleaseManifest(value, options = {}) {
  if (!isPlainObject(value)) {
    throw createDesktopReleaseHttpError('桌面发版清单必须是 JSON 对象。', 400, 'manifest_invalid')
  }

  const keys = Object.keys(value)
  if (keys.some(key => !ALLOWED_KEYS.has(key)) || keys.length !== ALLOWED_KEYS.size) {
    throw createDesktopReleaseHttpError(
      '桌面发版清单仅允许 schemaVersion、version、minSupported。',
      400,
      'manifest_extra_fields',
    )
  }

  if (value.schemaVersion !== DESKTOP_RELEASE_MANIFEST_SCHEMA_VERSION) {
    throw createDesktopReleaseHttpError(
      `桌面发版清单 schemaVersion 必须为 ${DESKTOP_RELEASE_MANIFEST_SCHEMA_VERSION}。`,
      400,
      'manifest_schema',
    )
  }

  if (typeof value.version !== 'string' || !DESKTOP_RELEASE_SEMVER_PATTERN.test(value.version)) {
    throw createDesktopReleaseHttpError('桌面发版清单 version 需为 x.y.z。', 400, 'manifest_version')
  }
  if (typeof value.minSupported !== 'string' || !DESKTOP_RELEASE_SEMVER_PATTERN.test(value.minSupported)) {
    throw createDesktopReleaseHttpError('桌面发版清单 minSupported 需为 x.y.z。', 400, 'manifest_min_supported')
  }

  if (compareSemver(value.minSupported, value.version) > 0) {
    throw createDesktopReleaseHttpError(
      '桌面发版清单 minSupported 不能高于 version。',
      400,
      'manifest_min_supported_range',
    )
  }

  const expectedVersion = options.expectedVersion ?? null
  if (typeof expectedVersion === 'string' && expectedVersion && expectedVersion !== value.version) {
    throw createDesktopReleaseHttpError(
      `桌面发版清单 version=${value.version} 与期望版本 ${expectedVersion} 不一致。`,
      400,
      'manifest_version_mismatch',
    )
  }

  return {
    schemaVersion: DESKTOP_RELEASE_MANIFEST_SCHEMA_VERSION,
    version: value.version,
    minSupported: value.minSupported,
  }
}

/**
 * @param {string | Buffer} raw
 * @param {{ expectedVersion?: string | null, maxBytes?: number }} [options]
 */
export function parseDesktopReleaseManifestText(raw, options = {}) {
  const maxBytes = options.maxBytes ?? DESKTOP_RELEASE_MANIFEST_MAX_BYTES
  const buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(String(raw), 'utf8')
  if (buffer.byteLength === 0) {
    throw createDesktopReleaseHttpError('桌面发版清单为空。', 400, 'manifest_empty')
  }
  if (buffer.byteLength > maxBytes) {
    throw createDesktopReleaseHttpError(
      `桌面发版清单超过 ${maxBytes} 字节上限。`,
      400,
      'manifest_too_large',
    )
  }

  let parsed
  try {
    parsed = JSON.parse(buffer.toString('utf8'))
  } catch {
    throw createDesktopReleaseHttpError('桌面发版清单 JSON 无效。', 400, 'manifest_json')
  }
  return parseDesktopReleaseManifest(parsed, options)
}

/**
 * @param {string} filePath
 * @param {{ expectedVersion?: string | null }} [options]
 */
export function readDesktopReleaseManifestFromPath(filePath, options = {}) {
  if (!fs.existsSync(filePath)) {
    throw createDesktopReleaseHttpError(`缺少桌面发版清单：${filePath}`, 400, 'manifest_missing')
  }
  const buffer = fs.readFileSync(filePath)
  return parseDesktopReleaseManifestText(buffer, options)
}

export function buildDesktopReleaseAssetNames(version) {
  if (!DESKTOP_RELEASE_SEMVER_PATTERN.test(version)) {
    throw createDesktopReleaseHttpError('版本号需为 x.y.z。', 400, 'invalid_version')
  }
  return {
    exe: `yunzhan-setup-${version}.exe`,
    blockmap: `yunzhan-setup-${version}.exe.blockmap`,
    latestYml: 'latest.yml',
    manifest: DESKTOP_RELEASE_MANIFEST_FILE_NAME,
  }
}

export function buildGitHubReleaseDownloadUrl(version, fileName) {
  if (!DESKTOP_RELEASE_SEMVER_PATTERN.test(version)) {
    throw createDesktopReleaseHttpError('版本号需为 x.y.z。', 400, 'invalid_version')
  }
  if (typeof fileName !== 'string' || !fileName || fileName.includes('/') || fileName.includes('\\') || fileName.includes('..')) {
    throw createDesktopReleaseHttpError('资产文件名无效。', 400, 'invalid_asset_name')
  }
  return `https://github.com/${DESKTOP_RELEASE_REPO_FULL_NAME}/releases/download/v${version}/${fileName}`
}

export function isAllowedGitHubReleaseDownloadUrl(url, version, fileName) {
  if (typeof url !== 'string' || typeof version !== 'string' || typeof fileName !== 'string') return false
  const expected = buildGitHubReleaseDownloadUrl(version, fileName)
  return url === expected
}
