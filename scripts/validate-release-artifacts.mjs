import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import {
  DESKTOP_RELEASE_MANIFEST_FILE_NAME,
  DESKTOP_RELEASE_SOURCE_FILE_NAME,
  readDesktopReleaseManifestFromPath,
} from '../server/desktop-release-manifest.mjs'
import { parseLatestYml } from '../server/latest-yml.mjs'

export { parseLatestYml } from '../server/latest-yml.mjs'

export function computeFileSha512Base64(filePath) {
  const buffer = fs.readFileSync(filePath)
  return crypto.createHash('sha512').update(buffer).digest('base64')
}

export function prepareDesktopReleaseManifestArtifact({
  projectRoot,
  releaseDir,
  expectedVersion,
}) {
  const sourcePath = path.join(projectRoot, DESKTOP_RELEASE_SOURCE_FILE_NAME)
  const manifest = readDesktopReleaseManifestFromPath(sourcePath, { expectedVersion })
  const manifestPath = path.join(releaseDir, DESKTOP_RELEASE_MANIFEST_FILE_NAME)
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  return {
    manifest,
    manifestPath,
  }
}

export function validateReleaseArtifacts(options) {
  const releaseDir = options.releaseDir
  const expectedVersion = options.expectedVersion
  const projectRoot = options.projectRoot
  const requireManifest = options.requireManifest !== false

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

  let manifestPath = null
  let manifest = null
  if (requireManifest) {
    if (typeof projectRoot !== 'string' || !projectRoot.trim()) {
      throw new Error('projectRoot 无效，无法校验桌面发版清单。')
    }
    const prepared = prepareDesktopReleaseManifestArtifact({
      projectRoot,
      releaseDir,
      expectedVersion,
    })
    manifestPath = prepared.manifestPath
    manifest = prepared.manifest
    if (!fs.existsSync(manifestPath) || fs.statSync(manifestPath).size <= 0) {
      throw new Error(`缺少发版清单资产: ${DESKTOP_RELEASE_MANIFEST_FILE_NAME}`)
    }
  }

  return {
    version: parsed.version,
    exePath,
    blockmapPath,
    latestYmlPath,
    manifestPath,
    manifest,
    downloadFileName: parsed.path,
  }
}
