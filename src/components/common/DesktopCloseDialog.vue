<script setup lang="ts">
import { nextTick, onUnmounted, ref, watch } from 'vue'
import { Minimize2, Power, X } from 'lucide-vue-next'
import {
  lockBodyScroll,
  trapFocus,
  unlockBodyScroll,
} from '@/utils/authDialogFocus'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  quit: [remember: boolean]
  tray: [remember: boolean]
  cancel: []
}>()

const dialogRef = ref<HTMLElement | null>(null)
const cancelButtonRef = ref<HTMLButtonElement | null>(null)
const rememberChoice = ref(false)

function requestCancel() {
  emit('cancel')
}

function requestQuit() {
  emit('quit', rememberChoice.value)
}

function requestTray() {
  emit('tray', rememberChoice.value)
}

function onBackdropClick(event: MouseEvent) {
  if (event.target !== event.currentTarget) return
  requestCancel()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    requestCancel()
    return
  }
  if (dialogRef.value) trapFocus(dialogRef.value, event)
}

watch(() => props.open, async (visible) => {
  if (visible) {
    rememberChoice.value = false
    lockBodyScroll()
    await nextTick()
    cancelButtonRef.value?.focus()
    return
  }
  unlockBodyScroll()
}, { immediate: true })

onUnmounted(() => {
  if (props.open) unlockBodyScroll()
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="desktop-close-dialog-root"
      @keydown="onKeydown"
    >
      <div
        class="desktop-close-dialog-backdrop"
        role="presentation"
        @click="onBackdropClick"
      >
        <section
          ref="dialogRef"
          class="desktop-close-dialog-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="desktop-close-dialog-title"
        >
          <header class="desktop-close-dialog-header">
            <div class="min-w-0">
              <p class="text-xs font-mono text-cyan-400">CLOSE APP</p>
              <h2 id="desktop-close-dialog-title" class="text-lg font-semibold text-gray-100 mt-1">
                关闭云栈
              </h2>
            </div>
            <button
              type="button"
              class="desktop-close-dialog-icon-button"
              title="取消"
              aria-label="取消"
              @click="requestCancel"
            >
              <X class="w-4 h-4" />
            </button>
          </header>

          <div class="desktop-close-dialog-body space-y-4">
            <p class="text-sm text-gray-400 leading-7">
              请选择关闭窗口时的行为。缩小到后台后，可通过系统托盘再次打开云栈。
            </p>

            <div class="grid gap-2">
              <button
                type="button"
                class="desktop-close-dialog-action"
                @click="requestTray"
              >
                <Minimize2 class="w-4 h-4 shrink-0 text-cyan-400" aria-hidden="true" />
                <span>
                  <span class="block text-sm font-medium text-gray-100">缩小到后台运行</span>
                  <span class="block text-xs text-gray-500 mt-0.5">隐藏窗口，保留在系统托盘</span>
                </span>
              </button>
              <button
                type="button"
                class="desktop-close-dialog-action"
                @click="requestQuit"
              >
                <Power class="w-4 h-4 shrink-0 text-gray-300" aria-hidden="true" />
                <span>
                  <span class="block text-sm font-medium text-gray-100">直接退出应用</span>
                  <span class="block text-xs text-gray-500 mt-0.5">完全关闭云栈</span>
                </span>
              </button>
            </div>

            <label class="inline-flex items-center gap-3 text-sm text-gray-300 cursor-pointer select-none">
              <input
                v-model="rememberChoice"
                type="checkbox"
                class="h-4 w-4 rounded border-white/20 bg-transparent text-cyan-400 focus:ring-cyan-400/50"
              />
              以后按此选择，不再询问
            </label>
          </div>

          <footer class="desktop-close-dialog-footer">
            <button
              ref="cancelButtonRef"
              type="button"
              class="desktop-close-dialog-secondary"
              @click="requestCancel"
            >
              取消
            </button>
          </footer>
        </section>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.desktop-close-dialog-root {
  @apply fixed inset-0 z-[100];
}

.desktop-close-dialog-backdrop {
  @apply fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4;
}

.desktop-close-dialog-panel {
  @apply w-full max-w-md max-h-[calc(100vh-2rem)] overflow-hidden rounded-lg
    border border-edge-card bg-surface-tertiary shadow-2xl;
}

.desktop-close-dialog-header {
  @apply flex items-start justify-between gap-4 px-5 py-4 border-b border-edge-card;
}

.desktop-close-dialog-body {
  @apply px-5 py-4;
}

.desktop-close-dialog-footer {
  @apply flex justify-end px-5 py-4 border-t border-edge-card;
}

.desktop-close-dialog-icon-button {
  @apply inline-flex w-9 h-9 items-center justify-center rounded-md
    text-gray-500 hover:text-gray-200 hover:bg-white/[0.05];
}

.desktop-close-dialog-action {
  @apply flex w-full items-start gap-3 rounded-md border border-edge-card px-4 py-3 text-left
    hover:bg-white/[0.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40;
}

.desktop-close-dialog-secondary {
  @apply inline-flex h-10 items-center justify-center rounded-md px-5 text-sm
    text-gray-300 hover:bg-white/[0.05];
}
</style>
