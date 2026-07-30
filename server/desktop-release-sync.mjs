/**
 * GitHub Release → desktop_releases 同步共享服务。
 * Webhook 与超管“从 GitHub 同步”复用同一校验与创建路径。
 */
import crypto from 'node:crypto'
import {
  buildDesktopReleaseAssetNames,
  buildGitHubReleaseDownloadUrl,
  compareSemver,
  createDesktopReleaseHttpError,
  DESKTOP_RELEASE_MANIFEST_FILE_NAME,
  DESKTOP_RELEASE_MANIFEST_MAX_BYTES,
  DESKTOP_RELEASE_REPO_FULL_NAME,
  DESKTOP_RELEASE_SEMVER_PATTERN,
  isAllowedGitHubReleaseDownloadUrl,
  parseDesktopReleaseManifestText,
} from './desktop-release-manifest.mjs'
import {
  extractChangelogEntryFromMarkdown,
  formatChangelogForAnnouncement,
  readChangelogFile,
} from './announcement-generation.mjs'
import {
  assertLatestYmlMatchesRelease,
  LATEST_YML_MAX_BYTES,
  parseLatestYml,
} from './latest-yml.mjs'
import { limitedHttpsFetch } from './limited-fetch.mjs'

export const DESKTOP_RELEASE_NOTES_MAX_LENGTH = 2000
export const DESKTOP_RELEASE_EXE_MIN_BYTES = 1_000_000
export const DESKTOP_RELEASE_EXE_MAX_BYTES = 500 * 1024 * 1024
export const DESKTOP_RELEASE_ASSET_FETCH_TIMEOUT_MS = 10_000
export const DESKTOP_RELEASE_ASSET_FETCH_MAX_REDIRECTS = 5
export const DESKTOP_RELEASE_LATEST_YML_MAX_BYTES = LATEST_YML_MAX_BYTES
export const DESKTOP_RELEASE_GITHUB_API_MAX_BYTES = 1 * 1024 * 1024

const GITHUB_DELIVERY_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ALLOWED_ASSET_FETCH_HOSTS = new Set([
  'github.com',
  'objects.githubusercontent.com',
  'release-assets.githubusercontent.com',
])
const ALLOWED_GITHUB_API_HOSTS = new Set(['api.github.com'])

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function mapDesktopReleaseRow(row) {
  return {
    id: Number(row.id),
    version: row.version,
    minSupported: row.min_supported,
    downloadUrl: row.download_url,
    releaseNotes: row.release_notes,
    enabled: row.enabled === 1 || row.enabled === true,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  }
}

export function validateDesktopReleaseFields({
  version,
  minSupported,
  downloadUrl,
  releaseNotes = '',
  enabled = false,
  requireGitHubDownloadUrl = false,
}) {
  if (typeof version !== 'string' || !DESKTOP_RELEASE_SEMVER_PATTERN.test(version)) {
    throw createDesktopReleaseHttpError('版本号需为 x.y.z 形式纯数字。', 400, 'invalid_version')
  }
  if (typeof minSupported !== 'string' || !DESKTOP_RELEASE_SEMVER_PATTERN.test(minSupported)) {
    throw createDesktopReleaseHttpError('最低兼容版本需为 x.y.z 形式纯数字。', 400, 'invalid_min_supported')
  }
  if (compareSemver(minSupported, version) > 0) {
    throw createDesktopReleaseHttpError('最低兼容版本不能高于发布版本。', 400, 'min_supported_range')
  }
  if (typeof downloadUrl !== 'string' || downloadUrl.length > 500) {
    throw createDesktopReleaseHttpError('下载地址无效或超过 500 字符。', 400, 'invalid_download_url')
  }
  if (requireGitHubDownloadUrl) {
    if (!isAllowedGitHubReleaseDownloadUrl(downloadUrl, version, buildDesktopReleaseAssetNames(version).exe)) {
      throw createDesktopReleaseHttpError(
        '下载地址必须来自本仓库 GitHub Release 的安装包资产。',
        400,
        'download_url_not_allowed',
      )
    }
  } else if (!/^https?:\/\//.test(downloadUrl)) {
    throw createDesktopReleaseHttpError('下载地址需为 http(s):// 开头。', 400, 'invalid_download_url')
  }
  if (typeof releaseNotes !== 'string' || releaseNotes.length > DESKTOP_RELEASE_NOTES_MAX_LENGTH) {
    throw createDesktopReleaseHttpError(
      `发布说明不超过 ${DESKTOP_RELEASE_NOTES_MAX_LENGTH} 字符。`,
      400,
      'release_notes_too_long',
    )
  }
  if (typeof enabled !== 'boolean') {
    throw createDesktopReleaseHttpError('enabled 必须为布尔值。', 400, 'invalid_enabled')
  }
  return {
    version,
    minSupported,
    downloadUrl,
    releaseNotes,
    enabled,
  }
}

