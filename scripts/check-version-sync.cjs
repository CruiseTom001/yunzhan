/**
 * 构建前校验:package.json / CHANGELOG.md / release/latest.yml 三处版本号一致
 *
 * 设计动机:
 * - 版本号散落在多处(package.json、CHANGELOG、electron-builder 产物清单),
 *   手工维护易脱节,曾导致发版时 Changelog 顶部版本与代码版本对不上。
 * - 运行时手工维护,构建期自动校验,不一致则 fail-fast。
 *
 * 运行: node scripts/check-version-sync.cjs
 * 退出码: 0 = 一致; 1 = 不一致(构建应中止)
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const PACKAGE_JSON = path.join(ROOT, 'package.json')
const CHANGELOG = path.join(ROOT, 'CHANGELOG.md')
const LATEST_YML = path.join(ROOT, 'release', 'latest.yml')

const SEMVER_RE = /^\d+\.\d+\.\d+$/

function readPackageVersion() {
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8'))
  if (typeof pkg.version !== 'string' || !SEMVER_RE.test(pkg.version)) {
    throw new Error(`check-version-sync: package.json version 非法: ${String(pkg.version)}`)
  }
  return pkg.version
}

function readChangelogVersion() {
  if (!fs.existsSync(CHANGELOG)) {
    throw new Error('check-version-sync: CHANGELOG.md 不存在,请在发版前维护。')
  }
  const src = fs.readFileSync(CHANGELOG, 'utf8')
  // 顶部 "## [x.y.z] -" 形式
  const match = src.match(/^##\s*\[([0-9.]+)\]/m)
  if (!match) {
    throw new Error('check-version-sync: CHANGELOG.md 顶部未找到版本条目。')
  }
  return match[1]
}

function readLatestYmlVersion() {
  if (!fs.existsSync(LATEST_YML)) return null
  const src = fs.readFileSync(LATEST_YML, 'utf8')
  const match = src.match(/^version:\s*([0-9.]+)/m)
  return match ? match[1] : null
}

function main() {
  const a = readPackageVersion()
  const b = readChangelogVersion()
  const c = readLatestYmlVersion()

  const mismatches = []
  if (a !== b) mismatches.push(`  package.json=${a} / CHANGELOG.md=${b}`)
  if (c !== null && a !== c) mismatches.push(`  package.json=${a} / release/latest.yml=${c}`)

  if (mismatches.length === 0) {
    console.log(`[check-version-sync] OK: 版本号一致 (${a})`)
    return
  }
  console.error('[check-version-sync] 版本号不一致,请先同步再构建:')
  for (const line of mismatches) console.error(line)
  process.exit(1)
}

main()
