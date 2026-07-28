<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ChevronLeft, ChevronRight, X } from 'lucide-vue-next'
import { useOnboardingStore } from '@/stores/onboarding'
import { matchesOnboardingRoute, type OnboardingStepDefinition } from '@/utils/onboardingSteps'

const MIN_HIGHLIGHT_SIZE = 48

const onboardingStore = useOnboardingStore()
const router = useRouter()
const route = useRoute()

const panelRef = ref<HTMLElement | null>(null)
const spotlightStyle = ref<Record<string, string>>({ display: 'none' })
const panelStyle = ref<Record<string, string>>({})
const anchorMissing = ref(false)
const informationalMode = ref(false)
const navigating = ref(false)
const stepReady = ref(false)
const loadingTitle = ref('正在加载…')

const step = computed(() => onboardingStore.currentStep)
const progressLabel = computed(() => `新手教程 ${onboardingStore.currentStepIndex + 1} / ${onboardingStore.totalSteps}`)
const displayTitle = computed(() => {
  if (!stepReady.value) return loadingTitle.value
  if (informationalMode.value && step.value.missingTitle) return step.value.missingTitle
  return step.value.title
})
const displayDescription = computed(() => {
  if (!stepReady.value) return '请稍候，正在定位讲解区域…'
  if (informationalMode.value && step.value.missingDescription) return step.value.missingDescription
  return step.value.description
})
const primaryLabel = computed(() => {
  if (!stepReady.value) return '请稍候…'
  return onboardingStore.isLastStep ? '开始学习' : '下一步'
})

let resizeObserver: ResizeObserver | null = null
let repositionTimer: ReturnType<typeof setTimeout> | null = null
let prepareToken = 0

function queryAnchor(id: string | undefined): HTMLElement | null {
  if (!id) return null
  return document.querySelector(`[data-tour-id="${id}"]`)
}