export function buildDesktopReleaseNotesFromChangelog(version, changelogMarkdown = null) {
  if (!DESKTOP_RELEASE_SEMVER_PATTERN.test(version)) {
    throw createDesktopReleaseHttpError('版本号需为 x.y.z。', 400, 'invalid_version')
  }
  const markdown = changelogMarkdown ?? readChangelogFile()
  const entry = extractChangelogEntryFromMarkdown(markdown, version)
  if (!entry) {
    throw createDesktopReleaseHttpError(
      `CHANGELOG 中未找到版本 ${version}。`,
      422,
      'changelog_version_missing',
    )
  }
  const notes = formatChangelogForAnnouncement(entry, 'desktop_release').trim()
  if (!notes) {
    throw createDesktopReleaseHttpError(
      `版本 ${version} 没有可用于桌面端的用户侧更新说明。`,
      422,
      'changelog_empty_user_notes',
    )
  }
  if (notes.length <= DESKTOP_RELEASE_NOTES_MAX_LENGTH) return notes
  return `${notes.slice(0, DESKTOP_RELEASE_NOTES_MAX_LENGTH - 1).trimEnd()}…`
}

export function parseReleaseTagName(tagName) {
  if (typeof tagName !== 'string' || !/^v\d+\.\d+\.\d+$/.test(tagName)) {
    throw createDesktopReleaseHttpError('Release tag 必须为 vX.Y.Z。', 400, 'invalid_tag')
  }
  return tagName.slice(1)
}

export function validateGitHubDeliveryId(deliveryId) {
  if (typeof deliveryId !== 'string' || !GITHUB_DELIVERY_PATTERN.test(deliveryId.trim())) {
    throw createDesktopReleaseHttpError('X-GitHub-Delivery 无效。', 400, 'invalid_delivery')
  }
  return deliveryId.trim().toLowerCase()
}

/**
 * 从 GitHub release JSON（Webhook payload.release 或 API 响应）提取并校验资产。
 * @param {unknown} release
 * @param {{ expectedVersion?: string | null }} [options]
 */
