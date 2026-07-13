<script setup lang="ts">
import { computed } from 'vue'
import { CheckCircle2, Clock } from 'lucide-vue-next'
import type { Course, Difficulty } from '@/types'
import { DIFFICULTY_COLORS, DIFFICULTY_LABELS } from '@/types'
import { getCourseIconChar } from '@/data/courseIcons'

const props = defineProps<{
  course: Omit<Course, 'chapters'>
  progress?: number
  completedCount?: number
}>()

const COURSE_TECH_STACKS: Record<string, string[]> = {
  'computer-basics': ['CPU', 'Memory', 'OS'],
  'linux-basics': ['Bash', 'systemd', 'SSH'],
  networking: ['TCP/IP', 'DNS', 'Firewall'],
  git: ['Git', 'Branch', 'CI'],
  'web-server': ['Nginx', 'HTTP', 'TLS'],
  database: ['MySQL', 'SQL', 'Backup'],
  'cache-queue': ['Redis', 'MQ', 'Cache'],
  'python-ops': ['Python', 'Script', 'API'],
  virtualization: ['VM', 'KVM', 'Storage'],
  docker: ['Docker', 'Compose', 'Image'],
  cicd: ['Pipeline', 'GitHub', 'Deploy'],
  monitoring: ['Prometheus', 'Grafana', 'Alert'],
  logging: ['ELK', 'Loki', 'Trace'],
  security: ['IAM', 'Audit', 'Hardening'],
  kubernetes: ['K8s', 'Helm', 'Ingress'],
  automation: ['Ansible', 'Shell', 'IaC'],
  'high-availability': ['HAProxy', 'Keepalived', 'Cluster'],
  'cloud-ops': ['Cloud', 'Terraform', 'FinOps'],
  'devops-sre': ['SRE', 'SLO', 'Incident'],
  'devops-project': ['DevOps', 'Release', 'Observability'],
}

const techStack = computed(() => COURSE_TECH_STACKS[props.course.id] ?? ['Linux', 'Ops'])
const isComplete = computed(() => props.progress === 100)

const emit = defineEmits<{
  click: [id: string]
}>()
</script>

<template>
  <div
    class="course-card group relative overflow-hidden bg-white/[0.01] border border-white/[0.04] rounded-xl p-5 cursor-pointer transition-all duration-300 hover:bg-white/[0.025] hover:border-white/[0.08] hover:-translate-y-0.5"
    :class="{ 'course-card-complete': isComplete }"
    role="button"
    tabindex="0"
    @click="emit('click', course.id)"
    @keydown.enter="emit('click', course.id)"
    @keydown.space.prevent="emit('click', course.id)"
  >
    <div class="flex items-start justify-between mb-3">
      <div class="w-10 h-10 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center font-mono text-cyan-400 text-sm">
        {{ getCourseIconChar(course.icon) }}
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

    <div class="course-tech-stack" aria-label="课程技术栈">
      <span v-for="technology in techStack" :key="technology">{{ technology }}</span>
    </div>

    <div class="flex items-center justify-between">
      <div class="flex items-center gap-1.5 text-[10px] text-gray-600 font-mono">
        <Clock class="w-3 h-3" />
        <span>{{ course.estimatedHours }}h</span>
      </div>
      <span class="text-cyan-400 text-xs font-mono opacity-0 group-hover:opacity-100 transition-opacity">-&gt;</span>
    </div>

    <div v-if="isComplete" class="course-complete-label">
      <CheckCircle2 class="w-3 h-3" /> 已完成
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

<style scoped>
.course-tech-stack {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  max-height: 0;
  margin-bottom: 0;
  overflow: hidden;
  opacity: 0;
  transform: translateY(-4px);
  transition: max-height 0.25s ease, margin-bottom 0.25s ease, opacity 0.2s ease, transform 0.25s ease;
}

.course-card:hover .course-tech-stack,
.course-card:focus-within .course-tech-stack {
  max-height: 28px;
  margin-bottom: 10px;
  opacity: 1;
  transform: translateY(0);
}

.course-tech-stack span {
  padding: 2px 6px;
  border: 1px solid rgb(34 211 238 / 0.12);
  border-radius: 4px;
  color: #67e8f9;
  background: rgb(34 211 238 / 0.04);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 9px;
}

.course-complete-label {
  position: absolute;
  right: 16px;
  bottom: 15px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #6ee7b7;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 9px;
}

.course-card-complete::after {
  position: absolute;
  inset: 0;
  pointer-events: none;
  content: '';
  background: linear-gradient(105deg, transparent 20%, rgb(52 211 153 / 0.1) 50%, transparent 78%);
  transform: translateX(-100%);
  animation: course-complete-scan 1.2s ease-out 0.25s both;
}

@keyframes course-complete-scan {
  0% { opacity: 0; transform: translateX(-100%); }
  25% { opacity: 1; }
  100% { opacity: 0; transform: translateX(100%); }
}

@media (prefers-reduced-motion: reduce) {
  .course-card-complete::after {
    display: none;
  }

  .course-tech-stack {
    transition: none;
  }
}
</style>
