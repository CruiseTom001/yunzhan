/**
 * Electron latest.yml 共享解析器（发版脚本与 GitHub 同步共用）。
 */
const FIELD_PATTERN = /^([a-zA-Z0-9_-]+):\s*(.+)$/
const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/

export const LATEST_YML_MAX_BYTES = 64 * 1024

export function isValidSha512Base64(value) {
  if (typeof value !== 'string' || !value.trim()) return false
  const trimmed = value.trim()
  // SHA-512 原始 64 字节 → Base64 约 88 字符（含 padding）
  if (trimmed.length < 80 || trimmed.length > 128) return false
  if (!BASE64_PATTERN.test(trimmed)) return false
  try {
    const decoded = Buffer.from(trimmed, 'base64')
    return decoded.byteLength === 64
  } catch {
    return false
  }
}

/**
 * @param {string} content
 * @returns {{ version: string, path: string, sha512: string, size: number }}
 */
export function parseLatestYml(content) {
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('latest.yml 为空或格式无效。')
  }

  const fields = {}
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('-')) continue
    const match = trimmed.match(FIELD_PATTERN)
    if (!match) continue
    fields[match[1]] = match[2].trim()
  }

  const version = fields.version
  const artifactPath = fields.path
  const sha512 = fields.sha512
  const sizeText = fields.size

  if (!version || !artifactPath || !sha512 || !sizeText) {
    throw new Error('latest.yml 缺少 version/path/sha512/size 字段。')
  }

  if (!isValidSha512Base64(sha512)) {
    throw new Error('latest.yml sha512 无效，需为合法 Base64 编码的 SHA-512。')
  }

  const size = Number(sizeText)
  if (!Number.isFinite(size) || size <= 0) {
    throw new Error('latest.yml size 字段无效。')
  }

  return {
    version,
    path: artifactPath,
    sha512,
    size,
  }
}

/**
 * 对照 Release 元数据校验 latest.yml 正文（不下载 exe、不重算哈希）。
 */
export function assertLatestYmlMatchesRelease(parsed, {
  expectedVersion,
  expectedExeFileName,
  expectedExeSize,
}) {
  if (parsed.version !== expectedVersion) {
    throw new Error(
      `latest.yml version=${parsed.version} 与 Release 版本 ${expectedVersion} 不一致。`,
    )
  }
  if (parsed.path !== expectedExeFileName) {
    throw new Error(
      `latest.yml path=${parsed.path} 与期望文件名 ${expectedExeFileName} 不一致。`,
    )
  }
  if (parsed.size !== expectedExeSize) {
    throw new Error(
      `latest.yml size=${parsed.size} 与 GitHub 安装包资产 size=${expectedExeSize} 不一致。`,
    )
  }
}
