import type {
  Bookmark,
  CommandHistoryItem,
  CommunityDraft,
  LabRecord,
  LearningProgress,
  QuizRecord,
  ReviewCard,
  SyncSnapshot,
  UserProfile,
} from '@/types'

const STORAGE_KEY = 'ops-school-progress'
const STORAGE_META_KEY = `${STORAGE_KEY}:meta`
const STORAGE_BACKUP_KEY = `${STORAGE_KEY}:manual-backup`
const LEGACY_MIGRATION_KEY = `${STORAGE_KEY}:legacy-migrated`
const ACCOUNT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
let storageScope: string | null = null

export interface ProgressSnapshot {
  progress: LearningProgress
  updatedAt: number
}

export interface ProgressBackup extends ProgressSnapshot {
  reason: 'manual' | 'before-import' | 'before-clear'
}

function scopedStorageKey(baseKey: string) {
  return storageScope ? `${baseKey}:account:${storageScope}` : baseKey
}

export function setProgressStorageScope(accountId: string | null) {
  if (accountId !== null && !ACCOUNT_ID_PATTERN.test(accountId)) {
    throw new Error('账号 ID 无效，无法切换进度存储空间。')
  }
  storageScope = accountId
}

export function loadLegacyProgressSnapshot() {
  return loadProgressSnapshotByKey(STORAGE_KEY, STORAGE_META_KEY)
}

export function hasMigratedLegacyProgress() {
  return localStorage.getItem(LEGACY_MIGRATION_KEY) === 'true'
}

export function markLegacyProgressMigrated() {
  localStorage.setItem(LEGACY_MIGRATION_KEY, 'true')
}

interface DesktopProgressEnvelope {
  version?: number
  updatedAt?: number
  progress?: unknown
}

interface DesktopLoadResult {
  source: 'primary' | 'backup'
  path: string
  payload: DesktopProgressEnvelope
}

function getElectronApi() {
  return window.electronAPI
}

export function loadProgressSnapshot(): ProgressSnapshot {
  return loadProgressSnapshotByKey(scopedStorageKey(STORAGE_KEY), scopedStorageKey(STORAGE_META_KEY))
}

function loadProgressSnapshotByKey(progressKey: string, metaKey: string): ProgressSnapshot {
  try {
    const raw = localStorage.getItem(progressKey)
    if (raw) {
      return {
        progress: normalizeProgress(JSON.parse(raw) as unknown),
        updatedAt: readLocalUpdatedAt(metaKey),
      }
    }
  } catch { /* ignore */ }
  return {
    progress: normalizeProgress({}),
    updatedAt: 0,
  }
}

export function normalizeProgress(progress: unknown): LearningProgress {
  const source = isRecord(progress) ? progress : {}
  return {
    completedChapters: readRecord(source.completedChapters, readChapterIndexes),
    quizRecords: readRecord(source.quizRecords, readQuizRecord),
    achievements: readStringArray(source.achievements),
    lastVisited: readString(source.lastVisited),
    lastRoute: readString(source.lastRoute),
    totalTimeSpent: readNonNegativeNumber(source.totalTimeSpent),
    bookmarks: readArray(source.bookmarks, readBookmark),
    studyDays: readStringArray(source.studyDays),
    commandHistory: readArray(source.commandHistory, readCommandHistoryItem),
    labRecords: readRecord(source.labRecords, readLabRecord),
    reviewCards: readRecord(source.reviewCards, readReviewCard),
    syncSnapshots: readArray(source.syncSnapshots, readSyncSnapshot),
    communityDrafts: readArray(source.communityDrafts, readCommunityDraft),
    userProfile: readUserProfile(source.userProfile) ?? {
      id: `local-${Date.now()}`,
      name: '本地学习者',
      targetRole: 'DevOps 工程师',
      level: 1,
      createdAt: Date.now(),
    },
  }
}

