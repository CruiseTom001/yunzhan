#!/usr/bin/env node
/**
 * Phase 2 一条龙验证：质量门禁 + 迁移幂等/旧数据校验 + 生产依赖审计 + diff 空白检查。
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

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

function runStep(label, command, args, extraEnv = {}) {
  console.info(`\n[verify:phase2] >>> ${label}`)
  const { executable, args: prefixArgs } = commandFor(command)
  const result = spawnSync(executable, [...prefixArgs, ...args], {
    cwd: root,
    stdio: 'inherit',
    shell: false,
    env: { ...process.env, ...extraEnv },
  })
  if (result.error) {
    console.error(`[verify:phase2] ERROR: ${result.error.message}`)
    process.exit(1)
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

runStep('质量门禁 npm run quality', 'npm', ['run', 'quality'])
runStep('Phase 2 迁移与草稿链路验证', 'node', ['scripts/verify-announcement-phase2.mjs'], {
  DATABASE_URL: '',
  DB_SSL: '',
})
runStep('生产依赖审计 npm audit --omit=dev', 'npm', ['audit', '--omit=dev', '--registry=https://registry.npmjs.org'])
runStep('Git diff 空白检查', 'git', ['diff', '--check'])

console.info('\n[verify:phase2] OK: 一条龙验证全部通过')