<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Search, Filter, Route, ArrowRight } from 'lucide-vue-next'
import { courseIndex, chapterCounts } from '@/data/courses/index'
import type { Difficulty } from '@/types'
import CourseCard from '@/components/common/CourseCard.vue'
import { useProgressStore } from '@/stores/progress'

defineOptions({ name: 'CourseListPage' })

const router = useRouter()
const progressStore = useProgressStore()
const searchQuery = ref('')
const selectedDifficulty = ref<Difficulty | 'all'>('all')
const selectedCategory = ref<string>('all')
const courseGrid = ref<HTMLElement | null>(null)
let courseRevealObserver: IntersectionObserver | null = null

interface RecommendedCourse {
  id: string
}

interface RecommendedStep {
  title: string
  description: string
  courses: RecommendedCourse[]
}

interface RecommendedCourseWithIndex {
  id: string
  index: number
}

interface RecommendedStepWithIndex {
  title: string
  description: string
  courses: RecommendedCourseWithIndex[]
}

const recommendedSteps: RecommendedStep[] = [
  {
    title: '第 1 阶段：基础入门',
    description: '从零开始：计算机基础、Linux 与网络是后面所有方向的地基。',
    courses: [
      { id: 'computer-basics' },
      { id: 'linux-basics' },
      { id: 'networking' },
    ],
  },
  {
    title: '第 2 阶段：服务部署',
    description: '把常见 Web 服务、数据库与缓存消息队列跑起来，进入真实运维场景。',
    courses: [
      { id: 'web-server' },
      { id: 'database' },
      { id: 'cache-queue' },
    ],
  },
  {
    title: '第 3 阶段：日常运维能力',
    description: '版本控制、脚本编程、自动化、监控、日志与安全，形成日常运维闭环。',
    courses: [
      { id: 'git' },
      { id: 'python-ops' },
      { id: 'automation' },
      { id: 'monitoring' },
      { id: 'logging' },
      { id: 'security' },
    ],
  },
  {
    title: '第 4 阶段：平台与架构',
    description: '从虚拟化到容器、Kubernetes，再到高可用与云服务，构建平台能力。',
    courses: [
      { id: 'virtualization' },
      { id: 'docker' },
      { id: 'kubernetes' },
      { id: 'high-availability' },
      { id: 'cloud-ops' },
    ],
  },
  {
    title: '第 5 阶段：工程化与实战',
    description: 'CI/CD、DevOps 与 SRE，最后落地到企业级 DevOps 平台综合实战。',
    courses: [
      { id: 'cicd' },
      { id: 'devops-sre' },
      { id: 'devops-project' },
    ],
  },
]

const recommendedStepsWithIndex = computed<RecommendedStepWithIndex[]>(() => {
  let counter = 0
  return recommendedSteps.map((step) => ({
    title: step.title,
    description: step.description,
    courses: step.courses.map((course) => {
      counter += 1
      return { id: course.id, index: counter }
    }),
  }))
})

function getCourseTitle(id: string) {
  return courseIndex.find(course => course.id === id)?.title ?? id
}

const categories = computed(() => {
  const cats = new Map<string, string>()
  cats.set('all', '全部')
  for (const c of courseIndex) {
    const label = c.category === 'linux' ? 'Linux' : c.category === 'networking' ? '网络' : c.category === 'web' ? 'Web' : c.category === 'database' ? '数据库' : c.category === 'cache' ? '缓存' : c.category === 'container' ? '容器' : c.category === 'devops' ? 'DevOps' : c.category === 'monitoring' ? '监控' : c.category === 'automation' ? '自动化' : c.category === 'security' ? '安全' : c.category === 'architecture' ? '架构' : c.category === 'cloud' ? '云服务' : c.category === 'fundamentals' ? '计算机基础' : c.category === 'programming' ? '编程' : c.category === 'infrastructure' ? '基础设施' : c.category
    if (!cats.has(c.category)) {
      cats.set(c.category, label)
    }
  }
  return Array.from(cats.entries()).map(([value, label]) => ({ value, label }))
})

const filteredCourses = computed(() => {
  return courseIndex.filter((c) => {
    const matchSearch =
      !searchQuery.value ||
      c.title.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      c.description.toLowerCase().includes(searchQuery.value.toLowerCase())
    const matchDifficulty = selectedDifficulty.value === 'all' || c.difficulty === selectedDifficulty.value
    const matchCategory = selectedCategory.value === 'all' || c.category === selectedCategory.value
    return matchSearch && matchDifficulty && matchCategory
  })
})

