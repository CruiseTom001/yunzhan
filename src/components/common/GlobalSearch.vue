<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { courseIndex } from '@/data/courses/index'
import { getCourse } from '@/data/courses/all'
import { Search, ChevronRight, Loader2 } from 'lucide-vue-next'

defineOptions({ inheritAttrs: false })

const router = useRouter()
const isOpen = ref(false)
const query = ref('')
const activeIndex = ref(0)
const results = ref<SearchResult[]>([])
const searching = ref(false)

interface SearchResult {
  courseId: string
  courseTitle: string
  chapterIndex: number
  chapterTitle: string
  matchText: string
  matchLine: string
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

async function doSearch(q: string) {
  if (!q.trim()) {
    results.value = []
    return
  }

  searching.value = true
  const qLower = q.toLowerCase()
  const found: SearchResult[] = []

  // 1. 先在元数据中搜索（课程名、描述）——立即返回
  for (const c of courseIndex) {
    if (c.title.toLowerCase().includes(qLower) || c.description.toLowerCase().includes(qLower)) {
      found.push({
        courseId: c.id,
        courseTitle: c.title,
        chapterIndex: 0,
        chapterTitle: '课程简介',
        matchText: c.description.slice(0, 120),
        matchLine: c.title,
      })
    }
    if (found.length >= 3) break // 元数据结果限制
  }

  // 2. 懒加载课程内容搜索（逐个加载并搜索）
  for (const c of courseIndex) {
    if (found.length >= 10) break
    try {
      const course = await getCourse(c.id)
      if (!course) continue
      for (const ch of course.chapters) {
        if (found.length >= 10) break
        // 在章节内容中搜索
        const lines = ch.content.split('\n')
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]
          if (line.toLowerCase().includes(qLower) && !line.startsWith('```')) {
            found.push({
              courseId: c.id,
              courseTitle: c.title,
              chapterIndex: ch.index,
              chapterTitle: ch.title,
              matchText: line.replace(/[#*`]/g, '').trim().slice(0, 100),
              matchLine: line.trim().slice(0, 80),
            })
            if (found.length >= 10) break
          }
        }
      }
    } catch {
      // skip failed loads
    }
  }

  results.value = found
  activeIndex.value = 0
  searching.value = false
}

function selectResult(index: number) {
  const r = results.value[index]
  if (!r) return
  close()
  router.push(`/course/${r.courseId}/chapter/${r.chapterIndex}`)
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

  const isCoursePage = window.location.pathname.startsWith('/course/')
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
                  v-for="suggest in ['Docker', 'Nginx', 'grep', 'Kubernetes', 'Redis', 'chmod']"
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
                :key="`${r.courseId}-${r.chapterIndex}-${i}`"
                @click="selectResult(i)"
                @mouseenter="activeIndex = i"
                class="w-full text-left px-5 py-3 transition-colors"
                :class="activeIndex === i ? 'bg-cyan-400/5' : 'hover:bg-white/[0.02]'"
              >
                <div class="flex items-center gap-2 mb-0.5">
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
