#!/usr/bin/env node
/**
 * 生产服务启动前自动生成更新公告草稿（best-effort）：
 * - 基于当前 package.json version + CHANGELOG.md 对应条目
 * - 幂等：source_key 已存在时不重复创建
 * - 无用户侧内容时跳过，不写空泛草稿
 * - 失败只告警并退出 0，不阻断服务启动
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { pool } from './db.mjs'
import {
  EMPTY_FILTERED_RELEASE_NOTICE,
  extractChangelogEntryFromMarkdown,
  generateReleaseAnnouncementDraft,
  readChangelogFile,
} from './announcement-generation.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

function readVersion() {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
  return typeof pkg.version === 'string' ? pkg.version.trim() : ''
}

function readChangelogEntry(version) {
  try {
    const markdown = readChangelogFile(root)
    return extractChangelogEntryFromMarkdown(markdown, version)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.warn(`[release-announcement] 无法读取 CHANGELOG：${message}`)
    return ''
  }
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
    const changelogEntry = readChangelogEntry(version)
    if (!changelogEntry) {
      console.info(`[release-announcement] 跳过：CHANGELOG 中无版本 ${version} 或无法读取。`)
      return
    }
    const result = await generateReleaseAnnouncementDraft(pool, {
      category: 'web_release',
      version,
      sourceCommit: readSourceCommit(),
      changelogEntry,
      environment: process.env,
    })
    if (result.skipped) {
      console.info(
        `[release-announcement] sourceKey=${result.announcement?.sourceKey ?? `web_release:${version}`} skipped=true reason=${EMPTY_FILTERED_RELEASE_NOTICE}`,
      )
      return
    }
    console.info(`[release-announcement] sourceKey=${result.announcement.sourceKey} created=${result.created} repaired=${Boolean(result.repaired)} generatedByAi=${result.announcement.generatedByAi}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.warn(`[release-announcement] 生成失败但不阻断启动：${message}`)
  } finally {
    await pool.end()
  }
}

await main()
