#!/usr/bin/env node
/**
 * 桌面端发版辅助脚本（安全版）：
 * - 发版前校验 Git 状态、版本一致、tag/release 不存在
 * - 运行完整 quality 门禁并构建 Windows 安装包
 * - 校验 latest.yml / exe / blockmap 一致性
 * - 创建 GitHub Release 并上传（禁止覆盖已发布版本）
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateReleaseArtifacts } from './validate-release-artifacts.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const releaseDir = path.join(root, 'release')

const args = new Set(process.argv.slice(2))
const skipBuild = args.has('--skip-build')
const skipAnnouncement = args.has('--skip-announcement')
const dryRun = args.has('--dry-run')

function fail(message) {
  console.error(`[release-desktop] ${message}`)
  process.exit(1)
}

function commandFor(baseName) {
  if (process.platform !== 'win32') return { executable: baseName, args: [] }
  if (baseName === 'npm') {
    const npmCli = path.join(process.execPath, '..', 'node_modules', 'npm', 'bin', 'npm-cli.js')
    return { executable: process.execPath, args: [npmCli] }
  }
  if (baseName === 'npx') {
    const npxCli = path.join(process.execPath, '..', 'node_modules', 'npm', 'bin', 'npx-cli.js')
    return { executable: process.execPath, args: [npxCli] }
  }
  if (baseName === 'gh') return { executable: 'gh.exe', args: [] }
  return { executable: baseName, args: [] }
}

function run(command, commandArgs, options = {}) {
  const { executable, args: prefixArgs } = commandFor(command)
  const result = spawnSync(executable, [...prefixArgs, ...commandArgs], {
    cwd: root,
    stdio: 'inherit',
    shell: false,
    ...options,
  })
  if (result.error) {
    fail(`命令启动失败: ${executable} ${[...prefixArgs, ...commandArgs].join(' ')} (${result.error.message})`)
  }
  if (result.status !== 0) {
    fail(`命令失败: ${executable} ${[...prefixArgs, ...commandArgs].join(' ')}`)
  }
}

function runCapture(command, commandArgs) {
  const { executable, args: prefixArgs } = commandFor(command)
  return spawnSync(executable, [...prefixArgs, ...commandArgs], {
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

function assertSkipBuildAllowed() {
  if (!skipBuild) return
  if (dryRun) return
  fail('--skip-build 仅允许与 --dry-run 一起使用；正式发布必须执行完整构建。')
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

function collectUploadFiles(artifacts) {
  const files = [artifacts.exePath, artifacts.blockmapPath, artifacts.latestYmlPath]
  if (artifacts.manifestPath) files.push(artifacts.manifestPath)
  return files
}

function readCurrentCommit() {
  const result = runCapture('git', ['rev-parse', 'HEAD'])
  if (result.status !== 0) return null
  const commit = result.stdout.trim()
  return /^[0-9a-f]{7,64}$/i.test(commit) ? commit : null
}

function generateReleaseAnnouncement(version) {
  if (skipAnnouncement) {
    console.log('[release-desktop] 跳过更新公告草稿生成（--skip-announcement）')
    return
  }
  const commit = readCurrentCommit()
  const commandArgs = [
    'scripts/generate-release-announcement.mjs',
    '--kind',
    'desktop_release',
    '--version',
    version,
  ]
  if (commit) commandArgs.push('--source-commit', commit)
  const result = runCapture('node', commandArgs)
  if (result.status !== 0) {
    console.warn('[release-desktop] 更新公告草稿生成失败，但不影响 GitHub Release。')
    if (result.stderr) console.warn(result.stderr.trim())
    return
  }
  if (result.stdout) process.stdout.write(result.stdout)
  if (result.stderr) process.stderr.write(result.stderr)
}

function main() {
  const version = readPackageVersion()
  const tag = `v${version}`
  console.log(`[release-desktop] 目标版本 ${version}`)

  assertCleanGitTree()
  assertSyncedWithOriginMain()
  assertSkipBuildAllowed()
  run('node', ['scripts/check-version-sync.cjs'])
  run('node', ['scripts/check-changelog-entry.mjs'])
  assertTagAndReleaseAbsent(tag)

  if (!skipBuild) {
    run('npm', ['run', 'quality'])
    run('npm', ['run', 'release:windows'])
  }

  if (!fs.existsSync(releaseDir)) fail('release/ 目录不存在')

  let artifacts
  try {
    artifacts = validateReleaseArtifacts({
      releaseDir,
      expectedVersion: version,
      projectRoot: root,
      requireManifest: true,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    fail(message)
  }

  const uploadFiles = collectUploadFiles(artifacts)
  const downloadUrl = `https://github.com/CruiseTom001/yunzhan/releases/download/${tag}/${artifacts.downloadFileName}`

  console.log('[release-desktop] 产物校验通过')
  console.log(`[release-desktop] exe=${path.basename(artifacts.exePath)}`)
  console.log(`[release-desktop] blockmap=${path.basename(artifacts.blockmapPath)}`)
  console.log(`[release-desktop] latest.yml=latest.yml`)
  console.log(`[release-desktop] manifest=${path.basename(artifacts.manifestPath)}`)
  console.log(`[release-desktop] minSupported=${artifacts.manifest.minSupported}`)

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
    `桌面端 ${version} 安装包。覆盖安装保留学习进度。\n\n下载：${downloadUrl}\n\n注意：当前安装包未配置代码签名，Windows SmartScreen 可能提示未知发布者。`,
    ...uploadFiles,
  ])

  generateReleaseAnnouncement(version)

  console.log('[release-desktop] 完成')
  console.log(`[release-desktop] releasePage=https://github.com/CruiseTom001/yunzhan/releases/tag/${tag}`)
  console.log(`[release-desktop] downloadUrl=${downloadUrl}`)
}

main()
