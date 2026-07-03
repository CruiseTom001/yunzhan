<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { courseIndex } from '@/data/courses/index'
import { getCourse } from '@/data/courses/all'
import { loadChapterContent } from '@/utils/contentLoader'
import { getAllCommandExplanations } from '@/utils/explainer'
import { getAllKnowledge } from '@/utils/knowledge'
import { Search, ChevronRight, Loader2, BookOpen, Terminal, Lightbulb } from 'lucide-vue-next'

defineOptions({ inheritAttrs: false })

const router = useRouter()
const isOpen = ref(false)
const query = ref('')
const activeIndex = ref(0)
const results = ref<SearchResult[]>([])
const searching = ref(false)

interface SearchResult {
  id: string
  type: 'course' | 'chapter' | 'command' | 'knowledge'
  route: string
  courseTitle: string
  chapterTitle: string
  matchText: string
  matchLine: string
}

const resultTypeMeta: Record<SearchResult['type'], { label: string; icon: typeof BookOpen }> = {
  course: { label: '课程', icon: BookOpen },
  chapter: { label: '章节', icon: BookOpen },
  command: { label: '命令', icon: Terminal },
  knowledge: { label: '知识', icon: Lightbulb },
}

const show = computed(() => isOpen.value)

function open() {
  isOpen.value = true
  query.value = ''
  results.value = []
  activeIndex.value = 0
  nextTick(() => {
    document.getElementById('global-search-input')?.focus()
  })
}

function close() {
  isOpen.value = false
  query.value = ''
  results.value = []
}

/**
 * 全文搜索
 *
 * 两阶段：
 * 1. 元数据（课程名/描述）即时匹配，立刻出结果
 * 2. 章节正文搜索（重）：从 markdown 文件加载并匹配
 *
 * 性能/竞态保护：
 * - 输入防抖（250ms），避免每次按键都串行动态加载 20 门课程
 * - searchSeq 自增序号：只有最后一次请求的结果才会写入 results，
 *   防止用户快速输入时早期（但更慢）的请求覆盖最新结果
 */
let searchTimer: ReturnType<typeof setTimeout> | null = null
let searchSeq = 0

function doSearch(q: string) {
  if (searchTimer) clearTimeout(searchTimer)

  const trimmed = q.trim()
  if (!trimmed) {
    results.value = []
    searching.value = false
    return
  }

  // 1. 内存结果即时匹配（课程元数据 + 命令库 + 知识库）
  const qLower = trimmed.toLowerCase()
  const metaFound: SearchResult[] = []
  for (const c of courseIndex) {
    if (metaFound.length >= 3) break
    if (c.title.toLowerCase().includes(qLower) || c.description.toLowerCase().includes(qLower)) {
      metaFound.push({
        id: `course:${c.id}`,
        type: 'course',
        route: `/course/${c.id}/chapter/0`,
        courseTitle: c.title,
        chapterTitle: '课程简介',
        matchText: c.description.slice(0, 120),
        matchLine: c.title,
      })
    }
  }

  const commandFound = getAllCommandExplanations()
    .filter((cmd) => {
      const haystack = [
        cmd.command,
        cmd.summary,
        cmd.description,
        Object.keys(cmd.options || {}).join(' '),
        Object.values(cmd.options || {}).join(' '),
        (cmd.examples || []).join(' '),
      ].join(' ').toLowerCase()
      return haystack.includes(qLower)
    })
    .slice(0, 4)
    .map<SearchResult>((cmd) => ({
      id: `command:${cmd.command}`,
      type: 'command',
      route: routeForCommand(cmd.command),
      courseTitle: '命令讲解',
      chapterTitle: cmd.command,
      matchText: cmd.description.slice(0, 130),
      matchLine: `${cmd.command} - ${cmd.summary}`,
    }))

  const knowledgeFound = getAllKnowledge()
    .filter((entry) => {
      const haystack = [
        entry.term,
        entry.summary,
        entry.description,
        entry.category,
        ...(entry.keywords || []),
        ...(entry.related || []),
      ].join(' ').toLowerCase()
      return haystack.includes(qLower)
    })
    .slice(0, 4)
    .map<SearchResult>((entry) => ({
      id: `knowledge:${entry.term}`,
      type: 'knowledge',
      route: routeForKnowledge(entry.category),
      courseTitle: '知识卡片',
      chapterTitle: entry.term,
      matchText: entry.summary,
      matchLine: entry.category,
    }))

  const instantFound = [...knowledgeFound, ...commandFound, ...metaFound].slice(0, 10)
  results.value = instantFound
  activeIndex.value = 0

  // 2. 正文搜索：防抖后异步执行
  searching.value = true
  const mySeq = ++searchSeq
  searchTimer = setTimeout(() => {
    void searchChapterContent(qLower, instantFound.length, mySeq)
  }, 250)
}

