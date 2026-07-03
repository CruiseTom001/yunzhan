import type { LearningProgress } from '@/types'

const STORAGE_KEY = 'ops-school-progress'
const STORAGE_META_KEY = `${STORAGE_KEY}:meta`

export interface ProgressSnapshot {
  progress: LearningProgress
  updatedAt: number
}

interface DesktopProgressEnvelope {
  version?: number
  updatedAt?: number
  progress?: Partial<LearningProgress>
}

interface DesktopLoadResult {
  source: 'primary' | 'backup'
  path: string
  payload: DesktopProgressEnvelope
}

function getElectronApi() {
  return window.electronAPI
}

export function loadProgress(): LearningProgress {
  return loadProgressSnapshot().progress
}

export function loadProgressSnapshot(): ProgressSnapshot {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      return {
        progress: normalizeProgress(JSON.parse(raw) as Partial<LearningProgress>),
        updatedAt: readLocalUpdatedAt(),
      }
    }
  } catch { /* ignore */ }
  return {
    progress: normalizeProgress({}),
    updatedAt: 0,
  }
}

export function normalizeProgress(progress: Partial<LearningProgress>): LearningProgress {
  return {
    completedChapters: progress.completedChapters ?? {},
    quizRecords: progress.quizRecords ?? {},
    achievements: progress.achievements ?? [],
    lastVisited: progress.lastVisited ?? '',
    lastRoute: progress.lastRoute ?? '',
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

export function saveProgress(progress: LearningProgress): number {
  const updatedAt = Date.now()
  saveProgressToLocal(progress, updatedAt)
  void queueDesktopSave(progress, updatedAt)
  return updatedAt
}

export function saveProgressToLocal(progress: LearningProgress, updatedAt = Date.now()): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
  localStorage.setItem(STORAGE_META_KEY, JSON.stringify({ updatedAt }))
}

export async function loadDesktopProgressSnapshot(): Promise<(ProgressSnapshot & {
  path: string
  source: 'primary' | 'backup'
}) | null> {
  const electronAPI = getElectronApi()
  if (!electronAPI) return null

  const result = await electronAPI.invoke<DesktopLoadResult | null>('progress:load')
  if (!result?.payload?.progress) return null

  return {
    progress: normalizeProgress(result.payload.progress),
    updatedAt: result.payload.updatedAt ?? 0,
    path: result.path,
    source: result.source,
  }
}

export function clearProgress(): void {
  localStorage.removeItem(STORAGE_KEY)
  localStorage.removeItem(STORAGE_META_KEY)
  void getElectronApi()?.invoke('progress:clear')
}

function readLocalUpdatedAt(): number {
  try {
    const raw = localStorage.getItem(STORAGE_META_KEY)
    if (!raw) return 0
    const meta = JSON.parse(raw) as { updatedAt?: number }
    return typeof meta.updatedAt === 'number' ? meta.updatedAt : 0
  } catch {
    return 0
  }
}

let desktopSaveQueue = Promise.resolve()

function queueDesktopSave(progress: LearningProgress, updatedAt: number): Promise<void> {
  const electronAPI = getElectronApi()
  if (!electronAPI) return Promise.resolve()

  const payload = {
    version: 1,
    updatedAt,
    progress,
  }

  desktopSaveQueue = desktopSaveQueue
    .then(() => electronAPI.invoke('progress:save', payload))
    .then(() => undefined)
    .catch((error) => {
      console.warn('Failed to save desktop progress:', error)
    })

  return desktopSaveQueue
}
