<script setup lang="ts">
import { defineAsyncComponent, ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AlertCircle, ArrowLeft, ArrowRight, ArrowUp, CheckCircle2, ChevronLeft, ChevronRight, Download, FlaskConical, Play, Rocket, RotateCcw, Share2, TerminalSquare, Trophy, X } from 'lucide-vue-next'
import { getCourse } from '@/data/courses/all'
import { useProgressStore } from '@/stores/progress'
import MarkdownRenderer from '@/components/common/MarkdownRenderer.vue'
import { loadChapterContent } from '@/utils/contentLoader'
import {
  createCourseCertificateBlob,
  downloadCertificateBlob,
  getCertificateFileName,
  type CourseCertificateData,
} from '@/utils/courseCertificate'
import { getLabsForChapter } from '@/data/labs'
import type { LabTask } from '@/types'
import type { Course } from '@/types'

defineOptions({ name: 'CourseDetailPage' })

const route = useRoute()
const router = useRouter()
const progressStore = useProgressStore()
const CodeEditor = defineAsyncComponent(() => import('@/components/ai/CodeEditor.vue'))

const course = ref<Course | null>(null)
const loading = ref(true)
const chapterContent = ref('')
const labEditorContent = ref('')

// 竞态保护：快速切换课程时（A→B→C），getCourse 是懒加载 async import，
// 慢请求返回后会覆盖最新课程。用 courseLoadSeq 确保只有最新请求生效。
let courseLoadSeq = 0
watch(() => route.params.id, async (idParam) => {
  const id = Array.isArray(idParam) ? idParam[0] : idParam
  if (!id) {
    course.value = null
    chapterContent.value = ''
    labEditorContent.value = ''
    loading.value = false
    return
  }
  if (id) {
    const mySeq = ++courseLoadSeq
    loading.value = true
    course.value = null
    chapterContent.value = ''
    labEditorContent.value = ''
    const data = await getCourse(id)
    if (mySeq !== courseLoadSeq) return // 已被更新的请求取代
    course.value = data ?? null
    // 记录最近访问的课程
    progressStore.updateLastVisited(id)
    // 记录今日学习
    progressStore.trackStudyDay()
  }
  loading.value = false
  if (course.value && !route.params.chapterIndex) {
    router.replace(`/course/${route.params.id}/chapter/0`)
  }
}, { immediate: true })
const chapterIndex = computed(() => {
  const ci = Number(route.params.chapterIndex)
  return isNaN(ci) ? 0 : ci
})

const currentChapter = computed(() => course.value?.chapters[chapterIndex.value])
const totalChapters = computed(() => course.value?.chapters.length ?? 0)
const labUiRecords = ref<Record<string, ReturnType<typeof progressStore.evaluateLab>>>({})
const currentLabs = computed(() =>
  course.value ? getLabsForChapter(course.value.id, chapterIndex.value) : [],
)
const editorLanguage = computed(() => {
  const id = course.value?.id ?? ''
  if (id.includes('kubernetes') || chapterContent.value.includes('apiVersion:')) return 'yaml'
  if (id.includes('docker') || chapterContent.value.includes('docker-compose')) return 'yaml'
  if (id.includes('linux') || id.includes('automation')) return 'bash'
  return 'yaml'
})
const showConfigWorkbench = computed(() =>
  ['docker', 'kubernetes', 'automation', 'cicd', 'linux-basics'].includes(course.value?.id ?? '') || currentLabs.value.length > 0,
)

// 加载章节内容（优先 .md 文件，其次 inline content）
//
// 竞态保护：用户快速切换章节（ch1→ch2→ch3）会触发多次 loadContent，
// 每次各自 await。若不加保护，慢的请求（旧章节）resolve 后会覆盖最新章节内容。
// 用 loadSeq 序号确保只有最后一次请求的结果才会写入 chapterContent。
let loadSeq = 0
async function loadContent() {
  if (!course.value || !currentChapter.value) return
  const ch = currentChapter.value
  const mySeq = ++loadSeq
  if (ch.contentFile) {
    try {
      const md = await loadChapterContent(course.value.id, ch.index)
      if (mySeq !== loadSeq) return // 已被更新的请求取代
      chapterContent.value = md || ch.content || '（内容加载中...）'
    } catch (e) {
      if (mySeq !== loadSeq) return
      console.warn('[CourseDetail] .md 加载失败，使用内联内容:', e)
      chapterContent.value = ch.content
    }
  } else {
    chapterContent.value = ch.content
  }
  if (mySeq !== loadSeq) return
  labEditorContent.value = createWorkbenchTemplate()
}

watch([() => course.value?.id, chapterIndex], () => {
  loadContent()
}, { immediate: true })
const hasPrev = computed(() => chapterIndex.value > 0)
const hasNext = computed(() => chapterIndex.value < totalChapters.value - 1)
const sidebarOpen = ref(true)
const scrollProgress = ref(0)
const showBackToTop = ref(false)
const showCelebration = ref(false)
const celebrationMode = ref<'chapter' | 'course'>('chapter')
const showCourseCompletion = ref(false)
const certificateStatus = ref('')
const certificateStatusError = ref(false)
const certificateBusy = ref(false)
const labFeedback = ref<{ labId: string; status: 'passed' | 'incomplete' } | null>(null)
const chapterMotion = ref<'next' | 'previous' | null>(null)

interface CelebrationParticle {
  id: number
  x: number
  y: number
  delay: number
  color: string
}

const CELEBRATION_DURATION_MS = 1800
const CELEBRATION_PARTICLE_COLORS = ['cyan', 'emerald', 'violet', 'amber'] as const
const celebrationParticles: CelebrationParticle[] = Array.from({ length: 28 }, (_, index) => {
  const angle = (Math.PI * 2 * index) / 28
  const distance = 108 + (index % 5) * 16

  return {
    id: index,
    x: Math.round(Math.cos(angle) * distance),
    y: Math.round(Math.sin(angle) * distance),
    delay: (index % 7) * 24,
    color: CELEBRATION_PARTICLE_COLORS[index % CELEBRATION_PARTICLE_COLORS.length],
  }
})
let celebrationTimer: ReturnType<typeof setTimeout> | null = null
let courseCompletionTimer: ReturnType<typeof setTimeout> | null = null
let labFeedbackTimer: ReturnType<typeof setTimeout> | null = null
let chapterMotionTimer: ReturnType<typeof setTimeout> | null = null

