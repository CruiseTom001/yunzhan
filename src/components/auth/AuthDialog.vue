<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { X } from 'lucide-vue-next'
import AuthPanel from '@/components/auth/AuthPanel.vue'
import {
  lockBodyScroll,
  trapFocus,
  unlockBodyScroll,
} from '@/utils/authDialogFocus'
import type { AuthMode } from '@/utils/authRedirect'

const props = defineProps<{
  open: boolean
  mode: AuthMode
  redirectPath?: string
}>()

const emit = defineEmits<{
  close: []
  authenticated: []
  modeChange: [mode: AuthMode]
}>()

const dialogRef = ref<HTMLElement | null>(null)
const authPanelRef = ref<InstanceType<typeof AuthPanel> | null>(null)
const lastTrigger = ref<HTMLElement | null>(null)

const titleId = computed(() => {
  if (props.mode === 'register') return 'auth-dialog-register-title'
  if (props.mode === 'forgot-password') return 'auth-dialog-forgot-password-title'
  return 'auth-dialog-login-title'
})

const dialogTitle = computed(() => {
  if (props.mode === 'register') return '注册云栈'
  if (props.mode === 'forgot-password') return '找回密码'
  return '登录云栈'
})

function rememberTrigger() {
  const active = document.activeElement
  if (active instanceof HTMLElement) {
    lastTrigger.value = active
  }
}

function restoreTrigger() {
  const trigger = lastTrigger.value
  lastTrigger.value = null
  if (trigger && document.contains(trigger)) {
    trigger.focus()
  }
}

function requestClose() {
  if (authPanelRef.value?.isBusy()) return
  emit('close')
}

function onBackdropClick(event: MouseEvent) {
  if (event.target !== event.currentTarget) return
  requestClose()
}

function onKeydown(event: KeyboardEvent) {
  if (!props.open) return
  if (event.key === 'Escape') {
    event.preventDefault()
    requestClose()
    return
  }
  if (dialogRef.value) trapFocus(dialogRef.value, event)
}

watch(() => props.open, async (isOpen) => {
  if (isOpen) {
    rememberTrigger()
    lockBodyScroll()
    await nextTick()
    authPanelRef.value?.focusFirstField()
    return
  }
  authPanelRef.value?.stopCountdown()
  unlockBodyScroll()
  await nextTick()
  restoreTrigger()
}, { immediate: true })

onUnmounted(() => {
  authPanelRef.value?.stopCountdown()
  if (props.open) unlockBodyScroll()
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="auth-dialog-root"
      @keydown="onKeydown"
    >
      <div
        class="auth-dialog-backdrop"
        aria-hidden="true"
        @click="onBackdropClick"
      />
      <div
        ref="dialogRef"
        class="auth-dialog-panel"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        tabindex="-1"
        @click.stop
      >
        <div class="auth-dialog-header">
          <h2 :id="titleId" class="sr-only">{{ dialogTitle }}</h2>
          <button
            type="button"
            class="auth-dialog-close"
            aria-label="关闭登录弹窗"
            title="关闭"
            @click="requestClose"
          >
            <X class="w-4 h-4" />
          </button>
        </div>
        <div class="auth-dialog-body">
          <AuthPanel
            ref="authPanelRef"
            :initial-mode="mode"
            @authenticated="emit('authenticated')"
            @mode-change="emit('modeChange', $event)"
          />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.auth-dialog-root {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: grid;
  place-items: center;
  padding: 16px;
}

.auth-dialog-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(2px);
}

.auth-dialog-panel {
  position: relative;
  z-index: 1;
  display: flex;
  width: min(460px, 100%);
  max-height: calc(100dvh - 32px);
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--border-card);
  border-radius: 10px;
  background: var(--bg-tertiary);
  box-shadow: var(--shadow);
}

.auth-dialog-header {
  display: flex;
  justify-content: flex-end;
  padding: 12px 12px 0;
}

.auth-dialog-close {
  display: inline-flex;
  width: 32px;
  height: 32px;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border-light);
  border-radius: 6px;
  color: var(--text-muted);
  background: var(--bg-elevated);
}

.auth-dialog-close:hover {
  color: var(--text-primary);
  background: var(--bg-card-hover);
}

.auth-dialog-body {
  overflow-y: auto;
  padding: 0 24px 24px;
  -webkit-overflow-scrolling: touch;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 520px) {
  .auth-dialog-root {
    padding: 12px;
    align-items: end;
  }

  .auth-dialog-panel {
    max-height: calc(100dvh - 24px);
    border-radius: 12px 12px 8px 8px;
  }

  .auth-dialog-body {
    padding: 0 18px 18px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .auth-dialog-panel {
    transition: none;
  }
}
</style>
