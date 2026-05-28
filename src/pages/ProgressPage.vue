<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import {
  Trophy,
  BookOpen,
  Target,
  Award,
  ChevronRight,
  Star,
  Zap,
  Brain,
  ClipboardCheck,
  Cloud,
  Flame,
  Share2,
} from 'lucide-vue-next'
import { courseIndex, chapterCounts } from '@/data/courses/index'
import { achievements as allAchievements } from '@/data/achievements'
import { useProgressStore } from '@/stores/progress'
import { labTasks } from '@/data/labs'

const router = useRouter()
const progressStore = useProgressStore()

const totalChapterCount = Object.values(chapterCounts).reduce((a, b) => a + b, 0)

const stats = computed(() => ({
  completedChapters: progressStore.completedChaptersCount,
  completedCourses: courseIndex.filter((c) => {
    const completed = progressStore.progress.completedChapters[c.id]?.length ?? 0
    return completed >= (chapterCounts[c.id] ?? 0)
  }).length,
  quizAccuracy: progressStore.quizAccuracy,
  totalQuestions: progressStore.quizTotalAnswered,
  totalCourses: courseIndex.length,
  totalChapters: totalChapterCount,
  completedLabs: progressStore.completedLabCount,
  totalLabs: labTasks.length,
  dueReviews: progressStore.dueReviewCards.length,
}))

const courseProgress = computed(() =>
  courseIndex.map((c) => {
    const completed = progressStore.progress.completedChapters[c.id]?.length ?? 0
    const total = chapterCounts[c.id] ?? 0
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0
    return { id: c.id, title: c.title, completed, total, pct }
  }).filter((c) => c.pct > 0).sort((a, b) => b.pct - a.pct),
)

const earnedAchievements = computed(() =>
  allAchievements.filter((a) => progressStore.hasAchievement(a.id)),
)

const unearnedAchievements = computed(() =>
  allAchievements.filter((a) => !progressStore.hasAchievement(a.id)),
)

const heatmapDays = computed(() => {
  const days: Array<{ date: string; studied: boolean; label: string }> = []
  for (let i = 20; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000)
    const date = d.toISOString().slice(0, 10)
    days.push({
      date,
      studied: progressStore.studyDays.includes(date),
      label: `${d.getMonth() + 1}/${d.getDate()}`,
    })
  }
  return days
})

const weakCategories = computed(() => {
  const grouped = new Map<string, { wrong: number; total: number }>()
  for (const card of progressStore.wrongQuestionCards) {
    const item = grouped.get(card.categoryId) ?? { wrong: 0, total: 0 }
    item.wrong += card.lapses
    item.total += 1
    grouped.set(card.categoryId, item)
  }
  return Array.from(grouped.entries())
    .map(([categoryId, stat]) => ({
      categoryId,
      wrong: stat.wrong,
      total: stat.total,
      title: courseIndex.find(c => c.id === categoryId)?.title ?? categoryId,
    }))
    .sort((a, b) => b.wrong - a.wrong)
    .slice(0, 5)
})

const dueReviews = computed(() => progressStore.dueReviewCards.slice(0, 5))

const latestCommands = computed(() => progressStore.commandHistory.slice(0, 5))

const syncStatus = computed(() => progressStore.progress.syncSnapshots[0])

