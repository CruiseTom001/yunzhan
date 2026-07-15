<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import AppHeader from '@/components/layout/AppHeader.vue'
import AnnouncementModal from '@/components/common/AnnouncementModal.vue'
import ConceptPopover from '@/components/common/ConceptPopover.vue'
import GlobalSearch from '@/components/common/GlobalSearch.vue'
import AIChatPanel from '@/components/ai/AIChatPanel.vue'
import FloatingTerminal from '@/components/ai/FloatingTerminal.vue'
import { useProgressStore } from '@/stores/progress'
import { useAuthStore } from '@/stores/auth'

const globalSearch = ref<InstanceType<typeof GlobalSearch> | null>(null)
const showAI = ref(false)
const showTerminal = ref(false)
const progressStore = useProgressStore()
const authStore = useAuthStore()
const route = useRoute()
const STUDY_SAMPLE_SECONDS = 30
const ACTIVE_WINDOW_MS = 2 * 60 * 1000
let lastActivityAt = Date.now()
let studyTimer: ReturnType<typeof setInterval> | null = null

// keep-alive 缓存白名单：
// - CourseDetailPage：章节阅读含 MarkdownRenderer 的 DOM 注解树、滚动位置，
//   用户从目录切回详情页时不重新挂载，体验流畅；
// - CourseListPage：课程列表静态数据，缓存后切回瞬时显示。
// 不缓存 HomePage：首页统计随 progress 变化，每次进应当反映最新进度。
// 不缓存 QuizPage/TerminalPage/ProgressPage：这些页面 state 与全局 progress 强绑定，
// 缓存反而会展示陈旧数据。
const keepAliveIncludes = ['CourseDetailPage', 'CourseListPage']

function openSearch() {
  globalSearch.value?.open()
}

function toggleAI() {
  showAI.value = !showAI.value
}

function toggleTerminal() {
  showTerminal.value = !showTerminal.value
}

function openTerminalForCommand() {
  showTerminal.value = true
}

function recordActivity() {
  lastActivityAt = Date.now()
}

function sampleActiveStudyTime() {
  const recentlyActive = Date.now() - lastActivityAt <= ACTIVE_WINDOW_MS
  if (authStore.isAuthenticated && document.visibilityState === 'visible' && recentlyActive) {
    progressStore.addTimeSpent(STUDY_SAMPLE_SECONDS)
  }
}

onMounted(() => {
  window.addEventListener('yunzhan:run-command', openTerminalForCommand)
  window.addEventListener('pointerdown', recordActivity, { passive: true })
  window.addEventListener('keydown', recordActivity)
  window.addEventListener('scroll', recordActivity, { passive: true })
  studyTimer = setInterval(sampleActiveStudyTime, STUDY_SAMPLE_SECONDS * 1000)
})

onUnmounted(() => {
  window.removeEventListener('yunzhan:run-command', openTerminalForCommand)
  window.removeEventListener('pointerdown', recordActivity)
  window.removeEventListener('keydown', recordActivity)
  window.removeEventListener('scroll', recordActivity)
  if (studyTimer) {
    clearInterval(studyTimer)
    studyTimer = null
  }
})
</script>

<template>
  <div class="min-h-screen bg-surface-secondary text-ink-secondary antialiased">
    <AppHeader
      v-if="!route.meta.hideChrome"
      @open-search="openSearch"
      @toggle-ai="toggleAI"
      @toggle-terminal="toggleTerminal"
    />
    <router-view v-slot="{ Component, route: pageRoute }">
      <transition name="page" mode="out-in">
        <keep-alive :include="keepAliveIncludes">
          <component :is="Component" :key="String(pageRoute.name ?? pageRoute.path)" />
        </keep-alive>
      </transition>
    </router-view>
    <template v-if="!route.meta.hideChrome">
      <AnnouncementModal />
      <ConceptPopover />
      <GlobalSearch ref="globalSearch" />
      <AIChatPanel :visible="showAI" @close="showAI = false" />
      <FloatingTerminal :visible="showTerminal" @close="showTerminal = false" />
    </template>
  </div>
</template>

<style>
.page-enter-active,
.page-leave-active {
  transition: opacity 0.28s ease, transform 0.32s cubic-bezier(0.16, 1, 0.3, 1), filter 0.28s ease;
}
.page-enter-from {
  opacity: 0;
  filter: blur(3px);
  transform: translateY(10px) scale(0.995);
}
.page-leave-to {
  opacity: 0;
  filter: blur(2px);
  transform: translateY(-6px) scale(1.002);
}

@media (prefers-reduced-motion: reduce) {
  .page-enter-active,
  .page-leave-active {
    transition: opacity 0.01ms linear;
  }

  .page-enter-from,
  .page-leave-to {
    filter: none;
    transform: none;
  }
}
</style>
