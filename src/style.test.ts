// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const STYLE_PATH = resolve(process.cwd(), 'src/style.css')
const css = readFileSync(STYLE_PATH, 'utf8')

// ---------- 工具：解析 style.css 的主题块与补丁 ----------

function extractBlock(pattern: string): string {
  // pattern 为已转义的正则片段（调用方负责转义），此处拼接选择器主体
  const match = css.match(new RegExp(`${pattern}\\s*\\{([^}]*)\\}`))
  if (!match) throw new Error(`未找到主题块: ${pattern}`)
  return match[1]
}

function parseVars(block: string): Record<string, string> {
  const vars: Record<string, string> = {}
  for (const m of block.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)) {
    vars[m[1]] = m[2].trim()
  }
  return vars
}

// ---------- 工具：WCAG 对比度计算 ----------

type Rgb = [number, number, number]

function parseColor(value: string): Rgb | null {
  const hex = value.trim()
  const short = hex.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i)
  if (short) {
    return [
      parseInt(short[1] + short[1], 16),
      parseInt(short[2] + short[2], 16),
      parseInt(short[3] + short[3], 16),
    ]
  }
  const full = hex.match(/^#([0-9a-f]{6})$/i)
  if (full) {
    return [
      parseInt(full[1].slice(0, 2), 16),
      parseInt(full[1].slice(2, 4), 16),
      parseInt(full[1].slice(4, 6), 16),
    ]
  }
  const rgb = hex.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/)
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])]
  return null
}

