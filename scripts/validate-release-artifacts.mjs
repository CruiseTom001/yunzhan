import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const FIELD_PATTERN = /^([a-zA-Z0-9_-]+):\s*(.+)$/

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

export function computeFileSha512Base64(filePath) {
  const buffer = fs.readFileSync(filePath)
  return crypto.createHash('sha512').update(buffer).digest('base64')
}

export function validateReleaseArtifacts(options) {
  const releaseDir = options.releaseDir
  const expectedVersion = options.expectedVersion

  if (typeof releaseDir !== 'string' || !releaseDir.trim()) {
    throw new Error('releaseDir 无效。')
  }
  if (typeof expectedVersion !== 'string' || !/^\d+\.\d+\.\d+$/.test(expectedVersion)) {
    throw new Error('expectedVersion 无效。')
  }

  const latestYmlPath = path.join(releaseDir, 'latest.yml')
  if (!fs.existsSync(latestYmlPath)) {
    throw new Error('latest.yml 不存在。')
  }

  const parsed = parseLatestYml(fs.readFileSync(latestYmlPath, 'utf8'))
  if (parsed.version !== expectedVersion) {
    throw new Error(`latest.yml version=${parsed.version} 与 package.json version=${expectedVersion} 不一致。`)
  }

  const expectedExeName = `yunzhan-setup-${expectedVersion}.exe`
  if (parsed.path !== expectedExeName) {
    throw new Error(`latest.yml path=${parsed.path} 与期望文件名 ${expectedExeName} 不一致。`)
  }

  const exePath = path.join(releaseDir, parsed.path)
  if (!fs.existsSync(exePath)) {
    throw new Error(`安装包不存在: ${parsed.path}`)
  }

  const blockmapPath = `${exePath}.blockmap`
  if (!fs.existsSync(blockmapPath)) {
    throw new Error(`blockmap 不存在: ${path.basename(blockmapPath)}`)
  }

  const actualSize = fs.statSync(exePath).size
  if (actualSize !== parsed.size) {
    throw new Error(`安装包 size=${actualSize} 与 latest.yml size=${parsed.size} 不一致。`)
  }

  const actualSha512 = computeFileSha512Base64(exePath)
  if (actualSha512 !== parsed.sha512) {
    throw new Error('安装包 sha512 与 latest.yml 不一致。')
  }

  return {
    version: parsed.version,
    exePath,
    blockmapPath,
    latestYmlPath,
    downloadFileName: parsed.path,
  }
}
