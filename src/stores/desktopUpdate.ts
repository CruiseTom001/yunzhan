import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { useOnboardingStore } from '@/stores/onboarding'
import { canQuitAppForUpdate } from '@/utils/appQuitGuard'
import { isAllowedDesktopDownloadUrl } from '@/utils/desktopDownloadUrl'
import {
  canClickDownloadButton,
  canClickInstallButton,
  isUpdaterBusy,
  parseDesktopUpdaterPublicState,
} from '@/utils/desktopUpdaterState'
import {
  decideUpdateNotice,
  DESKTOP_UPDATE_CHECK_INTERVAL_MS,
  DESKTOP_UPDATE_SNOOZE_MS,
  DESKTOP_UPDATE_STARTUP_DELAY_MS,
  InvalidDesktopUpdateInfoError,
  resolveDesktopUpdateCheckError,
  safeLocalVersion,
  shouldShowOptionalAutoNotice,
  shouldShowRequiredAutoNotice,
  snoozeOptionalNotice,
  type UpdateNotice,
} from '@/utils/desktopUpdateCheck'
import { computeNextPeriodicCheckDelay } from '@/utils/desktopUpdateSchedule'
import {
  applyVersionSyncErrorState,
  isVersionSyncError,
  reconcileDesktopUpdateSources,
} from '@/utils/desktopUpdateVersionSync'
import { canCloseUpdateDialog } from '@/utils/desktopUpdateDialogBehavior'
import {
  VERSION_SYNC_ERROR_MESSAGE,
  type DesktopUpdaterPublicState,
  type DesktopUpdaterStatus,
} from '@/utils/desktopUpdaterTypes'
import { getDesktopLatestVersion } from '@/utils/desktopVersionApi'
import { isSemver } from '@/utils/semver'

export type DesktopUpdateSource = 'startup' | 'manual' | 'periodic' | 'visibility'

declare const __APP_VERSION__: string

function isDesktopRuntime(): boolean {
  return typeof window !== 'undefined' && Boolean(window.electronAPI)
}

function hasUpdaterApi(): boolean {
  return Boolean(
    window.electronAPI
    && typeof window.electronAPI.getUpdaterState === 'function'
    && typeof window.electronAPI.onDesktopUpdaterStateChanged === 'function',
  )
}

async function resolveLocalVersion(): Promise<string> {
  if (window.electronAPI) {
    try {
      const ipcVersion = await window.electronAPI.invoke<unknown>('app:getVersion')
      if (typeof ipcVersion === 'string' && isSemver(ipcVersion)) {
        return ipcVersion
      }
    } catch {
      // IPC 失败时使用受控兜底
    }
  }
  return safeLocalVersion(typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : undefined)
}

function createIdleUpdaterState(): DesktopUpdaterPublicState {
  return parseDesktopUpdaterPublicState({ status: 'idle' })
}