function resolveAnchorElement(currentStep: OnboardingStepDefinition): HTMLElement | null {
  const primary = queryAnchor(currentStep.anchorId)
  if (primary) return primary
  if (currentStep.skipIfAnchorMissing) return null
  return queryAnchor(currentStep.fallbackAnchorId)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function focusPanel() {
  void nextTick(() => {
    panelRef.value?.focus({ preventScroll: true })
  })
}

function centerPanel() {
  const viewportWidth = window.innerWidth
  const isMobile = viewportWidth <= 640
  const panelWidth = isMobile ? viewportWidth - 24 : Math.min(420, viewportWidth - 24)

  panelStyle.value = isMobile
    ? {
      left: '12px',
      right: '12px',
      width: 'auto',
      transform: 'none',
      top: 'auto',
      bottom: '12px',
    }
    : {
      top: '50%',
      left: '50%',
      width: `${panelWidth}px`,
      transform: 'translate(-50%, -50%)',
    }
}

function enterLoadingState(message: string) {
  stepReady.value = false
  navigating.value = true
  informationalMode.value = false
  anchorMissing.value = false
  loadingTitle.value = message
  spotlightStyle.value = { display: 'none' }
  centerPanel()
}

function updateLayout() {
  if (!onboardingStore.isRunning || !stepReady.value) return

  const currentStep = step.value
  const anchor = informationalMode.value ? null : resolveAnchorElement(currentStep)
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const isMobile = viewportWidth <= 640
  const panelWidth = isMobile ? viewportWidth - 24 : Math.min(420, viewportWidth - 24)
  const panelHeight = panelRef.value?.offsetHeight ?? 220

  if (!anchor) {
    spotlightStyle.value = { display: 'none' }
    centerPanel()
    return
  }

  const rect = anchor.getBoundingClientRect()
  const padding = 8
  const highlightTop = clamp(rect.top - padding, 8, viewportHeight - 8)
  const highlightLeft = clamp(rect.left - padding, 8, viewportWidth - 8)
  const maxWidth = Math.max(MIN_HIGHLIGHT_SIZE, viewportWidth - highlightLeft - 8)
  const maxHeight = Math.max(MIN_HIGHLIGHT_SIZE, viewportHeight - highlightTop - 8)
  const highlightWidth = clamp(rect.width + padding * 2, MIN_HIGHLIGHT_SIZE, maxWidth)
  const highlightHeight = clamp(rect.height + padding * 2, MIN_HIGHLIGHT_SIZE, maxHeight)

  spotlightStyle.value = {
    display: 'block',
    top: `${highlightTop}px`,
    left: `${highlightLeft}px`,
    width: `${highlightWidth}px`,
    height: `${highlightHeight}px`,
  }

  if (isMobile) {
    panelStyle.value = {
      left: '12px',
      right: '12px',
      width: 'auto',
      transform: 'none',
      top: 'auto',
      bottom: '12px',
    }
    return
  }

  const belowTop = rect.bottom + 16
  const aboveTop = rect.top - panelHeight - 16
  const placeBelow = belowTop + panelHeight <= viewportHeight - 12
  const top = placeBelow
    ? belowTop
    : clamp(aboveTop, 12, viewportHeight - panelHeight - 12)
  const left = clamp(rect.left, 12, viewportWidth - panelWidth - 12)

  panelStyle.value = {
    top: `${top}px`,
    left: `${left}px`,
    width: `${panelWidth}px`,
    transform: 'none',
  }
}

function scheduleLayout() {
  if (repositionTimer) clearTimeout(repositionTimer)
  repositionTimer = setTimeout(() => {
    void nextTick().then(updateLayout)
  }, 60)
}

async function waitForPrimaryAnchor(currentStep: OnboardingStepDefinition, maxMs = 2500): Promise<boolean> {
  const started = Date.now()
  while (Date.now() - started < maxMs) {
    if (queryAnchor(currentStep.anchorId)) return true
    await new Promise(resolve => setTimeout(resolve, 80))
  }
  return Boolean(queryAnchor(currentStep.anchorId))
}

async function prepareCurrentStep() {
  if (!onboardingStore.isRunning) return

  const token = ++prepareToken
  const currentStep = step.value
  const loadingMessage = currentStep.navigationMessage
    ?? (currentStep.autoNavigate ? '正在打开页面…' : '正在定位讲解区域…')

  enterLoadingState(loadingMessage)

  try {
    if (currentStep.autoNavigate && !matchesOnboardingRoute(currentStep.route, route.fullPath)) {
      await router.push(currentStep.route)
      if (token !== prepareToken) return
    }

    const primaryFound = await waitForPrimaryAnchor(currentStep)
    if (token !== prepareToken) return

    if (!primaryFound && currentStep.skipIfAnchorMissing) {
      informationalMode.value = true
      anchorMissing.value = false
      stepReady.value = true
      spotlightStyle.value = { display: 'none' }
      centerPanel()
      focusPanel()
      return
    }

    const anchor = resolveAnchorElement(currentStep)
    informationalMode.value = false
    anchorMissing.value = !anchor
    if (!primaryFound && anchor && anchor.dataset.tourId !== currentStep.anchorId) {
      anchorMissing.value = true
    }

    if (anchor) {
      anchor.scrollIntoView({ block: 'center', behavior: 'auto' })
      await nextTick()
      await new Promise(resolve => setTimeout(resolve, 80))
      if (token !== prepareToken) return
    }

    stepReady.value = true
    await nextTick()
    updateLayout()
    focusPanel()
  } catch {
    if (token !== prepareToken) return
    anchorMissing.value = true
    informationalMode.value = false
    stepReady.value = true
    spotlightStyle.value = { display: 'none' }
    centerPanel()
  } finally {
    if (token === prepareToken) {
      navigating.value = false
    }
  }
}

function handlePrevious() {
  if (navigating.value || !stepReady.value) return
  onboardingStore.previousStep()
}

function handleNext() {
  if (navigating.value || !stepReady.value) return
  if (onboardingStore.isLastStep) {
    void onboardingStore.completeTour()
    return
  }
  onboardingStore.nextStep()
}

function handleClose() {
  onboardingStore.closeTour()
}

function handleSkip() {
  void onboardingStore.skipTour()
}

function handleKeydown(event: KeyboardEvent) {
  if (!onboardingStore.isRunning || navigating.value || !stepReady.value) return
  if (event.key === 'Escape') {
    event.preventDefault()
    handleClose()
    return
  }
  if (event.key === 'ArrowRight' && !event.shiftKey) {
    event.preventDefault()
    handleNext()
    return
  }
  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    handlePrevious()
  }
}