async function searchChapterContent(
  qLower: string,
  metaCount: number,
  mySeq: number,
) {
  const found: SearchResult[] = []

  for (const c of courseIndex) {
    if (found.length >= 10 - metaCount) break
    try {
      const course = await getCourse(c.id)
      // 竞态取消：用户已经输入了新关键词
      if (mySeq !== searchSeq) return
      if (!course) continue
      for (const ch of course.chapters) {
        if (found.length >= 10 - metaCount) break
        // 内容已迁移到 .md 文件，ch.content 恒为空，必须走 contentLoader
        const content = await loadChapterContent(c.id, ch.index)
        if (mySeq !== searchSeq) return
        const lines = content.split('\n')
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]
          if (line.toLowerCase().includes(qLower) && !line.startsWith('```')) {
            found.push({
              id: `chapter:${c.id}:${ch.index}:${i}`,
              type: 'chapter',
              route: `/course/${c.id}/chapter/${ch.index}`,
              courseTitle: c.title,
              chapterTitle: ch.title,
              matchText: line.replace(/[#*`]/g, '').trim().slice(0, 100),
              matchLine: line.trim().slice(0, 80),
            })
            if (found.length >= 10 - metaCount) break
          }
        }
      }
    } catch {
      // skip failed loads
    }
  }

  // 仅当这仍是最新请求时才写入结果
  if (mySeq !== searchSeq) return
  results.value = [...results.value.slice(0, metaCount), ...found]
  activeIndex.value = 0
  searching.value = false
}

function selectResult(index: number) {
  const r = results.value[index]
  if (!r) return
  close()
  router.push(r.route)
}

function routeForCommand(command: string): string {
  if (command === 'docker') return '/course/docker/chapter/1'
  if (command === 'git') return '/course/git/chapter/1'
  if (['kubectl'].includes(command)) return '/course/kubernetes/chapter/1'
  if (['curl', 'wget', 'ping', 'ss', 'netstat'].includes(command)) return '/course/linux-basics/chapter/4'
  if (['systemctl', 'journalctl', 'ps', 'top', 'kill', 'jobs', 'nohup'].includes(command)) return '/course/linux-basics/chapter/3'
  if (['df', 'du', 'free', 'stat'].includes(command)) return '/course/linux-basics/chapter/5'
  if (['sudo', 'chmod', 'chown', 'id', 'useradd', 'usermod'].includes(command)) return '/course/linux-basics/chapter/2'
  return '/course/linux-basics/chapter/0'
}

function routeForKnowledge(category: string): string {
  if (category.includes('网络')) return '/course/networking/chapter/0'
  if (category.includes('存储')) return '/course/linux-basics/chapter/5'
  if (category.includes('Shell')) return '/course/linux-basics/chapter/6'
  if (category.includes('容器')) return '/course/docker/chapter/0'
  return '/course/linux-basics/chapter/0'
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    activeIndex.value = Math.min(activeIndex.value + 1, results.value.length - 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    activeIndex.value = Math.max(activeIndex.value - 1, 0)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    selectResult(activeIndex.value)
  } else if (e.key === 'Escape') {
    close()
  }
}

// 全局快捷键 Ctrl+K 或 Cmd+K
function handleGlobalKeydown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault()
    if (isOpen.value) {
      close()
    } else {
      open()
    }
  }
  if (e.key === 'Escape' && isOpen.value) {
    close()
  }
}

// 快捷键：← → 翻页（在课程详情页）
function handleNavKeydown(e: KeyboardEvent) {
  // 如果搜索框打开，不处理导航快捷键
  if (isOpen.value) return
  // 检测是否在输入框中
  const tag = (e.target as HTMLElement).tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA') return

  const isCoursePage = window.location.hash.startsWith('#/course/')
  if (!isCoursePage) return

  if (e.key === 'ArrowLeft') {
    const prevBtn = document.querySelector('[data-prev-btn]') as HTMLButtonElement
    prevBtn?.click()
  } else if (e.key === 'ArrowRight') {
    const nextBtn = document.querySelector('[data-next-btn]') as HTMLButtonElement
    nextBtn?.click()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeydown)
  window.addEventListener('keydown', handleNavKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
  window.removeEventListener('keydown', handleNavKeydown)
  if (searchTimer) clearTimeout(searchTimer)
  // 让挂起中的异步搜索失效，避免写入已卸载组件的 ref
  searchSeq++
})

