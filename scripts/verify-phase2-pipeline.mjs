#!/usr/bin/env node
/**
 * Phase 2 一条龙验证：质量门禁 + 迁移幂等/旧数据校验 + 生产依赖审计 + diff 空白检查。
 */
import { spawnSync } from 'node:child_process'

function runStep(label, command, args, extraEnv = {}) {
  console.info(`\n[verify:phase2] >>> ${label}`)
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, ...extraEnv },
  })
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

runStep('质量门禁 npm run quality', 'npm', ['run', 'quality'])
runStep('Phase 2 迁移与草稿链路验证', 'node', ['scripts/verify-announcement-phase2.mjs'])
runStep('生产依赖审计 npm audit --omit=dev', 'npm', ['audit', '--omit=dev', '--registry=https://registry.npmjs.org'])
runStep('Git diff 空白检查', 'git', ['diff', '--check'])

console.info('\n[verify:phase2] OK: 一条龙验证全部通过')