watch(
  () => [onboardingStore.isRunning, onboardingStore.currentStepIndex, onboardingStore.tourMode, route.fullPath] as const,
  () => {
    if (!onboardingStore.isRunning) return
    void prepareCurrentStep()
  },
  { immediate: true },
)

watch(stepReady, (ready) => {
  if (ready && panelRef.value) {
    resizeObserver?.observe(panelRef.value)
  }
})

onMounted(() => {
  window.addEventListener('resize', scheduleLayout)
  window.addEventListener('scroll', scheduleLayout, true)
  window.addEventListener('keydown', handleKeydown)
  resizeObserver = new ResizeObserver(() => scheduleLayout())
})

onUnmounted(() => {
  window.removeEventListener('resize', scheduleLayout)
  window.removeEventListener('scroll', scheduleLayout, true)
  window.removeEventListener('keydown', handleKeydown)
  resizeObserver?.disconnect()
  if (repositionTimer) clearTimeout(repositionTimer)
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="onboardingStore.isRunning"
      class="onboarding-root"
      role="presentation"
    >
      <div class="onboarding-backdrop" />
      <div
        class="onboarding-spotlight"
        :class="{ 'onboarding-spotlight-hidden': !stepReady }"
        :style="spotlightStyle"
      />
      <section
        ref="panelRef"
        class="onboarding-panel"
        :class="{ 'onboarding-panel-loading': !stepReady }"
        :style="panelStyle"
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        :aria-labelledby="`onboarding-title-${step.id}`"
        :aria-busy="!stepReady"
      >
        <div class="onboarding-panel-header">
          <div>
            <div class="onboarding-kicker">{{ progressLabel }}</div>
            <h2 :id="`onboarding-title-${step.id}`" class="onboarding-title">{{ displayTitle }}</h2>
          </div>
          <button
            type="button"
            class="onboarding-icon-button"
            title="关闭新手教程"
            aria-label="关闭新手教程"
            :disabled="navigating && !stepReady"
            @click="handleClose"
          >
            <X class="w-4 h-4" />
          </button>
        </div>

        <p class="onboarding-description">{{ displayDescription }}</p>
        <p v-if="stepReady && anchorMissing && !informationalMode" class="onboarding-fallback-note">
          当前讲解区域暂时不可用，你可以继续下一步，或稍后在账号设置重新打开新手教程。
        </p>
        <p v-if="onboardingStore.syncWarning" class="onboarding-sync-warning">{{ onboardingStore.syncWarning }}</p>

        <div class="onboarding-footer">
          <div class="onboarding-actions">
            <button
              type="button"
              class="onboarding-secondary-button"
              :disabled="onboardingStore.isFirstStep || navigating || !stepReady"
              @click="handlePrevious"
            >
              <ChevronLeft class="w-4 h-4" />
              上一步
            </button>
            <button
              type="button"
              class="onboarding-primary-button"
              :disabled="navigating || !stepReady"
              @click="handleNext"
            >
              <span v-if="!stepReady" class="onboarding-loading-dot" aria-hidden="true" />
              {{ primaryLabel }}
              <ChevronRight v-if="stepReady && !onboardingStore.isLastStep" class="w-4 h-4" />
            </button>
          </div>
          <button
            type="button"
            class="onboarding-skip-link"
            :disabled="navigating && !stepReady"
            @click="handleSkip"
          >
            跳过新手教程
          </button>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.onboarding-root {
  position: fixed;
  inset: 0;
  z-index: 120;
  pointer-events: none;
}

.onboarding-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(2, 6, 23, 0.62);
  pointer-events: auto;
}

[data-theme="light"] .onboarding-backdrop {
  background: rgba(15, 23, 42, 0.28);
}

.onboarding-spotlight {
  position: fixed;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--accent-cyan) 55%, transparent);
  box-shadow:
    0 0 0 1px color-mix(in srgb, var(--accent-cyan) 25%, transparent),
    0 0 24px color-mix(in srgb, var(--accent-cyan) 18%, transparent);
  background: color-mix(in srgb, var(--accent-cyan) 8%, transparent);
  pointer-events: none;
  transition: top 0.2s ease, left 0.2s ease, width 0.2s ease, height 0.2s ease, opacity 0.15s ease;
}