defineExpose({ open, close })
</script>

<template>
  <Teleport to="body">
    <!-- 遮罩层 -->
    <Transition name="search-fade">
      <div
        v-if="show"
        class="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[15vh]"
        @click.self="close"
      >
        <!-- 搜索面板 -->
        <div class="w-full max-w-2xl mx-4 bg-[#0c0c14] border border-white/[0.08] rounded-2xl shadow-2xl shadow-black/50 overflow-hidden">
          <!-- 搜索输入框 -->
          <div class="flex items-center gap-3 px-5 py-4 border-b border-white/[0.04]">
            <Search class="w-4 h-4 text-gray-500 flex-shrink-0" />
            <input
              id="global-search-input"
              ref="searchInput"
              v-model="query"
              type="text"
              placeholder="搜索课程、概念、命令…  (如：Docker、grep、权限管理)"
              class="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-gray-700"
              @input="doSearch(query)"
              @keydown="onKeyDown"
            />
            <kbd class="hidden md:inline-flex px-1.5 py-0.5 rounded bg-white/[0.04] text-[10px] text-gray-700 font-mono border border-white/[0.04]">ESC</kbd>
          </div>

          <!-- 搜索结果 -->
          <div class="max-h-[50vh] overflow-y-auto">
            <!-- 加载中 -->
            <div v-if="searching" class="flex items-center justify-center py-10">
              <Loader2 class="w-5 h-5 text-cyan-400 animate-spin" />
            </div>

            <!-- 空状态 -->
            <div v-else-if="query && results.length === 0 && !searching" class="text-center py-10">
              <p class="text-gray-600 text-xs font-mono mb-1">未找到结果</p>
              <p class="text-gray-700 text-xs">换个关键词试试</p>
            </div>

            <!-- 提示 -->
            <div v-else-if="!query" class="py-8 px-5">
              <p class="text-gray-700 text-xs font-mono text-center">输入关键词开始搜索</p>
              <div class="flex flex-wrap gap-1.5 justify-center mt-3">
                <button
                  v-for="suggest in ['Docker', 'Nginx', 'sudo', 'PATH', 'Kubernetes', 'chmod']"
                  :key="suggest"
                  @click="query = suggest; doSearch(suggest)"
                  class="px-2 py-1 rounded-md bg-white/[0.03] border border-white/[0.04] text-gray-500 text-[11px] font-mono hover:bg-white/[0.06] hover:text-white transition-all"
                >
                  {{ suggest }}
                </button>
              </div>
            </div>

            <!-- 结果列表 -->
            <div v-else class="py-2">
              <div class="px-5 py-1 text-[10px] text-gray-700 font-mono">找到 {{ results.length }} 条结果</div>
              <button
                v-for="(r, i) in results"
                :key="r.id"
                @click="selectResult(i)"
                @mouseenter="activeIndex = i"
                class="w-full text-left px-5 py-3 transition-colors"
                :class="activeIndex === i ? 'bg-cyan-400/5' : 'hover:bg-white/[0.02]'"
              >
                <div class="flex items-center gap-2 mb-0.5">
                  <component
                    :is="resultTypeMeta[r.type].icon"
                    class="w-3.5 h-3.5 text-cyan-400/70 flex-shrink-0"
                  />
                  <span class="px-1.5 py-0.5 rounded bg-white/[0.04] text-[10px] text-gray-500 font-mono">
                    {{ resultTypeMeta[r.type].label }}
                  </span>
                  <span class="text-white text-sm font-medium truncate">{{ r.courseTitle }}</span>
                  <ChevronRight class="w-3 h-3 text-gray-700 flex-shrink-0" />
                  <span class="text-gray-500 text-xs truncate font-mono">{{ r.chapterTitle }}</span>
                </div>
                <p class="text-gray-600 text-xs leading-relaxed truncate" v-text="r.matchText"></p>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.search-fade-enter-active,
.search-fade-leave-active {
  transition: opacity 0.2s ease;
}
.search-fade-enter-from,
.search-fade-leave-to {
  opacity: 0;
}
</style>
