import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import {
  fetchOnboardingState,
  updateOnboardingState,
  type OnboardingState,
} from '@/utils/onboardingApi'
import {
  getOnboardingStep,
  getOnboardingStepIndex,
  onboardingSteps,
  shouldAutoStartOnboarding,
  type OnboardingStatus,
} from '@/utils/onboardingSteps'
import {
  readOnboardingCache,
  writeOnboardingCache,
  clearOnboardingCache,
} from '@/utils/onboardingStorage'

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error'

function toCacheRecord(state: OnboardingState) {
  return {
    status: state.status,
    version: state.version,
    stepId: state.stepId,
    updatedAt: state.updatedAt ?? Date.now(),
  }
}

export const useOnboardingStore = defineStore('onboarding', () => {
  const authStore = useAuthStore()

  const loadStatus = ref<LoadStatus>('idle')
  const status = ref<OnboardingStatus>('completed')
  const version = ref(1)
  const stepId = ref<string | null>(null)
  const updatedAt = ref<number | null>(null)
  const tourVersion = ref(1)
  const isRunning = ref(false)
  const isManualReplay = ref(false)
  const currentStepIndex = ref(0)
  const errorMessage = ref('')
  const syncWarning = ref('')

  let initializePromise: Promise<void> | null = null
  let stepPersistTimer: ReturnType<typeof setTimeout> | null = null

  const shouldAutoStart = computed(() => shouldAutoStartOnboarding({
    status: status.value,
    version: version.value,
    isAuthenticated: authStore.isAuthenticated,
  }))

  const blocksAnnouncements = computed(() => {
    if (isRunning.value) return true
    return status.value === 'pending' && version.value < tourVersion.value
  })

  const shouldDeferLastRouteRestore = computed(() => {
    return authStore.isAuthenticated && status.value === 'pending' && version.value < tourVersion.value
  })

  const currentStep = computed(() => onboardingSteps[currentStepIndex.value] ?? onboardingSteps[0])
  const totalSteps = computed(() => onboardingSteps.length)
  const isFirstStep = computed(() => currentStepIndex.value <= 0)
  const isLastStep = computed(() => currentStepIndex.value >= onboardingSteps.length - 1)

  function applyState(next: OnboardingState) {
    status.value = next.status
    version.value = next.version
    stepId.value = next.stepId
    updatedAt.value = next.updatedAt
    tourVersion.value = next.tourVersion
    if (authStore.user) {
      writeOnboardingCache(authStore.user.id, toCacheRecord(next))
    }
  }

  function resetForLogout() {
    loadStatus.value = 'idle'
    status.value = 'completed'
    version.value = 1
    stepId.value = null
    updatedAt.value = null
    tourVersion.value = 1
    isRunning.value = false
    isManualReplay.value = false
    currentStepIndex.value = 0
    errorMessage.value = ''
    syncWarning.value = ''
    initializePromise = null
    if (stepPersistTimer) {
      clearTimeout(stepPersistTimer)
      stepPersistTimer = null
    }
  }

  async function syncToServer(patch: Parameters<typeof updateOnboardingState>[0]) {
    try {
      const next = await updateOnboardingState(patch)
      applyState(next)
      syncWarning.value = ''
      return next
    } catch (error: unknown) {
      syncWarning.value = error instanceof Error ? error.message : '引导状态同步失败。'
      return null
    }
  }

  function scheduleStepPersist(nextStepId: string) {
    stepId.value = nextStepId
    if (authStore.user) {
      writeOnboardingCache(authStore.user.id, {
        status: status.value,
        version: version.value,
        stepId: nextStepId,
        updatedAt: Date.now(),
      })
    }
    if (stepPersistTimer) clearTimeout(stepPersistTimer)
    stepPersistTimer = setTimeout(() => {
      void syncToServer({ stepId: nextStepId })
    }, 400)
  }

  async function initialize() {
    if (!authStore.isAuthenticated || !authStore.user) {
      resetForLogout()
      return
    }
    if (initializePromise) return initializePromise

    loadStatus.value = 'loading'
    initializePromise = (async () => {
      const cached = readOnboardingCache(authStore.user!.id)
      if (cached) {
        status.value = cached.status
        version.value = cached.version
        stepId.value = cached.stepId
        updatedAt.value = cached.updatedAt
      }

      try {
        const remote = await fetchOnboardingState()
        applyState(remote)
        loadStatus.value = 'ready'
      } catch (error: unknown) {
        if (cached) {
          loadStatus.value = 'ready'
          syncWarning.value = error instanceof Error ? error.message : '引导状态加载失败，已使用本地缓存。'
        } else {
          loadStatus.value = 'error'
          errorMessage.value = error instanceof Error ? error.message : '引导状态加载失败。'
        }
      }
    })()

    try {
      await initializePromise
    } finally {
      initializePromise = null
    }
  }

  function beginTour(manual: boolean, resumeStepId: string | null = stepId.value) {
    isManualReplay.value = manual
    isRunning.value = true
    currentStepIndex.value = getOnboardingStepIndex(resumeStepId)
    scheduleStepPersist(getOnboardingStep(resumeStepId).id)
  }

  function tryAutoStart(routeName?: string | symbol | null) {
    if (loadStatus.value !== 'ready' || isRunning.value) return false
    if (!shouldAutoStartOnboarding({
      status: status.value,
      version: version.value,
      isAuthenticated: authStore.isAuthenticated,
      routeName,
    })) {
      return false
    }
    beginTour(false, stepId.value)
    return true
  }

  function startManualTour() {
    beginTour(true, onboardingSteps[0]?.id ?? null)
  }

  function goToStep(index: number) {
    const bounded = Math.max(0, Math.min(index, onboardingSteps.length - 1))
    currentStepIndex.value = bounded
    scheduleStepPersist(onboardingSteps[bounded].id)
  }

  function nextStep() {
    if (isLastStep.value) {
      void completeTour()
      return
    }
    goToStep(currentStepIndex.value + 1)
  }

  function previousStep() {
    goToStep(currentStepIndex.value - 1)
  }

  async function skipTour() {
    const next: OnboardingState = {
      status: 'skipped',
      version: tourVersion.value,
      stepId: null,
      updatedAt: Date.now(),
      tourVersion: tourVersion.value,
    }
    applyState(next)
    isRunning.value = false
    isManualReplay.value = false
    await syncToServer({ status: 'skipped', version: tourVersion.value, stepId: null })
  }

  async function completeTour() {
    const next: OnboardingState = {
      status: 'completed',
      version: tourVersion.value,
      stepId: null,
      updatedAt: Date.now(),
      tourVersion: tourVersion.value,
    }
    applyState(next)
    isRunning.value = false
    isManualReplay.value = false
    await syncToServer({ status: 'completed', version: tourVersion.value, stepId: null })
  }

  function clearLocalCacheForCurrentUser() {
    if (authStore.user) {
      clearOnboardingCache(authStore.user.id)
    }
  }

  return {
    loadStatus,
    status,
    version,
    stepId,
    updatedAt,
    tourVersion,
    isRunning,
    isManualReplay,
    currentStepIndex,
    currentStep,
    totalSteps,
    isFirstStep,
    isLastStep,
    errorMessage,
    syncWarning,
    shouldAutoStart,
    blocksAnnouncements,
    shouldDeferLastRouteRestore,
    initialize,
    resetForLogout,
    tryAutoStart,
    startManualTour,
    nextStep,
    previousStep,
    skipTour,
    completeTour,
    goToStep,
    clearLocalCacheForCurrentUser,
  }
})
