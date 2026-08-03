<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { AlertCircle, ArrowLeft, CheckCheck, Loader2, Megaphone, RefreshCw, X } from 'lucide-vue-next'
import { useAnnouncementsStore } from '@/stores/announcements'
import {
  formatAnnouncementCategory,
  formatAnnouncementDate,
} from '@/utils/announcementDisplay'
import {
  lockBodyScroll,
  trapFocus,
  unlockBodyScroll,
} from '@/utils/authDialogFocus'

const store = useAnnouncementsStore()
const dialogRef = ref<HTMLElement | null>(null)
const closeButtonRef = ref<HTMLButtonElement | null>(null)
const lastTrigger = ref<HTMLElement | null>(null)
const mobileDetailOpen = ref(false)

const hasMore = computed(() => store.announcements.length < store.total)
const showEmpty = computed(() => !store.loading && store.announcements.length === 0 && !store.errorMessage)

function rememberTrigger() {
  const active = document.activeElement
  if (active instanceof HTMLElement) {
    lastTrigger.value = active
  }
}

function restoreTrigger() {
  lastTrigger.value?.focus()
  lastTrigger.value = null
}

function requestClose() {
  store.closeCenter()
  mobileDetailOpen.value = false
  restoreTrigger()
}

function onBackdropClick(event: MouseEvent) {
  if (event.target !== event.currentTarget) return
  requestClose()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    if (mobileDetailOpen.value) {
      mobileDetailOpen.value = false
      return
    }
    requestClose()
    return
  }
  if (dialogRef.value) trapFocus(dialogRef.value, event)
}

function openItem(id: string) {
  store.selectAnnouncement(id)
  if (window.matchMedia('(max-width: 767px)').matches) {
    mobileDetailOpen.value = true
  }
}

function backToList() {
  mobileDetailOpen.value = false
}

async function handleMarkRead() {
  const selected = store.selectedAnnouncement
  if (!selected || selected.read) return
  await store.markRead(selected.id)
}

async function handleMarkAllRead() {
  await store.markAllRead()
}

watch(
  () => store.centerVisible,
  async (visible) => {
    if (visible) {
      rememberTrigger()
      lockBodyScroll()
      await nextTick()
      closeButtonRef.value?.focus()
      if (store.announcements.length === 0) {
        await store.loadAnnouncements({ reset: true })
      }
      return
    }
    unlockBodyScroll()
    mobileDetailOpen.value = false
  },
)

