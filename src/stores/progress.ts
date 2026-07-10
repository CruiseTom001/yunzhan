import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { CommandHistoryItem, LabCheck, LabTask, LearningProgress, QuizRecord } from '@/types'
import {
  clearProgress,
  loadDesktopProgressSnapshot,
  loadProgressBackup,
  loadProgressSnapshot,
  normalizeProgress,
  saveProgress,
  saveProgressBackup,
  saveProgressToLocal,
} from '@/utils/storage'
import { allQuestions } from '@/data/quizzes/all'
import type { QuizQuestion } from '@/types'

/** 按题目 id 建立索引，避免每次答题 O(n) 扫描全量题库 */
const questionMap: Map<string, QuizQuestion> = new Map(allQuestions.map((q) => [q.id, q]))

export const useProgressStore = defineStore('progress', () => {
  const initialSnapshot = loadProgressSnapshot()
  const progress = ref<LearningProgress>(initialSnapshot.progress)
  const storageReady = ref(false)
  const storageStatus = ref<'browser' | 'desktop' | 'error'>('browser')
  const storagePath = ref('')
  const backupUpdatedAt = ref(loadProgressBackup()?.updatedAt ?? 0)
  let latestSavedAt = initialSnapshot.updatedAt

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

  function updateLastRoute(route: string) {
    if (!route || progress.value.lastRoute === route) return
    progress.value.lastRoute = route
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

  function recordCommand(
    command: string,
    output: string,
    source: 'terminal' | 'course' | 'lab' = 'terminal',
    exitCode = 0,
  ) {
    if (!progress.value.commandHistory) progress.value.commandHistory = []
    const latest = progress.value.commandHistory[0]
    if (
      latest?.command === command &&
      latest.source === source &&
      Date.now() - latest.createdAt < 1500
    ) {
      latest.output = output || latest.output
      latest.exitCode = exitCode
      persist()
      return
    }
    progress.value.commandHistory.unshift({
      command,
      output,
      exitCode,
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

  function resetLab(labId: string) {
    if (!progress.value.labRecords) progress.value.labRecords = {}
    progress.value.labRecords[labId] = {
      labId,
      status: 'in_progress',
      startedAt: Date.now(),
      checkResults: {},
      checkMessages: {},
    }
    persist()
    return progress.value.labRecords[labId]
  }

  function evaluateLab(lab: LabTask) {
    if (!progress.value.labRecords) progress.value.labRecords = {}
    const record = progress.value.labRecords[lab.id] ?? {
      labId: lab.id,
      status: 'in_progress' as const,
      startedAt: Date.now(),
      checkResults: {},
    }

    if (!record.startedAt) record.startedAt = Date.now()
    const startedAt = record.startedAt
    const history = (progress.value.commandHistory ?? [])
      .filter(item => item.createdAt >= startedAt)
    const results: Record<string, boolean> = {}
    const messages: Record<string, string> = {}
    for (const check of lab.checks) {
      const evaluation = evaluateLabCheck(check, record.checkResults, history)
      results[check.id] = evaluation.passed
      messages[check.id] = evaluation.message
    }

    record.checkResults = results
    record.checkMessages = messages
    record.lastCheckedAt = Date.now()
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
    if (!record.checkMessages) record.checkMessages = {}
    record.checkMessages[checkId] = passed ? '已手动确认。' : '等待你手动确认这一项。'
    progress.value.labRecords[labId] = record
    persist()
  }

  function evaluateLabCheck(
    check: LabCheck,
    existingResults: Record<string, boolean>,
    history: CommandHistoryItem[],
  ) {
    if (check.type === 'manual') {
      const passed = Boolean(existingResults[check.id])
      return {
        passed,
        message: passed ? '已手动确认。' : `需要手动确认：${check.label}`,
      }
    }

    if (check.type === 'command_in_history' || check.type === 'command_exact') {
      const normalizedTarget = normalizeLabCommand(check.target)
      const matched = history.find(item => item.command.includes(check.target))
      const exactMatched = history.find(item =>
        item.exitCode === 0 && normalizeLabCommand(item.command) === normalizedTarget,
      )
      const validMatch = check.type === 'command_exact' ? exactMatched : matched
      if (validMatch) {
        return {
          passed: true,
          message: `已检测到成功执行的命令：${validMatch.command}`,
        }
      }

      return {
        passed: false,
        message: history.length > 0
          ? `未找到包含 "${check.target}" 的命令。最近执行：${latestCommandSummary(history)}`
          : `还没有检测到实验开始后的命令，请先运行：${check.target}`,
      }
    }

    const target = check.target.toLowerCase()
    const expectedCommand = check.command ? normalizeLabCommand(check.command) : ''
    const matchedOutput = history.find(item =>
      item.exitCode === 0 &&
      item.output.toLowerCase().includes(target) &&
      (check.type !== 'output_from_command' || normalizeLabCommand(item.command) === expectedCommand),
    )
    if (matchedOutput) {
      return {
        passed: true,
        message: `已在指定命令 "${matchedOutput.command}" 的输出中看到 "${check.target}"。`,
      }
    }

    return {
      passed: false,
      message: history.length > 0
        ? `输出中还没有出现 "${check.target}"，请确认命令是否产生预期结果。`
        : `还没有可检查的输出，请先运行会产生 "${check.target}" 的命令。`,
    }
  }

  function normalizeLabCommand(command: string) {
    return command
      .replace(/\s+#.*$/, '')
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase()
  }

  function latestCommandSummary(history: CommandHistoryItem[]) {
    return history
      .slice(0, 3)
      .map(item => item.command)
      .join('、')
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
    const backup = saveProgressBackup(progress.value, 'manual')
    backupUpdatedAt.value = backup.updatedAt
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

  function importProgress(payload: unknown) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new Error('进度文件格式无效。')
    }

    const source = payload as Record<string, unknown>
    const candidate = source.progress && typeof source.progress === 'object'
      ? source.progress
      : source

    if (!hasRecognizableProgressFields(candidate as Record<string, unknown>)) {
      throw new Error('没有在文件中找到云栈学习进度。')
    }

    const backup = saveProgressBackup(progress.value, 'before-import')
    backupUpdatedAt.value = backup.updatedAt
    progress.value = normalizeProgress(candidate as Partial<LearningProgress>)
    flushPersist()
    return progress.value
  }

  function restoreProgressBackup() {
    const backup = loadProgressBackup()
    if (!backup) throw new Error('没有可恢复的本地备份。')
    progress.value = normalizeProgress(backup.progress)
    flushPersist()
    return progress.value
  }

  function clearAllProgress() {
    const backup = saveProgressBackup(progress.value, 'before-clear')
    backupUpdatedAt.value = backup.updatedAt
    clearProgress()
    progress.value = normalizeProgress({})
    latestSavedAt = 0
    flushPersist()
  }

  function hasRecognizableProgressFields(value: Record<string, unknown>) {
    return [
      'completedChapters',
      'quizRecords',
      'achievements',
      'bookmarks',
      'studyDays',
      'commandHistory',
      'labRecords',
      'reviewCards',
    ].some(key => key in value)
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
    const question = questionMap.get(questionId)
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

  /**
   * 持久化策略：
   * - persist()：防抖（300ms 合并），适合高频用户操作（答题、终端命令等）
   * - flushPersist()：立即落盘，适合时序敏感场景（hydration、页面卸载）
   *
   * 原实现每次 mutator 都全量 JSON.stringify + localStorage + Electron IPC，
   * 终端连续敲命令时会产生大量同步写。防抖把它们合并为一次。
   */
  const PERSIST_DEBOUNCE_MS = 300
  let persistTimer: ReturnType<typeof setTimeout> | null = null

  function flushPersist() {
    if (persistTimer) {
      clearTimeout(persistTimer)
      persistTimer = null
    }
    latestSavedAt = saveProgress(progress.value)
  }

  function persist() {
    if (persistTimer) clearTimeout(persistTimer)
    persistTimer = setTimeout(() => {
      persistTimer = null
      latestSavedAt = saveProgress(progress.value)
    }, PERSIST_DEBOUNCE_MS)
  }

  // 页面隐藏/卸载时强制刷盘，避免防抖丢掉最后一次未写改动
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', flushPersist, { capture: true })
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flushPersist()
    })
  }

  const storageHydration = hydrateDesktopStorage()

  async function hydrateDesktopStorage() {
    try {
      const desktopSnapshot = await loadDesktopProgressSnapshot()
      if (!desktopSnapshot) {
        if (latestSavedAt > 0 || hasLearningData(progress.value)) {
          flushPersist()
        }
        storageReady.value = true
        return
      }

      storageStatus.value = 'desktop'
      storagePath.value = desktopSnapshot.path

      if (desktopSnapshot.updatedAt >= latestSavedAt) {
        progress.value = desktopSnapshot.progress
        latestSavedAt = desktopSnapshot.updatedAt
        saveProgressToLocal(progress.value, latestSavedAt)
      } else {
        flushPersist()
      }
    } catch (error) {
      console.warn('Failed to hydrate desktop progress:', error)
      storageStatus.value = 'error'
    } finally {
      // 确保 hydration 期间任何被防抖挂起的写入都已落盘，
      // 否则 main.ts 在 await whenStorageReady() 后恢复路由时可能读到旧状态
      flushPersist()
      storageReady.value = true
    }
  }

  function whenStorageReady() {
    return storageHydration
  }

  function hasLearningData(value: LearningProgress) {
    return (
      Object.keys(value.completedChapters).length > 0 ||
      Object.keys(value.quizRecords).length > 0 ||
      value.achievements.length > 0 ||
      value.bookmarks.length > 0 ||
      value.studyDays.length > 0 ||
      value.commandHistory.length > 0 ||
      Object.keys(value.labRecords).length > 0 ||
      Boolean(value.lastVisited || value.lastRoute)
    )
  }

  return {
    progress,
    storageReady,
    storageStatus,
    storagePath,
    backupUpdatedAt,
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
    updateLastRoute,
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
    resetLab,
    evaluateLab,
    markManualLabCheck,
    reviewCard,
    createSyncSnapshot,
    importProgress,
    restoreProgressBackup,
    clearAllProgress,
    addCommunityDraft,
    updateUserProfile,
    whenStorageReady,
  }
})
