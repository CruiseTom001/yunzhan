<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import AppHeader from '@/components/layout/AppHeader.vue'
import ConceptPopover from '@/components/common/ConceptPopover.vue'
import GlobalSearch from '@/components/common/GlobalSearch.vue'
import AIChatPanel from '@/components/ai/AIChatPanel.vue'
import FloatingTerminal from '@/components/ai/FloatingTerminal.vue'

const globalSearch = ref<InstanceType<typeof GlobalSearch> | null>(null)
const showAI = ref(false)
const showTerminal = ref(false)

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

onMounted(() => {
  window.addEventListener('yunzhan:run-command', openTerminalForCommand)
})

onUnmounted(() => {
  window.removeEventListener('yunzhan:run-command', openTerminalForCommand)
})
</script>

<template>
  <div class="min-h-screen bg-surface-secondary text-ink-secondary antialiased">
    <AppHeader @open-search="openSearch" @toggle-ai="toggleAI" @toggle-terminal="toggleTerminal" />
    <router-view v-slot="{ Component }">
      <transition name="page" mode="out-in">
        <keep-alive :include="keepAliveIncludes">
          <component :is="Component" />
        </keep-alive>
      </transition>
    </router-view>
    <ConceptPopover />
    <GlobalSearch ref="globalSearch" />
    <AIChatPanel :visible="showAI" @close="showAI = false" />
    <FloatingTerminal :visible="showTerminal" @close="showTerminal = false" />
  </div>
</template>

<style>
.page-enter-active,
.page-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}
.page-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.page-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