onUnmounted(() => {
  if (store.centerVisible) unlockBodyScroll()
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="store.centerVisible"
      class="announcement-backdrop"
      role="presentation"
      @click="onBackdropClick"
    >
      <section
        ref="dialogRef"
        class="announcement-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="announcement-center-title"
        @keydown="onKeydown"
      >
        <header class="announcement-header">
          <div class="flex items-center gap-2 min-w-0">
            <Megaphone class="w-5 h-5 text-cyan-400 shrink-0" aria-hidden="true" />
            <div class="min-w-0">
              <div class="text-xs text-cyan-400 font-mono">ANNOUNCEMENTS</div>
              <h2 id="announcement-center-title" class="text-lg font-semibold text-gray-100 truncate">
                公告中心
              </h2>
            </div>
          </div>
          <button
            v-if="store.hasUnread"
            type="button"
            class="announcement-read-all"
            :disabled="store.markAllReadInFlight"
            :title="store.markAllReadInFlight ? '正在标记全部已读' : '全部标记为已读'"
            @click="handleMarkAllRead"
          >
            <Loader2 v-if="store.markAllReadInFlight" class="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
            <CheckCheck v-else class="w-3.5 h-3.5" aria-hidden="true" />
            {{ store.markAllReadInFlight ? '处理中…' : '全部已读' }}
          </button>
          <button
            ref="closeButtonRef"
            type="button"
            class="icon-action"
            title="关闭公告中心"
            aria-label="关闭公告中心"
            @click="requestClose"
          >
            <X class="w-4 h-4" />
          </button>
        </header>

        <div v-if="store.loading" class="announcement-state" role="status">
          <Loader2 class="w-5 h-5 animate-spin text-cyan-400" aria-hidden="true" />
          <span>正在加载公告…</span>
        </div>

        <div v-else-if="store.errorMessage && store.announcements.length === 0" class="announcement-state">
          <AlertCircle class="w-5 h-5 text-amber-400" aria-hidden="true" />
          <p>{{ store.errorMessage }}</p>
          <button type="button" class="secondary-button" @click="store.loadAnnouncements({ reset: true })">
            <RefreshCw class="w-4 h-4" />
            重新加载
          </button>
        </div>

        <div v-else-if="showEmpty" class="announcement-state">
          <Megaphone class="w-5 h-5 text-gray-500" aria-hidden="true" />
          <p>暂无公告</p>
        </div>

        <div v-else class="announcement-body">
          <aside
            class="announcement-list"
            :class="{ 'max-md:hidden': mobileDetailOpen }"
            aria-label="公告列表"
          >
            <button
              v-for="item in store.announcements"
              :key="item.id"
              type="button"
              class="announcement-list-item"
              :class="{ 'is-selected': store.selectedAnnouncementId === item.id }"
              @click="openItem(item.id)"
            >
              <div class="flex items-start justify-between gap-2">
                <span class="font-medium text-gray-100 text-left line-clamp-2">{{ item.title }}</span>
                <span
                  class="read-badge shrink-0"
                  :class="item.read ? 'read-badge--read' : 'read-badge--unread'"
                >
                  {{ item.read ? '已读' : '未读' }}
                </span>
              </div>
              <div class="meta-row">
                <span>{{ formatAnnouncementCategory(item.category) }}</span>
                <span>{{ formatAnnouncementDate(item.publishedAt) }}</span>
              </div>
              <div v-if="item.version" class="text-xs text-cyan-400/80 font-mono">v{{ item.version }}</div>
            </button>

            <div v-if="hasMore" class="p-3 border-t border-edge-card">
              <button
                type="button"
                class="secondary-button w-full"
                :disabled="store.loadingMore"
                @click="store.loadMore()"
              >
                <Loader2 v-if="store.loadingMore" class="w-4 h-4 animate-spin" aria-hidden="true" />
                <span>{{ store.loadingMore ? '加载中…' : '加载更多' }}</span>
              </button>
              <p v-if="store.errorMessage" class="text-xs text-amber-400 mt-2 text-center">{{ store.errorMessage }}</p>
            </div>
          </aside>

          <article
            class="announcement-detail md:flex"
            :class="{ 'max-md:hidden': !mobileDetailOpen }"
            aria-label="公告详情"
          >
            <button
              v-if="mobileDetailOpen"
              type="button"
              class="mobile-back-button md:hidden"
              @click="backToList"
            >
              <ArrowLeft class="w-4 h-4" />
              返回公告列表
            </button>

            <template v-if="store.selectedAnnouncement">
              <div class="detail-meta">
                <span class="category-chip">{{ formatAnnouncementCategory(store.selectedAnnouncement.category) }}</span>
                <span v-if="store.selectedAnnouncement.version" class="version-chip">
                  v{{ store.selectedAnnouncement.version }}
                </span>
                <span class="text-xs text-gray-500">
                  {{ formatAnnouncementDate(store.selectedAnnouncement.publishedAt) }}
                </span>
                <span
                  class="read-badge"
                  :class="store.selectedAnnouncement.read ? 'read-badge--read' : 'read-badge--unread'"
                >
                  {{ store.selectedAnnouncement.read ? '已读' : '未读' }}
                </span>
              </div>
              <h3 class="detail-title">{{ store.selectedAnnouncement.title }}</h3>
              <div class="detail-content">{{ store.selectedAnnouncement.content }}</div>
              <div class="detail-actions">
                <button
                  v-if="!store.selectedAnnouncement.read"
                  type="button"
                  class="primary-button"
                  :disabled="store.isMarkReadInFlight(store.selectedAnnouncement.id)"
                  @click="handleMarkRead"
                >
                  {{ store.isMarkReadInFlight(store.selectedAnnouncement.id) ? '处理中…' : '标记已读' }}
                </button>
                <p v-if="store.markReadError" class="text-xs text-amber-400">{{ store.markReadError }}</p>
              </div>
            </template>

            <div v-else class="announcement-state detail-empty">
              <p>请选择一条公告查看详情</p>
            </div>
          </article>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.announcement-backdrop {
  @apply fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4;
}

/* 全部已读：语义色类直接引用主题变量，浅色下自动适配，无需全局补丁 */
.announcement-read-all {
  @apply inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-edge-card px-2.5 text-xs text-ink-secondary transition-colors hover:bg-surface-elevated hover:text-ink-primary disabled:cursor-not-allowed disabled:opacity-50;
}

.announcement-panel {
  @apply w-full max-w-5xl max-h-[calc(100vh-1.5rem)] overflow-hidden rounded-xl border border-edge-card bg-surface-tertiary shadow-2xl flex flex-col;
}

.announcement-header {
  @apply flex items-start justify-between gap-4 px-4 sm:px-5 py-4 border-b border-edge-card shrink-0;
}

.announcement-body {
  @apply grid md:grid-cols-[minmax(240px,320px)_1fr] min-h-0 flex-1;
}

.announcement-list {
  @apply overflow-y-auto border-b md:border-b-0 md:border-r border-edge-card min-h-0 max-h-[42vh] md:max-h-none;
}

.announcement-list-item {
  @apply w-full text-left px-4 py-3 border-b border-white/[0.06] hover:bg-white/[0.03] transition-colors;
}

.announcement-list-item.is-selected {
  @apply bg-cyan-400/[0.08] border-l-2 border-l-cyan-400;
}

.announcement-detail {
  @apply overflow-y-auto min-h-0 p-4 sm:p-5 flex flex-col gap-4;
}

.announcement-state {
  @apply flex flex-col items-center justify-center gap-3 px-6 py-16 text-sm text-gray-500 text-center;
}

.detail-empty {
  @apply py-10;
}

.meta-row {
  @apply flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 mt-2;
}

.detail-meta {
  @apply flex flex-wrap items-center gap-2;
}

.detail-title {
  @apply text-lg font-semibold text-gray-100;
}

.detail-content {
  @apply text-sm text-gray-400 leading-7 whitespace-pre-wrap break-words overflow-y-auto flex-1;
}

.detail-actions {
  @apply flex flex-col items-start gap-2 pt-2 border-t border-edge-card;
}

.read-badge {
  @apply inline-flex items-center rounded px-2 py-0.5 text-[11px] font-medium;
}

.read-badge--read {
  @apply bg-white/[0.06] text-gray-500;
}

.read-badge--unread {
  @apply bg-cyan-400/15 text-cyan-300;
}

.category-chip,
.version-chip {
  @apply inline-flex items-center rounded px-2 py-0.5 text-xs font-medium bg-white/[0.05] text-gray-400;
}

.icon-action {
  @apply inline-flex w-9 h-9 items-center justify-center rounded-md text-gray-500 hover:text-gray-100 hover:bg-white/[0.04];
}

.primary-button {
  @apply inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium bg-cyan-400 text-gray-950 hover:bg-cyan-300 disabled:opacity-50;
}

.secondary-button {
  @apply inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium border border-edge-card text-gray-400 hover:bg-white/[0.04] disabled:opacity-50;
}

.mobile-back-button {
  @apply inline-flex items-center gap-2 text-sm text-cyan-300 hover:text-cyan-200 mb-2;
}

@media (prefers-reduced-motion: reduce) {
  .announcement-backdrop {
    @apply backdrop-blur-none;
  }
}
</style>
