#!/usr/bin/env node
/**
 * 桌面端发版辅助脚本（安全版）：
 * - 发版前校验 Git 状态、版本一致、tag/release 不存在
 * - 运行完整 quality 门禁并构建 Windows 安装包
 * - 创建 GitHub Release 并上传（禁止覆盖已发布版本）
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const releaseDir = path.join(root, 'release')

const args = new Set(process.argv.slice(2))
const skipBuild = args.has('--skip-build')
const dryRun = args.has('--dry-run')

function fail(message) {
  console.error(`[release-desktop] ${message}`)
  process.exit(1)
}

function commandFor(baseName) {
  if (process.platform !== 'win32') return baseName
  if (baseName === 'npm') return 'npm.cmd'
  if (baseName === 'npx') return 'npx.cmd'
  if (baseName === 'gh') return 'gh.exe'
  return baseName
}

function run(command, commandArgs, options = {}) {
  const executable = commandFor(command)
  const result = spawnSync(executable, commandArgs, {
    cwd: root,
    stdio: 'inherit',
    shell: false,
    ...options,
  })
  if (result.status !== 0) {
    fail(`命令失败: ${executable} ${commandArgs.join(' ')}`)
  }
}

function runCapture(command, commandArgs) {
  const executable = commandFor(command)
  return spawnSync(executable, commandArgs, {
    cwd: root,
    encoding: 'utf8',
    shell: false,
  })
}

function readPackageVersion() {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
  if (typeof pkg.version !== 'string' || !/^\d+\.\d+\.\d+$/.test(pkg.version)) {
    fail(`package.json version 非法: ${String(pkg.version)}`)
  }
  return pkg.version
}

function assertCleanGitTree() {
  const status = runCapture('git', ['status', '--porcelain'])
  if (status.status !== 0) fail('无法读取 Git 状态。')
  const dirty = status.stdout
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('?? .zcode/'))
  if (dirty.length > 0) fail('Git 工作区不干净，请先提交或清理后再发版。')
}

function assertSyncedWithOriginMain() {
  runCapture('git', ['fetch', 'origin', 'main'])
  const branch = runCapture('git', ['rev-parse', '--abbrev-ref', 'HEAD'])
  if (branch.stdout.trim() !== 'main') {
    fail(`当前分支为 ${branch.stdout.trim()}，发版必须在 main 分支进行。`)
  }
  const aheadBehind = runCapture('git', ['rev-list', '--left-right', '--count', 'origin/main...HEAD'])
  if (aheadBehind.status !== 0) fail('无法比较 origin/main 与 HEAD。')
  const [behindText, aheadText] = aheadBehind.stdout.trim().split(/\s+/)
  if (Number(behindText) > 0) fail('本地 main 落后于 origin/main，请先拉取同步。')
  if (Number(aheadText) > 0) fail('本地 main 尚未推送到 origin/main，请先推送再发版。')
}

function assertTagAndReleaseAbsent(tag) {
  const localTag = runCapture('git', ['tag', '--list', tag])
  if (localTag.stdout.trim()) fail(`Git tag ${tag} 已存在，请升级版本号。`)

  const remoteTag = runCapture('git', ['ls-remote', '--tags', 'origin', tag])
  if (remoteTag.stdout.trim()) fail(`远程 tag ${tag} 已存在，请升级版本号。`)

  const view = runCapture('gh', ['release', 'view', tag])
  if (view.status === 0) fail(`GitHub Release ${tag} 已存在，禁止覆盖已发布版本。`)
}

function resolveAsciiSetupPath(version) {
  const asciiName = `yunzhan-setup-${version}.exe`
  const asciiPath = path.join(releaseDir, asciiName)
  if (fs.existsSync(asciiPath)) {
    fail(`已存在 ${asciiName}，禁止覆盖已发布安装包。请升级版本号。`)
  }

  const candidates = fs.readdirSync(releaseDir)
    .filter(name => (name.endsWith(`Setup-${version}.exe`) || name.endsWith(`-Setup-${version}.exe`)))
    .filter(name => !name.endsWith('.blockmap'))

  if (candidates.length === 0) fail(`未找到 ${version} 的安装包，请先构建。`)

  fs.copyFileSync(path.join(releaseDir, candidates[0]), asciiPath)
  console.log(`[release-desktop] 已复制: ${candidates[0]} -> ${asciiName}`)
  return asciiPath
}

function collectUploadFiles(version, asciiPath) {
  const uploadFiles = [asciiPath]
  const blockmapPath = `${asciiPath}.blockmap`
  if (fs.existsSync(blockmapPath)) uploadFiles.push(blockmapPath)
  const latestYml = path.join(releaseDir, 'latest.yml')
  if (fs.existsSync(latestYml)) uploadFiles.push(latestYml)
  return uploadFiles
}

function main() {
  const version = readPackageVersion()
  const tag = `v${version}`
  console.log(`[release-desktop] 目标版本 ${version}`)

  assertCleanGitTree()
  assertSyncedWithOriginMain()
  run('node', ['scripts/check-version-sync.cjs'])
  assertTagAndReleaseAbsent(tag)

  if (!skipBuild) {
    run('npm', ['run', 'quality'])
    run('npm', ['run', 'release:windows'])
  }

  if (!fs.existsSync(releaseDir)) fail('release/ 目录不存在')

  const asciiPath = resolveAsciiSetupPath(version)
  const uploadFiles = collectUploadFiles(version, asciiPath)
  const downloadUrl = `https://github.com/CruiseTom001/yunzhan/releases/download/${tag}/${path.basename(asciiPath)}`

  if (dryRun) {
    console.log('[release-desktop] dry-run，跳过 gh release create')
    console.log(`[release-desktop] upload=${uploadFiles.join(', ')}`)
    console.log(`[release-desktop] downloadUrl=${downloadUrl}`)
    return
  }

  run('gh', [
    'release',
    'create',
    tag,
    '--title',
    `云栈桌面端 ${tag}`,
    '--notes',
    `桌面端 ${version} 安装包。覆盖安装保留学习进度。\n\n下载：${downloadUrl}`,
    ...uploadFiles,
  ])

  console.log('[release-desktop] 完成')
  console.log(`[release-desktop] releasePage=https://github.com/CruiseTom001/yunzhan/releases/tag/${tag}`)
  console.log(`[release-desktop] downloadUrl=${downloadUrl}`)
}

main()