function updateScrollProgress() {
  const el = document.documentElement
  const scrollTop = el.scrollTop
  const scrollHeight = el.scrollHeight - el.clientHeight
  scrollProgress.value = scrollHeight > 0 ? Math.min((scrollTop / scrollHeight) * 100, 100) : 0
  showBackToTop.value = scrollTop > 400
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

onMounted(() => {
  window.addEventListener('scroll', updateScrollProgress, { passive: true })
})

onUnmounted(() => {
  window.removeEventListener('scroll', updateScrollProgress)
  if (celebrationTimer) {
    clearTimeout(celebrationTimer)
  }
  if (courseCompletionTimer) {
    clearTimeout(courseCompletionTimer)
  }
  if (labFeedbackTimer) {
    clearTimeout(labFeedbackTimer)
  }
  if (chapterMotionTimer) {
    clearTimeout(chapterMotionTimer)
  }
})

watch(chapterIndex, () => {
  window.scrollTo({ top: 0, behavior: 'smooth' })
})

function triggerChapterMotion(direction: 'next' | 'previous') {
  if (chapterMotionTimer) {
    clearTimeout(chapterMotionTimer)
  }
  chapterMotion.value = direction
  chapterMotionTimer = setTimeout(() => {
    chapterMotion.value = null
    chapterMotionTimer = null
  }, 420)
}

function goToChapter(index: number) {
  if (index !== chapterIndex.value) {
    triggerChapterMotion(index > chapterIndex.value ? 'next' : 'previous')
  }
  router.push(`/course/${route.params.id}/chapter/${index}`)
}

function goNext() {
  if (hasNext.value) goToChapter(chapterIndex.value + 1)
}

function goPrev() {
  if (hasPrev.value) goToChapter(chapterIndex.value - 1)
}

function goBack() {
  router.push('/courses')
}

const courseProgress = computed(() => {
  if (!course.value) return 0
  const completed = progressStore.progress.completedChapters[course.value.id]?.length ?? 0
  return totalChapters.value > 0 ? Math.round((completed / totalChapters.value) * 100) : 0
})

const completedDateLabel = computed(() => new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date()))

