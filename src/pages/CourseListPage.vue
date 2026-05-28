<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { Search, Filter } from 'lucide-vue-next'
import { courseIndex, chapterCounts } from '@/data/courses/index'
import type { Difficulty } from '@/types'
import CourseCard from '@/components/common/CourseCard.vue'
import { useProgressStore } from '@/stores/progress'

const router = useRouter()
const progressStore = useProgressStore()
const searchQuery = ref('')
const selectedDifficulty = ref<Difficulty | 'all'>('all')
const selectedCategory = ref<string>('all')

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

function goToCourse(id: string) {
  router.push(`/course/${id}`)
}
</script>

<template>
  <div class="min-h-screen bg-theme pt-20 pb-16 px-6">
    <div class="max-w-7xl mx-auto">
      <div class="mb-8">
        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/[0.06] bg-white/[0.02] text-gray-500 text-xs font-mono mb-3">
          <Filter class="w-3 h-3" /> 课程库
        </div>
        <h1 class="text-3xl font-bold text-white mb-1">全部课程</h1>
        <p class="text-gray-600 text-sm font-mono">共 {{ courseIndex.length }} 门课程</p>
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

      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <CourseCard
          v-for="course in filteredCourses"
          :key="course.id"
          :course="course"
          :progress="getCourseProgress(course.id)"
          @click="goToCourse"
        />
      </div>
    </div>
  </div>
</template>