.onboarding-spotlight-hidden {
  opacity: 0;
}

.onboarding-panel {
  position: fixed;
  pointer-events: auto;
  border-radius: 14px;
  border: 1px solid color-mix(in srgb, var(--accent-cyan) 22%, var(--border-subtle));
  background: color-mix(in srgb, var(--bg-primary) 92%, #000 8%);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
  padding: 18px;
  max-width: calc(100vw - 24px);
  outline: none;
}

.onboarding-panel-loading {
  text-align: center;
}

.onboarding-panel-loading .onboarding-panel-header {
  justify-content: center;
}

.onboarding-panel-loading .onboarding-icon-button {
  position: absolute;
  top: 18px;
  right: 18px;
}

.onboarding-panel-loading .onboarding-title {
  text-align: center;
}

[data-theme="light"] .onboarding-panel {
  background: color-mix(in srgb, var(--bg-primary) 96%, white 4%);
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.12);
}

.onboarding-panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
  position: relative;
}

.onboarding-kicker {
  font-size: 12px;
  color: var(--accent-cyan);
}

.onboarding-title {
  margin-top: 4px;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.onboarding-description {
  font-size: 14px;
  line-height: 1.7;
  color: var(--text-secondary);
}

.onboarding-fallback-note,
.onboarding-sync-warning {
  margin-top: 10px;
  font-size: 12px;
  line-height: 1.6;
}

.onboarding-fallback-note {
  color: var(--text-muted);
}

.onboarding-sync-warning {
  color: #f59e0b;
}

.onboarding-footer {
  margin-top: 16px;
  display: grid;
  gap: 10px;
}

.onboarding-actions {
  display: flex;
  gap: 8px;
}

.onboarding-primary-button,
.onboarding-secondary-button,
.onboarding-icon-button,
.onboarding-skip-link {
  border-radius: 8px;
  transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease;
}

.onboarding-primary-button,
.onboarding-secondary-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 38px;
  padding: 0 14px;
  font-size: 13px;
}

.onboarding-primary-button {
  flex: 1;
  border: 1px solid color-mix(in srgb, var(--accent-cyan) 45%, transparent);
  background: color-mix(in srgb, var(--accent-cyan) 14%, transparent);
  color: var(--text-primary);
}

.onboarding-primary-button:hover:not(:disabled) {
  background: color-mix(in srgb, var(--accent-cyan) 22%, transparent);
}

.onboarding-secondary-button {
  border: 1px solid var(--border-subtle);
  background: transparent;
  color: var(--text-secondary);
}

.onboarding-secondary-button:hover:not(:disabled) {
  background: color-mix(in srgb, var(--bg-elevated) 80%, transparent);
}

.onboarding-primary-button:disabled,
.onboarding-secondary-button:disabled,
.onboarding-skip-link:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.onboarding-icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid var(--border-subtle);
  background: transparent;
  color: var(--text-muted);
}

.onboarding-icon-button:hover:not(:disabled) {
  color: var(--text-primary);
  background: color-mix(in srgb, var(--bg-elevated) 80%, transparent);
}

.onboarding-skip-link {
  justify-self: center;
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-size: 12px;
  padding: 4px 8px;
}

.onboarding-skip-link:hover:not(:disabled) {
  color: var(--text-secondary);
}

.onboarding-loading-dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: currentColor;
  animation: onboarding-pulse 1s ease-in-out infinite;
}

@keyframes onboarding-pulse {
  0%, 100% { opacity: 0.35; }
  50% { opacity: 1; }
}

@media (max-width: 640px) {
  .onboarding-panel {
    left: 12px !important;
    right: 12px;
    width: auto !important;
    transform: none !important;
    top: auto !important;
    bottom: 12px;
    max-height: min(52vh, 420px);
    overflow-y: auto;
  }

  .onboarding-actions {
    flex-direction: column;
  }
}

@media (prefers-reduced-motion: reduce) {
  .onboarding-spotlight {
    transition: none;
  }

  .onboarding-loading-dot {
    animation: none;
    opacity: 0.8;
  }
}
</style>
