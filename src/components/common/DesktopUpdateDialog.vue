<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { AlertCircle, Download, RefreshCw, RotateCcw, X } from 'lucide-vue-next'
import { useDesktopUpdateStore } from '@/stores/desktopUpdate'
import {
  lockBodyScroll,
  trapFocus,
  unlockBodyScroll,
} from '@/utils/authDialogFocus'
import {
  canCloseUpdateDialog,
  isUpdateDialogBackdropClick,
  pickFocusRestoreTarget,
  resolveUpdateDialogCloseAction,
  shouldHandleUpdateDialogEscape,
} from '@/utils/desktopUpdateDialogBehavior'
import { formatByteSize, formatTransferSpeed } from '@/utils/formatByteSize'

const store = useDesktopUpdateStore()
const dialogRef = ref<HTMLElement | null>(null)
const primaryButtonRef = ref<HTMLButtonElement | null>(null)
const lastTrigger = ref<HTMLElement | null>(null)

const isRequired = computed(() => store.noticeMode === 'required')
const status = computed(() => store.status)

const title = computed(() => {
  if (status.value === 'downloading') return '正在下载更新'
  if (status.value === 'downloaded') return '更新已准备好'
  if (status.value === 'installing') return '正在准备安装'
  if (status.value === 'error') return '更新失败'
  return isRequired.value ? '需要更新' : '发现新版本'
})

const canDismiss = computed(() => canCloseUpdateDialog(store.noticeMode, status.value))

const progressPercent = computed(() => {
  const percent = store.updaterState.percent
  return percent === null ? 0 : Math.round(percent)
})

const progressDetail = computed(() => {
  const { transferred, total, bytesPerSecond } = store.updaterState
  if (transferred === null && total === null) return ''
  return `${formatByteSize(transferred)} / ${formatByteSize(total)} · ${formatTransferSpeed(bytesPerSecond)}`
})

function rememberTrigger() {
  const active = document.activeElement
  if (active instanceof HTMLElement) {
    lastTrigger.value = active
  }
}

function restoreTrigger() {
  const trigger = pickFocusRestoreTarget(lastTrigger.value)
  lastTrigger.value = null
  trigger?.focus()
}

function requestClose() {
  if (!canDismiss.value) return
  const action = resolveUpdateDialogCloseAction(store.noticeMode)
  if (action === 'close') {
    store.closeDialog()
    return
  }
  store.dismissNotice()
}

function onBackdropClick(event: MouseEvent) {
  if (!canDismiss.value) return
  if (!isUpdateDialogBackdropClick(event.target, event.currentTarget)) return
  requestClose()
}

function onKeydown(event: KeyboardEvent) {
  if (!canDismiss.value) {
    if (dialogRef.value) trapFocus(dialogRef.value, event)
    return
  }
  if (shouldHandleUpdateDialogEscape(event.key, store.shouldRenderDialog)) {
    event.preventDefault()
    requestClose()
    return
  }
  if (dialogRef.value) trapFocus(dialogRef.value, event)
}

async function handlePrimaryAction() {
  if (status.value === 'downloaded') {
    await store.installUpdate()
    return
  }
  if (status.value === 'error') {
    const errorCode = store.updaterState.errorCode
    if (errorCode === 'install_failed') {
      await store.installUpdate()
      return
    }
    if (errorCode === 'download_failed' || errorCode === 'download_cancelled' || errorCode === 'checksum_failed') {
      await store.downloadUpdate()
      return
    }
    await store.checkForUpdates({ source: 'manual', force: true })
    return
  }
  await store.downloadUpdate()
}

watch(() => store.shouldRenderDialog, async (visible) => {
  if (visible) {
    rememberTrigger()
    lockBodyScroll()
    await nextTick()
    primaryButtonRef.value?.focus()
    return
  }
  unlockBodyScroll()
  await nextTick()
  restoreTrigger()
}, { immediate: true })

