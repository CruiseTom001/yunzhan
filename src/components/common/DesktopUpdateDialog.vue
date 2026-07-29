<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { AlertCircle, ExternalLink, X } from 'lucide-vue-next'
import { useDesktopUpdateStore } from '@/stores/desktopUpdate'
import {
  lockBodyScroll,
  trapFocus,
  unlockBodyScroll,
} from '@/utils/authDialogFocus'
import {
  isUpdateDialogBackdropClick,
  pickFocusRestoreTarget,
  resolveUpdateDialogCloseAction,
  shouldHandleUpdateDialogEscape,
} from '@/utils/desktopUpdateDialogBehavior'

const store = useDesktopUpdateStore()
const dialogRef = ref<HTMLElement | null>(null)
const primaryButtonRef = ref<HTMLButtonElement | null>(null)
const lastTrigger = ref<HTMLElement | null>(null)

const isRequired = computed(() => store.noticeMode === 'required')
const title = computed(() => (isRequired.value ? '需要更新' : '发现新版本'))

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
  const action = resolveUpdateDialogCloseAction(store.noticeMode)
  if (action === 'close') {
    store.closeDialog()
    return
  }
  store.dismissNotice()
}

function onBackdropClick(event: MouseEvent) {
  if (!isUpdateDialogBackdropClick(event.target, event.currentTarget)) return
  requestClose()
}

function onKeydown(event: KeyboardEvent) {
  if (shouldHandleUpdateDialogEscape(event.key, store.shouldRenderDialog)) {
    event.preventDefault()
    requestClose()
    return
  }
  if (dialogRef.value) trapFocus(dialogRef.value, event)
}

async function handleDownload() {
  await store.openDownload()
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
              type="button"
              class="update-dialog-icon-button"
              title="关闭"
              @click="requestClose"
            >
              <X class="w-4 h-4" />
            </button>
          </header>

          <div class="update-dialog-body space-y-4">
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

            <p v-if="store.downloadErrorMessage" class="text-sm text-red-400" role="alert">
              {{ store.downloadErrorMessage }}
            </p>

            <div class="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
              <button type="button" class="update-dialog-secondary" @click="requestClose">
                {{ isRequired ? '稍后处理' : '稍后提醒' }}
              </button>
              <button
                ref="primaryButtonRef"
                type="button"
                class="update-dialog-primary"
                @click="handleDownload"
              >
                <ExternalLink class="w-4 h-4" />
                立即更新
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
    bg-cyan-400 text-gray-950 hover:bg-cyan-300;
}

.update-dialog-secondary {
  @apply inline-flex h-10 items-center justify-center rounded-md px-5 text-sm
    text-gray-300 hover:bg-white/[0.05];
}
</style>