export function isValidProgressPayload(progress: unknown): boolean {
  if (!isRecord(progress)) return false
  const validators: Record<string, (value: unknown) => boolean> = {
    completedChapters: value => isRecordValue(value, readChapterIndexes),
    quizRecords: value => isRecordValue(value, readQuizRecord),
    achievements: value => isArrayValue(value, readString),
    lastVisited: value => typeof value === 'string',
    lastRoute: value => typeof value === 'string',
    totalTimeSpent: value => isNonNegativeNumber(value),
    bookmarks: value => isArrayValue(value, readBookmark),
    studyDays: value => isArrayValue(value, readString),
    commandHistory: value => isArrayValue(value, readCommandHistoryItem),
    labRecords: value => isRecordValue(value, readLabRecord),
    reviewCards: value => isRecordValue(value, readReviewCard),
    syncSnapshots: value => isArrayValue(value, readSyncSnapshot),
    communityDrafts: value => isArrayValue(value, readCommunityDraft),
    userProfile: value => readUserProfile(value) !== null,
  }
  return Object.entries(progress).every(([key, value]) => !validators[key] || validators[key](value))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function readNonNegativeNumber(value: unknown): number {
  return isNonNegativeNumber(value) ? value : 0
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function isNonNegativeInteger(value: unknown): value is number {
  return isNonNegativeNumber(value) && Number.isInteger(value)
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function readArray<T>(value: unknown, reader: (item: unknown) => T | null): T[] {
  if (!Array.isArray(value)) return []
  return value.map(reader).filter((item): item is T => item !== null)
}

function readRecord<T>(value: unknown, reader: (item: unknown) => T | null): Record<string, T> {
  if (!isRecord(value)) return {}
  const result: Record<string, T> = {}
  for (const [key, item] of Object.entries(value)) {
    const parsed = reader(item)
    if (parsed !== null) result[key] = parsed
  }
  return result
}

function isArrayValue<T>(value: unknown, reader: (item: unknown) => T | null): boolean {
  return Array.isArray(value) && value.every(item => reader(item) !== null)
}

function isRecordValue<T>(value: unknown, reader: (item: unknown) => T | null): boolean {
  return isRecord(value) && Object.values(value).every(item => reader(item) !== null)
}

function readChapterIndexes(value: unknown): number[] | null {
  if (!Array.isArray(value) || !value.every(isNonNegativeInteger)) return null
  return [...new Set(value)]
}

function readQuizRecord(value: unknown): QuizRecord | null {
  if (!isRecord(value) || !isNonNegativeNumber(value.answeredAt) || typeof value.isCorrect !== 'boolean' || !isNonNegativeNumber(value.attempts)) return null
  return { answeredAt: value.answeredAt, isCorrect: value.isCorrect, attempts: value.attempts }
}

function readBookmark(value: unknown): Bookmark | null {
  if (!isRecord(value) || typeof value.courseId !== 'string' || !isNonNegativeInteger(value.chapterIndex) || !isNonNegativeNumber(value.createdAt)) return null
  if (value.note !== undefined && typeof value.note !== 'string') return null
  return { courseId: value.courseId, chapterIndex: value.chapterIndex, note: typeof value.note === 'string' ? value.note : undefined, createdAt: value.createdAt }
}

function readCommandHistoryItem(value: unknown): CommandHistoryItem | null {
  if (!isRecord(value) || typeof value.command !== 'string' || typeof value.output !== 'string' || !isNonNegativeInteger(value.exitCode) || !isNonNegativeNumber(value.createdAt)) return null
  if (value.source !== 'terminal' && value.source !== 'course' && value.source !== 'lab') return null
  return { command: value.command, output: value.output, exitCode: value.exitCode, source: value.source, createdAt: value.createdAt }
}

function readLabRecord(value: unknown): LabRecord | null {
  if (!isRecord(value) || typeof value.labId !== 'string' || !isRecord(value.checkResults)) return null
  if (value.status !== 'not_started' && value.status !== 'in_progress' && value.status !== 'passed') return null
  if (!Object.values(value.checkResults).every(item => typeof item === 'boolean')) return null
  const checkMessages = isRecord(value.checkMessages)
    ? Object.fromEntries(Object.entries(value.checkMessages).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
    : undefined
  const checkResults = Object.fromEntries(
    Object.entries(value.checkResults).filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean'),
  )
  return {
    labId: value.labId,
    status: value.status,
    startedAt: isNonNegativeNumber(value.startedAt) ? value.startedAt : undefined,
    completedAt: isNonNegativeNumber(value.completedAt) ? value.completedAt : undefined,
    checkResults,
    checkMessages,
    lastCheckedAt: isNonNegativeNumber(value.lastCheckedAt) ? value.lastCheckedAt : undefined,
  }
}

function readReviewCard(value: unknown): ReviewCard | null {
  if (!isRecord(value)) return null
  const sourceType = value.sourceType
  if (sourceType !== 'quiz' && sourceType !== 'concept' && sourceType !== 'lab') return null
  if (typeof value.id !== 'string' || typeof value.sourceId !== 'string' || typeof value.categoryId !== 'string' || typeof value.prompt !== 'string' || typeof value.answer !== 'string') return null
  if (!isNonNegativeNumber(value.nextReviewAt) || !isNonNegativeNumber(value.intervalDays) || !isNonNegativeNumber(value.ease) || !isNonNegativeNumber(value.repetitions) || !isNonNegativeNumber(value.lapses) || !isNonNegativeNumber(value.updatedAt)) return null
  return {
    id: value.id,
    sourceType,
    sourceId: value.sourceId,
    categoryId: value.categoryId,
    prompt: value.prompt,
    answer: value.answer,
    nextReviewAt: value.nextReviewAt,
    intervalDays: value.intervalDays,
    ease: value.ease,
    repetitions: value.repetitions,
    lapses: value.lapses,
    updatedAt: value.updatedAt,
  }
}

function readSyncSnapshot(value: unknown): SyncSnapshot | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.deviceName !== 'string' || typeof value.checksum !== 'string' || !isNonNegativeNumber(value.createdAt)) return null
  return { id: value.id, createdAt: value.createdAt, deviceName: value.deviceName, checksum: value.checksum }
}

function readCommunityDraft(value: unknown): CommunityDraft | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.title !== 'string' || typeof value.content !== 'string' || !isNonNegativeNumber(value.createdAt)) return null
  if (value.type !== 'lab-note' && value.type !== 'yaml' && value.type !== 'command') return null
  if (!Array.isArray(value.tags) || !value.tags.every(tag => typeof tag === 'string')) return null
  return { id: value.id, type: value.type, title: value.title, content: value.content, tags: value.tags.filter((tag): tag is string => typeof tag === 'string'), createdAt: value.createdAt }
}

