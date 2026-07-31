import { onUnmounted, ref } from 'vue'
import { useDesktopUpdateStore } from '@/stores/desktopUpdate'
import { canProceedWithAppClose } from '@/utils/appQuitGuard'
import {
  parseCloseRequestedPayload,
  resolveDesktopClose,
  type DesktopCloseBehavior,
  type DesktopCloseResolveAction,
} from '@/utils/desktopCloseBehavior'
import { isDesktopRuntime } from '@/utils/desktopAuthPreferences'
import {
  resolveBehaviorToAction,
  shouldBlockCloseForUpdate,
  shouldShowCloseDialog,
} from '@/utils/desktopCloseFlow'

async function acknowledgeDesktopClose(): Promise<void> {
  if (!window.electronAPI?.acknowledgeDesktopClose) return
  try {
    await window.electronAPI.acknowledgeDesktopClose()
  } catch {
    // Ack is best-effort; main process keeps a fallback for missed listeners.
  }
}

export function useDesktopCloseHandler() {
  const closeDialogVisible = ref(false)
  const unsavedDialogVisible = ref(false)
  const pendingBehavior = ref<DesktopCloseBehavior>('ask')

  const desktopUpdateStore = useDesktopUpdateStore()

  let unsubscribeCloseRequested: (() => void) | null = null
  let flowInProgress = false

  async function submitCloseAction(action: DesktopCloseResolveAction, remember: boolean) {
    closeDialogVisible.value = false
    unsavedDialogVisible.value = false
    try {
      await resolveDesktopClose({ action, remember })
    } finally {
      flowInProgress = false
    }
  }

  async function continueAfterGuards() {
    if (shouldShowCloseDialog(pendingBehavior.value)) {
      closeDialogVisible.value = true
      flowInProgress = false
      return
    }

    const action = resolveBehaviorToAction(pendingBehavior.value)
    if (!action) {
      await submitCloseAction('cancel', false)
      return
    }

    await submitCloseAction(action, false)
  }

  async function handleCloseRequested(payload: unknown) {
    await acknowledgeDesktopClose()

    const parsed = parseCloseRequestedPayload(payload)
    if (!parsed) {
      await submitCloseAction('cancel', false)
      return
    }

    if (flowInProgress || closeDialogVisible.value || unsavedDialogVisible.value) {
      return
    }

    flowInProgress = true
    pendingBehavior.value = parsed.behavior

    try {
      if (shouldBlockCloseForUpdate(desktopUpdateStore.status)) {
        await submitCloseAction('cancel', false)
        return
      }

      const guardResult = await canProceedWithAppClose()
      if (!guardResult.ok) {
        unsavedDialogVisible.value = true
        flowInProgress = false
        return
      }

      await continueAfterGuards()
    } catch {
      await submitCloseAction('cancel', false)
    }
  }

  async function handleUnsavedConfirm() {
    flowInProgress = true
    unsavedDialogVisible.value = false
    try {
      await continueAfterGuards()
    } catch {
      await submitCloseAction('cancel', false)
    }
  }

  async function handleUnsavedCancel() {
    await submitCloseAction('cancel', false)
  }

  async function handleCloseDialogQuit(remember: boolean) {
    await submitCloseAction('quit', remember)
  }

  async function handleCloseDialogTray(remember: boolean) {
    await submitCloseAction('tray', remember)
  }

  async function handleCloseDialogCancel() {
    await submitCloseAction('cancel', false)
  }

  // Subscribe during setup (not onMounted) so the first close after startup is not missed.
  if (isDesktopRuntime() && window.electronAPI?.onCloseRequested) {
    unsubscribeCloseRequested = window.electronAPI.onCloseRequested((payload) => {
      void handleCloseRequested(payload)
    })
  }

  onUnmounted(() => {
    unsubscribeCloseRequested?.()
    unsubscribeCloseRequested = null
  })

  return {
    closeDialogVisible,
    unsavedDialogVisible,
    handleUnsavedConfirm,
    handleUnsavedCancel,
    handleCloseDialogQuit,
    handleCloseDialogTray,
    handleCloseDialogCancel,
  }
}
