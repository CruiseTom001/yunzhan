<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  CheckCircle2,
  XCircle,
  ArrowRight,
  RotateCcw,
  TrendingUp,
  Target,
  Award,
  Zap,
} from 'lucide-vue-next'
import { allQuestions, getQuestionsByCategory, getQuestionCategories } from '@/data/quizzes/all'
import { useProgressStore } from '@/stores/progress'

const route = useRoute()
const router = useRouter()
const progressStore = useProgressStore()

const categoryNames: Record<string, string> = {
  'linux-basics': 'Linux 基础',
  'networking': '网络基础',
  'web-server': 'Web 服务器',
  'database': '数据库',
  'cache-queue': '缓存队列',
  'docker': 'Docker',
  'kubernetes': 'K8s',
  'cicd': 'CI/CD',
  'monitoring': '监控',
  'automation': '自动化',
  'logging': '日志',
  'security': '安全',
  'high-availability': '高可用',
  'cloud-ops': '云运维',
  'devops-sre': 'DevOps',
  'computer-basics': '计算机基础',
  'git': 'Git',
  'python-ops': 'Python',
  'virtualization': '虚拟化',
}

const selectedCategory = ref<string>(route.params.categoryId as string || 'all')
const currentIndex = ref(0)
const selectedAnswer = ref<string | null>(null)
const showResult = ref(false)
const currentStreak = ref(0)
const answeredCount = ref(0)
const correctCount = ref(0)
const answerFeedback = ref<'correct' | 'wrong' | null>(null)
const showPerfectCelebration = ref(false)
const PERFECT_CELEBRATION_DURATION_MS = 2200
let answerFeedbackTimer: ReturnType<typeof setTimeout> | null = null
let perfectCelebrationTimer: ReturnType<typeof setTimeout> | null = null

const questions = computed(() => {
  if (selectedCategory.value === 'all') return allQuestions
  return getQuestionsByCategory(selectedCategory.value)
})

const currentQuestion = computed(() => questions.value[currentIndex.value] ?? null)

const isCorrect = computed(() => {
  if (!selectedAnswer.value || !currentQuestion.value) return false
  const opt = currentQuestion.value.options.find((o) => o.id === selectedAnswer.value)
  return opt?.isCorrect ?? false
})

const progressPercent = computed(() =>
  questions.value.length > 0 ? Math.round((answeredCount.value / questions.value.length) * 100) : 0,
)

const accuracy = computed(() =>
  answeredCount.value > 0 ? Math.round((correctCount.value / answeredCount.value) * 100) : 0,
)

const allCategories = computed(() => {
  const cats = getQuestionCategories()
  return [
    { value: 'all', label: '全部', count: allQuestions.length },
    ...cats.map((c) => ({
      value: c,
      label: categoryNames[c] || c,
      count: getQuestionsByCategory(c).length,
    })),
  ]
})

function selectCategory(cat: string) {
  selectedCategory.value = cat
  currentIndex.value = 0
  selectedAnswer.value = null
  showResult.value = false
  currentStreak.value = 0
  answeredCount.value = 0
  correctCount.value = 0
  router.replace(`/quiz${cat !== 'all' ? `/${cat}` : ''}`)
}

function selectOption(optionId: string) {
  if (showResult.value) return
  selectedAnswer.value = optionId
  showResult.value = true
  answeredCount.value += 1

  if (isCorrect.value) {
    correctCount.value += 1
    currentStreak.value += 1
  } else {
    currentStreak.value = 0
  }

  triggerAnswerFeedback(isCorrect.value ? 'correct' : 'wrong')

  progressStore.recordQuizAnswer(currentQuestion.value!.id, isCorrect.value)

  if (currentStreak.value === 10) progressStore.unlockAchievement('quiz-streak-10')
  if (currentStreak.value === 20) progressStore.unlockAchievement('quiz-streak-20')
  if (accuracy.value >= 80) progressStore.unlockAchievement('quiz-score-80')
  if (accuracy.value >= 95) progressStore.unlockAchievement('quiz-score-95')

  const reachedLastQuestion = currentIndex.value === questions.value.length - 1
  if (reachedLastQuestion && correctCount.value === answeredCount.value) {
    triggerPerfectCelebration()
  }
}

function triggerAnswerFeedback(status: 'correct' | 'wrong') {
  if (answerFeedbackTimer) {
    clearTimeout(answerFeedbackTimer)
  }
  answerFeedback.value = status
  answerFeedbackTimer = setTimeout(() => {
    answerFeedback.value = null
    answerFeedbackTimer = null
  }, 650)
}

