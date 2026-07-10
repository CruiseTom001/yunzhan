<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Brain, CheckCircle2, ChevronRight, Clock3, RotateCcw, XCircle } from 'lucide-vue-next'
import { useProgressStore } from '@/stores/progress'
import { courseIndex } from '@/data/courses/index'
import type { ReviewCard } from '@/types'

type ReviewFilter = 'due' | 'wrong' | 'all'

const router = useRouter()
const progressStore = useProgressStore()
const activeFilter = ref<ReviewFilter>('due')
const revealed = ref<Record<string, boolean>>({})

const cards = computed(() => {
  const source = activeFilter.value === 'due'
    ? progressStore.dueReviewCards
    : activeFilter.value === 'wrong'
      ? progressStore.wrongQuestionCards
      : progressStore.reviewCards
  return [...source].sort((a, b) => a.nextReviewAt - b.nextReviewAt)
})

const filters = computed(() => [
  { id: 'due' as const, label: '今日到期', count: progressStore.dueReviewCards.length },
  { id: 'wrong' as const, label: '历史错题', count: progressStore.wrongQuestionCards.length },
  { id: 'all' as const, label: '全部卡片', count: progressStore.reviewCards.length },
])

function courseTitle(card: ReviewCard) {
  return courseIndex.find(course => course.id === card.categoryId)?.title ?? card.categoryId
}

function sourceLabel(card: ReviewCard) {
  if (card.sourceType === 'quiz') return '题目'
  if (card.sourceType === 'lab') return '实验'
  return '概念'
}

function review(card: ReviewCard, quality: 2 | 4) {
  progressStore.reviewCard(card.id, quality)
  delete revealed.value[card.id]
}

function openSource(card: ReviewCard) {
  if (card.sourceType === 'quiz') {
    router.push(`/quiz/${card.categoryId}`)
    return
  }
  router.push(`/course/${card.categoryId}`)
}
</script>

<template>
  <main class="min-h-screen bg-theme pt-20 pb-16 px-6">
    <div class="max-w-5xl mx-auto">
      <header class="mb-7">
        <div class="inline-flex items-center gap-2 text-xs text-purple-400 font-mono mb-3">
          <Brain class="w-4 h-4" /> 间隔复习
        </div>
        <div class="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 class="text-3xl font-bold text-white mb-2">复习中心</h1>
            <p class="text-sm text-gray-600">按遗忘节奏复习错题、实验和重点概念。</p>
          </div>
          <div class="flex items-center gap-2 text-xs font-mono text-gray-500">
            <Clock3 class="w-4 h-4 text-cyan-400" />
            今日待复习 <span class="text-white font-bold">{{ progressStore.dueReviewCards.length }}</span>
          </div>
        </div>
      </header>

      <div class="flex items-center gap-1 mb-6 border-b border-white/[0.05] overflow-x-auto">
        <button
          v-for="filter in filters"
          :key="filter.id"
          @click="activeFilter = filter.id"
          class="flex items-center gap-2 px-4 py-3 text-xs font-mono border-b-2 transition-colors whitespace-nowrap"
          :class="activeFilter === filter.id ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-gray-600 hover:text-gray-300'"
        >
          {{ filter.label }}
          <span class="min-w-5 h-5 px-1 rounded bg-white/[0.04] text-[10px] flex items-center justify-center">{{ filter.count }}</span>
        </button>
      </div>

      <section v-if="cards.length" class="space-y-3">
        <article
          v-for="card in cards"
          :key="card.id"
          class="border border-white/[0.05] bg-white/[0.012] rounded-lg p-5"
        >
          <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div class="flex items-center gap-2 text-[10px] font-mono">
              <span class="px-2 py-1 rounded border border-purple-400/15 bg-purple-400/5 text-purple-400">{{ sourceLabel(card) }}</span>
              <span class="text-gray-600">{{ courseTitle(card) }}</span>
              <span v-if="card.lapses" class="text-red-400">错 {{ card.lapses }} 次</span>
            </div>
            <button @click="openSource(card)" class="inline-flex items-center gap-1 text-[10px] text-gray-600 hover:text-cyan-400 font-mono">
              返回来源 <ChevronRight class="w-3 h-3" />
            </button>
          </div>

          <h2 class="text-white text-sm leading-7 mb-4">{{ card.prompt }}</h2>

          <button
            v-if="!revealed[card.id]"
            @click="revealed[card.id] = true"
            class="w-full h-10 rounded-md border border-cyan-400/15 bg-cyan-400/5 text-cyan-400 text-xs font-mono hover:bg-cyan-400/10 transition-colors"
          >
            显示答案
          </button>

          <div v-else>
            <div class="border-l-2 border-cyan-400/30 bg-black/10 px-4 py-3 text-sm text-gray-400 leading-7 whitespace-pre-line mb-4">
              {{ card.answer }}
            </div>
            <div class="grid grid-cols-2 gap-2">
              <button @click="review(card, 2)" class="h-10 inline-flex items-center justify-center gap-2 rounded-md border border-red-400/15 bg-red-400/5 text-red-400 text-xs font-mono hover:bg-red-400/10">
                <RotateCcw class="w-3.5 h-3.5" /> 还不熟
              </button>
              <button @click="review(card, 4)" class="h-10 inline-flex items-center justify-center gap-2 rounded-md border border-emerald-400/15 bg-emerald-400/5 text-emerald-400 text-xs font-mono hover:bg-emerald-400/10">
                <CheckCircle2 class="w-3.5 h-3.5" /> 已掌握
              </button>
            </div>
          </div>
        </article>
      </section>

      <section v-else class="py-20 text-center border border-dashed border-white/[0.06] rounded-lg">
        <CheckCircle2 v-if="activeFilter === 'due'" class="w-10 h-10 text-emerald-400/60 mx-auto mb-4" />
        <XCircle v-else class="w-10 h-10 text-gray-700 mx-auto mb-4" />
        <h2 class="text-white text-sm font-medium mb-2">{{ activeFilter === 'due' ? '今天的复习已完成' : '这里还没有复习卡片' }}</h2>
        <p class="text-xs text-gray-600">答题和完成实验后，系统会自动生成复习内容。</p>
      </section>
    </div>
  </main>
</template>
