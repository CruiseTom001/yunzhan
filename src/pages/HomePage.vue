<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowRight, BookOpen, PenTool, BarChart3, Terminal, Zap, Shield, Cloud, ChevronRight, Play, Lock, Unlock } from 'lucide-vue-next'
import { courseIndex, chapterCounts } from '@/data/courses/index'
import { getCourseIconChar } from '@/data/courseIcons'
import type { Difficulty, CourseIcon } from '@/types'
import ParticleBg from '@/components/common/ParticleBg.vue'
import { useProgressStore } from '@/stores/progress'

const router = useRouter()
const progressStore = useProgressStore()
const appVersion = __APP_VERSION__
const pageRoot = ref<HTMLElement | null>(null)
const typedText = ref('')
const fullText = '从入门到高级，系统化掌握运维全栈技能'
const activePhase = ref(0)
let typeTimer: ReturnType<typeof setInterval> | null = null
let revealObserver: IntersectionObserver | null = null

onMounted(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduceMotion) {
    typedText.value = fullText
  }

  let i = 0
  if (!reduceMotion) {
    typeTimer = setInterval(() => {
      if (i <= fullText.length) {
        typedText.value = fullText.slice(0, i)
        i++
      } else if (typeTimer) {
        clearInterval(typeTimer)
        typeTimer = null
      }
    }, 54)
  }

  const revealElements = pageRoot.value?.querySelectorAll<HTMLElement>('[data-reveal]') ?? []
  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealElements.forEach((element) => element.classList.add('is-visible'))
    return
  }

  revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return
      entry.target.classList.add('is-visible')
      revealObserver?.unobserve(entry.target)
    })
  }, { threshold: 0.12, rootMargin: '0px 0px -48px' })

  revealElements.forEach((element) => revealObserver?.observe(element))
})

onUnmounted(() => {
  if (typeTimer) {
    clearInterval(typeTimer)
    typeTimer = null
  }
  revealObserver?.disconnect()
  revealObserver = null
})

