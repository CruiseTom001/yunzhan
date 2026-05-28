import type { LearningProgress } from '@/types'

const STORAGE_KEY = 'ops-school-progress'

export function loadProgress(): LearningProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return normalizeProgress(JSON.parse(raw) as Partial<LearningProgress>)
  } catch { /* ignore */ }
  return normalizeProgress({})
}

function normalizeProgress(progress: Partial<LearningProgress>): LearningProgress {
  return {
    completedChapters: progress.completedChapters ?? {},
    quizRecords: progress.quizRecords ?? {},
    achievements: progress.achievements ?? [],
    lastVisited: progress.lastVisited ?? '',
    totalTimeSpent: progress.totalTimeSpent ?? 0,
    bookmarks: progress.bookmarks ?? [],
    studyDays: progress.studyDays ?? [],
    commandHistory: progress.commandHistory ?? [],
    labRecords: progress.labRecords ?? {},
    reviewCards: progress.reviewCards ?? {},
    syncSnapshots: progress.syncSnapshots ?? [],
    communityDrafts: progress.communityDrafts ?? [],
    userProfile: progress.userProfile ?? {
      id: `local-${Date.now()}`,
      name: '本地学习者',
      targetRole: 'DevOps 工程师',
      level: 1,
      createdAt: Date.now(),
    },
  }
}

export function saveProgress(progress: LearningProgress): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
}

export function clearProgress(): void {
  localStorage.removeItem(STORAGE_KEY)
}
