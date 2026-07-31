// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import AccountPage from './AccountPage.vue'
import { useAuthStore } from '@/stores/auth'

// 与 src/style.css 浅色块保持一致的期望值；用例 A 会从源码断言同一数值，防止漂移。
const LIGHT_BG_CARD = '#fafbfd'
const LIGHT_BORDER_CARD = '#b7c3d1'
// 深色下 .card 的 scoped 编译产物原值（@apply border-white/[0.08] bg-white/[0.015]）
const DARK_CARD_BG = 'rgba(255, 255, 255, 0.015)'
const DARK_CARD_BORDER = 'rgba(255, 255, 255, 0.08)'

vi.mock('@/utils/accountApi', () => ({
  listAccountSessions: vi.fn().mockResolvedValue([]),
  revokeAccountSession: vi.fn(),
  revokeOtherAccountSessions: vi.fn(),
  changeAccountPassword: vi.fn(),
  requestEmailChangeCode: vi.fn(),
  exportAccountData: vi.fn(),
  deleteAccount: vi.fn(),
}))

vi.mock('@/utils/feedbackApi', () => ({
  listMyFeedback: vi.fn().mockResolvedValue([]),
  submitFeedback: vi.fn(),
}))

vi.mock('@/utils/desktopVersionApi', () => ({
  getDesktopLatestVersion: vi.fn(),
}))

vi.mock('@/stores/desktopUpdate', () => ({
  useDesktopUpdateStore: () => ({ isDesktop: false }),
}))

function applyProjectTheme(theme: 'light' | 'dark') {
  document.documentElement.setAttribute('data-theme', theme)
  document.documentElement.classList.toggle('dark', theme === 'dark')
  const themeVars = theme === 'light'
    ? { '--bg-card': LIGHT_BG_CARD, '--border-card': LIGHT_BORDER_CARD, '--border-hover': '#adb9c6' }
    : { '--bg-card': 'rgba(255, 255, 255, 0.01)', '--border-card': 'rgba(255, 255, 255, 0.04)', '--border-hover': 'rgba(255, 255, 255, 0.08)' }
  for (const [name, value] of Object.entries(themeVars)) {
    document.documentElement.style.setProperty(name, value)
  }
}

// 模拟 Vue 编译后的 scoped 产物：.card[data-v-*] 为普通声明（与全局补丁同特异性、可后出现）
function createCascadeCard() {
  const card = document.createElement('div')
  card.className = 'card'
  card.setAttribute('data-v-cascade', '')
  document.body.appendChild(card)
  return card
}

function injectStyle(id: string, css: string) {
  const styleEl = document.createElement('style')
  styleEl.id = id
  styleEl.textContent = css
  document.head.appendChild(styleEl)
  return styleEl
}

function removeInjectedAssets() {
  document.querySelectorAll('style#cascade-style, style#cascade-control, style#cascade-real').forEach((el) => el.remove())
  document.querySelectorAll('.card[data-v-cascade]').forEach((el) => el.remove())
}

