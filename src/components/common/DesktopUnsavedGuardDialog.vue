<script setup lang="ts">
import { nextTick, onUnmounted, ref, watch } from 'vue'
import { AlertTriangle, X } from 'lucide-vue-next'
import {
  lockBodyScroll,
  trapFocus,
  unlockBodyScroll,
} from '@/utils/authDialogFocus'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()

const dialogRef = ref<HTMLElement | null>(null)
const cancelButtonRef = ref<HTMLButtonElement | null>(null)

function requestCancel() {
  emit('cancel')
}

function requestConfirm() {
  emit('confirm')
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
      class="desktop-unsaved-guard-root"
      @keydown="onKeydown"
    >
      <div
        class="desktop-unsaved-guard-backdrop"
        role="presentation"
        @click="onBackdropClick"
      >
        <section
          ref="dialogRef"
          class="desktop-unsaved-guard-panel"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="desktop-unsaved-guard-title"
          aria-describedby="desktop-unsaved-guard-description"
        >
          <header class="desktop-unsaved-guard-header">
            <div class="flex items-start gap-3 min-w-0">
              <AlertTriangle class="w-5 h-5 shrink-0 text-amber-400" aria-hidden="true" />
              <div class="min-w-0">
                <h2 id="desktop-unsaved-guard-title" class="text-lg font-semibold text-gray-100">
                  未保存的内容
                </h2>
              </div>
            </div>
            <button
              type="button"
              class="desktop-unsaved-guard-icon-button"
              title="取消"
              aria-label="取消"
              @click="requestCancel"
            >
              <X class="w-4 h-4" />
            </button>
          </header>

          <div class="desktop-unsaved-guard-body">
            <p id="desktop-unsaved-guard-description" class="text-sm text-gray-400 leading-7">
              检测到未保存的学习笔记或表单内容。若继续关闭，未保存的更改将会丢失。
            </p>
          </div>

          <footer class="desktop-unsaved-guard-footer">
            <button
              ref="cancelButtonRef"
              type="button"
              class="desktop-unsaved-guard-secondary"
              @click="requestCancel"
            >
              取消
            </button>
            <button
              type="button"
              class="desktop-unsaved-guard-primary"
              @click="requestConfirm"
            >
              放弃更改并继续
            </button>
          </footer>
        </section>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.desktop-unsaved-guard-root {
  @apply fixed inset-0 z-[105];
}

.desktop-unsaved-guard-backdrop {
  @apply fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4;
}

.desktop-unsaved-guard-panel {
  @apply w-full max-w-md max-h-[calc(100vh-2rem)] overflow-hidden rounded-lg
    border border-edge-card bg-surface-tertiary shadow-2xl;
}

.desktop-unsaved-guard-header {
  @apply flex items-start justify-between gap-4 px-5 py-4 border-b border-edge-card;
}

.desktop-unsaved-guard-body {
  @apply px-5 py-4;
}

.desktop-unsaved-guard-footer {
  @apply flex flex-wrap justify-end gap-2 px-5 py-4 border-t border-edge-card;
}

.desktop-unsaved-guard-icon-button {
  @apply inline-flex w-9 h-9 items-center justify-center rounded-md
    text-gray-500 hover:text-gray-200 hover:bg-white/[0.05];
}

.desktop-unsaved-guard-primary {
  @apply inline-flex h-10 items-center justify-center rounded-md px-5 text-sm font-medium
    bg-amber-500 text-gray-950 hover:bg-amber-400;
}

.desktop-unsaved-guard-secondary {
  @apply inline-flex h-10 items-center justify-center rounded-md px-5 text-sm
    text-gray-300 hover:bg-white/[0.05];
}
</style>