function getCourseProgress(id: string): number {
  const completed = progressStore.progress.completedChapters[id]?.length ?? 0
  const total = chapterCounts[id] ?? 0
  return total > 0 ? Math.round((completed / total) * 100) : 0
}

function getCompletedChapterCount(id: string): number {
  return progressStore.progress.completedChapters[id]?.length ?? 0
}

function goToCourse(id: string) {
  router.push(`/course/${id}`)
}

function observeCourseCards() {
  const cards = courseGrid.value?.querySelectorAll<HTMLElement>('[data-course-entry]') ?? []
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduceMotion || !('IntersectionObserver' in window)) {
    cards.forEach(card => card.classList.add('is-visible'))
    return
  }

  cards.forEach(card => courseRevealObserver?.observe(card))
}

onMounted(() => {
  courseRevealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return
      entry.target.classList.add('is-visible')
      courseRevealObserver?.unobserve(entry.target)
    })
  }, { threshold: 0.08, rootMargin: '0px 0px -36px' })
  observeCourseCards()
})

watch(filteredCourses, async () => {
  await nextTick()
  observeCourseCards()
})

onUnmounted(() => {
  courseRevealObserver?.disconnect()
  courseRevealObserver = null
})
</script>

<template>
  <div class="min-h-screen bg-theme pt-20 pb-16 px-6">
    <div class="max-w-7xl mx-auto">
      <div class="mb-8">
        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/[0.06] bg-white/[0.02] text-gray-500 text-xs font-mono mb-3">
          <Filter class="w-3 h-3" /> 课程库
        </div>
        <h1 class="text-3xl font-bold text-white mb-1">全部课程</h1>
        <p class="text-gray-600 text-sm font-mono">新手先按推荐顺序学；已有基础再用筛选自由选择，共 {{ courseIndex.length }} 门课程</p>
      </div>

      <section class="learning-order mb-8" aria-labelledby="learning-order-title">
        <div class="learning-order-header">
          <div>
            <div class="learning-order-kicker">
              <Route class="w-3.5 h-3.5" aria-hidden="true" />
              学习顺序
            </div>
            <h2 id="learning-order-title">初学者推荐路线</h2>
          </div>
          <p>从零开始建议按下面顺序学习，先打基础，再部署服务，最后进入容器、Kubernetes、云平台与综合实战。</p>
        </div>

        <div class="learning-order-grid">
          <article v-for="step in recommendedStepsWithIndex" :key="step.title" class="learning-order-step">
            <h3>{{ step.title }}</h3>
            <p>{{ step.description }}</p>
            <div class="learning-order-courses">
              <button
                v-for="entry in step.courses"
                :key="entry.id"
                type="button"
                class="learning-order-course"
                @click="goToCourse(entry.id)"
              >
                <span class="learning-order-course-index">{{ String(entry.index).padStart(2, '0') }}</span>
                <span class="learning-order-course-title">{{ getCourseTitle(entry.id) }}</span>
                <ArrowRight class="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          </article>
        </div>

        <p class="learning-order-hint">
          直接从第 1 阶段依次往下学即可，所有课程都在主线中，无需自行跳过。
        </p>
      </section>

      <div class="course-library-header">
        <div>
          <h2>课程库</h2>
          <p>搜索或按难度、方向筛选课程</p>
        </div>
      </div>

      <div class="flex flex-col md:flex-row gap-3 mb-6">
        <div class="relative flex-1">
          <Search class="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索课程..."
            class="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04] text-white text-sm placeholder-gray-600 focus:outline-none focus:border-cyan-400/20 focus:bg-white/[0.03] transition-all font-mono"
          />
        </div>

        <div class="flex gap-1.5 flex-wrap">
          <button
            v-for="diff in [
              { value: 'all', label: '全部' },
              { value: 'beginner', label: '入门' },
              { value: 'intermediate', label: '进阶' },
              { value: 'advanced', label: '高级' },
            ]"
            :key="diff.value"
            @click="selectedDifficulty = diff.value as Difficulty | 'all'"
            :class="[
              'px-3 py-2 rounded-lg text-xs font-mono font-medium border transition-all',
              selectedDifficulty === diff.value
                ? 'border-cyan-400/20 bg-cyan-400/5 text-cyan-400'
                : 'border-white/[0.04] bg-white/[0.01] text-gray-500 hover:text-gray-300 hover:border-white/[0.08]',
            ]"
          >
            {{ diff.label }}
          </button>
        </div>
      </div>

      <div class="flex gap-1.5 flex-wrap mb-8">
        <button
          v-for="cat in categories"
          :key="cat.value"
          @click="selectedCategory = cat.value"
          :class="[
            'px-2.5 py-1 rounded text-[10px] font-mono border transition-all',
            selectedCategory === cat.value
              ? 'border-purple-400/20 bg-purple-400/5 text-purple-400'
              : 'border-white/[0.03] bg-white/[0.01] text-gray-600 hover:text-gray-400',
          ]"
        >
          {{ cat.label }}
        </button>
      </div>

      <div v-if="filteredCourses.length === 0" class="text-center py-20">
        <p class="text-gray-600 font-mono text-sm">没有找到匹配的课程</p>
      </div>

      <div v-else ref="courseGrid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="(course, visualIndex) in filteredCourses"
          :key="course.id"
          data-course-entry
          class="course-entry"
          :style="{ '--course-index': visualIndex % 6 }"
        >
          <CourseCard
            :course="course"
            :progress="getCourseProgress(course.id)"
            :completed-count="getCompletedChapterCount(course.id)"
            @click="goToCourse"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.learning-order {
  border: 1px solid rgb(255 255 255 / 0.06);
  border-radius: 12px;
  background: rgb(255 255 255 / 0.018);
  padding: 18px;
}

