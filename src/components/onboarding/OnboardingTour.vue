<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ChevronLeft, ChevronRight, X } from 'lucide-vue-next'
import { useOnboardingStore } from '@/stores/onboarding'

const onboardingStore = useOnboardingStore()
const router = useRouter()
const route = useRoute()

const panelRef = ref<HTMLElement | null>(null)
const spotlightStyle = ref<Record<string, string>>({})
const panelStyle = ref<Record<string, string>>({})
const anchorMissing = ref(false)
const navigating = ref(false)

const step = computed(() => onboardingStore.currentStep)
const progressLabel = computed(() => `${onboardingStore.currentStepIndex + 1} / ${onboardingStore.totalSteps}`)
const primaryLabel = computed(() => (
  onboardingStore.isLastStep ? '开始学习' : '下一步'
))

let resizeObserver: ResizeObserver | null = null
let repositionTimer: ReturnType<typeof setTimeout> | null = null
let anchorWaitTimer: ReturnType<typeof setTimeout> | null = null

function queryAnchor(id: string | undefined): HTMLElement | null {
  if (!id) return null
  return document.querySelector(`[data-tour-id="${id}"]`)
}

function resolveAnchorElement() {
  const primary = queryAnchor(step.value.anchorId)
  if (primary) return primary
  const fallback = queryAnchor(step.value.fallbackAnchorId)
  return fallback
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function updateLayout() {
  if (!onboardingStore.isRunning) return

  const anchor = resolveAnchorElement()
  anchorMissing.value = !anchor
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const panelWidth = Math.min(420, viewportWidth - 24)
  const panelHeight = panelRef.value?.offsetHeight ?? 220

  if (!anchor) {
    spotlightStyle.value = { display: 'none' }
    panelStyle.value = {
      top: '50%',
      left: '50%',
      width: `${panelWidth}px`,
      transform: 'translate(-50%, -50%)',
    }
    return
  }

  const rect = anchor.getBoundingClientRect()
  const padding = 8
  const highlightTop = clamp(rect.top - padding, 8, viewportHeight - 8)
  const highlightLeft = clamp(rect.left - padding, 8, viewportWidth - 8)
  const highlightWidth = clamp(rect.width + padding * 2, 24, viewportWidth - highlightLeft - 8)
  const highlightHeight = clamp(rect.height + padding * 2, 24, viewportHeight - highlightTop - 8)

  spotlightStyle.value = {
    display: 'block',
    top: `${highlightTop}px`,
    left: `${highlightLeft}px`,
    width: `${highlightWidth}px`,
    height: `${highlightHeight}px`,
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

async function waitForAnchor(maxMs = 2000): Promise<boolean> {
  const started = Date.now()
  while (Date.now() - started < maxMs) {
    if (resolveAnchorElement()) return true
    await new Promise(resolve => setTimeout(resolve, 80))
  }
  return Boolean(resolveAnchorElement())
}

async function ensureStepRoute() {
  if (!onboardingStore.isRunning || !step.value.autoNavigate) {
    scheduleLayout()
    return
  }
  if (route.fullPath === step.value.route || route.path === step.value.route) {
    await waitForAnchor()
    scheduleLayout()
    return
  }

  navigating.value = true
  try {
    await router.push(step.value.route)
    await waitForAnchor()
  } catch {
    anchorMissing.value = true
  } finally {
    navigating.value = false
    scheduleLayout()
  }
}

function handlePrevious() {
  onboardingStore.previousStep()
}

function handleNext() {
  onboardingStore.nextStep()
}

async function handleSkip() {
  await onboardingStore.skipTour()
}

function handleKeydown(event: KeyboardEvent) {
  if (!onboardingStore.isRunning) return
  if (event.key === 'Escape') {
    event.preventDefault()
    void handleSkip()
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
  () => [onboardingStore.isRunning, onboardingStore.currentStepIndex, route.fullPath] as const,
  () => {
    if (!onboardingStore.isRunning) return
    void ensureStepRoute()
  },
  { immediate: true },
)

onMounted(() => {
  window.addEventListener('resize', scheduleLayout)
  window.addEventListener('scroll', scheduleLayout, true)
  window.addEventListener('keydown', handleKeydown)
  resizeObserver = new ResizeObserver(() => scheduleLayout())
  if (panelRef.value) resizeObserver.observe(panelRef.value)
  scheduleLayout()
})

onUnmounted(() => {
  window.removeEventListener('resize', scheduleLayout)
  window.removeEventListener('scroll', scheduleLayout, true)
  window.removeEventListener('keydown', handleKeydown)
  resizeObserver?.disconnect()
  if (repositionTimer) clearTimeout(repositionTimer)
  if (anchorWaitTimer) clearTimeout(anchorWaitTimer)
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
      <div class="onboarding-spotlight" :style="spotlightStyle" />
      <section
        ref="panelRef"
        class="onboarding-panel"
        :style="panelStyle"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="`onboarding-title-${step.id}`"
      >
        <div class="onboarding-panel-header">
          <div>
            <div class="onboarding-kicker">TOUR // {{ String(onboardingStore.currentStepIndex + 1).padStart(2, '0') }}</div>
            <h2 :id="`onboarding-title-${step.id}`" class="onboarding-title">{{ step.title }}</h2>
          </div>
          <button
            type="button"
            class="onboarding-icon-button"
            title="跳过导览"
            aria-label="跳过导览"
            @click="handleSkip"
          >
            <X class="w-4 h-4" />
          </button>
        </div>

        <p class="onboarding-description">{{ step.description }}</p>
        <p v-if="anchorMissing" class="onboarding-fallback-note">
          当前页面入口暂时不可用，你可以继续下一步，或稍后在账号设置重新打开导览。
        </p>
        <p v-if="onboardingStore.syncWarning" class="onboarding-sync-warning">{{ onboardingStore.syncWarning }}</p>

        <div class="onboarding-footer">
          <div class="onboarding-progress" aria-live="polite">
            <span class="onboarding-progress-label">进度</span>
            <span class="onboarding-progress-value">{{ progressLabel }}</span>
          </div>
          <div class="onboarding-actions">
            <button
              type="button"
              class="onboarding-secondary-button"
              :disabled="onboardingStore.isFirstStep || navigating"
              @click="handlePrevious"
            >
              <ChevronLeft class="w-4 h-4" />
              上一步
            </button>
            <button
              type="button"
              class="onboarding-primary-button"
              :disabled="navigating"
              @click="handleNext"
            >
              {{ primaryLabel }}
              <ChevronRight v-if="!onboardingStore.isLastStep" class="w-4 h-4" />
            </button>
          </div>
          <button type="button" class="onboarding-skip-link" @click="handleSkip">
            跳过导览
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
  transition: top 0.2s ease, left 0.2s ease, width 0.2s ease, height 0.2s ease;
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
}

.onboarding-kicker {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  letter-spacing: 0.08em;
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

.onboarding-progress {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: var(--text-muted);
}

.onboarding-progress-value {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  color: var(--accent-cyan);
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
.onboarding-secondary-button:disabled {
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

.onboarding-icon-button:hover {
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

.onboarding-skip-link:hover {
  color: var(--text-secondary);
}

@media (max-width: 640px) {
  .onboarding-panel {
    left: 12px !important;
    right: 12px;
    width: auto !important;
    transform: none !important;
    top: auto !important;
    bottom: 12px;
  }

  .onboarding-actions {
    flex-direction: column;
  }
}

@media (prefers-reduced-motion: reduce) {
  .onboarding-spotlight {
    transition: none;
  }
}
</style>
