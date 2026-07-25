#!/usr/bin/env node
/**
 * 桌面端发版辅助脚本：
 * 1) 校验 package.json / CHANGELOG 版本一致
 * 2) 运行 npm run release:windows
 * 3) 复制 ASCII 文件名安装包
 * 4) 创建 GitHub Release 并上传
 * 5) 打印 downloadUrl，便于填入超管后台
 *
 * 用法：
 *   node scripts/release-desktop.mjs
 *   node scripts/release-desktop.mjs --skip-build   # 仅上传已有 release/ 产物
 *   node scripts/release-desktop.mjs --dry-run      # 不创建 Release
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

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...options,
  })
  if (result.status !== 0) {
    fail(`命令失败: ${command} ${commandArgs.join(' ')}`)
  }
}

function readPackageVersion() {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
  if (typeof pkg.version !== 'string' || !/^\d+\.\d+\.\d+$/.test(pkg.version)) {
    fail(`package.json version 非法: ${String(pkg.version)}`)
  }
  return pkg.version
}

function findSetupExe(version) {
  const asciiName = `yunzhan-setup-${version}.exe`
  const asciiPath = path.join(releaseDir, asciiName)
  if (fs.existsSync(asciiPath)) return asciiPath

  const candidates = fs.readdirSync(releaseDir)
    .filter((name) => name.endsWith(`Setup-${version}.exe`) || name.endsWith(`-Setup-${version}.exe`))
    .filter((name) => !name.endsWith('.blockmap'))

  if (candidates.length === 0) {
    fail(`未找到 ${version} 的 Setup.exe，请先构建。`)
  }

  const source = path.join(releaseDir, candidates[0])
  fs.copyFileSync(source, asciiPath)
  console.log(`[release-desktop] 已复制: ${candidates[0]} -> ${asciiName}`)
  return asciiPath
}

function main() {
  const version = readPackageVersion()
  const tag = `v${version}`
  console.log(`[release-desktop] 目标版本 ${version}`)

  run('node', ['scripts/check-version-sync.cjs'])

  if (!skipBuild) {
    run('npm', ['run', 'release:windows'])
  }

  if (!fs.existsSync(releaseDir)) {
    fail('release/ 目录不存在')
  }

  const setupPath = findSetupExe(version)
  const latestYml = path.join(releaseDir, 'latest.yml')
  const uploadFiles = [setupPath]
  if (fs.existsSync(latestYml)) uploadFiles.push(latestYml)

  const downloadUrl = `https://github.com/CruiseTom001/yunzhan/releases/download/${tag}/yunzhan-setup-${version}.exe`

  if (dryRun) {
    console.log('[release-desktop] dry-run，跳过 gh release create')
    console.log(`[release-desktop] downloadUrl=${downloadUrl}`)
    return
  }

  // 若已存在同名 Release，则仅上传缺失资源
  const view = spawnSync('gh', ['release', 'view', tag], {
    cwd: root,
    shell: process.platform === 'win32',
    encoding: 'utf8',
  })

  if (view.status === 0) {
    console.log(`[release-desktop] Release ${tag} 已存在，尝试上传/覆盖资源`)
    run('gh', ['release', 'upload', tag, ...uploadFiles, '--clobber'])
  } else {
    run('gh', [
      'release',
      'create',
      tag,
      `--title`,
      `云栈桌面端 ${tag}`,
      '--notes',
      `桌面端 ${version} 安装包。覆盖安装保留学习进度。\n\n下载：${downloadUrl}`,
      ...uploadFiles,
    ])
  }

  console.log('[release-desktop] 完成')
  console.log(`[release-desktop] releasePage=https://github.com/CruiseTom001/yunzhan/releases/tag/${tag}`)
  console.log(`[release-desktop] downloadUrl=${downloadUrl}`)
  console.log('[release-desktop] 请到超管后台 /admin/desktop-releases 填写上述 downloadUrl')
}

main()
