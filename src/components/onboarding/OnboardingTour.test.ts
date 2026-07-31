// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { computed, reactive } from 'vue'
import {
  getOnboardingStepsForMode,
  resolveOnboardingStepRoute,
} from '@/utils/onboardingSteps'
import OnboardingTour from './OnboardingTour.vue'

const fullSteps = getOnboardingStepsForMode('full')

// ---------- mock 依赖 ----------

const onboardingMock = reactive({
  isRunning: true,
  currentStepIndex: 0,
  tourMode: 'full' as const,
  totalSteps: fullSteps.length,
  syncWarning: '',
  nextStep: vi.fn(),
  previousStep: vi.fn(),
  completeTour: vi.fn(),
  skipTour: vi.fn(),
  closeTour: vi.fn(),
  currentStep: computed(() => fullSteps[onboardingMock.currentStepIndex] ?? fullSteps[0]),
  isLastStep: computed(() => onboardingMock.currentStepIndex >= fullSteps.length - 1),
  isFirstStep: computed(() => onboardingMock.currentStepIndex === 0),
})

vi.mock('@/stores/onboarding', () => ({
  useOnboardingStore: () => onboardingMock,
}))

const routeStub = reactive({ fullPath: '/' })
const pushMock = vi.fn()
vi.mock('vue-router', () => ({
  useRoute: () => routeStub,
  useRouter: () => ({ push: pushMock, replace: pushMock }),
}))

// ---------- 工具 ----------

const ANCHOR_IDS = fullSteps.map(step => step.anchorId)

function createAnchor(id: string): HTMLElement {
  const el = document.createElement('div')
  el.setAttribute('data-tour-id', id)
  document.body.appendChild(el)
  return el
}

function createAllAnchors(): HTMLElement[] {
  return ANCHOR_IDS.map(createAnchor)
}

function removeAllAnchors() {
  document.querySelectorAll('[data-tour-id]').forEach(el => el.remove())
}

function setViewport(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height })
  window.dispatchEvent(new Event('resize'))
}

function setAnchorRect(el: HTMLElement, rect: Partial<DOMRect>) {
  Object.defineProperty(el, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      top: 0, bottom: 40, left: 0, right: 200, width: 200, height: 40, x: 0, y: 0,
      toJSON: () => ({}),
      ...rect,
    }),
  })
}

async function advanceToStepReady(wrapper: VueWrapper, virtualMs = 200) {
  await vi.advanceTimersByTimeAsync(virtualMs)
  await flushPromises()
}

// Teleport 到 body：真实面板在 document.body 中，不在 wrapper 内
function panelElement(): HTMLElement | null {
  return document.body.querySelector('.onboarding-panel')
}

function panelStyleOf(): Record<string, string> {
  const panel = panelElement()
  if (!panel) return {}
  const result: Record<string, string> = {}
  for (const key of ['top', 'left', 'bottom', 'right', 'width']) {
    const value = panel.style.getPropertyValue(key).trim()
    if (value) result[key] = value
  }
  return result
}

function readPanelTop(style: Record<string, string>): number | null {
  if (!('top' in style) || !style.top) return null
  const parsed = Number.parseFloat(style.top)
  return Number.isFinite(parsed) ? parsed : null
}

// 桌面布局下面板必须有明确 width，right = left + width 必须落在视口内
function expectPanelRightWithinViewport(style: Record<string, string>, viewportWidth: number) {
  const left = style.left ? Number.parseFloat(style.left) : Number.NaN
  const width = style.width ? Number.parseFloat(style.width) : Number.NaN
  expect(Number.isFinite(left)).toBe(true)
  expect(Number.isFinite(width)).toBe(true)
  expect(left + width, `panel right = ${left + width} 超出视口 ${viewportWidth}`).toBeLessThanOrEqual(viewportWidth)
  expect(left).toBeGreaterThanOrEqual(0)
}

// ---------- 测试 ----------