.learning-order-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.learning-order-kicker {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
  color: #22d3ee;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
}

.learning-order-header h2,
.course-library-header h2 {
  color: #f8fafc;
  font-size: 18px;
  font-weight: 700;
}

.learning-order-header p,
.course-library-header p,
.learning-order-step p,
.learning-order-hint {
  color: #64748b;
  font-size: 12px;
  line-height: 1.7;
}

.learning-order-header > p {
  max-width: 360px;
  text-align: right;
}

.learning-order-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
}

.learning-order-step {
  min-width: 0;
  border: 1px solid rgb(255 255 255 / 0.05);
  border-radius: 10px;
  background: rgb(15 23 42 / 0.35);
  padding: 12px;
}

.learning-order-step h3 {
  margin-bottom: 6px;
  color: #e2e8f0;
  font-size: 13px;
  font-weight: 700;
}

.learning-order-courses {
  display: grid;
  gap: 7px;
  margin-top: 12px;
}

.learning-order-course {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 6px;
  min-height: 38px;
  padding: 8px 9px;
  border: 1px solid rgb(34 211 238 / 0.12);
  border-radius: 8px;
  color: #cffafe;
  background: rgb(34 211 238 / 0.04);
  text-align: left;
  transition: border-color 0.2s ease, background 0.2s ease, transform 0.2s ease;
}

.learning-order-course:hover {
  border-color: rgb(34 211 238 / 0.3);
  background: rgb(34 211 238 / 0.08);
  transform: translateY(-1px);
}

.learning-order-course-index {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  font-weight: 700;
  color: #22d3ee;
  white-space: nowrap;
}

.learning-order-course-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 600;
}

.learning-order-hint {
  margin-top: 14px;
}

.course-library-header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.course-entry {
  height: 100%;
  opacity: 0;
  transform: translateY(14px);
}

.course-entry.is-visible {
  animation: course-entry-in 0.55s cubic-bezier(0.16, 1, 0.3, 1) calc(var(--course-index) * 55ms) forwards;
}

.course-entry :deep(> *) {
  height: 100%;
}

@keyframes course-entry-in {
  from { opacity: 0; transform: translateY(14px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (prefers-reduced-motion: reduce) {
  .course-entry,
  .course-entry.is-visible {
    opacity: 1;
    transform: none;
    animation: none;
  }
}

@media (max-width: 1180px) {
  .learning-order-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .learning-order {
    padding: 14px;
  }

  .learning-order-header {
    display: block;
  }

  .learning-order-header > p {
    margin-top: 8px;
    max-width: none;
    text-align: left;
  }

  .learning-order-grid {
    grid-template-columns: 1fr;
  }
}
</style>