describe('AccountPage card light theme', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.classList.remove('dark')
    removeInjectedAssets()
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('prefers-reduced-motion'),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
  })

  afterEach(() => {
    removeInjectedAssets()
  })

  it('defines brighter card variables and an !important light patch in src/style.css', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/style.css'), 'utf8')
    expect(css).toContain(`--bg-card: ${LIGHT_BG_CARD}`)
    expect(css).toContain(`--border-card: ${LIGHT_BORDER_CARD}`)
    const patchSelector = '[data-theme="light"] .card'
    const patchStart = css.indexOf(patchSelector)
    expect(patchStart).toBeGreaterThanOrEqual(0)
    const patchRule = css.slice(patchStart, css.indexOf('}', patchStart))
    expect(patchRule).toContain('!important')
    expect(patchRule).toContain('var(--bg-card)')
    expect(patchRule).toContain('var(--border-card)')
    expect(css).not.toContain('prefers-color-scheme')
  })

  it('exposes brighter light card variables and keeps dark values untouched', () => {
    applyProjectTheme('light')
    const rootStyle = getComputedStyle(document.documentElement)
    expect(rootStyle.getPropertyValue('--bg-card').trim()).toBe(LIGHT_BG_CARD)
    expect(rootStyle.getPropertyValue('--border-card').trim()).toBe(LIGHT_BORDER_CARD)

    applyProjectTheme('dark')
    expect(getComputedStyle(document.documentElement).getPropertyValue('--bg-card').trim()).toBe('rgba(255, 255, 255, 0.01)')
    expect(getComputedStyle(document.documentElement).getPropertyValue('--border-card').trim()).toBe('rgba(255, 255, 255, 0.04)')
  })

  it('light patch overrides the scoped .card rule in the cascade', () => {
    // jsdom 的级联实现不处理 !important（按规则出现顺序覆盖），因此此处
    // 按"scoped 先出现、全局补丁后出现"注入，验证补丁能覆盖 scoped 规则、
    // 且深色下 scoped 原值保留；!important 的解析层保证见下一条用例。
    const styleEl = injectStyle('cascade-style', [
      `.card[data-v-cascade] {`,
      `  background-color: ${DARK_CARD_BG};`,
      `  border-color: ${DARK_CARD_BORDER};`,
      `}`,
      `[data-theme="light"] .card {`,
      `  background-color: ${LIGHT_BG_CARD} !important;`,
      `  border-color: ${LIGHT_BORDER_CARD} !important;`,
      `  box-shadow: 0 1px 2px rgba(23, 32, 43, 0.04) !important;`,
      `}`,
    ].join('\n'))
    const card = createCascadeCard()
    try {
      applyProjectTheme('light')
      const lightStyle = getComputedStyle(card)
      expect(lightStyle.backgroundColor).toBe('rgb(250, 251, 253)')
      expect(lightStyle.borderTopColor).toBe('rgb(183, 195, 209)')
      expect(lightStyle.boxShadow).not.toBe('none')

      applyProjectTheme('dark')
      const darkStyle = getComputedStyle(card)
      expect(darkStyle.backgroundColor).toBe(DARK_CARD_BG)
      expect(darkStyle.borderTopColor).toBe(DARK_CARD_BORDER)
    } finally {
      styleEl.remove()
      card.remove()
    }
  })

  it('parses the real style.css patch rule as !important', () => {
    // 解析层验证：真实 src/style.css 中的补丁规则必须被 CSS 解析器识别为 important，
    // 这是它在真实浏览器级联中压过 scoped 普通声明的保证（CSS 规范：!important 优先于所有普通声明）。
    const css = readFileSync(resolve(process.cwd(), 'src/style.css'), 'utf8')
    const patchStart = css.indexOf('[data-theme="light"] .card')
    const patchEnd = css.indexOf('}', patchStart) + 1
    expect(patchStart).toBeGreaterThanOrEqual(0)
    const styleEl = injectStyle('cascade-real', css.slice(patchStart, patchEnd))
    try {
      const sheet = styleEl.sheet as CSSStyleSheet
      let patchRule: { style: CSSStyleDeclaration } | undefined
      for (const rule of Array.from(sheet.cssRules)) {
        const candidate = rule as { selectorText?: string; style?: CSSStyleDeclaration }
        if (candidate.selectorText === '[data-theme="light"] .card' && candidate.style) {
          patchRule = { style: candidate.style }
          break
        }
      }
      expect(patchRule).toBeDefined()
      expect(patchRule?.style.getPropertyPriority('background-color')).toBe('important')
      expect(patchRule?.style.getPropertyPriority('border-color')).toBe('important')
      expect(patchRule?.style.getPropertyValue('background-color')).toBe('var(--bg-card)')
      expect(patchRule?.style.getPropertyValue('border-color')).toBe('var(--border-card)')
    } finally {
      styleEl.remove()
    }
  })

  it('without !important a later scoped rule wins — the patch must keep !important', () => {
    // 对照组：真实构建中组件 chunk CSS 晚于全局 CSS（scoped 规则后出现）。
    // 若补丁去掉 !important，同特异性下后出现的 scoped 规则会覆盖补丁，
    // 证明补丁依赖 !important 才能稳定压过 scoped。
    const styleEl = injectStyle('cascade-control', [
      `[data-theme="light"] .card {`,
      `  background-color: ${LIGHT_BG_CARD};`,
      `  border-color: ${LIGHT_BORDER_CARD};`,
      `}`,
      `.card[data-v-cascade] {`,
      `  background-color: ${DARK_CARD_BG};`,
      `  border-color: ${DARK_CARD_BORDER};`,
      `}`,
    ].join('\n'))
    const card = createCascadeCard()
    try {
      applyProjectTheme('light')
      const cs = getComputedStyle(card)
      expect(cs.backgroundColor).toBe(DARK_CARD_BG)
      expect(cs.borderTopColor).toBe(DARK_CARD_BORDER)
    } finally {
      styleEl.remove()
      card.remove()
    }
  })

  it('mounts the real AccountPage and renders at least 8 .card sections', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const authStore = useAuthStore()
    authStore.user = {
      id: 'u-test-1',
      username: 'tester',
      displayName: '测试用户',
      email: 'tester@example.com',
      emailVerifiedAt: Date.now(),
      role: 'user',
      status: 'active',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastLoginAt: Date.now(),
    }
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', name: 'landing', component: { template: '<div />' } }],
    })
    applyProjectTheme('light')

    const wrapper = mount(AccountPage, {
      global: { plugins: [pinia, router] },
    })
    await flushPromises()

    expect(wrapper.findAll('.card').length).toBeGreaterThanOrEqual(8)
    expect(getComputedStyle(document.documentElement).getPropertyValue('--bg-card').trim()).toBe(LIGHT_BG_CARD)
    wrapper.unmount()
  })
})