export const useDesktopUpdateStore = defineStore('desktopUpdate', () => {
  const onboardingStore = useOnboardingStore()

  const isDesktop = computed(() => isDesktopRuntime())
  const updaterState = ref<DesktopUpdaterPublicState>(createIdleUpdaterState())
  const localVersion = ref('')
  const remoteVersion = ref<string | null>(null)
  const minSupported = ref<string | null>(null)
  const releaseNotes = ref('')
  const noticeMode = ref<'optional' | 'required' | null>(null)
  const lastCheckedAt = ref<number | null>(null)
  const errorMessage = ref('')
  const dialogVisible = ref(false)
  const dialogPending = ref(false)
  const activeNotice = ref<UpdateNotice | null>(null)
  const actionInFlight = ref(false)

  let checkPromise: Promise<void> | null = null
  let startupTimer: ReturnType<typeof setTimeout> | null = null
  let nextCheckTimer: ReturnType<typeof setTimeout> | null = null
  let visibilityHandler: (() => void) | null = null
  let unsubscribeUpdater: (() => void) | null = null
  let initialized = false

  const status = computed<DesktopUpdaterStatus>(() => updaterState.value.status)

  const shouldRenderDialog = computed(() => (
    dialogVisible.value
    && dialogPending.value
    && !onboardingStore.blocksDesktopUpdateDialog
    && activeNotice.value !== null
    && (
      status.value === 'available'
      || status.value === 'downloading'
      || status.value === 'downloaded'
      || status.value === 'installing'
      || status.value === 'error'
    )
  ))

  const hasUpdate = computed(() => (
    status.value === 'available'
    || status.value === 'downloading'
    || status.value === 'downloaded'
    || status.value === 'installing'
  ))

  const isChecking = computed(() => status.value === 'checking' || actionInFlight.value)
  const canDownload = computed(() => (
    canClickDownloadButton(status.value, updaterState.value.errorCode)
    && !actionInFlight.value
    && !isVersionSyncError(updaterState.value)
  ))
  const canInstall = computed(() => (
    canClickInstallButton(status.value, updaterState.value.errorCode)
    && !actionInFlight.value
  ))
  const isBusy = computed(() => isUpdaterBusy(status.value) || actionInFlight.value)

  const displayErrorMessage = computed(() => {
    if (errorMessage.value) return errorMessage.value
    if (status.value === 'error') return updaterState.value.errorMessage ?? '更新失败，请稍后再试。'
    return ''
  })

  const accountStatusLabel = computed(() => {
    if (!isDesktop.value) return ''
    if (status.value === 'checking') return '正在检查更新…'
    if (status.value === 'downloading') return '正在下载更新…'
    if (status.value === 'downloaded') return '更新已准备好，可立即安装'
    if (status.value === 'installing') return '正在准备安装…'
    if (status.value === 'error') return displayErrorMessage.value || '检查更新失败'
    if (hasUpdate.value) {
      return noticeMode.value === 'required' ? '需要更新（低于最低兼容版本）' : '发现新版本'
    }
    if (status.value === 'upToDate') return '当前已是最新版本'
    return '尚未检查更新'
  })

  function applyUpdaterState(next: unknown): void {
    updaterState.value = parseDesktopUpdaterPublicState(next)
    if (updaterState.value.status === 'downloaded') {
      ensureDownloadedDialogVisible()
    }
  }

  function resetRemoteFields() {
    remoteVersion.value = null
    minSupported.value = null
    releaseNotes.value = ''
    noticeMode.value = null
    activeNotice.value = null
  }

  function applyNotice(notice: UpdateNotice) {
    errorMessage.value = ''
    remoteVersion.value = notice.remoteVersion
    minSupported.value = notice.minSupported
    releaseNotes.value = notice.releaseNotes
    noticeMode.value = notice.mode
    activeNotice.value = notice
  }

  function shouldThrottleAutomaticCheck(now: number, force: boolean): boolean {
    if (force) return false
    if (lastCheckedAt.value === null) return false
    return now - lastCheckedAt.value < DESKTOP_UPDATE_CHECK_INTERVAL_MS
  }

  function shouldOpenDialog(notice: UpdateNotice, source: DesktopUpdateSource, force: boolean, now: number): boolean {
    // Downloaded packages must always resurface; optional snooze must not hide install.
    if (status.value === 'downloaded') return true
    if (source === 'manual' || force) return true
    if (notice.mode === 'required') return shouldShowRequiredAutoNotice(notice, now)
    return shouldShowOptionalAutoNotice(notice, now)
  }

  function ensureDownloadedDialogVisible(): void {
    if (status.value !== 'downloaded') return
    if (activeNotice.value === null) return
    requestDialogDisplay()
  }

  function syncDialogVisibility(): void {
    const activeFlow = (
      status.value === 'available'
      || status.value === 'downloading'
      || status.value === 'downloaded'
      || status.value === 'installing'
      || status.value === 'error'
    )
    if (
      dialogPending.value
      && activeNotice.value !== null
      && activeFlow
      && !onboardingStore.blocksDesktopUpdateDialog
    ) {
      dialogVisible.value = true
      return
    }
    if (onboardingStore.blocksDesktopUpdateDialog) {
      dialogVisible.value = false
    }
  }

  function requestDialogDisplay(): void {
    dialogPending.value = true
    syncDialogVisibility()
  }

  function clearNextCheckTimer(): void {
    if (nextCheckTimer) {
      clearTimeout(nextCheckTimer)
      nextCheckTimer = null
    }
  }

  function scheduleNextPeriodicCheck(): void {
    clearNextCheckTimer()
    if (!initialized || !isDesktop.value) return

    const delay = computeNextPeriodicCheckDelay(lastCheckedAt.value, Date.now())
    nextCheckTimer = setTimeout(() => {
      void checkForUpdates({ source: 'periodic' })
    }, delay)
  }

  async function refreshUpdaterState(): Promise<void> {
    if (!hasUpdaterApi()) return
    const state = await window.electronAPI!.getUpdaterState()
    applyUpdaterState(state)
  }

  function validateVersionSync(notice: UpdateNotice, updaterVersion: string | null): boolean {
    if (!updaterVersion) return false
    return notice.remoteVersion === updaterVersion
  }

  function applyVersionSyncFailure(updaterStateSnapshot: DesktopUpdaterPublicState): void {
    resetRemoteFields()
    applyUpdaterState(applyVersionSyncErrorState(updaterStateSnapshot))
    errorMessage.value = VERSION_SYNC_ERROR_MESSAGE
    dialogPending.value = false
    dialogVisible.value = false
  }

  async function checkForUpdates(options: {
    source?: DesktopUpdateSource
    force?: boolean
  } = {}): Promise<void> {
    const source = options.source ?? 'startup'
    const force = options.force === true

    if (!isDesktop.value || !hasUpdaterApi()) return
    if (checkPromise) return checkPromise

    const now = Date.now()
    if (shouldThrottleAutomaticCheck(now, force)) return

    checkPromise = (async () => {
      errorMessage.value = ''
      actionInFlight.value = true

      try {
        if (!localVersion.value) {
          localVersion.value = await resolveLocalVersion()
        }

        const remote = await getDesktopLatestVersion()
        const notice = decideUpdateNotice(localVersion.value, remote)

        const previousStatus = status.value
        if (previousStatus !== 'downloaded' && previousStatus !== 'installing') {
          applyUpdaterState({ status: 'checking' })
        }
        const nextUpdaterState = await window.electronAPI!.checkForDesktopUpdate()
        applyUpdaterState(nextUpdaterState)
        lastCheckedAt.value = Date.now()

        if (notice && !isAllowedDesktopDownloadUrl(remote.downloadUrl)) {
          throw new InvalidDesktopUpdateInfoError()
        }

        const outcome = reconcileDesktopUpdateSources(notice, nextUpdaterState)

        if (outcome.kind === 'updater_error') {
          dialogPending.value = false
          dialogVisible.value = false
          return
        }

        if (outcome.kind === 'no_update') {
          resetRemoteFields()
          dialogPending.value = false
          dialogVisible.value = false
          return
        }

        if (outcome.kind === 'version_sync_error') {
          applyVersionSyncFailure(nextUpdaterState)
          return
        }

        applyNotice(outcome.notice)

        if (
          nextUpdaterState.status === 'downloaded'
          || shouldOpenDialog(outcome.notice, source, force, Date.now())
        ) {
          requestDialogDisplay()
        }
      } catch (error: unknown) {
        try {
          const latest = await window.electronAPI!.getUpdaterState()
          applyUpdaterState(latest)
        } catch {
          // Keep existing updater state when refresh fails.
        }

        if (updaterState.value.status === 'downloaded' && updaterState.value.version) {
          if (!activeNotice.value) {
            applyNotice({
              mode: 'optional',
              remoteVersion: updaterState.value.version,
              minSupported: localVersion.value || updaterState.value.version,
              downloadUrl: `https://github.com/CruiseTom001/yunzhan/releases/download/v${updaterState.value.version}/yunzhan-setup-${updaterState.value.version}.exe`,
              releaseNotes: releaseNotes.value || '',
            })
          }
          // Keep pending install across transient network failures; do not snooze.
          requestDialogDisplay()
          lastCheckedAt.value = Date.now()
          return
        }

        if (error instanceof InvalidDesktopUpdateInfoError) {
          errorMessage.value = resolveDesktopUpdateCheckError(error)
        } else {
          errorMessage.value = resolveDesktopUpdateCheckError(error)
        }
        applyUpdaterState({
          status: 'error',
          errorCode: 'check_failed',
          errorMessage: errorMessage.value,
        })
        lastCheckedAt.value = Date.now()
        dialogPending.value = false
        dialogVisible.value = false
      } finally {
        actionInFlight.value = false
        checkPromise = null
        syncDialogVisibility()
        scheduleNextPeriodicCheck()
      }
    })()

    return checkPromise
  }

  async function downloadUpdate(): Promise<void> {
    if (!hasUpdaterApi() || !canDownload.value || isVersionSyncError(updaterState.value)) return
    errorMessage.value = ''
    actionInFlight.value = true
    try {
      const next = await window.electronAPI!.downloadDesktopUpdate()
      applyUpdaterState(next)
      syncDialogVisibility()
    } finally {
      actionInFlight.value = false
    }
  }

  async function installUpdate(): Promise<void> {
    if (!hasUpdaterApi() || !canInstall.value) return

    const quitCheck = await canQuitAppForUpdate()
    if (quitCheck.ok === false) {
      errorMessage.value = quitCheck.message
      applyUpdaterState({
        ...updaterState.value,
        status: 'downloaded',
        errorCode: 'unsaved_changes',
        errorMessage: quitCheck.message,
      })
      return
    }

    errorMessage.value = ''
    actionInFlight.value = true
    try {
      const next = await window.electronAPI!.installDesktopUpdate()
      applyUpdaterState(next)
    } finally {
      actionInFlight.value = false
    }
  }

  function dismissNotice(): void {
    if (!canCloseUpdateDialog(noticeMode.value, status.value)) return
    if (activeNotice.value?.mode === 'optional') {
      snoozeOptionalNotice(activeNotice.value.remoteVersion, DESKTOP_UPDATE_SNOOZE_MS)
    }
    errorMessage.value = ''
    dialogPending.value = false
    dialogVisible.value = false
  }

  function resetError(): void {
    if (status.value !== 'error') return
    errorMessage.value = ''
    void refreshUpdaterState()
  }

  function closeDialog(): void {
    if (!canCloseUpdateDialog(noticeMode.value, status.value)) return
    errorMessage.value = ''
    dialogPending.value = false
    dialogVisible.value = false
  }

  function initialize(): void {
    if (initialized || !isDesktop.value || !hasUpdaterApi()) return
    initialized = true

    void resolveLocalVersion().then((version) => {
      localVersion.value = version
    })

    void refreshUpdaterState()

    unsubscribeUpdater = window.electronAPI!.onDesktopUpdaterStateChanged((state) => {
      applyUpdaterState(state)
      ensureDownloadedDialogVisible()
      syncDialogVisibility()
    })

    startupTimer = setTimeout(() => {
      void checkForUpdates({ source: 'startup' })
    }, DESKTOP_UPDATE_STARTUP_DELAY_MS)

    visibilityHandler = () => {
      if (document.visibilityState !== 'visible') return
      void checkForUpdates({ source: 'visibility' })
    }
    document.addEventListener('visibilitychange', visibilityHandler)
  }

  function dispose(): void {
    if (startupTimer) {
      clearTimeout(startupTimer)
      startupTimer = null
    }
    clearNextCheckTimer()
    if (visibilityHandler) {
      document.removeEventListener('visibilitychange', visibilityHandler)
      visibilityHandler = null
    }
    if (unsubscribeUpdater) {
      unsubscribeUpdater()
      unsubscribeUpdater = null
    }
    initialized = false
    checkPromise = null
    dialogPending.value = false
    dialogVisible.value = false
    actionInFlight.value = false
  }

  watch(
    () => onboardingStore.blocksDesktopUpdateDialog,
    (blocked) => {
      if (blocked) {
        dialogVisible.value = false
        return
      }
      syncDialogVisibility()
    },
  )

  watch(status, (nextStatus) => {
    if (nextStatus === 'downloaded') {
      ensureDownloadedDialogVisible()
    }
    syncDialogVisibility()
  })

  return {
    isDesktop,
    status,
    updaterState,
    localVersion,
    remoteVersion,
    minSupported,
    releaseNotes,
    noticeMode,
    lastCheckedAt,
    errorMessage,
    displayErrorMessage,
    dialogVisible,
    dialogPending,
    shouldRenderDialog,
    activeNotice,
    hasUpdate,
    isChecking,
    canDownload,
    canInstall,
    isBusy,
    accountStatusLabel,
    initialize,
    dispose,
    checkForUpdates,
    downloadUpdate,
    installUpdate,
    dismissNotice,
    resetError,
    closeDialog,
    shouldThrottleAutomaticCheck,
    shouldOpenDialog,
    syncDialogVisibility,
    scheduleNextPeriodicCheck,
    applyUpdaterState,
    validateVersionSync,
  }
})

export { resolveLocalVersion, isDesktopRuntime, hasUpdaterApi }