export function extractValidatedGitHubReleaseAssets(release, options = {}) {
  if (!isPlainObject(release)) {
    throw createDesktopReleaseHttpError('Release 数据无效。', 400, 'release_invalid')
  }
  if (release.draft === true) {
    throw createDesktopReleaseHttpError('草稿 Release 不能同步。', 400, 'release_draft')
  }
  if (release.prerelease === true) {
    throw createDesktopReleaseHttpError('预发布 Release 不能同步。', 400, 'release_prerelease')
  }

  const version = parseReleaseTagName(release.tag_name)
  if (options.expectedVersion && options.expectedVersion !== version) {
    throw createDesktopReleaseHttpError(
      `Release 版本 ${version} 与请求版本 ${options.expectedVersion} 不一致。`,
      400,
      'release_version_mismatch',
    )
  }

  const names = buildDesktopReleaseAssetNames(version)
  if (!Array.isArray(release.assets)) {
    throw createDesktopReleaseHttpError('Release 缺少 assets。', 400, 'assets_missing')
  }

  /** @type {Map<string, any>} */
  const byName = new Map()
  for (const asset of release.assets) {
    if (!isPlainObject(asset) || typeof asset.name !== 'string') {
      throw createDesktopReleaseHttpError('Release 资产无效。', 400, 'asset_invalid')
    }
    if (byName.has(asset.name)) {
      throw createDesktopReleaseHttpError(`Release 资产重复：${asset.name}`, 400, 'asset_duplicate')
    }
    byName.set(asset.name, asset)
  }

  const required = [names.exe, names.blockmap, names.latestYml, names.manifest]
  for (const name of required) {
    if (!byName.has(name)) {
      throw createDesktopReleaseHttpError(`缺少 Release 资产：${name}`, 400, 'asset_missing')
    }
  }

  const exe = byName.get(names.exe)
  const blockmap = byName.get(names.blockmap)
  const latestYml = byName.get(names.latestYml)
  const manifest = byName.get(names.manifest)

  const exeSize = Number(exe.size)
  if (!Number.isFinite(exeSize) || exeSize < DESKTOP_RELEASE_EXE_MIN_BYTES || exeSize > DESKTOP_RELEASE_EXE_MAX_BYTES) {
    throw createDesktopReleaseHttpError('安装包大小不在允许范围。', 400, 'exe_size')
  }
  const blockmapSize = Number(blockmap.size)
  if (!Number.isFinite(blockmapSize) || blockmapSize <= 0) {
    throw createDesktopReleaseHttpError('blockmap 资产为空。', 400, 'blockmap_empty')
  }
  const latestSize = Number(latestYml.size)
  if (!Number.isFinite(latestSize) || latestSize <= 0) {
    throw createDesktopReleaseHttpError('latest.yml 资产为空。', 400, 'latest_yml_empty')
  }
  const manifestSize = Number(manifest.size)
  if (!Number.isFinite(manifestSize) || manifestSize <= 0 || manifestSize > DESKTOP_RELEASE_MANIFEST_MAX_BYTES) {
    throw createDesktopReleaseHttpError('发版清单大小无效或过大。', 400, 'manifest_size')
  }

  for (const [asset, fileName] of [
    [exe, names.exe],
    [blockmap, names.blockmap],
    [latestYml, names.latestYml],
    [manifest, names.manifest],
  ]) {
    if (typeof asset.browser_download_url !== 'string'
      || !isAllowedGitHubReleaseDownloadUrl(asset.browser_download_url, version, fileName)) {
      throw createDesktopReleaseHttpError(
        `资产下载地址非法：${fileName}`,
        400,
        'asset_url_not_allowed',
      )
    }
  }

  const releaseId = release.id
  if (typeof releaseId !== 'number' && typeof releaseId !== 'string') {
    throw createDesktopReleaseHttpError('Release ID 无效。', 400, 'release_id_invalid')
  }

  return {
    version,
    releaseId: String(releaseId),
    tagName: `v${version}`,
    exeDownloadUrl: exe.browser_download_url,
    exeFileName: names.exe,
    exeSize,
    latestYmlDownloadUrl: latestYml.browser_download_url,
    manifestDownloadUrl: manifest.browser_download_url,
    assetNames: names,
  }
}

/**
 * 受限拉取 GitHub Release 资产正文。
 */