function readUserProfile(value: unknown): UserProfile | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.name !== 'string' || typeof value.targetRole !== 'string') return null
  if (!isNonNegativeNumber(value.level) || !isNonNegativeNumber(value.createdAt)) return null
  return { id: value.id, name: value.name, targetRole: value.targetRole, level: value.level, createdAt: value.createdAt }
}

export function saveProgress(progress: LearningProgress): number {
  const updatedAt = Date.now()
  saveProgressToLocal(progress, updatedAt)
  void queueDesktopSave(progress, updatedAt)
  return updatedAt
}

export function saveProgressToLocal(progress: LearningProgress, updatedAt = Date.now()): void {
  localStorage.setItem(scopedStorageKey(STORAGE_KEY), JSON.stringify(progress))
  localStorage.setItem(scopedStorageKey(STORAGE_META_KEY), JSON.stringify({ updatedAt }))
}

export async function loadDesktopProgressSnapshot(): Promise<(ProgressSnapshot & {
  path: string
  source: 'primary' | 'backup'
}) | null> {
  const electronAPI = getElectronApi()
  if (!electronAPI) return null

  const result = await electronAPI.invoke<DesktopLoadResult | null>('progress:load', storageScope)
  if (!result?.payload?.progress) return null

  return {
    progress: normalizeProgress(result.payload.progress),
    updatedAt: result.payload.updatedAt ?? 0,
    path: result.path,
    source: result.source,
  }
}

export function clearProgress(): void {
  localStorage.removeItem(scopedStorageKey(STORAGE_KEY))
  localStorage.removeItem(scopedStorageKey(STORAGE_META_KEY))
  void getElectronApi()?.invoke('progress:clear', storageScope)
}

export function saveProgressBackup(
  progress: LearningProgress,
  reason: ProgressBackup['reason'] = 'manual',
): ProgressBackup {
  const backup: ProgressBackup = {
    progress: normalizeProgress(JSON.parse(JSON.stringify(progress)) as unknown),
    updatedAt: Date.now(),
    reason,
  }
  localStorage.setItem(scopedStorageKey(STORAGE_BACKUP_KEY), JSON.stringify(backup))
  return backup
}

export function loadProgressBackup(): ProgressBackup | null {
  try {
    const raw = localStorage.getItem(scopedStorageKey(STORAGE_BACKUP_KEY))
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed) || !parsed.progress || typeof parsed.updatedAt !== 'number') return null
    return {
      progress: normalizeProgress(parsed.progress),
      updatedAt: parsed.updatedAt,
      reason: parsed.reason === 'before-import' || parsed.reason === 'before-clear' ? parsed.reason : 'manual',
    }
  } catch {
    return null
  }
}

function readLocalUpdatedAt(metaKey = scopedStorageKey(STORAGE_META_KEY)): number {
  try {
    const raw = localStorage.getItem(metaKey)
    if (!raw) return 0
    const meta: unknown = JSON.parse(raw)
    return isRecord(meta) && typeof meta.updatedAt === 'number' ? meta.updatedAt : 0
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
    accountId: storageScope,
  }

  desktopSaveQueue = desktopSaveQueue
    .then(() => electronAPI.invoke('progress:save', payload))
    .then(() => undefined)
    .catch((error) => {
      console.warn('Failed to save desktop progress:', error)
    })

  return desktopSaveQueue
}
