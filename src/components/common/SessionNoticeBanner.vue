<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { X } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import {
  SESSION_NOTICE_HEADER_OFFSET,
  SESSION_NOTICE_Z_INDEX,
} from '@/utils/sessionNoticeLayout'

const authStore = useAuthStore()
const route = useRoute()

const noticeText = computed(() => authStore.sessionNotice.trim())
const visible = computed(() => noticeText.value.length > 0)
const usesLandingOffset = computed(() => route.meta.hideChrome === true)
const shellStyle = computed(() => ({
  top: SESSION_NOTICE_HEADER_OFFSET,
  zIndex: SESSION_NOTICE_Z_INDEX,
}))

function dismissNotice() {
  authStore.clearSessionNotice()
}
</script>

<template>
  <div
    v-if="visible"
    class="session-notice-shell"
    :class="usesLandingOffset ? 'session-notice-shell--landing' : 'session-notice-shell--chrome'"
    :style="shellStyle"
    data-session-notice-root
    :data-session-notice-top="SESSION_NOTICE_HEADER_OFFSET"
  >
    <div
      class="session-notice-banner"
      role="status"
      aria-live="polite"
      :data-session-notice-placement="usesLandingOffset ? 'landing' : 'chrome'"
    >
      <p class="session-notice-banner__text">{{ noticeText }}</p>
      <button
        type="button"
        class="session-notice-banner__close"
        aria-label="关闭提示"
        @click="dismissNotice"
      >
        <X aria-hidden="true" :size="16" />
        <span class="sr-only">关闭</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.session-notice-shell {
  position: fixed;
  left: 0;
  right: 0;
  box-sizing: border-box;
  max-width: 100vw;
  padding-inline: clamp(0.75rem, 3vw, 1rem);
  pointer-events: none;
}

.session-notice-banner {
  pointer-events: auto;
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  width: min(100%, 72rem);
  margin-inline: auto;
  padding: 0.75rem 1rem;
  border: 1px solid var(--border-card);
  border-radius: 0.75rem;
  background: var(--bg-elevated);
  color: var(--text-primary);
  box-shadow: var(--shadow);
}

.session-notice-banner__text {
  flex: 1;
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.5;
  color: var(--text-secondary);
}

.session-notice-banner__close {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border: 1px solid var(--border-light);
  border-radius: 999px;
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
}

.session-notice-banner__close:hover {
  background: var(--bg-card-hover);
  border-color: var(--border-hover);
}

.session-notice-banner__close:focus-visible {
  outline: 2px solid var(--accent-cyan);
  outline-offset: 2px;
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

@media (max-width: 640px) {
  .session-notice-banner {
    padding: 0.625rem 0.75rem;
  }
}
</style>