export async function fetchGitHubReleaseAssetText(url, {
  fetchImplementation = fetch,
  maxBytes = DESKTOP_RELEASE_MANIFEST_MAX_BYTES,
  timeoutMs = DESKTOP_RELEASE_ASSET_FETCH_TIMEOUT_MS,
  maxRedirects = DESKTOP_RELEASE_ASSET_FETCH_MAX_REDIRECTS,
} = {}) {
  const buffer = await limitedHttpsFetch(url, {
    fetchImplementation,
    maxBytes,
    timeoutMs,
    maxRedirects,
    allowedHosts: ALLOWED_ASSET_FETCH_HOSTS,
    redirectMode: 'manual',
    headers: {
      Accept: 'application/octet-stream, application/json;q=0.9, */*;q=0.8',
      'User-Agent': 'yunzhan-desktop-release-sync',
    },
    errorPrefix: '获取 Release 资产',
  })
  return buffer.toString('utf8')
}

export async function loadManifestFromGitHubAsset(manifestDownloadUrl, expectedVersion, options = {}) {
  const text = await fetchGitHubReleaseAssetText(manifestDownloadUrl, {
    ...options,
    maxBytes: options.maxBytes ?? DESKTOP_RELEASE_MANIFEST_MAX_BYTES,
  })
  return parseDesktopReleaseManifestText(text, { expectedVersion })
}