function exportProgress() {
  const data = {
    exportTime: new Date().toISOString(),
    app: '云栈',
    version: '1.0.0',
    stats: {
      completedCourses: stats.value.completedCourses,
      totalCourses: stats.value.totalCourses,
      completedChapters: stats.value.completedChapters,
      totalChapters: stats.value.totalChapters,
      quizAccuracy: stats.value.quizAccuracy,
      totalQuestions: stats.value.totalQuestions,
      streakDays: progressStore.streakDays,
      totalStudyDays: progressStore.totalStudyDays,
    },
    completedChapters: progressStore.progress.completedChapters,
    achievements: progressStore.progress.achievements,
    bookmarks: progressStore.bookmarks.map((b) => {
      const course = courseIndex.find((c) => c.id === b.courseId)
      return {
        course: course?.title ?? b.courseId,
        chapter: b.chapterIndex,
        addedAt: new Date(b.createdAt).toLocaleDateString(),
      }
    }),
    labs: progressStore.progress.labRecords,
    reviewCards: progressStore.progress.reviewCards,
    commandHistory: progressStore.progress.commandHistory,
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `云栈-学习进度-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function createSyncSnapshot() {
  progressStore.createSyncSnapshot()
}

function shareLearningNote() {
  progressStore.addCommunityDraft(
    'lab-note',
    `学习复盘 ${new Date().toLocaleDateString()}`,
    `已完成章节 ${stats.value.completedChapters}/${stats.value.totalChapters}，实验 ${stats.value.completedLabs}/${stats.value.totalLabs}。`,
    ['学习复盘', '云栈'],
  )
}
</script>

<template>
  <div class="min-h-screen bg-theme pt-20 pb-16 px-6">
    <div class="max-w-5xl mx-auto">
      <div class="mb-8">
        <div class="flex items-center justify-between mb-3">
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/[0.06] bg-white/[0.02] text-gray-500 text-xs font-mono">
            <Zap class="w-3 h-3" /> 学习面板
          </div>
          <button
            @click="exportProgress"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.04] bg-white/[0.01] text-gray-500 hover:text-white hover:border-white/[0.08] text-xs font-mono transition-all"
          >
            📥 导出进度
          </button>
        </div>
        <h1 class="text-3xl font-bold text-white mb-1">学习进度</h1>
        <p class="text-gray-600 text-sm font-mono">
          {{ progressStore.progress.userProfile.name }} · Lv.{{ progressStore.progress.userProfile.level }} · {{ progressStore.progress.userProfile.targetRole }}
        </p>
      </div>

      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
        <div class="bg-white/[0.01] border border-white/[0.04] rounded-xl p-4">
          <div class="flex items-center gap-2 mb-2">
            <BookOpen class="w-3.5 h-3.5 text-cyan-400" />
            <span class="text-gray-600 text-[10px] font-mono">课程</span>
          </div>
          <span class="text-2xl font-bold text-white font-mono">{{ stats.completedCourses }}</span>
          <span class="text-gray-700 text-xs font-mono ml-1">/ {{ stats.totalCourses }}</span>
        </div>

        <div class="bg-white/[0.01] border border-white/[0.04] rounded-xl p-4">
          <div class="flex items-center gap-2 mb-2">
            <Trophy class="w-3.5 h-3.5 text-amber-400" />
            <span class="text-gray-600 text-[10px] font-mono">章节</span>
          </div>
          <span class="text-2xl font-bold text-white font-mono">{{ stats.completedChapters }}</span>
          <span class="text-gray-700 text-xs font-mono ml-1">/ {{ stats.totalChapters }}</span>
        </div>

        <div class="bg-white/[0.01] border border-white/[0.04] rounded-xl p-4">
          <div class="flex items-center gap-2 mb-2">
            <Target class="w-3.5 h-3.5 text-emerald-400" />
            <span class="text-gray-600 text-[10px] font-mono">准确率</span>
          </div>
          <span class="text-2xl font-bold text-white font-mono">{{ stats.quizAccuracy }}%</span>
          <span class="text-gray-700 text-xs font-mono ml-1">({{ stats.totalQuestions }})</span>
        </div>

        <div class="bg-white/[0.01] border border-white/[0.04] rounded-xl p-4">
          <div class="flex items-center gap-2 mb-2">
            <Award class="w-3.5 h-3.5 text-purple-400" />
            <span class="text-gray-600 text-[10px] font-mono">成就</span>
          </div>
          <span class="text-2xl font-bold text-white font-mono">{{ earnedAchievements.length }}</span>
          <span class="text-gray-700 text-xs font-mono ml-1">/ {{ allAchievements.length }}</span>
        </div>
      </div>

      <!-- 学习统计 -->
      <div class="grid grid-cols-3 gap-3 mb-10">
        <div class="bg-white/[0.01] border border-white/[0.04] rounded-xl p-4">
          <div class="flex items-center gap-2 mb-2">
            <span class="w-3 h-3 rounded-full bg-cyan-400 flex-shrink-0"></span>
            <span class="text-gray-600 text-[10px] font-mono">连续</span>
          </div>
          <span class="text-2xl font-bold text-white font-mono">{{ progressStore.streakDays }}</span>
          <span class="text-gray-700 text-xs font-mono ml-1">天连续</span>
        </div>

        <div class="bg-white/[0.01] border border-white/[0.04] rounded-xl p-4">
          <div class="flex items-center gap-2 mb-2">
            <span class="w-3 h-3 rounded-full bg-amber-400 flex-shrink-0"></span>
            <span class="text-gray-600 text-[10px] font-mono">学习天数</span>
          </div>
          <span class="text-2xl font-bold text-white font-mono">{{ progressStore.totalStudyDays }}</span>
          <span class="text-gray-700 text-xs font-mono ml-1">天总共</span>
        </div>

        <div class="bg-white/[0.01] border border-white/[0.04] rounded-xl p-4">
          <div class="flex items-center gap-2 mb-2">
            <span class="w-3 h-3 rounded-full bg-emerald-400 flex-shrink-0"></span>
            <span class="text-gray-600 text-[10px] font-mono">今日</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-xl font-bold font-mono" :class="progressStore.todayStudied ? 'text-emerald-400' : 'text-gray-600'">
              {{ progressStore.todayStudied ? '已学习' : '待开始' }}
            </span>
            <span v-if="progressStore.todayStudied" class="text-lg">✅</span>
          </div>
        </div>
      </div>

      <div class="grid lg:grid-cols-[1.1fr_0.9fr] gap-4 mb-10">
        <section class="bg-white/[0.01] border border-white/[0.04] rounded-xl p-4">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-2">
              <Flame class="w-4 h-4 text-amber-400" />
              <h2 class="text-white text-sm font-bold font-mono">学习热力图</h2>
            </div>
            <span class="text-[10px] text-gray-600 font-mono">近 21 天</span>
          </div>
          <div class="grid grid-cols-7 gap-1.5">
            <div
              v-for="day in heatmapDays"
              :key="day.date"
              :title="day.date"
              class="aspect-square rounded border"
              :class="day.studied ? 'bg-emerald-400/40 border-emerald-300/40' : 'bg-white/[0.015] border-white/[0.03]'"
            ></div>
          </div>
        </section>

        <section class="bg-white/[0.01] border border-white/[0.04] rounded-xl p-4">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-2">
              <ClipboardCheck class="w-4 h-4 text-emerald-400" />
              <h2 class="text-white text-sm font-bold font-mono">实验闭环</h2>
            </div>
            <span class="text-[10px] text-emerald-400 font-mono">{{ stats.completedLabs }}/{{ stats.totalLabs }}</span>
          </div>
          <div class="h-2 bg-white/[0.03] rounded-full overflow-hidden mb-3">
            <div
              class="h-full bg-emerald-400/70 rounded-full"
              :style="{ width: `${stats.totalLabs ? Math.round((stats.completedLabs / stats.totalLabs) * 100) : 0}%` }"
            ></div>
          </div>
          <div class="space-y-1.5">
            <div
              v-for="cmd in latestCommands"
              :key="cmd.createdAt"
              class="flex items-center justify-between gap-3 text-[11px] font-mono border border-white/[0.03] rounded px-2 py-1.5"
            >
              <span class="text-gray-400 truncate">{{ cmd.command }}</span>
              <span class="text-gray-700 flex-shrink-0">{{ cmd.source }}</span>
            </div>
            <p v-if="latestCommands.length === 0" class="text-gray-600 text-xs">还没有实验命令，去课程页点击代码块“运行”。</p>
          </div>
        </section>
      </div>

      <div class="grid lg:grid-cols-2 gap-4 mb-10">
        <section class="bg-white/[0.01] border border-white/[0.04] rounded-xl p-4">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-2">
              <Brain class="w-4 h-4 text-purple-400" />
              <h2 class="text-white text-sm font-bold font-mono">今日复习</h2>
            </div>
            <span class="text-[10px] text-purple-400 font-mono">到期 {{ progressStore.dueReviewCards.length }}</span>
          </div>
          <div class="space-y-2">
            <div
              v-for="card in dueReviews"
              :key="card.id"
              class="p-3 rounded-lg border border-white/[0.03] bg-white/[0.01]"
            >
              <div class="text-gray-300 text-xs mb-2 line-clamp-2">{{ card.prompt }}</div>
              <div class="flex gap-2">
                <button @click="progressStore.reviewCard(card.id, 2)" class="px-2 py-1 rounded border border-red-400/15 text-red-400 text-[10px] font-mono">重学</button>
                <button @click="progressStore.reviewCard(card.id, 4)" class="px-2 py-1 rounded border border-emerald-400/15 text-emerald-400 text-[10px] font-mono">掌握</button>
              </div>
            </div>
            <p v-if="dueReviews.length === 0" class="text-gray-600 text-xs">今天没有到期复习卡。错题和完成的实验会自动进入间隔复习。</p>
          </div>
        </section>

        <section class="bg-white/[0.01] border border-white/[0.04] rounded-xl p-4">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-2">
              <Target class="w-4 h-4 text-red-400" />
              <h2 class="text-white text-sm font-bold font-mono">薄弱知识点</h2>
            </div>
            <span class="text-[10px] text-red-400 font-mono">{{ progressStore.wrongQuestionCards.length }} 张卡片</span>
          </div>
          <div class="space-y-2">
            <div
              v-for="item in weakCategories"
              :key="item.categoryId"
              class="flex items-center gap-3"
            >
              <span class="w-28 text-[11px] text-gray-400 truncate">{{ item.title }}</span>
              <div class="flex-1 h-1.5 bg-white/[0.03] rounded-full overflow-hidden">
                <div class="h-full bg-red-400/60" :style="{ width: `${Math.min(100, item.wrong * 18)}%` }"></div>
              </div>
              <span class="text-[10px] text-red-400 font-mono">{{ item.wrong }}</span>
            </div>
            <p v-if="weakCategories.length === 0" class="text-gray-600 text-xs">还没有错题记录，完成问答后这里会显示薄弱方向。</p>
          </div>
        </section>
      </div>

      <div class="grid lg:grid-cols-2 gap-4 mb-10">
        <section class="bg-white/[0.01] border border-white/[0.04] rounded-xl p-4">
          <div class="flex items-center gap-2 mb-3">
            <Cloud class="w-4 h-4 text-cyan-400" />
            <h2 class="text-white text-sm font-bold font-mono">云同步准备</h2>
          </div>
          <p class="text-gray-600 text-xs leading-relaxed mb-3">
            当前为本地优先同步快照：可导出完整学习状态，后续接 Supabase/Firebase 时直接上传该数据结构。
          </p>
          <div class="flex items-center gap-2">
            <button @click="createSyncSnapshot" class="px-3 py-2 rounded-lg bg-cyan-400/10 border border-cyan-400/15 text-cyan-400 text-xs font-mono">
              创建快照
            </button>
            <span class="text-[10px] text-gray-600 font-mono">
              {{ syncStatus ? new Date(syncStatus.createdAt).toLocaleString() : '暂无快照' }}
            </span>
          </div>
        </section>

        <section class="bg-white/[0.01] border border-white/[0.04] rounded-xl p-4">
          <div class="flex items-center gap-2 mb-3">
            <Share2 class="w-4 h-4 text-amber-400" />
            <h2 class="text-white text-sm font-bold font-mono">社区分享草稿</h2>
          </div>
          <p class="text-gray-600 text-xs leading-relaxed mb-3">
            先把实验笔记/YAML/命令收藏沉淀为本地草稿，等用户系统上线即可发布到社区。
          </p>
          <button @click="shareLearningNote" class="px-3 py-2 rounded-lg bg-amber-400/10 border border-amber-400/15 text-amber-400 text-xs font-mono">
            生成复盘草稿
          </button>
          <span class="ml-2 text-[10px] text-gray-600 font-mono">{{ progressStore.progress.communityDrafts.length }} 条草稿</span>
        </section>
      </div>

      <div v-if="courseProgress.length > 0" class="mb-10">
        <h2 class="text-lg font-bold text-white mb-4 font-mono">学习中</h2>
        <div class="space-y-2">
          <div
            v-for="cp in courseProgress"
            :key="cp.id"
            @click="router.push(`/course/${cp.id}`)"
            class="group flex items-center gap-3 bg-white/[0.01] border border-white/[0.04] rounded-lg p-3 cursor-pointer hover:bg-white/[0.02] hover:border-white/[0.06] transition-all"
          >
            <div class="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-xs font-mono font-bold" :class="cp.pct === 100 ? 'bg-emerald-400/5 text-emerald-400 border border-emerald-400/15' : 'bg-cyan-400/5 text-cyan-400 border border-cyan-400/15'">
              {{ cp.pct }}%
            </div>
            <div class="flex-1 min-w-0">
              <h3 class="text-white font-medium text-sm mb-1">{{ cp.title }}</h3>
              <div class="h-1 bg-white/[0.03] rounded-full overflow-hidden">
                <div
                  class="h-full rounded-full transition-all"
                  :class="cp.pct === 100 ? 'bg-emerald-400/60' : 'bg-cyan-400/60'"
                  :style="{ width: `${cp.pct}%` }"
                ></div>
              </div>
              <span class="text-[10px] text-gray-600 font-mono mt-0.5 inline-block">已学 {{ cp.completed }}/{{ cp.total }} 章</span>
            </div>
            <ChevronRight class="w-3.5 h-3.5 text-gray-700 group-hover:text-cyan-400 transition-colors flex-shrink-0" />
          </div>
        </div>
      </div>

      <div v-else class="mb-10 text-center py-12 bg-white/[0.005] rounded-xl border border-white/[0.03]">
        <Star class="w-10 h-10 text-gray-700 mx-auto mb-3" />
        <p class="text-gray-600 text-sm font-mono">还没有学习记录</p>
        <button
          @click="router.push('/courses')"
          class="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-400/5 border border-cyan-400/15 text-cyan-400 text-xs font-mono hover:bg-cyan-400/10 transition-colors"
        >
          开始学习 <ChevronRight class="w-3 h-3" />
        </button>
      </div>

      <div>
        <h2 class="text-lg font-bold text-white mb-4 font-mono">
          成就列表
          <span class="text-gray-600 text-xs font-normal ml-2">{{ earnedAchievements.length }}/{{ allAchievements.length }}</span>
        </h2>

        <div class="grid grid-cols-3 md:grid-cols-6 lg:grid-cols-6 gap-2">
          <div
            v-for="ach in [...earnedAchievements, ...unearnedAchievements]"
            :key="ach.id"
            :class="[
              'flex flex-col items-center gap-1.5 p-3 rounded-lg border text-center transition-all',
              progressStore.hasAchievement(ach.id)
                ? 'bg-amber-400/[0.03] border-amber-400/15'
                : 'bg-white/[0.005] border-white/[0.03] opacity-30 grayscale',
            ]"
          >
            <span class="text-2xl">{{ ach.icon }}</span>
            <span
              :class="[
                'text-[10px] font-mono font-semibold leading-tight',
                progressStore.hasAchievement(ach.id) ? 'text-white' : 'text-gray-700',
              ]"
            >
              {{ ach.name }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
