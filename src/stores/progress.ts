import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { LabTask, LearningProgress, QuizRecord } from '@/types'
import { loadProgress, saveProgress } from '@/utils/storage'
import { allQuestions } from '@/data/quizzes/all'

export const useProgressStore = defineStore('progress', () => {
  const progress = ref<LearningProgress>(loadProgress())

  const completedChaptersCount = computed(() =>
    Object.values(progress.value.completedChapters).reduce((sum, ch) => sum + ch.length, 0),
  )

  const quizTotalAnswered = computed(() => Object.keys(progress.value.quizRecords).length)

  const quizCorrectCount = computed(() =>
    Object.values(progress.value.quizRecords).filter((r) => r.isCorrect).length,
  )

  const quizAccuracy = computed(() => {
    const total = quizTotalAnswered.value
    if (total === 0) return 0
    return Math.round((quizCorrectCount.value / total) * 100)
  })

  const completedCourseCount = computed(() => Object.keys(progress.value.completedChapters).length)
  const commandHistory = computed(() => progress.value.commandHistory ?? [])
  const labRecords = computed(() => progress.value.labRecords ?? {})
  const completedLabCount = computed(() =>
    Object.values(labRecords.value).filter(record => record.status === 'passed').length,
  )
  const reviewCards = computed(() => Object.values(progress.value.reviewCards ?? {}))
  const dueReviewCards = computed(() => reviewCards.value.filter(card => card.nextReviewAt <= Date.now()))
  const wrongQuestionCards = computed(() =>
    reviewCards.value.filter(card => card.sourceType === 'quiz' && card.lapses > 0),
  )

  function markChapterComplete(courseId: string, chapterIndex: number) {
    if (!progress.value.completedChapters[courseId]) {
      progress.value.completedChapters[courseId] = []
    }
    if (!progress.value.completedChapters[courseId].includes(chapterIndex)) {
      progress.value.completedChapters[courseId].push(chapterIndex)
    }
    persist()
  }

  function isChapterComplete(courseId: string, chapterIndex: number): boolean {
    return progress.value.completedChapters[courseId]?.includes(chapterIndex) ?? false
  }

  function unmarkChapterComplete(courseId: string, chapterIndex: number) {
    if (!progress.value.completedChapters[courseId]) return
    const idx = progress.value.completedChapters[courseId].indexOf(chapterIndex)
    if (idx >= 0) {
      progress.value.completedChapters[courseId].splice(idx, 1)
      persist()
    }
  }

  function isCourseComplete(courseId: string, totalChapters: number): boolean {
    const completed = progress.value.completedChapters[courseId]?.length ?? 0
    return completed >= totalChapters
  }

  function recordQuizAnswer(questionId: string, isCorrect: boolean) {
    const existing = progress.value.quizRecords[questionId]
    if (existing) {
      existing.attempts += 1
      existing.isCorrect = isCorrect
      existing.answeredAt = Date.now()
    } else {
      progress.value.quizRecords[questionId] = {
        answeredAt: Date.now(),
        isCorrect,
        attempts: 1,
      }
    }
    upsertQuizReview(questionId, isCorrect)
    persist()
  }

  function getQuizRecord(questionId: string): QuizRecord | undefined {
    return progress.value.quizRecords[questionId]
  }

  function unlockAchievement(achievementId: string) {
    if (!progress.value.achievements.includes(achievementId)) {
      progress.value.achievements.push(achievementId)
      persist()
      return true
    }
    return false
  }

  function hasAchievement(achievementId: string): boolean {
    return progress.value.achievements.includes(achievementId)
  }

  function addTimeSpent(seconds: number) {
    progress.value.totalTimeSpent += seconds
    persist()
  }

  function updateLastVisited(courseId: string) {
    progress.value.lastVisited = courseId
    persist()
  }

  // ===== 书签/收藏 =====
  function addBookmark(courseId: string, chapterIndex: number, note?: string) {
    // 迁移旧数据
    if (!progress.value.bookmarks) progress.value.bookmarks = []
    // 避免重复
    if (!progress.value.bookmarks.some((b) => b.courseId === courseId && b.chapterIndex === chapterIndex)) {
      progress.value.bookmarks.push({ courseId, chapterIndex, note, createdAt: Date.now() })
      persist()
      return true
    }
    return false
  }

  function removeBookmark(courseId: string, chapterIndex: number) {
    if (!progress.value.bookmarks) progress.value.bookmarks = []
    progress.value.bookmarks = progress.value.bookmarks.filter(
      (b) => !(b.courseId === courseId && b.chapterIndex === chapterIndex),
    )
    persist()
  }

  function isBookmarked(courseId: string, chapterIndex: number): boolean {
    if (!progress.value.bookmarks) return false
    return progress.value.bookmarks.some((b) => b.courseId === courseId && b.chapterIndex === chapterIndex)
  }

  const bookmarks = computed(() => progress.value.bookmarks ?? [])

  // ===== 学习天数统计 =====
  const studyDays = computed(() => progress.value.studyDays ?? [])

  /** 学习总天数 */
  const totalStudyDays = computed(() => studyDays.value.length)

  /** 连续学习天数 */
  const streakDays = computed(() => {
    const days = [...studyDays.value].sort().reverse()
    if (days.length === 0) return 0
    let streak = 0
    const today = new Date()
    // 检查今天或昨天是否学习（如果今天还没学，从昨天开始算）
    let checkDate = days[0] === todayStr() ? today : new Date(today.getTime() - 86400000)
    for (let i = 0; i < days.length; i++) {
      const d = new Date(days[i] + 'T00:00:00')
      if (d.toDateString() === checkDate.toDateString()) {
        streak++
        checkDate = new Date(checkDate.getTime() - 86400000)
      }
    }
    return streak
  })

  /** 今日是否已学习 */
  const todayStudied = computed(() => studyDays.value.includes(todayStr()))

  function todayStr(): string {
    return new Date().toISOString().slice(0, 10)
  }

  /** 记录今日学习 */
  function trackStudyDay() {
    if (!progress.value.studyDays) progress.value.studyDays = []
    const today = todayStr()
    if (!progress.value.studyDays.includes(today)) {
      progress.value.studyDays.push(today)
      persist()
    }
  }

  function recordCommand(command: string, output: string, source: 'terminal' | 'course' | 'lab' = 'terminal') {
    if (!progress.value.commandHistory) progress.value.commandHistory = []
    const latest = progress.value.commandHistory[0]
    if (
      latest?.command === command &&
      latest.source === source &&
      Date.now() - latest.createdAt < 1500
    ) {
      latest.output = output || latest.output
      persist()
      return
    }
    progress.value.commandHistory.unshift({
      command,
      output,
      exitCode: 0,
      source,
      createdAt: Date.now(),
    })
    progress.value.commandHistory = progress.value.commandHistory.slice(0, 200)
    trackStudyDay()
    persist()
  }

  function startLab(labId: string) {
    if (!progress.value.labRecords) progress.value.labRecords = {}
    const existing = progress.value.labRecords[labId]
    if (!existing) {
      progress.value.labRecords[labId] = {
        labId,
        status: 'in_progress',
        startedAt: Date.now(),
        checkResults: {},
      }
    } else if (existing.status === 'not_started') {
      existing.status = 'in_progress'
      existing.startedAt = Date.now()
    }
    persist()
  }

  function evaluateLab(lab: LabTask) {
    if (!progress.value.labRecords) progress.value.labRecords = {}
    const record = progress.value.labRecords[lab.id] ?? {
      labId: lab.id,
      status: 'in_progress' as const,
      startedAt: Date.now(),
      checkResults: {},
    }

    const history = progress.value.commandHistory ?? []
    const results: Record<string, boolean> = {}
    for (const check of lab.checks) {
      if (check.type === 'manual') {
        results[check.id] = Boolean(record.checkResults[check.id])
      } else if (check.type === 'command_in_history') {
        results[check.id] = history.some(item => item.command.includes(check.target))
      } else if (check.type === 'output_contains') {
        results[check.id] = history.some(item => item.output.toLowerCase().includes(check.target.toLowerCase()))
      }
    }

    record.checkResults = results
    record.status = Object.values(results).every(Boolean) ? 'passed' : 'in_progress'
    if (record.status === 'passed' && !record.completedAt) {
      record.completedAt = Date.now()
      createLabReview(lab)
    }
    progress.value.labRecords[lab.id] = record
    persist()
    return record
  }

  function markManualLabCheck(labId: string, checkId: string, passed: boolean) {
    if (!progress.value.labRecords) progress.value.labRecords = {}
    const record = progress.value.labRecords[labId] ?? {
      labId,
      status: 'in_progress' as const,
      startedAt: Date.now(),
      checkResults: {},
    }
    record.checkResults[checkId] = passed
    progress.value.labRecords[labId] = record
    persist()
  }

  function reviewCard(cardId: string, quality: 0 | 1 | 2 | 3 | 4 | 5) {
    const card = progress.value.reviewCards?.[cardId]
    if (!card) return
    const passed = quality >= 3
    if (!passed) {
      card.repetitions = 0
      card.intervalDays = 1
      card.lapses += 1
    } else {
      card.repetitions += 1
      if (card.repetitions === 1) card.intervalDays = 1
      else if (card.repetitions === 2) card.intervalDays = 3
      else card.intervalDays = Math.max(4, Math.round(card.intervalDays * card.ease))
      card.ease = Math.max(1.3, card.ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)))
    }
    card.nextReviewAt = Date.now() + card.intervalDays * 86400000
    card.updatedAt = Date.now()
    persist()
  }

  function createSyncSnapshot(deviceName = navigator.userAgent.slice(0, 40)) {
    if (!progress.value.syncSnapshots) progress.value.syncSnapshots = []
    const payload = JSON.stringify(progress.value)
    const checksum = Array.from(payload).reduce((sum, char) => (sum + char.charCodeAt(0)) % 1000000007, 0).toString(16)
    progress.value.syncSnapshots.unshift({
      id: `sync-${Date.now()}`,
      createdAt: Date.now(),
      deviceName,
      checksum,
    })
    progress.value.syncSnapshots = progress.value.syncSnapshots.slice(0, 10)
    persist()
  }

  function addCommunityDraft(type: 'lab-note' | 'yaml' | 'command', title: string, content: string, tags: string[] = []) {
    if (!progress.value.communityDrafts) progress.value.communityDrafts = []
    progress.value.communityDrafts.unshift({
      id: `draft-${Date.now()}`,
      type,
      title,
      content,
      tags,
      createdAt: Date.now(),
    })
    persist()
  }

  function updateUserProfile(name: string, targetRole: string) {
    progress.value.userProfile = {
      ...progress.value.userProfile,
      name,
      targetRole,
      level: Math.max(1, Math.floor((completedChaptersCount.value + completedLabCount.value * 2) / 10) + 1),
    }
    persist()
  }

  function upsertQuizReview(questionId: string, isCorrect: boolean) {
    if (!progress.value.reviewCards) progress.value.reviewCards = {}
    const question = allQuestions.find(q => q.id === questionId)
    if (!question) return
    const id = `quiz:${questionId}`
    const existing = progress.value.reviewCards[id]
    if (!existing) {
      progress.value.reviewCards[id] = {
        id,
        sourceType: 'quiz',
        sourceId: questionId,
        categoryId: question.categoryId,
        prompt: question.question,
        answer: question.explanation,
        nextReviewAt: Date.now() + (isCorrect ? 3 : 1) * 86400000,
        intervalDays: isCorrect ? 3 : 1,
        ease: 2.5,
        repetitions: isCorrect ? 1 : 0,
        lapses: isCorrect ? 0 : 1,
        updatedAt: Date.now(),
      }
      return
    }
    if (!isCorrect) {
      existing.lapses += 1
      existing.repetitions = 0
      existing.intervalDays = 1
      existing.nextReviewAt = Date.now() + 86400000
      existing.updatedAt = Date.now()
    }
  }

  function createLabReview(lab: LabTask) {
    if (!progress.value.reviewCards) progress.value.reviewCards = {}
    const id = `lab:${lab.id}`
    if (progress.value.reviewCards[id]) return
    progress.value.reviewCards[id] = {
      id,
      sourceType: 'lab',
      sourceId: lab.id,
      categoryId: lab.courseId,
      prompt: `复盘实验：${lab.title}`,
      answer: lab.steps.map(step => `${step.title}: ${step.command ?? step.description}`).join('\n'),
      nextReviewAt: Date.now() + 2 * 86400000,
      intervalDays: 2,
      ease: 2.5,
      repetitions: 1,
      lapses: 0,
      updatedAt: Date.now(),
    }
  }

  function persist() {
    saveProgress(progress.value)
  }

  return {
    progress,
    completedChaptersCount,
    quizTotalAnswered,
    quizCorrectCount,
    quizAccuracy,
    completedCourseCount,
    commandHistory,
    labRecords,
    completedLabCount,
    reviewCards,
    dueReviewCards,
    wrongQuestionCards,
    markChapterComplete,
    unmarkChapterComplete,
    isChapterComplete,
    isCourseComplete,
    recordQuizAnswer,
    getQuizRecord,
    unlockAchievement,
    hasAchievement,
    addTimeSpent,
    updateLastVisited,
    addBookmark,
    removeBookmark,
    isBookmarked,
    bookmarks,
    studyDays,
    totalStudyDays,
    streakDays,
    todayStudied,
    trackStudyDay,
    recordCommand,
    startLab,
    evaluateLab,
    markManualLabCheck,
    reviewCard,
    createSyncSnapshot,
    addCommunityDraft,
    updateUserProfile,
  }
})