function handleInteractiveMove(event: PointerEvent) {
  if (event.pointerType === 'touch' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const element = event.currentTarget
  if (!(element instanceof HTMLElement)) return

  const bounds = element.getBoundingClientRect()
  const horizontalRatio = (event.clientX - bounds.left) / bounds.width - 0.5
  const verticalRatio = (event.clientY - bounds.top) / bounds.height - 0.5
  element.style.setProperty('--tilt-x', `${(-verticalRatio * 3).toFixed(2)}deg`)
  element.style.setProperty('--tilt-y', `${(horizontalRatio * 4).toFixed(2)}deg`)
}

function resetInteractiveSurface(event: PointerEvent) {
  const element = event.currentTarget
  if (!(element instanceof HTMLElement)) return
  element.style.setProperty('--tilt-x', '0deg')
  element.style.setProperty('--tilt-y', '0deg')
}

const totalCourses = courseIndex.length

const difficultyStats = {
  beginner: courseIndex.filter((c) => c.difficulty === 'beginner').length,
  intermediate: courseIndex.filter((c) => c.difficulty === 'intermediate').length,
  advanced: courseIndex.filter((c) => c.difficulty === 'advanced').length,
}

const quickLinks = [
  { label: '浏览全部课程', icon: BookOpen, path: '/courses', color: 'text-cyan-400', glow: 'shadow-cyan-500/20' },
  { label: '开始答题练习', icon: PenTool, path: '/quiz', color: 'text-purple-400', glow: 'shadow-purple-500/20' },
  { label: '查看学习进度', icon: BarChart3, path: '/progress', color: 'text-emerald-400', glow: 'shadow-emerald-500/20' },
]

// 技能树路线图
const roadmapSteps = [
  {
    phase: 'LVL.1',
    label: '夯实基础',
    sub: 'Foundation',
    color: 'emerald',
    glow: 'shadow-emerald-400/20',
    courses: ['computer-basics', 'linux-basics', 'networking', 'git'],
  },
  {
    phase: 'LVL.2',
    label: '核心技能',
    sub: 'Core Skills',
    color: 'cyan',
    glow: 'shadow-cyan-400/20',
    courses: ['web-server', 'database', 'cache-queue', 'python-ops', 'virtualization'],
  },
  {
    phase: 'LVL.3',
    label: '进阶实战',
    sub: 'Advanced',
    color: 'amber',
    glow: 'shadow-amber-400/20',
    courses: ['docker', 'cicd', 'monitoring', 'logging', 'security'],
  },
  {
    phase: 'LVL.4',
    label: '高级架构',
    sub: 'Architecture',
    color: 'rose',
    glow: 'shadow-rose-400/20',
    courses: ['kubernetes', 'automation', 'high-availability', 'cloud-ops', 'devops-sre'],
  },
]

function getCourseTitle(id: string) {
  return courseIndex.find((c) => c.id === id)?.title ?? id
}

function getCourseProgress(id: string) {
  const total = chapterCounts[id] ?? 0
  if (total === 0) return 0
  const completed = progressStore.progress.completedChapters[id]?.length ?? 0
  return Math.round((completed / total) * 100)
}

function getPhaseProgress(step: typeof roadmapSteps[0]) {
  const progresses = step.courses.map((id) => getCourseProgress(id))
  return progresses.length > 0 ? Math.round(progresses.reduce((a, b) => a + b, 0) / progresses.length) : 0
}

function isCurrentCourse(courseId: string) {
  return progressStore.progress.lastVisited === courseId
}

function isRoadmapConnectionActive(courseIds: string[], coursePosition: number) {
  const nextCourseId = courseIds[coursePosition + 1]
  return Boolean(nextCourseId)
    && getCourseProgress(courseIds[coursePosition]) > 0
    && getCourseProgress(nextCourseId) > 0
}

// ===== 继续学习逻辑 =====
interface CourseMeta {
  id: string
  title: string
  icon: CourseIcon
  chapterCount: number
}

const lastVisitedCourse = computed<CourseMeta | null>(() => {
  const id = progressStore.progress.lastVisited
  if (!id || !courseIndex.find((c) => c.id === id)) return null
  const meta = courseIndex.find((c) => c.id === id)!
  return {
    id: meta.id,
    title: meta.title,
    icon: meta.icon,
    chapterCount: chapterCounts[id] ?? 0,
  }
})

const lastVisitedChapter = computed(() => {
  if (!lastVisitedCourse.value) return 0
  const completed = progressStore.progress.completedChapters[lastVisitedCourse.value.id] ?? []
  // 找到下一个未完成的章节
  for (let i = 0; i < lastVisitedCourse.value.chapterCount; i++) {
    if (!completed.includes(i)) return i
  }
  return lastVisitedCourse.value.chapterCount - 1
})

const lastVisitedProgress = computed(() => {
  if (!lastVisitedCourse.value) return 0
  const total = lastVisitedCourse.value.chapterCount
  if (total === 0) return 0
  const completed = progressStore.progress.completedChapters[lastVisitedCourse.value.id]?.length ?? 0
  return Math.round((completed / total) * 100)
})

const colorMap: Record<string, { border: string; bg: string; text: string; dot: string; ring: string; fill: string; hexBg: string }> = {
  emerald: { border: 'border-emerald-400/20', bg: 'bg-emerald-400/5', text: 'text-emerald-400', dot: 'bg-emerald-400', ring: 'ring-emerald-400/30', fill: 'fill-emerald-400', hexBg: '#0a1a14' },
  cyan: { border: 'border-cyan-400/20', bg: 'bg-cyan-400/5', text: 'text-cyan-400', dot: 'bg-cyan-400', ring: 'ring-cyan-400/30', fill: 'fill-cyan-400', hexBg: '#0a141a' },
  amber: { border: 'border-amber-400/20', bg: 'bg-amber-400/5', text: 'text-amber-400', dot: 'bg-amber-400', ring: 'ring-amber-400/30', fill: 'fill-amber-400', hexBg: '#1a160a' },
  rose: { border: 'border-rose-400/20', bg: 'bg-rose-400/5', text: 'text-rose-400', dot: 'bg-rose-400', ring: 'ring-rose-400/30', fill: 'fill-rose-400', hexBg: '#1a0a10' },
}

// 终端风格统计
const termLines = computed(() => [
  { prompt: true, text: `cat /courses/count` },
  { prompt: false, text: `共 ${totalCourses} 门课程` },
  { prompt: true, text: `ls ./beginner/` },
  { prompt: false, text: `${difficultyStats.beginner} 门课程就绪` },
  { prompt: true, text: `ls ./advanced/` },
  { prompt: false, text: `${difficultyStats.advanced} 门课程就绪` },
  { prompt: true, text: `echo "准备开始了吗？"` },
  { prompt: false, text: '准备好了' },
])
</script>

<template>
  <div ref="pageRoot" class="min-h-screen bg-theme">
    <!-- Hero Section - 终端风格 -->
    <section class="relative min-h-[90vh] flex flex-col items-center justify-center px-6 pt-20 pb-16 overflow-hidden">
      <ParticleBg />
      <div class="absolute inset-0 bg-gradient-to-b from-[#06060b] via-transparent to-[#06060b] pointer-events-none"></div>

      <div class="relative z-10 text-center max-w-5xl w-full">
        <!-- 终端窗口装饰 -->
        <div class="max-w-2xl mx-auto mb-10 animate-fade-in">
          <div
            class="hero-terminal interactive-surface relative rounded-xl border border-white/[0.06] bg-[#0c0c14]/80 backdrop-blur overflow-hidden shadow-2xl shadow-black/50"
            @pointermove="handleInteractiveMove"
            @pointerleave="resetInteractiveSurface"
          >
            <!-- 终端标题栏 -->
            <div class="flex items-center gap-2 px-4 py-2.5 bg-white/[0.02] border-b border-white/[0.04]">
              <div class="w-3 h-3 rounded-full bg-red-500/70"></div>
              <div class="w-3 h-3 rounded-full bg-yellow-500/70"></div>
              <div class="w-3 h-3 rounded-full bg-green-500/70"></div>
              <span class="text-gray-600 text-xs font-mono ml-2">ops-learner@terminal</span>
              <span class="terminal-status ml-auto inline-flex items-center gap-1.5 text-[10px] font-mono text-emerald-400/70">
                <span class="status-pulse w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                SYSTEM ONLINE
              </span>
            </div>
            <!-- 终端内容 -->
            <div class="p-4 font-mono text-sm text-left space-y-1">
              <div v-for="(line, i) in termLines" :key="i" class="terminal-line flex items-start gap-2">
                <span v-if="line.prompt" class="text-cyan-400 select-none">$</span>
                <span v-else class="w-3"></span>
                <span :class="line.prompt ? 'text-gray-300' : 'text-emerald-400/80'">{{ line.text }}</span>
              </div>
              <div class="flex items-center gap-2 mt-2">
                <span class="text-cyan-400 select-none">$</span>
                <span class="text-gray-300">{{ typedText }}</span>
                <span class="inline-block w-2 h-4 bg-cyan-400 animate-pulse"></span>
              </div>
            </div>
            <span class="terminal-scan" aria-hidden="true"></span>
          </div>
        </div>

        <!-- 主标题 -->
        <h1 data-text="云栈" class="brand-glitch text-5xl md:text-7xl font-bold text-white mb-4 leading-none tracking-tight animate-fade-in">
          云<span class="bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-500 bg-clip-text text-transparent">栈</span>
        </h1>

        <p class="text-lg text-gray-500 mb-10 animate-fade-in font-light">
          云计算入门到精通 · {{ totalCourses }} 门课程 · 完全免费
        </p>

        <!-- CTA 按钮 -->
        <div class="flex flex-col sm:flex-row items-center justify-center gap-4 mb-14 animate-fade-in">
          <button
            @click="router.push('/courses')"
            class="action-button group flex items-center gap-2.5 px-8 py-4 rounded-xl bg-cyan-500 text-[#06060b] font-bold text-base shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40 hover:bg-cyan-400 transition-all duration-300"
          >
            <Play class="w-4 h-4" />
            开始学习
            <ArrowRight class="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
          <button
            @click="router.push('/quiz')"
            class="action-button flex items-center gap-2 px-8 py-4 rounded-xl border border-white/10 bg-white/[0.02] text-gray-300 font-medium text-base hover:bg-white/[0.05] hover:border-white/20 transition-all duration-300"
          >
            问答练习
          </button>
        </div>

        <!-- 难度统计 - 六边形风格 -->
        <div class="grid grid-cols-3 gap-3 max-w-xl mx-auto animate-fade-in">
          <div
            v-for="d in [
              { key: 'beginner' as Difficulty, label: '入门', color: 'text-emerald-400', border: 'border-emerald-400/15', bg: 'bg-emerald-400/5' },
              { key: 'intermediate' as Difficulty, label: '进阶', color: 'text-amber-400', border: 'border-amber-400/15', bg: 'bg-amber-400/5' },
              { key: 'advanced' as Difficulty, label: '高级', color: 'text-rose-400', border: 'border-rose-400/15', bg: 'bg-rose-400/5' },
            ]"
            :key="d.key"
            class="group cursor-pointer rounded-xl border p-4 text-center hover:-translate-y-1 transition-all duration-300"
            :class="[d.border, d.bg, 'hover:shadow-lg']"
            @click="router.push('/courses')"
          >
            <div :class="[d.color, 'text-3xl font-bold font-mono']">{{ difficultyStats[d.key] }}</div>
            <div class="text-gray-500 text-xs mt-1">{{ d.label }}</div>
          </div>
        </div>
      </div>
    </section>

    <!-- ===== 继续学习 ===== -->
    <section v-if="lastVisitedCourse" class="max-w-6xl mx-auto px-6 pb-8">
      <div class="rounded-xl border border-cyan-400/10 bg-gradient-to-r from-cyan-400/[0.03] to-transparent p-5 md:p-6">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <div class="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></div>
            <span class="text-xs font-mono text-cyan-400 font-semibold">继续学习</span>
          </div>
          <button
            @click="router.push('/courses')"
            class="text-[10px] font-mono text-gray-600 hover:text-white transition-colors"
          >
            查看全部 →
          </button>
        </div>
        <button
          @click="router.push(`/course/${lastVisitedCourse.id}/chapter/${lastVisitedChapter}`)"
          class="group flex items-center gap-4 w-full text-left"
        >
          <div class="w-12 h-12 rounded-lg bg-cyan-400/10 border border-cyan-400/15 flex items-center justify-center font-mono text-cyan-400 text-lg flex-shrink-0">
            {{ getCourseIconChar(lastVisitedCourse.icon) }}
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-white font-semibold text-sm group-hover:text-cyan-400 transition-colors truncate">
              {{ lastVisitedCourse.title }}
            </div>
            <div class="text-gray-500 text-xs mt-0.5 font-mono">
              第 {{ lastVisitedChapter + 1 }} 章 · 共 {{ lastVisitedCourse.chapterCount }} 章
            </div>
            <div class="flex items-center gap-2 mt-1.5">
              <div class="flex-1 h-1 bg-white/[0.04] rounded-full overflow-hidden">
                <div
                  class="h-full bg-cyan-400/60 rounded-full transition-all"
                  :style="{ width: `${lastVisitedProgress}%` }"
                ></div>
              </div>
              <span class="text-[10px] text-gray-600 font-mono">{{ lastVisitedProgress }}%</span>
            </div>
          </div>
          <ChevronRight class="w-4 h-4 text-gray-700 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
        </button>
      </div>
    </section>

    <!-- ===== 我的收藏 ===== -->
    <section v-if="progressStore.bookmarks.length > 0" class="max-w-6xl mx-auto px-6 pb-8">
      <div class="rounded-xl border border-amber-400/10 bg-gradient-to-r from-amber-400/[0.03] to-transparent p-5 md:p-6">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <span class="text-sm text-amber-400">★</span>
            <span class="text-xs font-mono text-amber-400 font-semibold">我的收藏</span>
          </div>
        </div>
        <div class="space-y-2">
          <button
            v-for="bm in progressStore.bookmarks.slice(0, 5)"
            :key="`${bm.courseId}-${bm.chapterIndex}`"
            @click="router.push(`/course/${bm.courseId}/chapter/${bm.chapterIndex}`)"
            class="group flex items-center gap-3 w-full text-left hover:bg-white/[0.02] rounded-lg p-2 -mx-2 transition-colors"
          >
            <span class="text-sm text-amber-400 flex-shrink-0">★</span>
            <div class="flex-1 min-w-0">
              <span class="text-white text-sm group-hover:text-amber-400 transition-colors truncate block">
                {{ getCourseTitle(bm.courseId) }}
              </span>
              <span class="text-gray-600 text-xs font-mono">第 {{ bm.chapterIndex + 1 }} 章</span>
            </div>
            <ChevronRight class="w-3.5 h-3.5 text-gray-700 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
          </button>
        </div>
      </div>
    </section>

    <!-- 技能树路线图 - 游戏风格 -->
    <section data-reveal class="reveal-section max-w-6xl mx-auto px-6 pb-28">
      <div class="text-center mb-16">
        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/[0.06] bg-white/[0.02] text-gray-500 text-xs font-mono mb-4">
          <Zap class="w-3 h-3" /> 技能树
        </div>
        <h2 class="text-3xl font-bold text-white mb-2">技能树</h2>
        <p class="text-gray-500 text-sm">逐级解锁，从新手到架构师</p>
      </div>

      <div class="space-y-6">
        <div
          v-for="(step, idx) in roadmapSteps"
          :key="step.phase"
          class="skill-phase group"
          :style="{ '--phase-index': idx }"
          @mouseenter="activePhase = idx"
          @mouseleave="activePhase = -1"
        >
          <!-- 阶段标题行 -->
          <div class="flex items-center gap-4 mb-4">
            <div
              :class="[
                'flex items-center gap-3 px-4 py-2 rounded-lg border transition-all duration-300',
                colorMap[step.color].border,
                activePhase === idx ? colorMap[step.color].bg : 'bg-transparent',
              ]"
            >
              <span :class="[colorMap[step.color].text, 'font-mono font-bold text-sm']">{{ step.phase }}</span>
              <span class="text-white font-medium text-sm">{{ step.label }}</span>
              <span class="text-gray-600 text-xs font-mono">{{ step.sub }}</span>
            </div>
            <div class="flex-1 h-px bg-white/[0.04]"></div>
            <div class="flex items-center gap-2">
              <div class="h-1.5 w-20 bg-white/[0.04] rounded-full overflow-hidden">
                <div
                  :class="['phase-progress-flow h-full rounded-full transition-all duration-700', idx === 0 ? 'bg-emerald-400' : idx === 1 ? 'bg-cyan-400' : idx === 2 ? 'bg-amber-400' : 'bg-rose-400']"
                  :style="{ width: `${getPhaseProgress(step)}%` }"
                ></div>
              </div>
              <span class="text-gray-600 text-xs font-mono w-8">{{ getPhaseProgress(step) }}%</span>
            </div>
          </div>

          <!-- 课程节点 -->
          <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div
              v-for="(courseId, coursePosition) in step.courses"
              :key="courseId"
              class="skill-node-shell"
              :class="{ 'skill-node-linked': isRoadmapConnectionActive(step.courses, coursePosition) }"
            >
              <span v-if="coursePosition < step.courses.length - 1" class="skill-node-connector" aria-hidden="true" />
              <button
                @click="router.push(`/course/${courseId}`)"
                class="skill-node interactive-surface group/card relative h-full w-full rounded-xl border p-4 text-left transition-all duration-300 hover:-translate-y-1"
                :class="[
                  getCourseProgress(courseId) > 0
                    ? `${colorMap[step.color].border} ${colorMap[step.color].bg}`
                    : 'border-white/[0.04] bg-white/[0.01] hover:border-white/[0.08] hover:bg-white/[0.02]',
                  getCourseProgress(courseId) > 0 && getCourseProgress(courseId) < 100 ? 'skill-node-active' : '',
                  getCourseProgress(courseId) === 100 ? 'skill-node-complete' : '',
                  isCurrentCourse(courseId) ? 'skill-node-current' : '',
                ]"
                :style="{ '--node-index': coursePosition }"
                @pointermove="handleInteractiveMove"
                @pointerleave="resetInteractiveSurface"
              >
                <div class="absolute top-3 right-3">
                  <Unlock v-if="getCourseProgress(courseId) > 0" :class="[colorMap[step.color].text, 'w-3.5 h-3.5']" />
                  <Lock v-else class="w-3.5 h-3.5 text-gray-700" />
                </div>

                <span v-if="isCurrentCourse(courseId)" class="skill-node-current-label">当前</span>

                <div class="pr-6">
                  <div class="text-white text-sm font-medium group-hover/card:text-cyan-400 transition-colors leading-snug mb-2">
                    {{ getCourseTitle(courseId) }}
                  </div>
                </div>

                <div v-if="getCourseProgress(courseId) > 0" class="flex items-center gap-2">
                  <div class="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                    <div
                      class="animated-progress h-full rounded-full"
                      :class="idx === 0 ? 'bg-emerald-400' : idx === 1 ? 'bg-cyan-400' : idx === 2 ? 'bg-amber-400' : 'bg-rose-400'"
                      :style="{ width: `${getCourseProgress(courseId)}%` }"
                    ></div>
                  </div>
                  <span class="text-[10px] text-gray-500 font-mono">{{ getCourseProgress(courseId) }}%</span>
                </div>
                <div v-else class="text-[10px] text-gray-600 font-mono">未开始</div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 学习路径 -->
    <section data-reveal class="reveal-section max-w-5xl mx-auto px-6 pb-16">
      <div class="text-center mb-8">
        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/[0.06] bg-white/[0.02] text-gray-500 text-xs font-mono mb-4">
          <Cloud class="w-3 h-3" /> 学习路径
        </div>
        <h2 class="text-3xl font-bold text-white mb-2">学习路径</h2>
        <p class="text-gray-600 text-sm">选择你的岗位方向，系统规划学习路线</p>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div
          v-for="(path, pathIndex) in [
            { title: 'Linux 运维工程师', desc: '系统管理 + Shell + 安全', courses: 5, time: '3个月', color: 'cyan' },
            { title: 'DevOps 工程师', desc: 'CI/CD + 容器 + 自动化', courses: 9, time: '4个月', color: 'purple' },
            { title: '云原生工程师', desc: 'K8s + 微服务 + 高可用', courses: 8, time: '4个月', color: 'amber' },
            { title: '数据运维工程师', desc: '数据库 + 缓存 + 备份', courses: 6, time: '3个月', color: 'emerald' },
            { title: '全栈运维架构师', desc: '全部 20 门课程', courses: 20, time: '6个月', color: 'rose' },
          ]"
          :key="path.title"
          class="cascade-card interactive-surface group bg-white/[0.01] border border-white/[0.04] rounded-xl p-5 hover:border-white/[0.08] hover:bg-white/[0.02] transition-all cursor-pointer"
          :style="{ '--node-index': pathIndex }"
          @click="router.push('/courses')"
          @pointermove="handleInteractiveMove"
          @pointerleave="resetInteractiveSurface"
        >
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-white font-semibold text-sm">{{ path.title }}</h3>
            <span
              class="px-2 py-0.5 rounded text-[10px] font-mono"
              :class="{
                'bg-cyan-400/10 text-cyan-400': path.color === 'cyan',
                'bg-purple-400/10 text-purple-400': path.color === 'purple',
                'bg-amber-400/10 text-amber-400': path.color === 'amber',
                'bg-emerald-400/10 text-emerald-400': path.color === 'emerald',
                'bg-rose-400/10 text-rose-400': path.color === 'rose',
              }"
            >{{ path.time }}</span>
          </div>
          <p class="text-gray-600 text-xs mb-3">{{ path.desc }}</p>
          <div class="flex items-center justify-between">
            <span class="text-gray-700 text-[10px] font-mono">{{ path.courses }} 门课程</span>
            <div class="h-1 flex-1 mx-2 bg-white/[0.03] rounded-full overflow-hidden">
              <div
                class="h-full rounded-full"
                :style="{ width: `${Math.min(100, Math.round((path.courses / 20) * 100))}%` }"
                :class="{
                  'bg-cyan-400/60': path.color === 'cyan',
                  'bg-purple-400/60': path.color === 'purple',
                  'bg-amber-400/60': path.color === 'amber',
                  'bg-emerald-400/60': path.color === 'emerald',
                  'bg-rose-400/60': path.color === 'rose',
                }"
              ></div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 特色功能 - 网格风格 -->
    <section data-reveal class="reveal-section max-w-5xl mx-auto px-6 pb-20">
      <div class="text-center mb-12">
        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/[0.06] bg-white/[0.02] text-gray-500 text-xs font-mono mb-4">
          <Shield class="w-3 h-3" /> 核心特性
        </div>
        <h2 class="text-3xl font-bold text-white mb-2">核心特性</h2>
      </div>

      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-16">
        <div
          v-for="(f, i) in [
            { icon: Terminal, title: 'Linux 命令', desc: '100+ 命令详解', accent: 'from-emerald-400/10 to-transparent' },
            { icon: Zap, title: '实战练习', desc: '360+ 题目', accent: 'from-amber-400/10 to-transparent' },
            { icon: Shield, title: '体系化', desc: '20 门课程', accent: 'from-cyan-400/10 to-transparent' },
            { icon: Cloud, title: '进度追踪', desc: '成就系统', accent: 'from-purple-400/10 to-transparent' },
          ]"
          :key="i"
          class="cascade-card interactive-surface relative overflow-hidden rounded-xl border border-white/[0.04] bg-white/[0.01] p-5 hover:bg-white/[0.03] transition-all group"
          :style="{ '--node-index': i }"
          @pointermove="handleInteractiveMove"
          @pointerleave="resetInteractiveSurface"
        >
          <div class="absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity" :class="f.accent"></div>
          <div class="relative">
            <component :is="f.icon" class="w-6 h-6 text-gray-400 group-hover:text-white transition-colors mb-3" />
            <h3 class="text-white font-semibold text-sm mb-0.5">{{ f.title }}</h3>
            <p class="text-gray-600 text-xs">{{ f.desc }}</p>
          </div>
        </div>
      </div>

      <!-- 快速入口 -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
        <button
          v-for="link in quickLinks"
          :key="link.path"
          @click="router.push(link.path)"
          class="action-button group flex items-center justify-between rounded-xl border border-white/[0.04] bg-white/[0.01] p-5 hover:bg-white/[0.03] hover:border-white/[0.08] transition-all duration-300"
        >
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
              <component :is="link.icon" :class="[link.color, 'w-4 h-4']" />
            </div>
            <span class="text-white font-medium text-sm">{{ link.label }}</span>
          </div>
          <ChevronRight class="w-4 h-4 text-gray-700 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all" />
        </button>
      </div>
    </section>

    <!-- 底部终端装饰 -->
    <footer class="border-t border-white/[0.03] py-8">
      <div class="max-w-5xl mx-auto px-6 flex items-center justify-between">
        <span class="text-gray-700 text-xs font-mono">云栈 v{{ appVersion }}</span>
        <span class="text-gray-700 text-xs font-mono">Vue + TypeScript 构建</span>
      </div>
    </footer>
  </div>
