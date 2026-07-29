<script setup lang="ts">
import { nextTick, onUnmounted, ref, watch } from 'vue'
import { Megaphone, X } from 'lucide-vue-next'
import { useAnnouncementsStore } from '@/stores/announcements'
import { formatAnnouncementDate } from '@/utils/announcementDisplay'
import {
  lockBodyScroll,
  trapFocus,
  unlockBodyScroll,
} from '@/utils/authDialogFocus'

const store = useAnnouncementsStore()
const dialogRef = ref<HTMLElement | null>(null)
const dismissButtonRef = ref<HTMLButtonElement | null>(null)
const dismissing = ref(false)

function closeOnly() {
  store.closeLatestModal()
}

async function dismiss() {
  if (!store.latestAnnouncement || dismissing.value) return
  dismissing.value = true
  try {
    await store.dismissLatest()
  } finally {
    dismissing.value = false
  }
}

function onBackdropClick(event: MouseEvent) {
  if (event.target !== event.currentTarget) return
  closeOnly()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    closeOnly()
    return
  }
  if (dialogRef.value) trapFocus(dialogRef.value, event)
}

watch(
  () => store.shouldShowLatestModal,
  async (visible) => {
    if (visible) {
      lockBodyScroll()
      await nextTick()
      dismissButtonRef.value?.focus()
      return
    }
    unlockBodyScroll()
  },
)

onUnmounted(() => {
  if (store.shouldShowLatestModal) unlockBodyScroll()
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="store.shouldShowLatestModal && store.latestAnnouncement"
      class="modal-backdrop"
      role="presentation"
      @click="onBackdropClick"
    >
      <section
        ref="dialogRef"
        class="modal-panel max-w-md"
        role="dialog"
        aria-modal="true"
        aria-labelledby="announcement-latest-title"
        @keydown="onKeydown"
      >
        <div class="modal-header">
          <div class="flex items-center gap-2">
            <Megaphone class="w-5 h-5 text-cyan-400" aria-hidden="true" />
            <div>
              <div class="text-xs text-cyan-400 font-mono">ANNOUNCEMENT</div>
              <h2 id="announcement-latest-title" class="text-lg font-semibold text-gray-100 mt-0.5">最新公告</h2>
            </div>
          </div>
          <button
            type="button"
            class="icon-action"
            title="关闭"
            aria-label="关闭最新公告"
            @click="closeOnly"
          >
            <X class="w-4 h-4" />
          </button>
        </div>
        <div class="p-5 space-y-4">
          <h3 class="text-base font-semibold text-gray-100">{{ store.latestAnnouncement.title }}</h3>
          <div class="text-sm text-gray-400 leading-7 whitespace-pre-wrap break-words">
            {{ store.latestAnnouncement.content }}
          </div>
          <div class="text-xs text-gray-500 font-mono">
            {{ formatAnnouncementDate(store.latestAnnouncement.publishedAt) }}
          </div>
          <div class="flex justify-end pt-2">
            <button
              ref="dismissButtonRef"
              type="button"
              class="primary-button"
              :disabled="dismissing"
              @click="dismiss"
            >
              我知道了
            </button>
          </div>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-backdrop {
  @apply fixed inset-0 z-[105] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4;
}

.modal-panel {
  @apply w-full max-h-[calc(100vh-2rem)] overflow-hidden rounded-lg border border-edge-card bg-surface-tertiary shadow-2xl;
}

.modal-header {
  @apply flex items-start justify-between gap-4 px-5 py-4 border-b border-edge-card;
}

.icon-action {
  @apply inline-flex w-9 h-9 items-center justify-center rounded-md text-gray-500 hover:text-gray-100 hover:bg-white/[0.04];
}

.primary-button {
  @apply inline-flex h-10 items-center justify-center gap-2 rounded-md px-5 text-sm font-medium bg-cyan-400 text-gray-950 hover:bg-cyan-300 disabled:opacity-50 disabled:cursor-not-allowed;
}

@media (prefers-reduced-motion: reduce) {
  .modal-backdrop {
    @apply backdrop-blur-none;
  }
}
</style>