onUnmounted(() => {
  if (store.shouldRenderDialog) unlockBodyScroll()
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="store.shouldRenderDialog && store.activeNotice"
      class="update-dialog-root"
      @keydown="onKeydown"
    >
      <div
        class="update-dialog-backdrop"
        role="presentation"
        @click="onBackdropClick"
      >
        <section
          ref="dialogRef"
          class="update-dialog-panel"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="'desktop-update-dialog-title'"
        >
          <header class="update-dialog-header">
            <div class="flex items-start gap-3 min-w-0">
              <AlertCircle
                class="w-5 h-5 shrink-0"
                :class="isRequired ? 'text-amber-400' : 'text-cyan-400'"
              />
              <div class="min-w-0">
                <p
                  class="text-xs font-mono"
                  :class="isRequired ? 'text-amber-400' : 'text-cyan-400'"
                >
                  {{ isRequired ? 'UPDATE REQUIRED' : 'UPDATE AVAILABLE' }}
                </p>
                <h2 id="desktop-update-dialog-title" class="text-lg font-semibold text-gray-100 mt-1">
                  {{ title }}
                </h2>
              </div>
            </div>
            <button
              v-if="canDismiss"
              type="button"
              class="update-dialog-icon-button"
              title="关闭"
              @click="requestClose"
            >
              <X class="w-4 h-4" />
            </button>
          </header>

          <div class="update-dialog-body space-y-4">
            <template v-if="status === 'downloading'">
              <p class="text-sm text-gray-400 dark:text-gray-300 leading-7">
                正在下载 v{{ store.remoteVersion }}，请保持应用运行。
              </p>
              <div class="space-y-2">
                <div class="h-2 rounded-full bg-black/20 overflow-hidden">
                  <div
                    class="h-full bg-cyan-400 transition-all duration-200"
                    :style="{ width: `${progressPercent}%` }"
                  />
                </div>
                <div class="flex justify-between text-xs text-gray-500 font-mono">
                  <span>{{ progressPercent }}%</span>
                  <span>{{ progressDetail }}</span>
                </div>
              </div>
            </template>

            <template v-else-if="status === 'downloaded'">
              <p class="text-sm text-gray-400 dark:text-gray-300 leading-7">
                新版本 v{{ store.remoteVersion }} 已下载完成。点击「立即重启并安装」后，应用将关闭并在安装完成后重新启动。
              </p>
            </template>

            <template v-else-if="status === 'installing'">
              <p class="text-sm text-gray-400 dark:text-gray-300 leading-7">
                正在准备安装，应用即将关闭…
              </p>
            </template>

            <template v-else>
              <p v-if="isRequired" class="text-sm text-gray-400 dark:text-gray-300 leading-7">
                当前版本已低于最低兼容版本 v{{ store.minSupported }}。请升级至 v{{ store.remoteVersion }} 后继续获得完整功能。
              </p>
              <p v-else class="text-sm text-gray-400 dark:text-gray-300 leading-7">
                云栈桌面端有新版本可用，建议更新以获得最新功能与修复。
              </p>

              <dl class="grid gap-2 text-sm">
                <div class="flex flex-wrap gap-x-2">
                  <dt class="text-gray-500">当前版本</dt>
                  <dd class="font-mono text-gray-200">v{{ store.localVersion }}</dd>
                </div>
                <div class="flex flex-wrap gap-x-2">
                  <dt class="text-gray-500">最新版本</dt>
                  <dd class="font-mono text-gray-200">v{{ store.remoteVersion }}</dd>
                </div>
              </dl>

              <div
                v-if="store.releaseNotes"
                class="rounded-md border border-edge-card bg-black/10 dark:bg-black/20 p-3 text-sm text-gray-400 dark:text-gray-300 leading-7 whitespace-pre-wrap max-h-40 overflow-y-auto"
              >
                {{ store.releaseNotes }}
              </div>
            </template>

            <p v-if="store.displayErrorMessage" class="text-sm text-red-400" role="alert">
              {{ store.displayErrorMessage }}
            </p>

            <div class="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
              <button
                v-if="canDismiss && status !== 'downloaded'"
                type="button"
                class="update-dialog-secondary"
                @click="requestClose"
              >
                {{ isRequired ? '稍后处理' : '稍后提醒' }}
              </button>

              <button
                v-if="status === 'downloaded'"
                type="button"
                class="update-dialog-secondary"
                @click="requestClose"
              >
                稍后安装
              </button>

              <button
                v-if="status !== 'downloading' && status !== 'installing'"
                ref="primaryButtonRef"
                type="button"
                class="update-dialog-primary"
                :disabled="status === 'downloaded' ? !store.canInstall : (status === 'available' ? !store.canDownload : store.isBusy)"
                @click="handlePrimaryAction"
              >
                <Download v-if="status === 'available'" class="w-4 h-4" />
                <RotateCcw v-else-if="status === 'error'" class="w-4 h-4" />
                <RefreshCw v-else class="w-4 h-4" />
                {{
                  status === 'downloaded'
                    ? '立即重启并安装'
                    : status === 'error'
                      ? '重试'
                      : '下载更新'
                }}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.update-dialog-root {
  @apply fixed inset-0 z-[110];
}

.update-dialog-backdrop {
  @apply fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4;
}

.update-dialog-panel {
  @apply w-full max-w-md max-h-[calc(100vh-2rem)] overflow-hidden rounded-lg
    border border-edge-card bg-surface-tertiary shadow-2xl;
}

.update-dialog-header {
  @apply flex items-start justify-between gap-4 px-5 py-4 border-b border-edge-card;
}

.update-dialog-body {
  @apply px-5 py-4;
}

.update-dialog-icon-button {
  @apply inline-flex w-9 h-9 items-center justify-center rounded-md
    text-gray-500 hover:text-gray-200 hover:bg-white/[0.05];
}

.update-dialog-primary {
  @apply inline-flex h-10 items-center justify-center gap-2 rounded-md px-5 text-sm font-medium
    bg-cyan-400 text-gray-950 hover:bg-cyan-300 disabled:opacity-50 disabled:cursor-not-allowed;
}

.update-dialog-secondary {
  @apply inline-flex h-10 items-center justify-center rounded-md px-5 text-sm
    text-gray-300 hover:bg-white/[0.05];
}
</style>
