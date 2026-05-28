<script setup lang="ts">
import { Clock } from 'lucide-vue-next'
import type { Course, Difficulty } from '@/types'
import { DIFFICULTY_COLORS, DIFFICULTY_LABELS } from '@/types'

defineProps<{
  course: Omit<Course, 'chapters'>
  progress?: number
  completedCount?: number
}>()

const emit = defineEmits<{
  click: [id: string]
}>()

const iconMap: Record<string, string> = {
  Terminal: '>_',
  Network: 'NET',
  Server: 'WEB',
  Database: 'DB',
  Zap: 'HA',
  Box: 'BOX',
  Ship: 'K8S',
  GitBranch: 'GIT',
  Eye: 'OBS',
  Cog: 'OPS',
  FileText: 'LOG',
  Shield: 'SEC',
  Cloud: 'CLD',
  CloudLightning: 'SRE',
  RefreshCw: 'CI',
  Monitor: 'MON',
  Code: '</>',
  Layers: 'APP',
}

function getIcon(iconName: string): string {
  return iconMap[iconName] || 'OPS'
}
</script>

<template>
  <div
    class="group relative bg-white/[0.01] border border-white/[0.04] rounded-xl p-5 cursor-pointer transition-all duration-300 hover:bg-white/[0.025] hover:border-white/[0.08] hover:-translate-y-0.5"
    @click="emit('click', course.id)"
  >
    <div class="flex items-start justify-between mb-3">
      <div class="w-10 h-10 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center font-mono text-cyan-400 text-sm">
        {{ getIcon(course.icon) }}
      </div>
      <span
        :class="[
          'px-2 py-0.5 rounded text-[10px] font-mono font-medium border',
          DIFFICULTY_COLORS[course.difficulty as Difficulty],
        ]"
      >
        {{ DIFFICULTY_LABELS[course.difficulty as Difficulty] }}
      </span>
    </div>

    <h3 class="text-white font-semibold text-base mb-1 group-hover:text-cyan-400 transition-colors leading-snug">
      {{ course.title }}
    </h3>
    <p class="text-gray-600 text-xs leading-relaxed mb-3 line-clamp-2">{{ course.description }}</p>

    <div class="flex items-center justify-between">
      <div class="flex items-center gap-1.5 text-[10px] text-gray-600 font-mono">
        <Clock class="w-3 h-3" />
        <span>{{ course.estimatedHours }}h</span>
      </div>
      <span class="text-cyan-400 text-xs font-mono opacity-0 group-hover:opacity-100 transition-opacity">-&gt;</span>
    </div>

    <div v-if="progress !== undefined && progress > 0" class="mt-3 pt-3 border-t border-white/[0.03]">
      <div class="flex items-center justify-between text-[10px] text-gray-600 font-mono mb-1">
        <span>进度</span>
        <span>{{ progress }}%</span>
      </div>
      <div class="h-1 bg-white/[0.03] rounded-full overflow-hidden">
        <div
          class="h-full bg-cyan-400/60 rounded-full transition-all duration-500"
          :style="{ width: `${progress}%` }"
        ></div>
      </div>
    </div>
  </div>
</template>
