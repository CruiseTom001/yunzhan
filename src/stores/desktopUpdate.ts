import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { useOnboardingStore } from '@/stores/onboarding'
import { isAllowedDesktopDownloadUrl, openAllowedDesktopDownloadUrl } from '@/utils/desktopDownloadUrl'
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
import { getDesktopLatestVersion } from '@/utils/desktopVersionApi'
import { isSemver } from '@/utils/semver'

export type DesktopUpdateStatus = 'idle' | 'checking' | 'upToDate' | 'updateAvailable' | 'error'
export type DesktopUpdateSource = 'startup' | 'manual' | 'periodic' | 'visibility'

declare const __APP_VERSION__: string

function isDesktopRuntime(): boolean {
  return typeof window !== 'undefined' && Boolean(window.electronAPI)
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

export const useDesktopUpdateStore = defineStore('desktopUpdate', () => {
  const onboardingStore = useOnboardingStore()

  const isDesktop = computed(() => isDesktopRuntime())
  const status = ref<DesktopUpdateStatus>('idle')
  const localVersion = ref('')
  const remoteVersion = ref<string | null>(null)
  const minSupported = ref<string | null>(null)
  const downloadUrl = ref<string | null>(null)
  const releaseNotes = ref('')
  const noticeMode = ref<'optional' | 'required' | null>(null)
  const lastCheckedAt = ref<number | null>(null)
  const errorMessage = ref('')
  const downloadErrorMessage = ref('')
  const dialogVisible = ref(false)
  const dialogPending = ref(false)
  const activeNotice = ref<UpdateNotice | null>(null)

  let checkPromise: Promise<void> | null = null
  let startupTimer: ReturnType<typeof setTimeout> | null = null
  let nextCheckTimer: ReturnType<typeof setTimeout> | null = null
  let visibilityHandler: (() => void) | null = null
  let initialized = false

  const shouldRenderDialog = computed(() => (
    dialogVisible.value
    && dialogPending.value
    && !onboardingStore.blocksDesktopUpdateDialog
    && activeNotice.value !== null
  ))

  const hasUpdate = computed(() => status.value === 'updateAvailable')
  const isChecking = computed(() => status.value === 'checking')
  const accountStatusLabel = computed(() => {
    if (!isDesktop.value) return ''
    if (status.value === 'checking') return '正在检查更新…'
    if (status.value === 'error') return errorMessage.value || '检查更新失败'
    if (status.value === 'updateAvailable') {
      return noticeMode.value === 'required' ? '需要更新（低于最低兼容版本）' : '发现新版本'
    }
    if (status.value === 'upToDate') return '当前已是最新版本'
    return '尚未检查更新'
  })

  function resetRemoteFields() {
    remoteVersion.value = null
    minSupported.value = null
    downloadUrl.value = null
    releaseNotes.value = ''
    noticeMode.value = null
    activeNotice.value = null
  }

  function applyNotice(notice: UpdateNotice) {
    downloadErrorMessage.value = ''
    status.value = 'updateAvailable'
    remoteVersion.value = notice.remoteVersion
    minSupported.value = notice.minSupported
    downloadUrl.value = notice.downloadUrl
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
    if (source === 'manual' || force) return true
    if (notice.mode === 'required') return shouldShowRequiredAutoNotice(notice, now)
    return shouldShowOptionalAutoNotice(notice, now)
  }

  function syncDialogVisibility(): void {
    if (
      dialogPending.value
      && status.value === 'updateAvailable'
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

  async function checkForUpdates(options: {
    source?: DesktopUpdateSource
    force?: boolean
  } = {}): Promise<void> {
    const source = options.source ?? 'startup'
    const force = options.force === true

    if (!isDesktop.value) return
    if (checkPromise) return checkPromise

    const now = Date.now()
    if (shouldThrottleAutomaticCheck(now, force)) return

    checkPromise = (async () => {
      status.value = 'checking'
      errorMessage.value = ''
      downloadErrorMessage.value = ''

      try {
        if (!localVersion.value) {
          localVersion.value = await resolveLocalVersion()
        }

        const remote = await getDesktopLatestVersion()
        lastCheckedAt.value = Date.now()

        const notice = decideUpdateNotice(localVersion.value, remote)
        if (!notice) {
          status.value = 'upToDate'
          resetRemoteFields()
          dialogPending.value = false
          dialogVisible.value = false
          return
        }

        if (!isAllowedDesktopDownloadUrl(notice.downloadUrl)) {
          throw new InvalidDesktopUpdateInfoError()
        }

        applyNotice(notice)

        if (shouldOpenDialog(notice, source, force, Date.now())) {
          requestDialogDisplay()
        }
      } catch (error: unknown) {
        status.value = 'error'
        errorMessage.value = resolveDesktopUpdateCheckError(error)
        lastCheckedAt.value = Date.now()
        dialogPending.value = false
        dialogVisible.value = false
      } finally {
        checkPromise = null
        scheduleNextPeriodicCheck()
      }
    })()

    return checkPromise
  }

  async function openDownload(): Promise<void> {
    downloadErrorMessage.value = ''

    if (!isDesktop.value) return

    const url = downloadUrl.value
    if (!url) {
      downloadErrorMessage.value = '版本信息格式无效，请稍后再试。'
      return
    }

    const result = await openAllowedDesktopDownloadUrl(url)
    if (result.ok === false) {
      downloadErrorMessage.value = result.errorMessage
    }
  }

  function dismissNotice(): void {
    if (activeNotice.value?.mode === 'optional') {
      snoozeOptionalNotice(activeNotice.value.remoteVersion, DESKTOP_UPDATE_SNOOZE_MS)
    }
    downloadErrorMessage.value = ''
    dialogPending.value = false
    dialogVisible.value = false
  }

  function resetError(): void {
    if (status.value !== 'error') return
    status.value = 'idle'
    errorMessage.value = ''
  }

  function closeDialog(): void {
    downloadErrorMessage.value = ''
    dialogPending.value = false
    dialogVisible.value = false
  }

  function initialize(): void {
    if (initialized || !isDesktop.value) return
    initialized = true

    void resolveLocalVersion().then((version) => {
      localVersion.value = version
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
    initialized = false
    checkPromise = null
    dialogPending.value = false
    dialogVisible.value = false
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

  return {
    isDesktop,
    status,
    localVersion,
    remoteVersion,
    minSupported,
    downloadUrl,
    releaseNotes,
    noticeMode,
    lastCheckedAt,
    errorMessage,
    downloadErrorMessage,
    dialogVisible,
    dialogPending,
    shouldRenderDialog,
    activeNotice,
    hasUpdate,
    isChecking,
    accountStatusLabel,
    initialize,
    dispose,
    checkForUpdates,
    openDownload,
    dismissNotice,
    resetError,
    closeDialog,
    shouldThrottleAutomaticCheck,
    shouldOpenDialog,
    syncDialogVisibility,
    scheduleNextPeriodicCheck,
  }
})

export { resolveLocalVersion, isDesktopRuntime }