function triggerPerfectCelebration() {
  if (perfectCelebrationTimer) {
    clearTimeout(perfectCelebrationTimer)
  }
  showPerfectCelebration.value = true
  perfectCelebrationTimer = setTimeout(() => {
    showPerfectCelebration.value = false
    perfectCelebrationTimer = null
  }, PERFECT_CELEBRATION_DURATION_MS)
}

function nextQuestion() {
  if (currentIndex.value < questions.value.length - 1) {
    currentIndex.value++
    selectedAnswer.value = null
    showResult.value = false
  }
}

function restart() {
  currentIndex.value = 0
  selectedAnswer.value = null
  showResult.value = false
  currentStreak.value = 0
  answeredCount.value = 0
  correctCount.value = 0
  showPerfectCelebration.value = false
}

function getOptionClass(optionId: string) {
  if (!showResult.value) {
    return selectedAnswer.value === optionId
      ? 'border-cyan-400/30 bg-cyan-400/5'
      : 'border-white/[0.04] bg-white/[0.01] hover:border-white/[0.08] hover:bg-white/[0.02]'
  }

  const opt = currentQuestion.value?.options.find((o) => o.id === optionId)
  if (opt?.isCorrect) return 'border-emerald-400/30 bg-emerald-400/5'
  if (optionId === selectedAnswer.value && !opt?.isCorrect)
    return 'border-red-400/30 bg-red-400/5'
  return 'border-white/[0.02] bg-white/[0.005] opacity-30'
}

onUnmounted(() => {
  if (answerFeedbackTimer) {
    clearTimeout(answerFeedbackTimer)
  }
  if (perfectCelebrationTimer) {
    clearTimeout(perfectCelebrationTimer)
  }
})
</script>

