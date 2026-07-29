#!/usr/bin/env node
/**
 * 生产服务启动前自动生成更新公告草稿（best-effort）：
 * - 基于当前 package.json version + CHANGELOG.md 对应条目
 * - 幂等：source_key 已存在时不重复创建
 * - 失败只告警并退出 0，不阻断服务启动
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { pool } from './db.mjs'
import {
  extractChangelogEntryFromMarkdown,
  generateReleaseAnnouncementDraft,
} from './announcement-generation.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

function readVersion() {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
  return typeof pkg.version === 'string' ? pkg.version.trim() : ''
}

function readChangelogEntry(version) {
  const changelogPath = path.join(root, 'CHANGELOG.md')
  if (!fs.existsSync(changelogPath)) return ''
  return extractChangelogEntryFromMarkdown(fs.readFileSync(changelogPath, 'utf8'), version)
}

function readSourceCommit() {
  const candidates = [
    process.env.APP_COMMIT,
    process.env.VERCEL_GIT_COMMIT_SHA,
    process.env.RENDER_GIT_COMMIT,
    process.env.GITHUB_SHA,
  ]
  const commit = candidates.find(value => typeof value === 'string' && /^[0-9a-f]{7,64}$/i.test(value.trim()))
  return commit ? commit.trim() : null
}

async function main() {
  const version = readVersion()
  if (!version || process.env.RELEASE_ANNOUNCEMENT_AUTO_GENERATE === 'false') {
    return
  }
  try {
    const result = await generateReleaseAnnouncementDraft(pool, {
      category: 'web_release',
      version,
      sourceCommit: readSourceCommit(),
      changelogEntry: readChangelogEntry(version),
      environment: process.env,
    })
    console.info(`[release-announcement] sourceKey=${result.announcement.sourceKey} created=${result.created} generatedByAi=${result.announcement.generatedByAi}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.warn(`[release-announcement] 生成失败但不阻断启动：${message}`)
  } finally {
    await pool.end()
  }
}

await main()
