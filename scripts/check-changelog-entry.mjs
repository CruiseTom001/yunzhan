#!/usr/bin/env node
/**
 * 发布前门禁：校验 package.json 当前版本在 CHANGELOG.md 中存在，
 * 且每条有效更新都有合法 audience 标记；历史版本不强制。
 *
 * 若当前版本全部为 admin/internal：门禁通过（允许构建），
 * 但不要求生成用户侧公告（由 ensure/generate 跳过空泛草稿）。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  analyzeChangelogBulletsForAudience,
  extractChangelogEntryFromMarkdown,
  formatChangelogForAnnouncement,
  isValidAudience,
} from '../server/announcement-generation.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

function fail(message) {
  console.error(`[check-changelog-entry] ${message}`)
  process.exit(1)
}

function readPackageVersion() {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
  if (typeof pkg.version !== 'string' || !/^\d+\.\d+\.\d+$/.test(pkg.version.trim())) {
    fail(`package.json version 非法: ${String(pkg.version)}`)
  }
  return pkg.version.trim()
}

function main() {
  const version = readPackageVersion()
  const changelogPath = path.join(root, 'CHANGELOG.md')
  if (!fs.existsSync(changelogPath)) {
    fail('CHANGELOG.md 不存在，请在发版前维护更新日志。')
  }

  const markdown = fs.readFileSync(changelogPath, 'utf8')
  const entry = extractChangelogEntryFromMarkdown(markdown, version)
  if (!entry) {
    fail(`CHANGELOG.md 中未找到版本 ## [${version}]，请补充当前版本更新说明。`)
  }

  const analyses = analyzeChangelogBulletsForAudience(entry)
  if (analyses.length === 0) {
    fail(`CHANGELOG.md 版本 [${version}] 缺少有效更新条目，不能只有标题或空分类。`)
  }

  for (const item of analyses) {
    if (item.unknownAudience) {
      fail(
        `CHANGELOG.md 版本 [${version}] 存在非法 audience「${item.unknownAudience}」：${item.line}`,
      )
    }
    if (item.hasConflict || (Array.isArray(item.audiences) && item.audiences.length > 1)) {
      fail(
        `CHANGELOG.md 版本 [${version}] 每条更新必须恰好一个 audience 标记，发现多个或冲突：${item.line}`,
      )
    }
    if (!item.hasExactAudience) {
      fail(
        `CHANGELOG.md 版本 [${version}] 缺少 audience 标记（仅允许且必须恰好一个 user/all/admin/internal）：${item.line}`,
      )
    }
    if (!isValidAudience(item.audience)) {
      fail(
        `CHANGELOG.md 版本 [${version}] audience 无效：${item.line}`,
      )
    }
  }

  const desktopText = formatChangelogForAnnouncement(entry, 'desktop_release')
  const webText = formatChangelogForAnnouncement(entry, 'web_release')
  const userFacingCount = analyses.filter(item => item.userFacing).length

  if (!desktopText && !webText) {
    console.log(
      `[check-changelog-entry] OK: ${version} 更新日志条目有效；本版本没有用户侧公告内容（全部为 admin/internal 或渠道过滤后为空）。`,
    )
    return
  }

  if (userFacingCount === 0) {
    console.log(
      `[check-changelog-entry] OK: ${version} 更新日志条目有效；本版本没有用户侧公告内容。`,
    )
    return
  }

  console.log(`[check-changelog-entry] OK: ${version} 更新日志条目有效（用户侧 ${userFacingCount} 条）`)
}

main()
