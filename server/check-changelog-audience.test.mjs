/**
 * 门禁脚本 audience 规则的可单测封装校验。
 */
import { describe, expect, it } from 'vitest'
import {
  analyzeChangelogBulletsForAudience,
  extractChangelogEntryFromMarkdown,
  formatChangelogForAnnouncement,
  isValidAudience,
} from '../server/announcement-generation.mjs'

describe('check-changelog-entry audience gate helpers', () => {
  it('fails analysis when current-version bullet misses audience', () => {
    const entry = extractChangelogEntryFromMarkdown(
      '## [1.9.9]\n\n### 修复\n- 缺少标记的条目。(B)\n',
      '1.9.9',
    )
    const analyses = analyzeChangelogBulletsForAudience(entry)
    expect(analyses[0].hasExactAudience).toBe(false)
    expect(analyses[0].reason).toBe('missing')
  })

  it('flags unknown audience values with the concrete line', () => {
    const analyses = analyzeChangelogBulletsForAudience(
      '## [1.9.9]\n\n- 错误受众。[audience:ops] (B)',
    )
    expect(analyses[0].unknownAudience).toBe('ops')
    expect(analyses[0].hasExactAudience).toBe(false)
    expect(isValidAudience('ops')).toBe(false)
  })

  it('fails when a bullet has conflicting audiences', () => {
    const analyses = analyzeChangelogBulletsForAudience(
      '- 冲突条目。[audience:user] [audience:admin] (B)',
    )
    expect(analyses[0].hasConflict).toBe(true)
    expect(analyses[0].hasExactAudience).toBe(false)
    expect(analyses[0].audiences).toEqual(['user', 'admin'])
  })

  it('fails when a bullet repeats the same audience twice', () => {
    const analyses = analyzeChangelogBulletsForAudience(
      '- 重复标记。[audience:user] [audience:user] (B)',
    )
    expect(analyses[0].hasConflict).toBe(true)
    expect(analyses[0].hasExactAudience).toBe(false)
  })

  it('fails when valid and invalid audiences appear together', () => {
    const analyses = analyzeChangelogBulletsForAudience(
      '- 混杂。[audience:user] [audience:ops] (B)',
    )
    expect(analyses[0].hasExactAudience).toBe(false)
    expect(analyses[0].unknownAudience).toBe('ops')
  })

  it('accepts a single valid audience', () => {
    for (const audience of ['user', 'all', 'admin', 'internal']) {
      const analyses = analyzeChangelogBulletsForAudience(
        `- 合法。[audience:${audience}] (B)`,
      )
      expect(analyses[0].hasExactAudience).toBe(true)
      expect(analyses[0].audience).toBe(audience)
    }
  })

  it('excludes conflicting audience lines from user announcements and AI facts', () => {
    const entry = `### 修复
- 用户可见修复。[audience:user] (B)
- 冲突条目绝不可泄漏。[audience:user] [audience:admin] (Web)
- 后台入口。[audience:admin] (Web)`
    const text = formatChangelogForAnnouncement(entry, 'web_release')
    expect(text).toContain('用户可见修复')
    expect(text).not.toContain('冲突条目')
    expect(text).not.toContain('后台入口')
  })

  it('accepts historical versions without audience for compatibility', () => {
    const analyses = analyzeChangelogBulletsForAudience(
      '## [1.2.5]\n\n- 历史条目。(B)',
    )
    // 门禁对当前版本要求 hasExactAudience；历史分析仍可识别无标记
    expect(analyses[0].hasAudience).toBe(false)
    expect(analyses[0].hasExactAudience).toBe(false)
    expect(analyses[0].reason).toBe('missing')
    // 生成侧历史无标记仍可进入用户公告
    expect(formatChangelogForAnnouncement('- 历史条目。(B)', 'web_release')).toContain('历史条目')
  })
})