<template>
  <div class="min-h-screen bg-theme pt-20 pb-16 px-6">
    <div class="max-w-3xl mx-auto">
      <div class="mb-8">
        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/[0.06] bg-white/[0.02] text-gray-500 text-xs font-mono mb-3">
          <Zap class="w-3 h-3" /> 问答模式
        </div>
        <h1 class="text-3xl font-bold text-white mb-1">问答练习</h1>
        <p class="text-gray-600 text-sm font-mono">运维知识实战练习</p>
      </div>

      <div class="flex gap-1.5 flex-wrap mb-6">
        <button
          v-for="cat in allCategories"
          :key="cat.value"
          @click="selectCategory(cat.value)"
          :class="[
            'px-2.5 py-1.5 rounded text-[10px] font-mono border transition-all',
            selectedCategory === cat.value
              ? 'border-cyan-400/20 bg-cyan-400/5 text-cyan-400'
              : 'border-white/[0.03] bg-white/[0.01] text-gray-600 hover:text-gray-400',
          ]"
        >
          {{ cat.label }}<span class="ml-1 opacity-40">{{ cat.count }}</span>
        </button>
      </div>

      <div v-if="questions.length === 0" class="text-center py-20">
        <p class="text-gray-600 font-mono text-sm">当前分类暂无题目</p>
      </div>

      <template v-else>
        <div class="flex items-center gap-3 mb-4">
          <div class="flex items-center gap-2 bg-white/[0.01] border border-white/[0.04] rounded-lg px-3 py-1.5">
            <TrendingUp class="w-3 h-3 text-cyan-400" />
            <span class="text-gray-400 text-xs font-mono">{{ answeredCount }}/{{ questions.length }}</span>
          </div>
          <div class="flex items-center gap-2 bg-white/[0.01] border border-white/[0.04] rounded-lg px-3 py-1.5">
            <Target class="w-3 h-3 text-emerald-400" />
            <span class="text-emerald-400 text-xs font-mono">{{ accuracy }}%</span>
          </div>
          <div v-if="currentStreak > 2" class="flex items-center gap-2 bg-amber-400/5 border border-amber-400/15 rounded-lg px-3 py-1.5">
            <Award class="w-3 h-3 text-amber-400" />
            <span class="text-amber-400 text-xs font-mono">x{{ currentStreak }}</span>
          </div>
        </div>

        <div class="h-0.5 bg-white/[0.03] rounded-full mb-6 overflow-hidden">
          <div
            class="h-full bg-cyan-400/60 rounded-full transition-all duration-500"
            :style="{ width: `${progressPercent}%` }"
          ></div>
        </div>

        <div
          v-if="currentQuestion"
          class="quiz-question-panel bg-white/[0.01] border border-white/[0.04] rounded-xl p-6 mb-4"
          :class="{
            'quiz-feedback-correct': answerFeedback === 'correct',
            'quiz-feedback-wrong': answerFeedback === 'wrong',
          }"
        >
          <div class="flex items-center gap-2 mb-3">
            <span
              :class="[
                'px-1.5 py-0.5 rounded text-[10px] font-mono font-medium border',
                currentQuestion.type === 'single'
                  ? 'border-blue-400/20 bg-blue-400/5 text-blue-400'
                  : currentQuestion.type === 'multiple'
                    ? 'border-purple-400/20 bg-purple-400/5 text-purple-400'
                    : 'border-amber-400/20 bg-amber-400/5 text-amber-400',
              ]"
            >
              {{ currentQuestion.type === 'single' ? '单选' : currentQuestion.type === 'multiple' ? '多选' : '判断' }}
            </span>
            <span class="text-[10px] text-gray-600 font-mono">#{{ currentIndex + 1 }}</span>
          </div>

          <h2 class="text-lg text-white font-medium mb-5 leading-relaxed">
            {{ currentQuestion.question }}
          </h2>

          <div class="flex flex-col gap-2">
            <button
              v-for="option in currentQuestion.options"
              :key="option.id"
              @click="selectOption(option.id)"
              :disabled="showResult"
              :class="[
                'flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-all duration-200',
                getOptionClass(option.id),
                showResult ? 'cursor-default' : 'cursor-pointer',
                answerFeedback === 'correct' && option.isCorrect ? 'quiz-option-correct' : '',
                answerFeedback === 'wrong' && option.id === selectedAnswer ? 'quiz-option-wrong' : '',
              ]"
            >
              <span
                :class="[
                  'w-7 h-7 rounded flex items-center justify-center text-xs font-mono font-bold flex-shrink-0 transition-colors',
                  showResult && option.isCorrect
                    ? 'bg-emerald-400/10 text-emerald-400'
                    : showResult && option.id === selectedAnswer && !option.isCorrect
                      ? 'bg-red-400/10 text-red-400'
                      : selectedAnswer === option.id && !showResult
                        ? 'bg-cyan-400/10 text-cyan-400'
                        : 'bg-white/[0.03] text-gray-500',
                ]"
              >
                {{ option.id.toUpperCase() }}
              </span>
              <span class="text-gray-300 text-sm">{{ option.text }}</span>
              <CheckCircle2 v-if="showResult && option.isCorrect" class="w-4 h-4 text-emerald-400 ml-auto flex-shrink-0" />
              <XCircle v-if="showResult && option.id === selectedAnswer && !option.isCorrect" class="w-4 h-4 text-red-400 ml-auto flex-shrink-0" />
            </button>
          </div>

          <Transition name="answer-explanation">
            <div
              v-if="showResult"
              :class="[
                'mt-4 p-4 rounded-lg border',
                isCorrect
                  ? 'bg-emerald-400/[0.03] border-emerald-400/15'
                  : 'bg-red-400/[0.03] border-red-400/15',
              ]"
            >
              <div class="flex items-center gap-2 mb-1.5">
                <component :is="isCorrect ? CheckCircle2 : XCircle" :class="['w-4 h-4', isCorrect ? 'text-emerald-400' : 'text-red-400']" />
                <span :class="['font-medium text-xs font-mono', isCorrect ? 'text-emerald-400' : 'text-red-400']">
                  {{ isCorrect ? '回答正确' : '回答错误' }}
                </span>
              </div>
              <p class="text-gray-400 text-xs leading-relaxed">{{ currentQuestion.explanation }}</p>
            </div>
          </Transition>
        </div>

        <div class="flex items-center justify-between">
          <button
            @click="restart"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.04] text-gray-500 hover:text-gray-300 hover:border-white/[0.08] transition-all text-xs font-mono"
          >
            <RotateCcw class="w-3 h-3" />
            重置
          </button>

          <button
            v-if="showResult && currentIndex < questions.length - 1"
            @click="nextQuestion"
            class="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-500 text-[#06060b] font-bold text-xs font-mono shadow-lg shadow-cyan-500/20 hover:bg-cyan-400 transition-all"
          >
            下一题
            <ArrowRight class="w-3 h-3" />
          </button>

          <button
            v-else-if="showResult && currentIndex >= questions.length - 1"
            @click="restart"
            class="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500 text-[#06060b] font-bold text-xs font-mono shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition-all"
          >
            重新开始
            <RotateCcw class="w-3 h-3" />
          </button>
        </div>
      </template>
    </div>

    <Teleport to="body">
      <Transition name="perfect-fade">
        <div v-if="showPerfectCelebration" class="perfect-celebration" role="status" aria-live="polite">
          <div class="perfect-rays" aria-hidden="true">
            <span v-for="ray in 12" :key="ray" :style="{ '--ray-index': ray - 1 }" />
          </div>
          <Award class="perfect-award" aria-hidden="true" />
          <strong>PERFECT SCORE</strong>
          <span>{{ correctCount }}/{{ answeredCount }} 全部回答正确</span>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.quiz-feedback-correct {
  animation: quiz-correct-pulse 0.65s ease-out;
}

