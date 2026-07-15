<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Megaphone, X } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import {
  getLatestUnread,
  markAnnouncementRead,
  type Announcement,
} from '@/utils/announcementApi'

const authStore = useAuthStore()
const announcement = ref<Announcement | null>(null)
const loading = ref(false)
const dismissing = ref(false)
const errorMessage = ref('')

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }).format(timestamp)
}

async function checkLatest() {
  if (!authStore.isAuthenticated) return
  loading.value = true
  errorMessage.value = ''
  try {
    announcement.value = await getLatestUnread()
  } catch (error: unknown) {
    // 静默失败：公告加载失败不应阻塞用户使用应用
    errorMessage.value = error instanceof Error ? error.message : ''
  } finally {
    loading.value = false
  }
}

async function dismiss() {
  if (!announcement.value || dismissing.value) return
  dismissing.value = true
  const target = announcement.value
  // 先乐观关闭，让用户立即看到反馈；后端失败也不重新弹出
  announcement.value = null
  try {
    await markAnnouncementRead(target.id)
  } catch {
    // 即使标记失败也不影响用户继续操作
  } finally {
    dismissing.value = false
  }
}

function closeOnly() {
  // 仅关闭弹窗，不标记已读（用户可能误点）
  announcement.value = null
}

onMounted(() => {
  void checkLatest()
})
</script>

<template>
  <Teleport to="body">
    <div v-if="announcement" class="modal-backdrop" role="presentation" @click.self="closeOnly">
      <section class="modal-panel max-w-md" role="dialog" aria-modal="true" aria-labelledby="announcement-title">
        <div class="modal-header">
          <div class="flex items-center gap-2">
            <Megaphone class="w-5 h-5 text-cyan-400" />
            <div>
              <div class="text-xs text-cyan-400 font-mono">ANNOUNCEMENT</div>
              <h2 id="announcement-title" class="text-lg font-semibold text-white mt-0.5">最新公告</h2>
            </div>
          </div>
          <button type="button" class="icon-action" title="关闭" @click="closeOnly"><X class="w-4 h-4" /></button>
        </div>
        <div class="p-5 space-y-4">
          <h3 class="text-base font-semibold text-gray-100">{{ announcement.title }}</h3>
          <div class="text-sm text-gray-300 leading-7 whitespace-pre-wrap">{{ announcement.content }}</div>
          <div class="text-xs text-gray-600 font-mono">{{ formatDate(announcement.publishedAt) }}</div>
          <div class="flex justify-end pt-2">
            <button
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
  @apply fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4;
}

.modal-panel {
  @apply w-full max-h-[calc(100vh-2rem)] overflow-hidden rounded-lg border border-white/[0.08] bg-[#0c0f18] shadow-2xl;
}

.modal-header {
  @apply flex items-start justify-between gap-4 px-5 py-4 border-b border-white/[0.06];
}

.icon-action {
  @apply inline-flex w-9 h-9 items-center justify-center rounded-md text-gray-500 hover:text-white hover:bg-white/[0.04];
}

.primary-button {
  @apply inline-flex h-10 items-center justify-center gap-2 rounded-md px-5 text-sm font-medium bg-cyan-400 text-gray-950 hover:bg-cyan-300 disabled:opacity-50 disabled:cursor-not-allowed;
}
</style>