function formatStudyTime(seconds: number) {
  if (seconds < 60) return '不足 1 分钟'
  const totalMinutes = Math.floor(seconds / 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes} 分钟`
  return minutes > 0 ? `${hours} 小时 ${minutes} 分钟` : `${hours} 小时`
}

const studyTimeLabel = computed(() => formatStudyTime(progressStore.progress.totalTimeSpent))

function getCertificateData(): CourseCertificateData | null {
  const currentCourse = course.value
  if (!currentCourse) return null
  const dateKey = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  return {
    learnerName: progressStore.progress.userProfile.name || '本地学习者',
    courseTitle: currentCourse.title,
    completedChapters: totalChapters.value,
    studyTimeLabel: studyTimeLabel.value,
    streakDays: progressStore.streakDays,
    completedDate: completedDateLabel.value,
    certificateId: `YZ-${currentCourse.id.toUpperCase()}-${dateKey}`,
  }
}

async function buildCertificate() {
  const certificateData = getCertificateData()
  if (!certificateData || !course.value) return null
  const blob = await createCourseCertificateBlob(certificateData)
  return {
    blob,
    fileName: getCertificateFileName(course.value.title),
  }
}

async function saveCertificate() {
  certificateBusy.value = true
  certificateStatus.value = ''
  certificateStatusError.value = false
  try {
    const result = await buildCertificate()
    if (!result) return
    downloadCertificateBlob(result.blob, result.fileName)
    certificateStatus.value = '证书图片已保存。'
  } catch (error: unknown) {
    certificateStatusError.value = true
    certificateStatus.value = error instanceof Error ? error.message : '证书图片生成失败。'
  } finally {
    certificateBusy.value = false
  }
}

async function shareCertificate() {
  certificateBusy.value = true
  certificateStatus.value = ''
  certificateStatusError.value = false
  try {
    const result = await buildCertificate()
    if (!result || !course.value) return
    const file = new File([result.blob], result.fileName, { type: 'image/png' })
    const shareData = {
      title: `${course.value.title}通关证书`,
      text: `我已完成云栈的「${course.value.title}」课程。`,
      files: [file],
    }
    const canShareFile = typeof navigator.share === 'function'
      && (typeof navigator.canShare !== 'function' || navigator.canShare(shareData))
    if (canShareFile) {
      await navigator.share(shareData)
      certificateStatus.value = '证书分享面板已打开。'
    } else {
      downloadCertificateBlob(result.blob, result.fileName)
      certificateStatus.value = '当前环境不支持直接分享，已改为保存证书图片。'
    }
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      certificateStatus.value = '已取消分享。'
    } else {
      certificateStatusError.value = true
      certificateStatus.value = error instanceof Error ? error.message : '证书分享失败。'
    }
  } finally {
    certificateBusy.value = false
  }
}

const isBookmarked = computed(() => {
  if (!course.value) return false
  return progressStore.isBookmarked(course.value.id, chapterIndex.value)
})

function toggleBookmark() {
  if (!course.value) return
  if (isBookmarked.value) {
    progressStore.removeBookmark(course.value.id, chapterIndex.value)
  } else {
    progressStore.addBookmark(course.value.id, chapterIndex.value)
  }
}

const isCurrentChapterComplete = computed(() => {
  if (!course.value) return false
  return progressStore.isChapterComplete(course.value.id, chapterIndex.value)
})

// ===== 确认弹窗 =====
const showConfirm = ref(false)
const confirmAction = ref<'complete' | 'uncomplete'>('complete')

function showConfirmModal(action: 'complete' | 'uncomplete') {
  confirmAction.value = action
  showConfirm.value = true
}

function getCelebrationParticleStyle(particle: CelebrationParticle): Record<string, string> {
  return {
    '--burst-x': `${particle.x}px`,
    '--burst-y': `${particle.y}px`,
    '--burst-delay': `${particle.delay}ms`,
  }
}

function triggerCelebration(mode: 'chapter' | 'course') {
  if (celebrationTimer) {
    clearTimeout(celebrationTimer)
  }
  if (courseCompletionTimer) {
    clearTimeout(courseCompletionTimer)
    courseCompletionTimer = null
  }

  celebrationMode.value = mode
  showCelebration.value = true
  celebrationTimer = setTimeout(() => {
    showCelebration.value = false
    celebrationTimer = null
  }, CELEBRATION_DURATION_MS)
  if (mode === 'course') {
    courseCompletionTimer = setTimeout(() => {
      showCourseCompletion.value = true
      courseCompletionTimer = null
    }, CELEBRATION_DURATION_MS + 120)
  }
}

function handleConfirm() {
  if (!course.value) return
  if (confirmAction.value === 'complete') {
    progressStore.markChapterComplete(course.value.id, chapterIndex.value)
    triggerCelebration(courseProgress.value === 100 ? 'course' : 'chapter')
  } else {
    progressStore.unmarkChapterComplete(course.value.id, chapterIndex.value)
    showCourseCompletion.value = false
  }
  showConfirm.value = false
}

function runLabCommand(command: string) {
  window.dispatchEvent(new CustomEvent('yunzhan:run-command', {
    detail: { command, source: 'lab' },
  }))
}

function startLab(lab: LabTask) {
  progressStore.startLab(lab.id)
  const record = progressStore.labRecords[lab.id]
  if (record) {
    labUiRecords.value[lab.id] = record
  }
}

function checkLab(lab: LabTask) {
  const previousStatus = (labUiRecords.value[lab.id] ?? progressStore.labRecords[lab.id])?.status
  const result = progressStore.evaluateLab(lab)
  labUiRecords.value[lab.id] = result

  if (labFeedbackTimer) {
    clearTimeout(labFeedbackTimer)
  }
  labFeedback.value = {
    labId: lab.id,
    status: result.status === 'passed' ? 'passed' : 'incomplete',
  }
  labFeedbackTimer = setTimeout(() => {
    labFeedback.value = null
    labFeedbackTimer = null
  }, result.status === 'passed' && previousStatus !== 'passed' ? 1800 : 650)
}

function getLabFeedbackStatus(labId: string) {
  return labFeedback.value?.labId === labId ? labFeedback.value.status : null
}

function resetLab(lab: LabTask) {
  labUiRecords.value[lab.id] = progressStore.resetLab(lab.id)
}

function labPassed(lab: LabTask) {
  return (labUiRecords.value[lab.id] ?? progressStore.labRecords[lab.id])?.status === 'passed'
}

function labPassedCount(lab: LabTask) {
  return lab.checks.filter(check => checkPassed(lab.id, check.id)).length
}

function checkPassed(labId: string, checkId: string) {
  return Boolean((labUiRecords.value[labId] ?? progressStore.labRecords[labId])?.checkResults?.[checkId])
}

function checkMessage(labId: string, checkId: string) {
  return (labUiRecords.value[labId] ?? progressStore.labRecords[labId])?.checkMessages?.[checkId] ?? ''
}

function lastCheckedLabel(labId: string) {
  const lastCheckedAt = (labUiRecords.value[labId] ?? progressStore.labRecords[labId])?.lastCheckedAt
  if (!lastCheckedAt) return ''
  return new Date(lastCheckedAt).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function nextCommandTarget(lab: LabTask) {
  return lab.checks.find(check =>
    (check.type === 'command_in_history' || check.type === 'command_exact') &&
    !checkPassed(lab.id, check.id) &&
    check.target,
  )?.target ?? ''
}

function runNextLabCommand(lab: LabTask) {
  const command = nextCommandTarget(lab)
  if (command) {
    runLabCommand(command)
  }
}

function recentLabCommands(lab: LabTask) {
  const record = labUiRecords.value[lab.id] ?? progressStore.labRecords[lab.id]
  const startedAt = record?.startedAt ?? 0
  if (!startedAt) return []
  return progressStore.commandHistory
    .filter(item => item.source === 'lab' && item.createdAt >= startedAt)
    .slice(0, 3)
}

function createWorkbenchTemplate() {
  const id = course.value?.id ?? ''
  if (id === 'kubernetes') {
    return 'apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: yunzhan-demo\nspec:\n  replicas: 2\n  selector:\n    matchLabels:\n      app: yunzhan-demo\n  template:\n    metadata:\n      labels:\n        app: yunzhan-demo\n    spec:\n      containers:\n        - name: web\n          image: nginx:alpine\n          ports:\n            - containerPort: 80\n'
  }
  if (id === 'docker') {
    return 'services:\n  web:\n    image: nginx:alpine\n    ports:\n      - "8080:80"\n    volumes:\n      - ./html:/usr/share/nginx/html:ro\n'
  }
  if (id === 'cicd') {
    return 'stages:\n  - test\n  - deploy\n\nunit-test:\n  stage: test\n  script:\n    - echo "run tests"\n'
  }
  return '# 在这里整理本章命令，逐条发送到实验终端\npwd\nls -l\n'
}

function runWorkbench() {
  window.dispatchEvent(new CustomEvent('yunzhan:run-command', {
    detail: { command: labEditorContent.value, source: 'lab' },
  }))
}

function saveWorkbenchDraft() {
  progressStore.addCommunityDraft(
    editorLanguage.value === 'yaml' ? 'yaml' : 'command',
    `${course.value?.title ?? '课程'} - ${currentChapter.value?.title ?? '实验草稿'}`,
    labEditorContent.value,
    [course.value?.id ?? 'course', editorLanguage.value],
  )
}

</script>

<template>
  <div v-if="loading" class="min-h-screen bg-theme pt-20">
    <div class="max-w-3xl mx-auto px-6 md:px-8 pt-10 animate-pulse">
      <div class="h-3 w-40 bg-gray-700/30 rounded mb-4"></div>
      <div class="h-6 w-80 bg-gray-700/30 rounded mb-6"></div>
      <div class="flex gap-1.5 mb-6">
        <div class="h-4 w-16 bg-gray-700/20 rounded"></div>
        <div class="h-4 w-20 bg-gray-700/20 rounded"></div>
        <div class="h-4 w-14 bg-gray-700/20 rounded"></div>
      </div>
      <div class="space-y-3">
        <div class="h-4 w-full bg-gray-700/20 rounded"></div>
        <div class="h-4 w-5/6 bg-gray-700/20 rounded"></div>
        <div class="h-4 w-4/6 bg-gray-700/20 rounded"></div>
        <div class="h-4 w-full bg-gray-700/20 rounded"></div>
        <div class="h-4 w-3/4 bg-gray-700/20 rounded"></div>
      </div>
      <div class="h-32 w-full bg-gray-700/10 rounded-lg mt-6"></div>
      <div class="space-y-3 mt-6">
        <div class="h-4 w-full bg-gray-700/20 rounded"></div>
        <div class="h-4 w-5/6 bg-gray-700/20 rounded"></div>
        <div class="h-4 w-full bg-gray-700/20 rounded"></div>
      </div>
    </div>
  </div>

  <div v-else-if="!course" class="min-h-screen bg-theme pt-24 flex items-center justify-center">
    <div class="text-center">
      <p class="text-gray-500 text-sm mb-2">课程未找到</p>
      <button @click="goBack" class="text-cyan-400 text-xs font-mono hover:underline">← 返回课程列表</button>
    </div>
  </div>

  <div v-else class="min-h-screen bg-theme pt-16">
    <!-- 阅读进度条 -->
    <div class="fixed top-16 left-0 right-0 z-50 h-px bg-white/[0.02]">
      <div
        class="h-full bg-cyan-400/50 transition-all duration-150"
        :style="{ width: `${scrollProgress}%` }"
      ></div>
    </div>

    <!-- 侧边栏 -->
    <div
      :class="[
        'fixed top-16 left-0 bottom-0 z-40 w-64 bg-theme/95 backdrop-blur-xl border-r border-white/[0.03] transition-transform duration-300 overflow-y-auto',
        sidebarOpen ? 'translate-x-0' : '-translate-x-64',
      ]"
    >
      <div class="p-3 border-b border-white/[0.03]">
        <button @click="goBack" class="flex items-center gap-1.5 text-gray-500 hover:text-white text-xs transition-colors mb-2 font-mono">
          <ArrowLeft class="w-3 h-3" />
          <span>← 返回</span>
        </button>
        <h3 class="text-white font-semibold text-sm">{{ course.title }}</h3>
        <div class="flex items-center justify-between mt-1.5">
          <span class="text-gray-600 text-[10px] font-mono">{{ totalChapters }} 章</span>
          <span class="text-[10px] font-mono" :class="courseProgress === 100 ? 'text-emerald-400' : 'text-cyan-400'">
            {{ courseProgress }}%
          </span>
        </div>
        <div class="h-0.5 bg-white/[0.03] rounded-full overflow-hidden mt-1">
          <div
            class="h-full rounded-full transition-all duration-500"
            :class="courseProgress === 100 ? 'bg-emerald-400/60' : 'bg-cyan-400/60'"
            :style="{ width: `${courseProgress}%` }"
          ></div>
        </div>
      </div>

      <nav class="p-2">
        <button
          v-for="(ch, i) in course.chapters"
          :key="i"
          @click="goToChapter(i)"
          :class="[
            'w-full text-left flex items-start gap-2.5 px-2.5 py-2 rounded-md text-xs transition-all mb-0.5',
            chapterIndex === i
              ? 'bg-cyan-400/5 text-cyan-400'
              : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.02]',
          ]"
        >
          <div class="mt-0.5 flex-shrink-0">
            <CheckCircle2
              v-if="progressStore.isChapterComplete(course.id, i)"
              class="w-3.5 h-3.5 text-emerald-400"
            />
            <div
              v-else
              :class="[
                'w-3.5 h-3.5 rounded-full border flex-shrink-0',
                chapterIndex === i ? 'border-cyan-400 bg-cyan-400/10' : 'border-gray-700',
              ]"
            ></div>
          </div>
          <span class="leading-relaxed">{{ ch.title }}</span>
        </button>
      </nav>
    </div>

    <!-- 侧边栏切换 -->
    <button
      @click="sidebarOpen = !sidebarOpen"
      class="fixed top-20 z-50 p-1 bg-[#0c0c14] border border-white/[0.04] border-l-0 rounded-r-md text-gray-500 hover:text-white transition-all duration-300"
      :class="sidebarOpen ? 'left-64' : 'left-0'"
    >
      <ChevronRight v-if="!sidebarOpen" class="w-3.5 h-3.5" />
      <ChevronLeft v-else class="w-3.5 h-3.5" />
    </button>

    <!-- 主内容区 -->
    <main
      :class="[
        'transition-all duration-300 pt-6 pb-16',
        sidebarOpen ? 'ml-64' : 'ml-0',
        chapterMotion === 'next' ? 'chapter-motion-next' : '',
        chapterMotion === 'previous' ? 'chapter-motion-previous' : '',
      ]"
    >
      <div class="max-w-3xl mx-auto px-6 md:px-8">
        <div v-if="currentChapter" class="mb-8">
          <div class="mb-6">
            <div class="flex items-center gap-1.5 text-[10px] text-gray-600 font-mono mb-1.5">
              <span>{{ course.title }}</span>
              <ChevronRight class="w-2.5 h-2.5" />
              <span>{{ chapterIndex + 1 }}/{{ totalChapters }}</span>
            </div>
            <div class="flex items-center justify-between mb-3">
              <h1 class="text-2xl font-bold text-white">{{ currentChapter.title }}</h1>
              <div class="flex items-center gap-2 flex-shrink-0 ml-4">
                <button
                  @click="showConfirmModal(isCurrentChapterComplete ? 'uncomplete' : 'complete')"
                  class="flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-mono transition-all"
                  :class="isCurrentChapterComplete
                    ? 'bg-emerald-400/10 border-emerald-400/20 text-emerald-400 hover:bg-emerald-400/15 cursor-pointer'
                    : 'bg-cyan-400/5 border-cyan-400/20 text-cyan-400 hover:bg-cyan-400/10'"
                >
                  <CheckCircle2 v-if="isCurrentChapterComplete" class="w-3.5 h-3.5" />
                  <div v-else class="w-3.5 h-3.5 rounded-full border-2 border-cyan-400"></div>
                  {{ isCurrentChapterComplete ? '已学完' : '标记已学完' }}
                </button>
                <button
                  @click="toggleBookmark"
                  class="flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-mono transition-all"
                  :class="isBookmarked
                    ? 'bg-amber-400/5 border-amber-400/15 text-amber-400'
                    : 'bg-white/[0.01] border-white/[0.04] text-gray-600 hover:text-amber-400 hover:border-amber-400/15'"
                >
                  {{ isBookmarked ? '★ 已收藏' : '☆ 收藏' }}
                </button>
              </div>
            </div>

            <div
              v-if="currentChapter.keyConcepts.length > 0"
              class="flex flex-wrap gap-1.5 mb-2"
            >
              <span
                v-for="concept in currentChapter.keyConcepts"
                :key="concept"
                class="px-2 py-0.5 rounded bg-cyan-400/5 text-cyan-400 text-[10px] font-mono border border-cyan-400/10"
              >
                {{ concept }}
              </span>
            </div>
          </div>

          <MarkdownRenderer :content="chapterContent" />

          <section
            v-if="currentLabs.length > 0"
            class="mt-8 border border-emerald-400/15 bg-emerald-400/[0.025] rounded-xl overflow-hidden"
          >
            <div class="flex items-center justify-between gap-4 px-4 py-3 border-b border-emerald-400/10">
              <div class="flex items-center gap-2">
                <FlaskConical class="w-4 h-4 text-emerald-400" />
                <div>
                  <h2 class="text-sm font-bold text-white font-mono">交互式实验</h2>
                  <p class="text-[11px] text-gray-500">阅读后立即动手，终端历史会用于自动判题</p>
                </div>
              </div>
              <span class="text-[10px] text-emerald-400 font-mono">{{ currentLabs.length }} LAB</span>
            </div>

            <div class="p-4 space-y-4">
              <article
                v-for="lab in currentLabs"
                :key="lab.id"
                class="lab-card relative overflow-hidden border border-white/[0.04] bg-black/10 rounded-lg p-4"
                :class="{
                  'lab-card-passed': getLabFeedbackStatus(lab.id) === 'passed',
                  'lab-card-incomplete': getLabFeedbackStatus(lab.id) === 'incomplete',
                }"
              >
                <div
                  v-if="getLabFeedbackStatus(lab.id) === 'passed'"
                  class="lab-success-scan"
                  role="status"
                  aria-live="polite"
                >
                  <CheckCircle2 class="w-3.5 h-3.5" />
                  实验验证通过
                </div>
                <div
                  v-if="getLabFeedbackStatus(lab.id) === 'passed'"
                  class="lab-deploy-success"
                  aria-hidden="true"
                >
                  <Rocket class="w-5 h-5" />
                  <strong>DEPLOYMENT OK</strong>
                  <span>部署成功</span>
                </div>
                <div class="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <div class="flex items-center gap-2 mb-1">
                      <h3 class="text-white text-sm font-semibold">{{ lab.title }}</h3>
                      <span class="px-1.5 py-0.5 rounded border border-white/[0.05] text-[10px] text-gray-500 font-mono">
                        {{ lab.estimatedMinutes }}min
                      </span>
                    </div>
                    <p class="text-gray-500 text-xs leading-relaxed">{{ lab.description }}</p>
                  </div>
                  <div
                    class="px-2 py-1 rounded text-[10px] font-mono border"
                    :class="labPassed(lab) ? 'text-emerald-400 border-emerald-400/20 bg-emerald-400/5' : 'text-amber-400 border-amber-400/20 bg-amber-400/5'"
                  >
                    {{ labPassed(lab) ? 'PASSED' : `${labPassedCount(lab)}/${lab.checks.length}` }}
                  </div>
                </div>

                <div class="grid md:grid-cols-[1.2fr_0.8fr] gap-4">
                  <div class="space-y-2">
                    <div
                      v-for="(step, index) in lab.steps"
                      :key="`${lab.id}-step-${index}`"
                      class="lab-step flex items-start gap-3 p-3 rounded-lg bg-white/[0.015] border border-white/[0.03]"
                      :class="{ 'lab-step-complete': getLabFeedbackStatus(lab.id) === 'passed' }"
                      :style="{ '--lab-step-index': index }"
                    >
                      <span class="w-6 h-6 rounded bg-emerald-400/10 text-emerald-400 text-xs font-mono flex items-center justify-center flex-shrink-0">
                        {{ index + 1 }}
                      </span>
                      <div class="min-w-0 flex-1">
                        <div class="text-gray-200 text-xs font-medium mb-1">{{ step.title }}</div>
                        <p class="text-gray-600 text-[11px] leading-relaxed">{{ step.description }}</p>
                        <code v-if="step.command" class="mt-2 inline-block text-[11px] text-cyan-300 bg-cyan-400/5 border border-cyan-400/10 rounded px-2 py-1">
                          {{ step.command }}
                        </code>
                      </div>
                      <button
                        v-if="step.command"
                        @click="runLabCommand(step.command)"
                        class="flex items-center gap-1 px-2 py-1 rounded border border-cyan-400/15 bg-cyan-400/5 text-cyan-400 hover:bg-cyan-400/10 text-[10px] font-mono"
                      >
                        <Play class="w-3 h-3" />
                        运行
                      </button>
                    </div>
                  </div>

                  <div class="space-y-2">
                    <div
                      v-for="check in lab.checks"
                      :key="check.id"
                      class="p-2 rounded border text-xs"
                      :class="checkPassed(lab.id, check.id) ? 'border-emerald-400/15 bg-emerald-400/5 text-emerald-300' : 'border-white/[0.03] bg-white/[0.01] text-gray-500'"
                    >
                      <div class="flex items-center gap-2">
                        <CheckCircle2
                          v-if="checkPassed(lab.id, check.id)"
                          class="w-3.5 h-3.5 flex-shrink-0"
                        />
                        <AlertCircle
                          v-else
                          class="w-3.5 h-3.5 flex-shrink-0"
                        />
                        <span>{{ check.label }}</span>
                      </div>
                      <p
                        v-if="checkMessage(lab.id, check.id)"
                        class="mt-1 pl-5 text-[10px] leading-relaxed"
                        :class="checkPassed(lab.id, check.id) ? 'text-emerald-200/70' : 'text-amber-200/70'"
                      >
                        {{ checkMessage(lab.id, check.id) }}
                      </p>
                    </div>
                    <div class="flex gap-2 pt-2">
                      <button
                        @click="startLab(lab)"
                        class="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-white/[0.05] text-gray-400 hover:text-white hover:bg-white/[0.03] text-xs font-mono transition-all"
                      >
                        <TerminalSquare class="w-3.5 h-3.5" />
                        开始
                      </button>
                      <button
                        @click="checkLab(lab)"
                        class="flex-1 px-3 py-2 rounded-lg bg-emerald-500 text-[#06060b] font-bold text-xs font-mono hover:bg-emerald-400 transition-all"
                      >
                        自动判题
                      </button>
                    </div>
                    <div class="flex gap-2">
                      <button
                        :disabled="!nextCommandTarget(lab)"
                        @click="runNextLabCommand(lab)"
                        class="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-mono transition-all disabled:opacity-40 disabled:cursor-not-allowed border-cyan-400/15 bg-cyan-400/5 text-cyan-300 hover:bg-cyan-400/10"
                      >
                        <Play class="w-3.5 h-3.5" />
                        Next
                      </button>
                      <button
                        @click="resetLab(lab)"
                        class="px-3 py-2 rounded-lg border border-white/[0.05] text-gray-500 hover:text-amber-300 hover:bg-amber-400/5 text-xs font-mono transition-all"
                        title="Reset lab"
                      >
                        <RotateCcw class="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div
                      v-if="recentLabCommands(lab).length"
                      class="rounded-lg border border-white/[0.03] bg-black/10 p-2 space-y-1"
                    >
                      <div class="text-[10px] text-gray-600 font-mono">Recent commands</div>
                      <div
                        v-for="item in recentLabCommands(lab)"
                        :key="`${lab.id}-${item.createdAt}-${item.command}`"
                        class="truncate text-[10px] text-gray-400 font-mono"
                      >
                        $ {{ item.command }}
                      </div>
                    </div>
                    <p class="text-[10px] text-gray-600 leading-relaxed pt-1">
                      {{ lab.hints[0] }}
                    </p>
                    <p
                      v-if="lastCheckedLabel(lab.id)"
                      class="text-[10px] text-gray-600 leading-relaxed"
                    >
                      最近判题：{{ lastCheckedLabel(lab.id) }}
                    </p>
                  </div>
                </div>
              </article>
            </div>
          </section>

          <section
            v-if="showConfigWorkbench"
            class="mt-6 border border-cyan-400/15 bg-cyan-400/[0.02] rounded-xl overflow-hidden"
          >
            <div class="flex items-center justify-between gap-4 px-4 py-3 border-b border-cyan-400/10">
              <div>
                <h2 class="text-sm font-bold text-white font-mono">配置实验工作台</h2>
                <p class="text-[11px] text-gray-500">Monaco Editor 支持 YAML/Shell 编辑、草稿沉淀与终端联动</p>
              </div>
              <div class="flex gap-2">
                <button @click="saveWorkbenchDraft" class="px-3 py-1.5 rounded border border-white/[0.05] text-gray-400 hover:text-white text-[11px] font-mono">
                  保存草稿
                </button>
                <button @click="runWorkbench" class="px-3 py-1.5 rounded bg-cyan-500 text-[#06060b] font-bold text-[11px] font-mono">
                  发送终端
                </button>
              </div>
            </div>
            <div class="p-4">
              <CodeEditor
                :content="labEditorContent"
                :language="editorLanguage"
                height="260px"
                @change="labEditorContent = $event"
              />
            </div>
          </section>

          <div v-if="courseProgress === 100" class="flex justify-center mt-8">
            <button
              class="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-amber-400/20 bg-amber-400/5 text-amber-300 hover:bg-amber-400/10 text-xs font-mono transition-colors"
              @click="showCourseCompletion = true"
            >
              <Trophy class="w-4 h-4" />
              查看课程通关成果
            </button>
          </div>

          <!-- 章节底部：标记已学完 -->
          <div class="flex justify-center mt-8 mb-6">
            <button
              v-if="!isCurrentChapterComplete"
              @click="showConfirmModal('complete')"
              class="flex items-center gap-2 px-6 py-3 rounded-xl bg-cyan-500/10 border border-cyan-400/20 text-cyan-400 hover:bg-cyan-500/20 transition-all text-sm font-mono font-semibold"
            >
              <div class="w-4 h-4 rounded-full border-2 border-cyan-400"></div>
              标记本章已学完
            </button>
            <button
              v-else
              @click="showConfirmModal('uncomplete')"
              class="flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-400/10 border border-emerald-400/20 text-emerald-400 hover:bg-emerald-400/15 transition-all text-sm font-mono font-semibold cursor-pointer"
            >
              <CheckCircle2 class="w-4 h-4" />
              取消已学完
            </button>
          </div>

          <div class="flex items-center justify-between pt-6 border-t border-white/[0.03]">
            <button
              v-if="hasPrev"
              data-prev-btn
              @click="goPrev"
              class="group flex items-center gap-1.5 px-4 py-2 rounded-lg border border-white/[0.04] text-gray-400 hover:border-white/[0.08] hover:text-white transition-all text-xs font-mono"
            >
              <ArrowLeft class="w-3 h-3 group-hover:-translate-x-0.5 transition-transform" />
              上一章
            </button>
            <div v-else></div>

            <button
              v-if="hasNext"
              data-next-btn
              @click="goNext"
              class="group flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-500 text-[#06060b] font-bold text-xs font-mono shadow-lg shadow-cyan-500/20 hover:bg-cyan-400 transition-all"
            >
              下一章
              <ArrowRight class="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </button>

            <div
              v-else
              class="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-400/5 border border-emerald-400/15 text-emerald-400 text-xs font-mono"
            >
              <CheckCircle2 class="w-3.5 h-3.5" />
              已完成
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- 确认弹窗 -->
    <Teleport to="body">
      <Transition name="confirm-fade">
        <div
          v-if="showConfirm"
          class="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center"
          @click.self="showConfirm = false"
        >
          <div class="bg-[#0c0c14] border border-white/[0.08] rounded-2xl shadow-2xl shadow-black/50 p-6 mx-4 w-full max-w-sm">
            <div class="text-center mb-4">
              <div
                class="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center"
                :class="confirmAction === 'complete' ? 'bg-cyan-400/10' : 'bg-amber-400/10'"
              >
                <CheckCircle2 v-if="confirmAction === 'complete'" class="w-6 h-6 text-cyan-400" />
                <div v-else class="w-6 h-6 text-amber-400">⚠</div>
              </div>
              <h3 class="text-white text-sm font-semibold mb-1">
                {{ confirmAction === 'complete' ? '确认学完本章？' : '取消已学完？' }}
              </h3>
              <p class="text-gray-600 text-xs">
                {{ confirmAction === 'complete'
                  ? '标记后本章将计入学习进度'
                  : '取消后本章需要重新标记已学完' }}
              </p>
            </div>
            <div class="flex gap-2">
              <button
                @click="showConfirm = false"
                class="flex-1 px-4 py-2 rounded-lg border border-white/[0.04] text-gray-500 hover:text-white text-xs font-mono transition-all"
              >
                取消
              </button>
              <button
                @click="handleConfirm"
                class="flex-1 px-4 py-2 rounded-lg text-xs font-mono font-bold transition-all"
                :class="confirmAction === 'complete'
                  ? 'bg-cyan-500 text-[#06060b] shadow-lg shadow-cyan-500/20 hover:bg-cyan-400'
                  : 'bg-amber-500 text-[#06060b] shadow-lg shadow-amber-500/20 hover:bg-amber-400'"
              >
                确认
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <Teleport to="body">
      <Transition name="confirm-fade">
        <div
          v-if="showCourseCompletion"
          class="course-completion-backdrop"
          @click.self="showCourseCompletion = false"
        >
          <section
            class="course-completion-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="course-completion-title"
          >
            <button
              class="course-completion-close"
              title="关闭课程通关成果"
              aria-label="关闭课程通关成果"
              @click="showCourseCompletion = false"
            >
              <X class="w-4 h-4" />
            </button>

            <div class="course-completion-emblem" aria-hidden="true">
              <Trophy class="w-7 h-7" />
            </div>
            <span class="course-completion-kicker">COURSE COMPLETE</span>
            <h2 id="course-completion-title">{{ course?.title }}通关</h2>
            <p>课程进度已保存，可以生成证书图片留存或分享。</p>

            <div class="course-completion-stats">
              <div>
                <span>累计活跃学习</span>
                <strong>{{ studyTimeLabel }}</strong>
              </div>
              <div>
                <span>完成章节</span>
                <strong>{{ totalChapters }}/{{ totalChapters }}</strong>
              </div>
              <div>
                <span>连续学习</span>
                <strong>{{ progressStore.streakDays }} 天</strong>
              </div>
            </div>

            <div class="course-completion-actions">
              <button :disabled="certificateBusy" @click="saveCertificate">
                <Download class="w-4 h-4" />
                {{ certificateBusy ? '生成中...' : '保存证书' }}
              </button>
              <button class="course-share-button" :disabled="certificateBusy" @click="shareCertificate">
                <Share2 class="w-4 h-4" />
                分享图片
              </button>
            </div>
            <p
              v-if="certificateStatus"
              class="course-certificate-status"
              :class="certificateStatusError ? 'course-certificate-status-error' : ''"
              role="status"
              aria-live="polite"
            >
              {{ certificateStatus }}
            </p>
          </section>
        </div>
      </Transition>
    </Teleport>

    <!-- 回顶部按钮 -->
    <Teleport to="body">
      <Transition name="celebration-fade">
        <div
          v-if="showCelebration"
          class="celebration-overlay"
          role="status"
          aria-live="polite"
        >
          <div class="celebration-burst" aria-hidden="true">
            <span class="celebration-ring celebration-ring-primary" />
            <span class="celebration-ring celebration-ring-secondary" />
            <span
              v-for="particle in celebrationParticles"
              :key="particle.id"
              class="celebration-particle"
              :class="`celebration-particle-${particle.color}`"
              :style="getCelebrationParticleStyle(particle)"
            />
          </div>
          <div class="celebration-message">
            <Trophy v-if="celebrationMode === 'course'" class="celebration-trophy" aria-hidden="true" />
            <span class="celebration-prompt">
              {{ celebrationMode === 'course' ? '$ course --complete' : '$ progress --complete' }}
            </span>
            <strong>{{ celebrationMode === 'course' ? 'COURSE COMPLETE' : 'CHAPTER COMPLETE' }}</strong>
            <span>
              {{ celebrationMode === 'course' ? `${course?.title ?? '课程'}全部章节已完成` : '本章进度已保存' }}
            </span>
            <span v-if="celebrationMode === 'course'" class="celebration-summary">
              {{ totalChapters }}/{{ totalChapters }} 章节 · 100%
            </span>
          </div>
        </div>
      </Transition>
    </Teleport>

    <Transition name="fade">
      <button
        v-if="showBackToTop"
        @click="scrollToTop"
        class="fixed bottom-8 right-8 z-50 w-10 h-10 rounded-full bg-cyan-500/10 border border-cyan-400/20 text-cyan-400 hover:bg-cyan-500/20 hover:text-cyan-300 transition-all flex items-center justify-center shadow-lg"
        title="回到顶部"
      >
        <ArrowUp class="w-4 h-4" />
      </button>
    </Transition>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

.confirm-fade-enter-active,
.confirm-fade-leave-active {
  transition: opacity 0.2s ease;
}
.confirm-fade-enter-from,
.confirm-fade-leave-to {
  opacity: 0;
}

.chapter-motion-next {
  animation: chapter-slide-next 0.42s cubic-bezier(0.16, 1, 0.3, 1);
}

.chapter-motion-previous {
  animation: chapter-slide-previous 0.42s cubic-bezier(0.16, 1, 0.3, 1);
}

.lab-card::after {
  position: absolute;
  inset: 0;
  pointer-events: none;
  content: '';
  opacity: 0;
}

.lab-card-passed {
  animation: lab-success-pulse 0.8s ease-out;
}

.lab-card-passed::after {
  background: linear-gradient(105deg, transparent 15%, rgb(52 211 153 / 0.13) 48%, transparent 80%);
  animation: lab-scan 1.15s ease-out;
}

.lab-card-incomplete {
  animation: lab-incomplete-shake 0.38s ease-out;
}

.lab-success-scan {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 8px;
  border: 1px solid rgb(52 211 153 / 0.25);
  border-radius: 6px;
  color: #6ee7b7;
  background: rgb(6 78 59 / 0.72);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 10px;
  animation: lab-status-in 1.8s ease both;
}

.lab-deploy-success {
  position: absolute;
  top: 50%;
  left: 50%;
  z-index: 3;
  display: grid;
  min-width: 156px;
  padding: 12px 18px;
  border: 1px solid rgb(52 211 153 / 0.32);
  border-radius: 8px;
  color: #6ee7b7;
  background: rgb(3 18 16 / 0.94);
  box-shadow: 0 18px 48px rgb(0 0 0 / 0.45), 0 0 28px rgb(52 211 153 / 0.12);
  place-items: center;
  pointer-events: none;
  transform: translate(-50%, -50%);
  animation: lab-deploy-success 1.8s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.lab-deploy-success strong {
  margin-top: 6px;
  color: #d1fae5;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
}

.lab-deploy-success span {
  margin-top: 2px;
  color: #6ee7b7;
  font-size: 10px;
}

.lab-step-complete {
  animation: lab-step-light 0.55s ease-out calc(var(--lab-step-index) * 90ms) both;
}

.course-completion-backdrop {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgb(0 0 0 / 0.72);
  backdrop-filter: blur(8px);
}

.course-completion-panel {
  position: relative;
  width: min(560px, 100%);
  max-height: calc(100vh - 40px);
  padding: 28px;
  overflow-y: auto;
  border: 1px solid rgb(34 211 238 / 0.22);
  border-radius: 12px;
  color: #cbd5e1;
  background: #090d16;
  box-shadow: 0 28px 90px rgb(0 0 0 / 0.7), 0 0 40px rgb(34 211 238 / 0.08);
  text-align: center;
}

.course-completion-close {
  position: absolute;
  top: 12px;
  right: 12px;
  display: inline-flex;
  width: 32px;
  height: 32px;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  color: #64748b;
}

.course-completion-close:hover {
  color: #f8fafc;
  background: rgb(255 255 255 / 0.05);
}

.course-completion-emblem {
  display: inline-flex;
  width: 54px;
  height: 54px;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
  border: 1px solid rgb(251 191 36 / 0.24);
  border-radius: 50%;
  color: #fbbf24;
  background: rgb(251 191 36 / 0.07);
  box-shadow: 0 0 30px rgb(251 191 36 / 0.1);
}

.course-completion-kicker {
  display: block;
  color: #67e8f9;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 10px;
}

.course-completion-panel h2 {
  margin-top: 5px;
  color: #f8fafc;
  font-size: 24px;
  font-weight: 700;
}

.course-completion-panel > p {
  margin-top: 6px;
  color: #64748b;
  font-size: 12px;
}

.course-completion-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-top: 22px;
}

.course-completion-stats > div {
  min-width: 0;
  padding: 12px 8px;
  border: 1px solid rgb(255 255 255 / 0.05);
  border-radius: 7px;
  background: rgb(255 255 255 / 0.018);
}

.course-completion-stats span,
.course-completion-stats strong {
  display: block;
}

.course-completion-stats span {
  color: #64748b;
  font-size: 10px;
}

.course-completion-stats strong {
  margin-top: 5px;
  overflow-wrap: anywhere;
  color: #e2e8f0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 13px;
}

.course-completion-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 18px;
}

.course-completion-actions button {
  display: inline-flex;
  min-height: 40px;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border: 1px solid rgb(34 211 238 / 0.2);
  border-radius: 7px;
  color: #67e8f9;
  background: rgb(34 211 238 / 0.06);
  font-size: 12px;
  font-weight: 600;
}

.course-completion-actions button:hover:not(:disabled) {
  background: rgb(34 211 238 / 0.11);
}

.course-completion-actions button:disabled {
  cursor: wait;
  opacity: 0.5;
}

.course-completion-actions .course-share-button {
  border-color: rgb(52 211 153 / 0.22);
  color: #6ee7b7;
  background: rgb(52 211 153 / 0.06);
}

.course-certificate-status {
  margin-top: 12px !important;
  color: #6ee7b7 !important;
}

.course-certificate-status-error {
  color: #fca5a5 !important;
}

.celebration-trophy {
  width: 28px;
  height: 28px;
  color: #fbbf24;
  filter: drop-shadow(0 0 12px rgb(251 191 36 / 0.45));
  animation: trophy-arrive 1.1s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.celebration-summary {
  padding-top: 3px;
  border-top: 1px solid rgb(255 255 255 / 0.08);
  color: #94a3b8 !important;
  font-size: 10px !important;
}

.celebration-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  pointer-events: none;
  background: radial-gradient(circle at center, rgb(34 211 238 / 0.11), transparent 38%);
  animation: celebration-flash 1.8s ease-out both;
}

.celebration-burst {
  position: absolute;
  width: 1px;
  height: 1px;
}

.celebration-ring {
  position: absolute;
  inset: -48px;
  border: 1px solid rgb(34 211 238 / 0.8);
  border-radius: 50%;
  box-shadow: 0 0 24px rgb(34 211 238 / 0.2);
  animation: celebration-ring 1.15s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.celebration-ring-secondary {
  inset: -30px;
  border-color: rgb(52 211 153 / 0.75);
  animation-delay: 120ms;
}

.celebration-particle {
  position: absolute;
  width: 4px;
  height: 16px;
  border-radius: 2px;
  background: currentColor;
  box-shadow: 0 0 12px currentColor;
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.35);
  animation: celebration-particle 1.25s cubic-bezier(0.16, 1, 0.3, 1) var(--burst-delay) both;
}

.celebration-particle-cyan { color: #22d3ee; }
.celebration-particle-emerald { color: #34d399; }
.celebration-particle-violet { color: #a78bfa; }
.celebration-particle-amber { color: #fbbf24; }

.celebration-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  padding: 18px 24px;
  border: 1px solid rgb(34 211 238 / 0.38);
  border-radius: 8px;
  background: rgb(6 6 11 / 0.94);
  box-shadow: 0 0 0 1px rgb(255 255 255 / 0.04), 0 20px 60px rgb(0 0 0 / 0.52), 0 0 42px rgb(34 211 238 / 0.14);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  text-align: center;
  animation: celebration-message 1.8s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.celebration-message strong {
  color: #67e8f9;
  font-size: 18px;
  line-height: 1.3;
  letter-spacing: 0;
  text-shadow: 0 0 20px rgb(34 211 238 / 0.45);
}

.celebration-message > span:last-child {
  color: #a7f3d0;
  font-size: 12px;
}

.celebration-prompt {
  color: #94a3b8;
  font-size: 10px;
}

.celebration-fade-enter-active,
.celebration-fade-leave-active {
  transition: opacity 0.18s ease;
}

.celebration-fade-enter-from,
.celebration-fade-leave-to {
  opacity: 0;
}

@keyframes celebration-flash {
  0% { background-color: rgb(34 211 238 / 0); }
  16% { background-color: rgb(34 211 238 / 0.035); }
  100% { background-color: transparent; }
}

@keyframes chapter-slide-next {
  0% { opacity: 0.45; transform: translateX(16px); }
  100% { opacity: 1; transform: translateX(0); }
}

@keyframes chapter-slide-previous {
  0% { opacity: 0.45; transform: translateX(-16px); }
  100% { opacity: 1; transform: translateX(0); }
}

@keyframes lab-success-pulse {
  0% { border-color: rgb(255 255 255 / 0.04); box-shadow: 0 0 0 rgb(52 211 153 / 0); }
  35% { border-color: rgb(52 211 153 / 0.5); box-shadow: 0 0 28px rgb(52 211 153 / 0.14); }
  100% { border-color: rgb(52 211 153 / 0.2); box-shadow: 0 0 0 rgb(52 211 153 / 0); }
}

@keyframes lab-scan {
  0% { opacity: 0; transform: translateX(-80%); }
  22% { opacity: 1; }
  100% { opacity: 0; transform: translateX(80%); }
}

@keyframes lab-incomplete-shake {
  0%, 100% { transform: translateX(0); }
  30% { transform: translateX(-4px); border-color: rgb(251 191 36 / 0.3); }
  65% { transform: translateX(3px); }
}

@keyframes lab-status-in {
  0% { opacity: 0; transform: translateY(-6px); }
  12%, 72% { opacity: 1; transform: translateY(0); }
  100% { opacity: 0; transform: translateY(-4px); }
}

@keyframes lab-deploy-success {
  0% { opacity: 0; transform: translate(-50%, -44%) scale(0.88); }
  16%, 68% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  100% { opacity: 0; transform: translate(-50%, -56%) scale(0.97); }
}

@keyframes lab-step-light {
  0% { border-color: rgb(255 255 255 / 0.03); background: rgb(255 255 255 / 0.015); }
  55% { border-color: rgb(52 211 153 / 0.3); background: rgb(52 211 153 / 0.08); }
  100% { border-color: rgb(52 211 153 / 0.12); background: rgb(52 211 153 / 0.025); }
}

@keyframes trophy-arrive {
  0% { opacity: 0; transform: translateY(8px) scale(0.6) rotate(-8deg); }
  55% { opacity: 1; transform: translateY(0) scale(1.12) rotate(3deg); }
  100% { opacity: 1; transform: translateY(0) scale(1) rotate(0); }
}

@keyframes celebration-ring {
  0% { opacity: 0; transform: scale(0.25); }
  20% { opacity: 1; }
  100% { opacity: 0; transform: scale(3.2); }
}

@keyframes celebration-particle {
  0% { opacity: 0; transform: translate(-50%, -50%) scale(0.35) rotate(0deg); }
  14% { opacity: 1; }
  75% { opacity: 0.85; }
  100% { opacity: 0; transform: translate(calc(-50% + var(--burst-x)), calc(-50% + var(--burst-y))) scale(1) rotate(155deg); }
}

@keyframes celebration-message {
  0% { opacity: 0; transform: translateY(10px) scale(0.92); }
  16% { opacity: 1; transform: translateY(0) scale(1); }
  76% { opacity: 1; transform: translateY(0) scale(1); }
  100% { opacity: 0; transform: translateY(-8px) scale(0.98); }
}

@media (max-width: 480px) {
  .celebration-message {
    max-width: calc(100vw - 40px);
    padding: 16px 18px;
  }

  .celebration-message strong {
    font-size: 16px;
  }

  .course-completion-panel {
    padding: 24px 16px 18px;
  }

  .course-completion-panel h2 {
    font-size: 20px;
  }

  .course-completion-stats {
    grid-template-columns: 1fr;
  }

  .course-completion-actions {
    grid-template-columns: 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  .celebration-overlay,
  .celebration-message,
  .celebration-trophy,
  .chapter-motion-next,
  .chapter-motion-previous,
  .lab-card-passed,
  .lab-card-incomplete,
  .lab-step-complete,
  .lab-success-scan,
  .lab-deploy-success {
    animation: none;
  }

  .celebration-ring,
  .celebration-particle,
  .lab-card::after,
  .lab-deploy-success {
    display: none;
  }
}
</style>
