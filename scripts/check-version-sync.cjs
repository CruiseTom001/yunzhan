/**
 * 构建前校验: package.json / package-lock.json / CHANGELOG.md /
 * desktop-release.json / release/latest.yml 版本号一致
 *
 * 运行: node scripts/check-version-sync.cjs
 * 退出码: 0 = 一致; 1 = 不一致(构建应中止)
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const PACKAGE_JSON = path.join(ROOT, 'package.json')
const PACKAGE_LOCK = path.join(ROOT, 'package-lock.json')
const CHANGELOG = path.join(ROOT, 'CHANGELOG.md')
const DESKTOP_RELEASE = path.join(ROOT, 'desktop-release.json')
const LATEST_YML = path.join(ROOT, 'release', 'latest.yml')

const SEMVER_RE = /^\d+\.\d+\.\d+$/
const ALLOWED_MANIFEST_KEYS = new Set(['schemaVersion', 'version', 'minSupported'])

function compareSemver(a, b) {
  const [aMajor, aMinor, aPatch] = a.split('.').map(Number)
  const [bMajor, bMinor, bPatch] = b.split('.').map(Number)
  if (aMajor !== bMajor) return aMajor < bMajor ? -1 : 1
  if (aMinor !== bMinor) return aMinor < bMinor ? -1 : 1
  if (aPatch !== bPatch) return aPatch < bPatch ? -1 : 1
  return 0
}

function readPackageVersion() {
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8'))
  if (typeof pkg.version !== 'string' || !SEMVER_RE.test(pkg.version)) {
    throw new Error(`check-version-sync: package.json version 非法: ${String(pkg.version)}`)
  }
  return pkg.version
}

function readPackageLockVersion() {
  if (!fs.existsSync(PACKAGE_LOCK)) {
    throw new Error('check-version-sync: package-lock.json 不存在。')
  }
  const lock = JSON.parse(fs.readFileSync(PACKAGE_LOCK, 'utf8'))
  if (typeof lock.version !== 'string' || !SEMVER_RE.test(lock.version)) {
    throw new Error(`check-version-sync: package-lock.json version 非法: ${String(lock.version)}`)
  }
  return lock.version
}

function readChangelogVersion() {
  if (!fs.existsSync(CHANGELOG)) {
    throw new Error('check-version-sync: CHANGELOG.md 不存在,请在发版前维护。')
  }
  const src = fs.readFileSync(CHANGELOG, 'utf8')
  const match = src.match(/^##\s*\[([0-9.]+)\]/m)
  if (!match) {
    throw new Error('check-version-sync: CHANGELOG.md 顶部未找到版本条目。')
  }
  return match[1]
}

function readDesktopReleaseManifest() {
  if (!fs.existsSync(DESKTOP_RELEASE)) {
    throw new Error('check-version-sync: desktop-release.json 不存在。')
  }
  let parsed
  try {
    parsed = JSON.parse(fs.readFileSync(DESKTOP_RELEASE, 'utf8'))
  } catch {
    throw new Error('check-version-sync: desktop-release.json JSON 无效。')
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('check-version-sync: desktop-release.json 必须是对象。')
  }
  const keys = Object.keys(parsed)
  if (keys.some(key => !ALLOWED_MANIFEST_KEYS.has(key)) || keys.length !== ALLOWED_MANIFEST_KEYS.size) {
    throw new Error('check-version-sync: desktop-release.json 仅允许 schemaVersion/version/minSupported。')
  }
  if (parsed.schemaVersion !== 1) {
    throw new Error('check-version-sync: desktop-release.json schemaVersion 必须为 1。')
  }
  if (typeof parsed.version !== 'string' || !SEMVER_RE.test(parsed.version)) {
    throw new Error(`check-version-sync: desktop-release.json version 非法: ${String(parsed.version)}`)
  }
  if (typeof parsed.minSupported !== 'string' || !SEMVER_RE.test(parsed.minSupported)) {
    throw new Error(`check-version-sync: desktop-release.json minSupported 非法: ${String(parsed.minSupported)}`)
  }
  if (compareSemver(parsed.minSupported, parsed.version) > 0) {
    throw new Error('check-version-sync: desktop-release.json minSupported 不能高于 version。')
  }
  return parsed
}

function readLatestYmlVersion() {
  if (!fs.existsSync(LATEST_YML)) return null
  const src = fs.readFileSync(LATEST_YML, 'utf8')
  const match = src.match(/^version:\s*([0-9.]+)/m)
  return match ? match[1] : null
}

function main() {
  const packageVersion = readPackageVersion()
  const lockVersion = readPackageLockVersion()
  const changelogVersion = readChangelogVersion()
  const desktopManifest = readDesktopReleaseManifest()
  const latestYmlVersion = readLatestYmlVersion()

  const mismatches = []
  if (packageVersion !== lockVersion) {
    mismatches.push(`  package.json=${packageVersion} / package-lock.json=${lockVersion}`)
  }
  if (packageVersion !== changelogVersion) {
    mismatches.push(`  package.json=${packageVersion} / CHANGELOG.md=${changelogVersion}`)
  }
  if (packageVersion !== desktopManifest.version) {
    mismatches.push(`  package.json=${packageVersion} / desktop-release.json=${desktopManifest.version}`)
  }
  if (latestYmlVersion !== null && packageVersion !== latestYmlVersion) {
    mismatches.push(`  package.json=${packageVersion} / release/latest.yml=${latestYmlVersion}`)
  }

  if (mismatches.length === 0) {
    console.log(
      `[check-version-sync] OK: 版本号一致 (${packageVersion}), minSupported=${desktopManifest.minSupported}`,
    )
    return
  }
  console.error('[check-version-sync] 版本号不一致,请先同步再构建:')
  for (const line of mismatches) console.error(line)
  process.exit(1)
}

main()