export async function loadAndValidateLatestYmlFromGitHubAsset({
  latestYmlDownloadUrl,
  expectedVersion,
  expectedExeFileName,
  expectedExeSize,
  fetchImplementation,
  timeoutMs,
}) {
  const text = await fetchGitHubReleaseAssetText(latestYmlDownloadUrl, {
    fetchImplementation,
    maxBytes: DESKTOP_RELEASE_LATEST_YML_MAX_BYTES,
    timeoutMs,
  })
  let parsed
  try {
    parsed = parseLatestYml(text)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw createDesktopReleaseHttpError(message, 400, 'latest_yml_invalid')
  }
  try {
    assertLatestYmlMatchesRelease(parsed, {
      expectedVersion,
      expectedExeFileName,
      expectedExeSize,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw createDesktopReleaseHttpError(message, 400, 'latest_yml_mismatch')
  }
  return parsed
}

/**
 * 原子创建未启用桌面版本记录 + 审计。AI/外部网络调用必须在事务外完成。
 */
export async function createDisabledDesktopReleaseRecord(client, {
  version,
  minSupported,
  downloadUrl,
  releaseNotes,
  audit,
}) {
  const fields = validateDesktopReleaseFields({
    version,
    minSupported,
    downloadUrl,
    releaseNotes,
    enabled: false,
    requireGitHubDownloadUrl: true,
  })

  const existing = await client.query(
    `SELECT id, version, min_supported, download_url, release_notes, enabled, created_at, updated_at
       FROM desktop_releases
      WHERE version = $1`,
    [fields.version],
  )
  if (existing.rows.length > 0) {
    return {
      created: false,
      alreadyExists: true,
      release: mapDesktopReleaseRow(existing.rows[0]),
    }
  }

  if (!isPlainObject(audit) || typeof audit.action !== 'string' || !audit.action.trim()) {
    throw createDesktopReleaseHttpError('审计上下文无效。', 400, 'audit_invalid')
  }
  const action = audit.action.trim()
  if (action.length > 64) {
    throw createDesktopReleaseHttpError('审计动作无效。', 400, 'audit_action')
  }
  const metadata = isPlainObject(audit.metadata) ? audit.metadata : {}
  // 禁止把正文/URL 明文以外的大字段塞进审计；调用方应只传 delivery/repo/tag 等
  const safeMetadata = {
    deliveryId: typeof metadata.deliveryId === 'string' ? metadata.deliveryId : null,
    repository: typeof metadata.repository === 'string' ? metadata.repository : null,
    releaseId: typeof metadata.releaseId === 'string' ? metadata.releaseId : null,
    tag: typeof metadata.tag === 'string' ? metadata.tag : `v${fields.version}`,
    version: fields.version,
    result: 'created',
    source: typeof metadata.source === 'string' ? metadata.source : 'github_release',
  }

  const actorUserId = audit.actorUserId == null ? null : String(audit.actorUserId)
  const targetUserId = audit.targetUserId == null ? null : String(audit.targetUserId)

  const inserted = await client.query(
    `WITH inserted AS (
       INSERT INTO desktop_releases (version, min_supported, download_url, release_notes, enabled)
       VALUES ($1, $2, $3, $4, 0)
       ON CONFLICT (version) DO NOTHING
       RETURNING id, version, min_supported, download_url, release_notes, enabled, created_at, updated_at
     ),
     _audit AS (
       INSERT INTO audit_logs (actor_user_id, action, target_user_id, metadata)
       SELECT
         $5::uuid,
         $6,
         $7::uuid,
         $8::jsonb
       FROM inserted
       RETURNING id
     )
     SELECT * FROM inserted`,
    [
      fields.version,
      fields.minSupported,
      fields.downloadUrl,
      fields.releaseNotes,
      actorUserId,
      action,
      targetUserId,
      JSON.stringify(safeMetadata),
    ],
  )

  if (inserted.rows.length === 0) {
    const conflict = await client.query(
      `SELECT id, version, min_supported, download_url, release_notes, enabled, created_at, updated_at
         FROM desktop_releases
        WHERE version = $1`,
      [fields.version],
    )
    if (conflict.rows.length === 0) {
      throw createDesktopReleaseHttpError('桌面版本记录创建失败。', 500, 'create_failed')
    }
    return {
      created: false,
      alreadyExists: true,
      release: mapDesktopReleaseRow(conflict.rows[0]),
    }
  }

  return {
    created: true,
    alreadyExists: false,
    release: mapDesktopReleaseRow(inserted.rows[0]),
  }
}

/**
 * 完整同步：外部网络在外，DB 短写入在内。
 */
export async function syncDesktopReleaseFromGitHubRelease(client, releasePayload, {
  expectedVersion = null,
  changelogMarkdown = null,
  audit,
  fetchImplementation,
  timeoutMs,
} = {}) {
  const assets = extractValidatedGitHubReleaseAssets(releasePayload, { expectedVersion })
  const expectedDownloadUrl = buildGitHubReleaseDownloadUrl(assets.version, assets.assetNames.exe)
  if (assets.exeDownloadUrl !== expectedDownloadUrl) {
    throw createDesktopReleaseHttpError('安装包下载地址与版本不一致。', 400, 'download_url_mismatch')
  }

  const fetchOptions = { fetchImplementation, timeoutMs }
  const [manifest] = await Promise.all([
    loadManifestFromGitHubAsset(
      assets.manifestDownloadUrl,
      assets.version,
      fetchOptions,
    ),
    loadAndValidateLatestYmlFromGitHubAsset({
      latestYmlDownloadUrl: assets.latestYmlDownloadUrl,
      expectedVersion: assets.version,
      expectedExeFileName: assets.exeFileName,
      expectedExeSize: assets.exeSize,
      ...fetchOptions,
    }),
  ])

  const releaseNotes = buildDesktopReleaseNotesFromChangelog(assets.version, changelogMarkdown)

  return createDisabledDesktopReleaseRecord(client, {
    version: assets.version,
    minSupported: manifest.minSupported,
    downloadUrl: assets.exeDownloadUrl,
    releaseNotes,
    audit: {
      ...audit,
      metadata: {
        ...(audit?.metadata ?? {}),
        releaseId: assets.releaseId,
        tag: assets.tagName,
        version: assets.version,
        repository: DESKTOP_RELEASE_REPO_FULL_NAME,
      },
    },
  })
}

export async function fetchGitHubReleaseByTag(version, {
  fetchImplementation = fetch,
  githubToken = null,
  timeoutMs = DESKTOP_RELEASE_ASSET_FETCH_TIMEOUT_MS,
} = {}) {
  if (!DESKTOP_RELEASE_SEMVER_PATTERN.test(version)) {
    throw createDesktopReleaseHttpError('版本号需为 x.y.z。', 400, 'invalid_version')
  }
  const url = `https://api.github.com/repos/${DESKTOP_RELEASE_REPO_FULL_NAME}/releases/tags/v${version}`
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'yunzhan-desktop-release-sync',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  if (typeof githubToken === 'string' && githubToken.trim()) {
    headers.Authorization = `Bearer ${githubToken.trim()}`
  }

  let buffer
  try {
    buffer = await limitedHttpsFetch(url, {
      fetchImplementation,
      maxBytes: DESKTOP_RELEASE_GITHUB_API_MAX_BYTES,
      timeoutMs,
      maxRedirects: 0,
      allowedHosts: ALLOWED_GITHUB_API_HOSTS,
      redirectMode: 'error',
      headers,
      errorPrefix: '查询 GitHub Release',
    })
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'not_found') {
      throw createDesktopReleaseHttpError(`未找到 GitHub Release v${version}。`, 404, 'github_release_not_found')
    }
    throw error
  }

  let json
  try {
    json = JSON.parse(buffer.toString('utf8'))
  } catch {
    throw createDesktopReleaseHttpError('GitHub Release API 返回了非法 JSON。', 502, 'github_api_json')
  }
  return json
}

/**
 * 验签：HMAC-SHA256 over raw body，timingSafeEqual。
 */
export function verifyGitHubWebhookSignature({ rawBody, signatureHeader, secret }) {
  if (typeof secret !== 'string' || !secret) {
    throw createDesktopReleaseHttpError('GitHub Webhook Secret 未配置。', 503, 'webhook_secret_missing')
  }
  if (typeof signatureHeader !== 'string' || !signatureHeader.startsWith('sha256=')) {
    throw createDesktopReleaseHttpError('缺少或无效的 Webhook 签名。', 401, 'webhook_signature_missing')
  }
  if (!Buffer.isBuffer(rawBody) && typeof rawBody !== 'string') {
    throw createDesktopReleaseHttpError('Webhook 原始请求体无效。', 401, 'webhook_raw_body')
  }

  const provided = signatureHeader.slice('sha256='.length).trim().toLowerCase()
  if (!/^[0-9a-f]{64}$/.test(provided)) {
    throw createDesktopReleaseHttpError('Webhook 签名格式无效。', 401, 'webhook_signature_format')
  }

  const digest = crypto
    .createHmac('sha256', secret)
    .update(Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody))
    .digest('hex')

  const a = Buffer.from(digest, 'utf8')
  const b = Buffer.from(provided, 'utf8')
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw createDesktopReleaseHttpError('Webhook 签名校验失败。', 401, 'webhook_signature_mismatch')
  }
}

export function parseGitHubReleaseWebhookPayload(rawBody) {
  let parsed
  try {
    parsed = JSON.parse(Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody))
  } catch {
    throw createDesktopReleaseHttpError('Webhook JSON 无效。', 400, 'webhook_json')
  }
  if (!isPlainObject(parsed)) {
    throw createDesktopReleaseHttpError('Webhook payload 无效。', 400, 'webhook_payload')
  }
  return parsed
}

export function assertPublishedReleaseWebhook(payload, {
  eventName,
  repositoryFullName = DESKTOP_RELEASE_REPO_FULL_NAME,
}) {
  if (eventName !== 'release') {
    return { ignored: true, reason: 'event_not_release' }
  }
  if (payload.action !== 'published') {
    return { ignored: true, reason: 'action_not_published' }
  }
  if (!isPlainObject(payload.repository) || payload.repository.full_name !== repositoryFullName) {
    throw createDesktopReleaseHttpError('仓库不匹配。', 400, 'repository_mismatch')
  }
  if (!isPlainObject(payload.release)) {
    throw createDesktopReleaseHttpError('缺少 release 对象。', 400, 'release_missing')
  }
  return { ignored: false, release: payload.release }
}