</template>

<style scoped>
@keyframes fade-in {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes terminal-line-in {
  from { opacity: 0; transform: translateX(-8px); }
  to { opacity: 1; transform: translateX(0); }
}

@keyframes terminal-scan {
  0%, 12% { opacity: 0; top: 34px; }
  16% { opacity: 0.65; }
  38% { opacity: 0; top: calc(100% - 2px); }
  100% { opacity: 0; top: calc(100% - 2px); }
}

@keyframes status-beacon {
  0%, 100% { opacity: 0.45; box-shadow: 0 0 0 0 rgb(52 211 153 / 0); }
  45% { opacity: 1; box-shadow: 0 0 0 5px rgb(52 211 153 / 0.08); }
}

@keyframes brand-glitch-cyan {
  0%, 88%, 100% { opacity: 0; transform: translate(0); clip-path: inset(0 0 100% 0); }
  89% { opacity: 0.7; transform: translate(-3px, 1px); clip-path: inset(10% 0 62% 0); }
  90% { opacity: 0.35; transform: translate(2px, -1px); clip-path: inset(55% 0 18% 0); }
  91% { opacity: 0; transform: translate(0); clip-path: inset(0 0 100% 0); }
}

@keyframes brand-glitch-violet {
  0%, 89%, 100% { opacity: 0; transform: translate(0); clip-path: inset(100% 0 0 0); }
  90% { opacity: 0.6; transform: translate(3px, 0); clip-path: inset(32% 0 42% 0); }
  91% { opacity: 0.25; transform: translate(-2px, 1px); clip-path: inset(72% 0 8% 0); }
  92% { opacity: 0; transform: translate(0); clip-path: inset(100% 0 0 0); }
}

@keyframes node-reveal {
  from { opacity: 0; clip-path: inset(0 0 22% 0); }
  to { opacity: 1; clip-path: inset(0 0 0 0); }
}

.animate-fade-in {
  animation: fade-in 0.6s ease-out both;
}
.animate-fade-in:nth-child(2) { animation-delay: 0.1s; }
.animate-fade-in:nth-child(3) { animation-delay: 0.2s; }
.animate-fade-in:nth-child(4) { animation-delay: 0.3s; }

.terminal-line {
  animation: terminal-line-in 0.35s ease-out both;
}
.terminal-line:nth-child(1) { animation-delay: 0.08s; }
.terminal-line:nth-child(2) { animation-delay: 0.14s; }
.terminal-line:nth-child(3) { animation-delay: 0.2s; }
.terminal-line:nth-child(4) { animation-delay: 0.26s; }
.terminal-line:nth-child(5) { animation-delay: 0.32s; }
.terminal-line:nth-child(6) { animation-delay: 0.38s; }
.terminal-line:nth-child(7) { animation-delay: 0.44s; }
.terminal-line:nth-child(8) { animation-delay: 0.5s; }

.terminal-scan {
  position: absolute;
  z-index: 2;
  top: 34px;
  left: 0;
  width: 100%;
  height: 1px;
  background: rgb(34 211 238 / 0.7);
  box-shadow: 0 0 12px rgb(34 211 238 / 0.45);
  opacity: 0;
  pointer-events: none;
  animation: terminal-scan 4.8s ease-in-out 0.8s infinite;
}

.status-pulse {
  animation: status-beacon 1.8s ease-in-out infinite;
}

.brand-glitch {
  position: relative;
  display: inline-block;
  isolation: isolate;
}

.brand-glitch::before,
.brand-glitch::after {
  position: absolute;
  inset: 0;
  z-index: -1;
  content: attr(data-text);
  pointer-events: none;
  opacity: 0;
}

.brand-glitch::before {
  color: #22d3ee;
  animation: brand-glitch-cyan 5.4s steps(1, end) 1.2s infinite;
}

.brand-glitch::after {
  color: #a78bfa;
  animation: brand-glitch-violet 5.4s steps(1, end) 1.2s infinite;
}

.reveal-section {
  opacity: 0;
  transform: translateY(28px);
  transition: opacity 0.65s ease, transform 0.65s ease;
}

.reveal-section.is-visible {
  opacity: 1;
  transform: translateY(0);
}

.reveal-section .skill-phase,
.reveal-section .skill-node,
.reveal-section .cascade-card {
  opacity: 0;
}

.reveal-section.is-visible .skill-phase {
  animation: node-reveal 0.55s ease-out both;
  animation-delay: calc(0.06s + var(--phase-index) * 0.13s);
}

.reveal-section.is-visible .skill-node {
  animation: node-reveal 0.5s ease-out both;
  animation-delay: calc(0.12s + var(--phase-index) * 0.13s + var(--node-index) * 0.045s);
}

.reveal-section.is-visible .cascade-card {
  animation: node-reveal 0.5s ease-out both;
  animation-delay: calc(0.08s + var(--node-index) * 0.07s);
}

.reveal-section .animated-progress {
  transform: scaleX(0);
  transform-origin: left center;
  transition: transform 0.85s cubic-bezier(0.22, 1, 0.36, 1);
}

.reveal-section.is-visible .animated-progress {
  transform: scaleX(1);
}

.phase-progress-flow {
  position: relative;
  overflow: hidden;
}

.phase-progress-flow::after {
  position: absolute;
  inset: 0;
  content: '';
  background: linear-gradient(90deg, transparent, rgb(255 255 255 / 0.65), transparent);
  transform: translateX(-100%);
  animation: phase-progress-scan 2.2s ease-in-out infinite;
}

.skill-node-shell {
  position: relative;
  min-width: 0;
}

.skill-node-connector {
  position: absolute;
  top: 50%;
  left: 100%;
  z-index: 0;
  display: block;
  width: 12px;
  height: 1px;
  overflow: hidden;
  background: rgb(255 255 255 / 0.06);
}

.skill-node-connector::after {
  position: absolute;
  inset: 0;
  content: '';
  opacity: 0;
  background: linear-gradient(90deg, transparent, #67e8f9, #34d399, transparent);
  transform: translateX(-100%);
}

.skill-node-linked .skill-node-connector {
  background: rgb(34 211 238 / 0.14);
}

.skill-node-linked .skill-node-connector::after {
  animation: skill-connector-flow 1.8s ease-in-out infinite;
}

.skill-node-current {
  animation: current-node-breathe 2.4s ease-in-out infinite;
}

.skill-node-current-label {
  display: inline-flex;
  margin-bottom: 6px;
  padding: 1px 5px;
  border: 1px solid rgb(251 191 36 / 0.22);
  border-radius: 3px;
  color: #fbbf24;
  background: rgb(251 191 36 / 0.06);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 9px;
}

.skill-node-shell:nth-child(2n) .skill-node-connector {
  display: none;
}

.skill-node-active::before,
.skill-node-complete::before {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  content: '';
}

.skill-node-active::before {
  background: linear-gradient(115deg, transparent 25%, rgb(34 211 238 / 0.05), transparent 70%);
  animation: active-node-scan 2.8s ease-in-out infinite;
}

.skill-node-complete::before {
  border: 1px solid rgb(52 211 153 / 0.26);
  animation: completed-node-pulse 1.4s ease-out 0.4s both;
}

.interactive-surface {
  --tilt-x: 0deg;
  --tilt-y: 0deg;
  transform: perspective(900px) rotateX(var(--tilt-x)) rotateY(var(--tilt-y));
  transform-style: preserve-3d;
  will-change: transform;
}

.interactive-surface:hover {
  box-shadow: 0 16px 40px rgb(0 0 0 / 0.24);
}

.hero-terminal {
  transition: transform 0.16s ease-out, border-color 0.25s ease, box-shadow 0.25s ease;
}

.hero-terminal:hover {
  border-color: rgb(34 211 238 / 0.18);
  box-shadow: 0 24px 70px rgb(0 0 0 / 0.48);
}

.action-button:active {
  transform: translateY(1px) scale(0.98);
}

@media (hover: none), (pointer: coarse) {
  .interactive-surface {
    transform: none;
    will-change: auto;
  }
}

@keyframes phase-progress-scan {
  0%, 28% { opacity: 0; transform: translateX(-100%); }
  46% { opacity: 0.9; }
  72%, 100% { opacity: 0; transform: translateX(100%); }
}

@keyframes skill-connector-flow {
  0%, 20% { opacity: 0; transform: translateX(-100%); }
  48% { opacity: 1; }
  80%, 100% { opacity: 0; transform: translateX(100%); }
}

@keyframes current-node-breathe {
  0%, 100% { box-shadow: 0 0 0 rgb(251 191 36 / 0); }
  50% { box-shadow: 0 0 22px rgb(251 191 36 / 0.09); }
}

@keyframes active-node-scan {
  0%, 45% { opacity: 0; transform: translateX(-70%); }
  62% { opacity: 1; }
  100% { opacity: 0; transform: translateX(70%); }
}

@keyframes completed-node-pulse {
  0% { opacity: 0; box-shadow: inset 0 0 0 rgb(52 211 153 / 0), 0 0 0 rgb(52 211 153 / 0); }
  42% { opacity: 1; box-shadow: inset 0 0 18px rgb(52 211 153 / 0.08), 0 0 24px rgb(52 211 153 / 0.12); }
  100% { opacity: 0.45; box-shadow: inset 0 0 0 rgb(52 211 153 / 0), 0 0 0 rgb(52 211 153 / 0); }
}

@media (min-width: 640px) {
  .skill-node-shell:nth-child(2n) .skill-node-connector {
    display: block;
  }

  .skill-node-shell:nth-child(3n) .skill-node-connector {
    display: none;
  }
}

@media (min-width: 1024px) {
  .skill-node-shell:nth-child(3n) .skill-node-connector {
    display: block;
  }

  .skill-node-shell:nth-child(5n) .skill-node-connector {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .animate-fade-in,
  .terminal-line,
  .terminal-scan,
  .status-pulse,
  .brand-glitch::before,
  .brand-glitch::after,
  .reveal-section,
  .reveal-section .skill-phase,
  .reveal-section .skill-node,
  .reveal-section .cascade-card,
  .reveal-section .animated-progress,
  .phase-progress-flow::after,
  .skill-node-connector::after,
  .skill-node-current,
  .skill-node-active::before,
  .skill-node-complete::before {
    animation: none;
    opacity: 1;
    transform: none;
    transition: none;
  }

  .interactive-surface,
  .action-button,
  .group-hover\\:translate-x-1 {
    transform: none;
    transition-duration: 0.01ms;
  }
}
</style>