.quiz-feedback-wrong {
  animation: quiz-wrong-panel 0.42s ease-out;
}

.quiz-option-correct {
  animation: quiz-correct-option 0.65s ease-out;
}

.quiz-option-wrong {
  animation: quiz-wrong-option 0.38s ease-out;
}

.answer-explanation-enter-active,
.answer-explanation-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.answer-explanation-enter-from,
.answer-explanation-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

.perfect-celebration {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 7px;
  overflow: hidden;
  pointer-events: none;
  color: #fde68a;
  background: radial-gradient(circle at center, rgb(251 191 36 / 0.13), transparent 34%);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.perfect-celebration strong {
  color: #fbbf24;
  font-size: 24px;
  letter-spacing: 0;
  text-shadow: 0 0 28px rgb(251 191 36 / 0.55);
  animation: perfect-title 2.2s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.perfect-celebration > span:last-child {
  color: #d1fae5;
  font-size: 12px;
}

.perfect-award {
  width: 42px;
  height: 42px;
  filter: drop-shadow(0 0 18px rgb(251 191 36 / 0.45));
  animation: perfect-award 2.2s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.perfect-rays {
  position: absolute;
  width: 1px;
  height: 1px;
}

.perfect-rays span {
  position: absolute;
  width: 3px;
  height: 96px;
  border-radius: 2px;
  background: linear-gradient(to top, rgb(251 191 36 / 0.8), transparent);
  transform-origin: 50% 0;
  transform: rotate(calc(var(--ray-index) * 30deg)) translateY(52px);
  animation: perfect-ray 1.4s ease-out both;
}

.perfect-fade-enter-active,
.perfect-fade-leave-active {
  transition: opacity 0.2s ease;
}

.perfect-fade-enter-from,
.perfect-fade-leave-to {
  opacity: 0;
}

@keyframes quiz-correct-pulse {
  0% { box-shadow: 0 0 0 rgb(52 211 153 / 0); }
  40% { border-color: rgb(52 211 153 / 0.42); box-shadow: 0 0 32px rgb(52 211 153 / 0.12); }
  100% { box-shadow: 0 0 0 rgb(52 211 153 / 0); }
}

@keyframes quiz-wrong-panel {
  0%, 100% { transform: translateX(0); }
  32% { transform: translateX(-3px); }
  68% { transform: translateX(2px); }
}

@keyframes quiz-correct-option {
  0% { transform: scale(1); }
  45% { transform: scale(1.012); box-shadow: 0 0 22px rgb(52 211 153 / 0.12); }
  100% { transform: scale(1); }
}

@keyframes quiz-wrong-option {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-5px); }
  55% { transform: translateX(4px); }
  78% { transform: translateX(-2px); }
}

@keyframes perfect-title {
  0% { opacity: 0; transform: translateY(10px) scale(0.86); }
  18%, 76% { opacity: 1; transform: translateY(0) scale(1); }
  100% { opacity: 0; transform: translateY(-8px) scale(0.97); }
}

@keyframes perfect-award {
  0% { opacity: 0; transform: scale(0.4) rotate(-18deg); }
  24%, 78% { opacity: 1; transform: scale(1) rotate(0); }
  100% { opacity: 0; transform: scale(0.92) rotate(8deg); }
}

@keyframes perfect-ray {
  0% { opacity: 0; height: 20px; }
  28% { opacity: 0.9; }
  100% { opacity: 0; height: 150px; }
}

@media (prefers-reduced-motion: reduce) {
  .quiz-feedback-correct,
  .quiz-feedback-wrong,
  .quiz-option-correct,
  .quiz-option-wrong,
  .perfect-celebration strong,
  .perfect-award,
  .perfect-rays span {
    animation: none;
  }

  .perfect-rays {
    display: none;
  }
}
</style>