describe('OnboardingTour positioning and step availability', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    onboardingMock.currentStepIndex = 0
    onboardingMock.syncWarning = ''
    routeStub.fullPath = '/'
    setViewport(1440, 1000)
    removeAllAnchors()
    // jsdom 缺少 ResizeObserver，组件 onMounted 需要
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      unobserve() {}
      disconnect() {}
    })
    // jsdom 的 scrollIntoView 是 no-op；记录调用以便断言滚动行为
    Element.prototype.scrollIntoView = vi.fn()
  })

  afterEach(() => {
    vi.useRealTimers()
    removeAllAnchors()
  })

  it('clamps the panel inside the viewport when the anchor sits far above it (step 7 case, y=-6450)', async () => {
    const anchor = createAnchor('course-mark-complete')
    setAnchorRect(anchor, { top: -6466, bottom: -6400, left: 120, width: 200, height: 40 })
    onboardingMock.currentStepIndex = 6 // 第 7 步 course-complete
    routeStub.fullPath = resolveOnboardingStepRoute(fullSteps[6], 'full')

    const wrapper = mount(OnboardingTour)
    await advanceToStepReady(wrapper)

    expect(panelElement()).not.toBeNull()
    const style = panelStyleOf()
    const top = readPanelTop(style)
    expect(top).not.toBeNull()
    expect(top as number).toBeGreaterThanOrEqual(12)
    expect(top as number).toBeLessThanOrEqual(window.innerHeight)
    // 锚点在视口上方时面板不产生负数坐标
    expect(top as number).toBeGreaterThan(0)
    wrapper.unmount()
  })

  it('uses the fallback anchor without showing "当前讲解区域暂时不可用" when the primary anchor is missing', async () => {
    createAnchor('nav-quiz') // fallback 存在，主锚点 quiz-categories 缺失
    onboardingMock.currentStepIndex = 8 // 第 9 步 quiz-categories
    routeStub.fullPath = resolveOnboardingStepRoute(fullSteps[8], 'full')

    const wrapper = mount(OnboardingTour)
    await advanceToStepReady(wrapper, 3000) // 主锚点缺失，需要完整等待窗口

    expect(panelElement()).not.toBeNull()
    expect(panelElement()?.querySelector('.onboarding-fallback-note')).toBeNull()
    expect(panelElement()?.textContent).not.toContain('当前讲解区域暂时不可用')
    wrapper.unmount()
  })

  it('shows "当前讲解区域暂时不可用" only when both primary and fallback anchors are missing', async () => {
    // 不创建任何锚点
    onboardingMock.currentStepIndex = 8
    routeStub.fullPath = resolveOnboardingStepRoute(fullSteps[8], 'full')

    const wrapper = mount(OnboardingTour)
    await advanceToStepReady(wrapper, 3000)

    expect(panelElement()).not.toBeNull()
    expect(panelElement()?.querySelector('.onboarding-fallback-note')).not.toBeNull()
    expect(panelElement()?.textContent).toContain('当前讲解区域暂时不可用')
    wrapper.unmount()
  })

  it('walks all 19 steps with every panel inside the viewport (desktop 1440x1000)', async () => {
    createAllAnchors()
    const wrapper = mount(OnboardingTour)

    for (let index = 0; index < fullSteps.length; index += 1) {
      onboardingMock.currentStepIndex = index
      routeStub.fullPath = resolveOnboardingStepRoute(fullSteps[index], 'full')
      await advanceToStepReady(wrapper)

      expect(panelElement(), `第 ${index + 1} 步面板缺失`).not.toBeNull()
      const style = panelStyleOf()
      const top = readPanelTop(style)
      if (top !== null) {
        expect(top, `第 ${index + 1} 步 top=${top}`).toBeGreaterThanOrEqual(0)
        expect(top, `第 ${index + 1} 步 top=${top}`).toBeLessThanOrEqual(window.innerHeight)
      }
      const left = style.left ? Number.parseFloat(style.left) : 0
      expect(Number.isFinite(left)).toBe(true)
      expect(left).toBeGreaterThanOrEqual(0)
      expect(left).toBeLessThanOrEqual(window.innerWidth)
      // right 边界：left + width 不得超出视口
      expectPanelRightWithinViewport(style, window.innerWidth)
      // bottom 边界：top 不得超出视口高度
      if (top !== null) {
        expect(top).toBeLessThanOrEqual(window.innerHeight)
      }
      // 最后一步不得出现"讲解区域不可用"
      if (index === fullSteps.length - 1) {
        expect(panelElement()?.querySelector('.onboarding-fallback-note')).toBeNull()
        expect(panelElement()?.textContent).toContain('开始学习')
      }
    }
    wrapper.unmount()
  })

  it('keeps the panel in view at mobile 390x844 and tablet 768x1024 widths', async () => {
    createAllAnchors()

    for (const [width, height] of [[390, 844], [768, 1024]] as const) {
      setViewport(width, height)
      onboardingMock.currentStepIndex = 0
      routeStub.fullPath = resolveOnboardingStepRoute(fullSteps[0], 'full')

      const wrapper = mount(OnboardingTour)
      await advanceToStepReady(wrapper)

      expect(panelElement(), `视口 ${width}x${height} 面板缺失`).not.toBeNull()
      const style = panelStyleOf()
      if (width <= 640) {
        // 移动端底部条布局：bottom/right 均为 12px，面板贴底且在视口内
        expect(style.bottom).toBe('12px')
        expect(style.right).toBe('12px')
        expect(panelElement()?.getBoundingClientRect().bottom).toBeLessThanOrEqual(height)
      } else {
        const top = readPanelTop(style)
        expect(top as number).toBeGreaterThanOrEqual(0)
        expect(top as number).toBeLessThanOrEqual(height)
        expectPanelRightWithinViewport(style, width)
      }
      wrapper.unmount()
    }
  })
})