function channelLuminance(channel: number): number {
  const value = channel / 255
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

function luminance(rgb: Rgb): number {
  return 0.2126 * channelLuminance(rgb[0]) + 0.7152 * channelLuminance(rgb[1]) + 0.0722 * channelLuminance(rgb[2])
}

function contrastRatio(foreground: string, background: string): number {
  const fg = parseColor(foreground)
  const bg = parseColor(background)
  if (!fg || !bg) return Number.NaN
  const lighter = Math.max(luminance(fg), luminance(bg))
  const darker = Math.min(luminance(fg), luminance(bg))
  return (lighter + 0.05) / (darker + 0.05)
}

function expectContrastAtLeast(foreground: string, background: string, min: number, label: string) {
  const ratio = contrastRatio(foreground, background)
  expect(Number.isFinite(ratio), `${label}: ${foreground} 与 ${background} 无法计算对比度`).toBe(true)
  expect(ratio, `${label}: ${foreground} vs ${background} = ${ratio.toFixed(2)}:1，要求 ≥ ${min}:1`).toBeGreaterThanOrEqual(min)
}

// ---------- 测试 ----------

describe('light theme text contrast (WCAG)', () => {
  const lightVars = parseVars(extractBlock('\\[data-theme="light"\\]'))
  const bgPrimary = lightVars['bg-primary']
  const bgCard = lightVars['bg-card']

  it('exposes the semantic accent variables for light theme', () => {
    expect(lightVars['accent-cyan']).toBeDefined()
    expect(lightVars['accent-danger']).toBeDefined()
    expect(lightVars['accent-warning']).toBeDefined()
    expect(lightVars['accent-purple']).toBeDefined()
    expect(lightVars['accent-emerald']).toBeDefined()
  })

  it('keeps dark theme variables untouched', () => {
    const darkVars = parseVars(extractBlock(':root,\\s*\\[data-theme="dark"\\]'))
    expect(darkVars['bg-primary']).toBe('#06060b')
    expect(darkVars['text-primary']).toBe('#ffffff')
    expect(darkVars['accent-cyan']).toBe('#00f0ff')
    expect(darkVars['accent-danger']).toBe('#f87171')
    expect(darkVars['accent-warning']).toBe('#fbbf24')
  })

  it('primary/secondary text reach ≥ 4.5:1 on light backgrounds', () => {
    for (const name of ['text-primary', 'text-secondary', 'text-muted']) {
      expectContrastAtLeast(lightVars[name], bgPrimary, 4.5, name)
      expectContrastAtLeast(lightVars[name], bgCard, 4.5, `${name} on card`)
    }
  })

  it('accent status colors reach ≥ 4.5:1 as text on light backgrounds', () => {
    for (const name of ['accent-cyan', 'accent-purple', 'accent-emerald', 'accent-danger', 'accent-warning']) {
      expectContrastAtLeast(lightVars[name], bgPrimary, 4.5, name)
      expectContrastAtLeast(lightVars[name], bgCard, 4.5, `${name} on card`)
    }
  })

  it('dim text keeps ≥ 3:1 on light backgrounds (secondary hints)', () => {
    expectContrastAtLeast(lightVars['text-dim'], bgPrimary, 3, 'text-dim')
    expectContrastAtLeast(lightVars['text-dim'], bgCard, 3, 'text-dim on card')
  })
})

describe('light theme patch coverage', () => {
  it('maps hover:text-white and hover:text-gray-* to readable light colors', () => {
    expect(css).toContain('[data-theme="light"] .hover\\:text-white:hover')
    expect(css).toContain('[data-theme="light"] .hover\\:text-gray-200:hover')
    expect(css).toContain('[data-theme="light"] .hover\\:text-gray-400:hover')
  })

  it('hover background patches always carry :hover so they do not stick', () => {
    // 检查所有 [data-theme="light"] .hover\:bg-white 规则都带 :hover 伪类
    const hoverPatchSelector = /\[data-theme="light"\] \.hover\\:bg-white\\\/[^{]+(?=\{)/g
    const matches = [...css.matchAll(hoverPatchSelector)].map(m => m[0])
    expect(matches.length).toBeGreaterThan(0)
    for (const selector of matches) {
      expect(selector.trim(), `缺少 :hover 的规则: ${selector}`).toMatch(/:hover$/)
    }
  })

  it('covers cyan 100/200/300 and cyan-400 alpha variants', () => {
    expect(css).toContain('[data-theme="light"] .text-cyan-100,')
    expect(css).toContain('[data-theme="light"] .text-cyan-200,')
    expect(css).toContain('[data-theme="light"] .text-cyan-300')
    expect(css).toContain('[data-theme="light"] .text-cyan-400\\/50,')
    expect(css).toContain('[data-theme="light"] .text-cyan-400\\/70,')
    expect(css).toContain('[data-theme="light"] .text-cyan-400\\/80')
  })

  it('covers red/amber/purple status text', () => {
    expect(css).toContain('[data-theme="light"] .text-red-300,')
    expect(css).toContain('[data-theme="light"] .text-red-400')
    expect(css).toContain('[data-theme="light"] .text-amber-300,')
    expect(css).toContain('[data-theme="light"] .text-amber-400')
    expect(css).toContain('[data-theme="light"] .text-purple-300,')
    expect(css).toContain('[data-theme="light"] .text-purple-500')
  })

  it('covers scoped @apply component classes', () => {
    for (const selector of [
      '[data-theme="light"] .icon-action',
      '[data-theme="light"] .icon-action:hover:not(:disabled)',
      '[data-theme="light"] .form-field',
      '[data-theme="light"] .form-error',
      '[data-theme="light"] .modal-header',
      '[data-theme="light"] .secondary-button:hover:not(:disabled)',
      '[data-theme="light"] .ghost-button',
      '[data-theme="light"] .text-input',
      '[data-theme="light"] .text-input::placeholder',
    ]) {
      expect(css, `缺少组件类补丁: ${selector}`).toContain(selector)
    }
  })

  it('covers divide borders, border-white/20 and hover borders', () => {
    expect(css).toContain('[data-theme="light"] .divide-white\\/\\[0\\.05\\] > :not([hidden]) ~ :not([hidden])')
    expect(css).toContain('[data-theme="light"] .border-white\\/20')
    expect(css).toContain('[data-theme="light"] .hover\\:border-white\\/20:hover')
  })

  it('distinguishes native select option normal/hover/checked states', () => {
    const lightOptionBlock = extractBlock('\\[data-theme="light"\\] select option')
    const lightCheckedBlock = extractBlock('\\[data-theme="light"\\] select option:checked')
    const lightHoverBlock = extractBlock('\\[data-theme="light"\\] select option:hover')
    expect(lightOptionBlock).not.toBe(lightHoverBlock)
    expect(lightOptionBlock).not.toBe(lightCheckedBlock)
    expect(lightHoverBlock).not.toBe(lightCheckedBlock)
    const darkHoverBlock = extractBlock('\\[data-theme="dark"\\] select option:hover')
    expect(darkHoverBlock).toContain('#374151')
  })

  it('covers onboarding tour kicker contrast patch', () => {
    expect(css).toContain('[data-theme="light"] .onboarding-kicker')
  })

  it('does not use prefers-color-scheme', () => {
    expect(css).not.toContain('prefers-color-scheme')
  })
})
