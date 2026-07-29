#!/usr/bin/env node
/**
 * 发布成功后生成更新公告草稿（best-effort）：
 * - 读取 CHANGELOG.md 对应版本条目
 * - 调用服务端公告生成模块写入 active=false 草稿
 * - 数据库或 AI 不可用时只输出警告并以 0 退出，避免阻断 Release/部署
 */
import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { generateReleaseAnnouncementDraft } from '../server/announcement-generation.mjs'
import { RELEASE_ANNOUNCEMENT_CATEGORIES } from '../server/announcements.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

function usage() {
  console.error('用法: node scripts/generate-release-announcement.mjs --kind web_release|desktop_release --version x.y.z [--source-commit <sha>]')
  process.exit(1)
}

function readArgs(argv) {
  const args = { kind: '', version: '', sourceCommit: null }
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index]
    const value = argv[index + 1]
    if (key === '--kind' && value) {
      args.kind = value
      index += 1
      continue
    }
    if (key === '--version' && value) {
      args.version = value
      index += 1
      continue
    }
    if (key === '--source-commit' && value) {
      args.sourceCommit = value
      index += 1
      continue
    }
    usage()
  }
  return args
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function extractChangelogEntry(version) {
  const changelogPath = path.join(root, 'CHANGELOG.md')
  if (!fs.existsSync(changelogPath)) return ''
  const markdown = fs.readFileSync(changelogPath, 'utf8')
  const pattern = new RegExp(`## \\[${escapeRegExp(version)}\\][\\s\\S]*?(?=\\n## \\[|$)`, 'm')
  const match = markdown.match(pattern)
  return match ? match[0].trim() : ''
}

async function main() {
  const args = readArgs(process.argv.slice(2))
  if (!RELEASE_ANNOUNCEMENT_CATEGORIES.has(args.kind) || !/^\d+\.\d+\.\d+$/.test(args.version)) {
    usage()
  }

  let pool
  try {
    ;({ pool } = await import('../server/db.mjs'))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.warn(`[release-announcement] 跳过：数据库不可用（${message}）`)
    return
  }

  try {
    const result = await generateReleaseAnnouncementDraft(pool, {
      category: args.kind,
      version: args.version,
      sourceCommit: args.sourceCommit,
      changelogEntry: extractChangelogEntry(args.version),
      environment: process.env,
    })
    console.log(`[release-announcement] sourceKey=${result.announcement.sourceKey} created=${result.created} generatedByAi=${result.announcement.generatedByAi}`)
    if (result.announcement.generationProvider) {
      console.log(`[release-announcement] provider=${result.announcement.generationProvider}`)
    }
    if (result.announcement.generationError) {
      console.warn(`[release-announcement] AI 降级：${result.announcement.generationError}`)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.warn(`[release-announcement] 生成失败但不阻断发布：${message}`)
  } finally {
    await pool.end()
  }
}

await main()
