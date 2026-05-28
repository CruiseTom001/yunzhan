<script setup lang="ts">
import { defineAsyncComponent, ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, ArrowRight, ArrowUp, CheckCircle2, ChevronLeft, ChevronRight, FlaskConical, Play, TerminalSquare } from 'lucide-vue-next'
import { getCourse } from '@/data/courses/all'
import { useProgressStore } from '@/stores/progress'
import MarkdownRenderer from '@/components/common/MarkdownRenderer.vue'
import { loadChapterContent } from '@/utils/contentLoader'
import { getLabsForChapter } from '@/data/labs'
import { executeSandboxCommand } from '@/utils/terminalSandbox'
import type { LabTask } from '@/types'
import type { Course } from '@/types'

const route = useRoute()
const router = useRouter()
const progressStore = useProgressStore()
const CodeEditor = defineAsyncComponent(() => import('@/components/ai/CodeEditor.vue'))

const course = ref<Course | null>(null)
const loading = ref(true)
const chapterContent = ref('')
const labEditorContent = ref('')

watch(() => route.params.id, async (idParam) => {
  const id = Array.isArray(idParam) ? idParam[0] : idParam
  if (id) {
    loading.value = true
    course.value = null
    chapterContent.value = ''
    labEditorContent.value = ''
    const data = await getCourse(id)
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
async function loadContent() {
  if (!course.value || !currentChapter.value) return
  const ch = currentChapter.value
  if (ch.contentFile) {
    try {
      const md = await loadChapterContent(course.value.id, ch.index)
      chapterContent.value = md || ch.content || '（内容加载中...）'
    } catch (e) {
      console.warn('[CourseDetail] .md 加载失败，使用内联内容:', e)
      chapterContent.value = ch.content
    }
  } else {
    chapterContent.value = ch.content
  }
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
})

watch(chapterIndex, () => {
  window.scrollTo({ top: 0, behavior: 'smooth' })
})

function goToChapter(index: number) {
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

function handleConfirm() {
  if (!course.value) return
  if (confirmAction.value === 'complete') {
    progressStore.markChapterComplete(course.value.id, chapterIndex.value)
  } else {
    progressStore.unmarkChapterComplete(course.value.id, chapterIndex.value)
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
  const commandsList = lab.steps
    .map(step => step.command)
    .filter(Boolean)
  for (const command of commandsList) {
    progressStore.recordCommand(command!, simulateLabOutput(command!), 'lab')
  }
  labUiRecords.value[lab.id] = progressStore.evaluateLab(lab)
  const commands = commandsList
    .join('\n')
  if (commands) {
    runLabCommand(commands)
  }
}

function checkLab(lab: LabTask) {
  labUiRecords.value[lab.id] = progressStore.evaluateLab(lab)
}

function labPassed(lab: LabTask) {
  return (labUiRecords.value[lab.id] ?? progressStore.labRecords[lab.id])?.status === 'passed'
}

function checkPassed(labId: string, checkId: string) {
  return Boolean((labUiRecords.value[labId] ?? progressStore.labRecords[labId])?.checkResults?.[checkId])
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

function simulateLabOutput(command: string) {
  return executeSandboxCommand(command).output
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
                class="border border-white/[0.04] bg-black/10 rounded-lg p-4"
              >
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
                    {{ labPassed(lab) ? 'PASSED' : 'READY' }}
                  </div>
                </div>

                <div class="grid md:grid-cols-[1.2fr_0.8fr] gap-4">
                  <div class="space-y-2">
                    <div
                      v-for="(step, index) in lab.steps"
                      :key="`${lab.id}-step-${index}`"
                      class="flex items-start gap-3 p-3 rounded-lg bg-white/[0.015] border border-white/[0.03]"
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
                      class="flex items-center gap-2 p-2 rounded border text-xs"
                      :class="checkPassed(lab.id, check.id) ? 'border-emerald-400/15 bg-emerald-400/5 text-emerald-300' : 'border-white/[0.03] bg-white/[0.01] text-gray-500'"
                    >
                      <CheckCircle2 class="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{{ check.label }}</span>
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
                    <p class="text-[10px] text-gray-600 leading-relaxed pt-1">
                      {{ lab.hints[0] }}
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

    <!-- 回顶部按钮 -->
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
</style>
