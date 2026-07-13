import type { LearningProgress } from '@/types'
import { ApiError, apiRequest } from '@/utils/apiClient'
import { isValidProgressPayload, normalizeProgress } from '@/utils/storage'

export interface CloudProgressSnapshot {
  hasProgress: boolean
  progress: LearningProgress | null
  version: number
  updatedAt: number
}

export interface CloudSaveResult {
  version: number
  updatedAt: number
}

export class CloudProgressConflictError extends Error {
  readonly snapshot: CloudProgressSnapshot

  constructor(snapshot: CloudProgressSnapshot) {
    super('云端进度已被其他设备更新。')
    this.name = 'CloudProgressConflictError'
    this.snapshot = snapshot
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

function isTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function readSnapshot(value: unknown): CloudProgressSnapshot | null {
  if (!isRecord(value)) return null
  if (
    typeof value.hasProgress !== 'boolean'
    || !isNonNegativeInteger(value.version)
    || !isTimestamp(value.updatedAt)
  ) return null
  if (value.progress !== null && !isValidProgressPayload(value.progress)) return null
  return {
    hasProgress: value.hasProgress,
    progress: value.progress === null ? null : normalizeProgress(value.progress),
    version: value.version,
    updatedAt: value.updatedAt,
  }
}

function readSaveResult(value: unknown): CloudSaveResult | null {
  if (!isRecord(value) || !isNonNegativeInteger(value.version) || !isTimestamp(value.updatedAt)) return null
  return { version: value.version, updatedAt: value.updatedAt }
}

export async function loadCloudProgress() {
  const snapshot = readSnapshot(await apiRequest('/progress'))
  if (!snapshot) throw new Error('账号服务返回了无效进度数据。')
  return snapshot
}

export async function saveCloudProgress(progress: LearningProgress, expectedVersion: number) {
  try {
    const result = readSaveResult(await apiRequest('/progress', {
      method: 'PUT',
      body: JSON.stringify({ progress, expectedVersion }),
    }))
    if (!result) throw new Error('账号服务返回了无效保存结果。')
    return result
  } catch (error: unknown) {
    if (error instanceof ApiError && error.status === 409) {
      const snapshot = readSnapshot({
        ...(isRecord(error.payload) ? error.payload : {}),
        hasProgress: true,
      })
      if (snapshot) throw new CloudProgressConflictError(snapshot)
    }
    throw error
  }
}

function mergeUniqueStrings(left: string[], right: string[]) {
  return Array.from(new Set([...left, ...right]))
}

function mergeByKey<T>(left: T[], right: T[], getKey: (item: T) => string, getTimestamp: (item: T) => number) {
  const merged = new Map<string, T>()
  for (const item of [...right, ...left]) {
    const key = getKey(item)
    const existing = merged.get(key)
    if (!existing || getTimestamp(item) >= getTimestamp(existing)) {
      merged.set(key, item)
    }
  }
  return Array.from(merged.values())
}

export function mergeLearningProgress(localValue: LearningProgress, remoteValue: LearningProgress) {
  const local = normalizeProgress(localValue)
  const remote = normalizeProgress(remoteValue)
  const completedChapters: LearningProgress['completedChapters'] = { ...remote.completedChapters }
  for (const [courseId, chapters] of Object.entries(local.completedChapters)) {
    completedChapters[courseId] = Array.from(new Set([...(completedChapters[courseId] ?? []), ...chapters])).sort((a, b) => a - b)
  }

  const quizRecords = { ...remote.quizRecords }
  for (const [questionId, record] of Object.entries(local.quizRecords)) {
    const existing = quizRecords[questionId]
    if (!existing || record.answeredAt >= existing.answeredAt) {
      quizRecords[questionId] = { ...record, attempts: Math.max(record.attempts, existing?.attempts ?? 0) }
    }
  }

  const labRecords = { ...remote.labRecords }
  for (const [labId, record] of Object.entries(local.labRecords)) {
    const existing = labRecords[labId]
    const recordTime = record.lastCheckedAt ?? record.completedAt ?? record.startedAt ?? 0
    const existingTime = existing?.lastCheckedAt ?? existing?.completedAt ?? existing?.startedAt ?? 0
    if (!existing || recordTime >= existingTime) labRecords[labId] = record
  }

  const reviewCards = { ...remote.reviewCards }
  for (const [cardId, card] of Object.entries(local.reviewCards)) {
    if (!reviewCards[cardId] || card.updatedAt >= reviewCards[cardId].updatedAt) reviewCards[cardId] = card
  }

  return normalizeProgress({
    ...remote,
    completedChapters,
    quizRecords,
    achievements: mergeUniqueStrings(local.achievements, remote.achievements),
    lastVisited: local.lastVisited || remote.lastVisited,
    lastRoute: local.lastRoute || remote.lastRoute,
    totalTimeSpent: Math.max(local.totalTimeSpent, remote.totalTimeSpent),
    bookmarks: mergeByKey(
      local.bookmarks,
      remote.bookmarks,
      bookmark => `${bookmark.courseId}:${bookmark.chapterIndex}`,
      bookmark => bookmark.createdAt,
    ),
    studyDays: mergeUniqueStrings(local.studyDays, remote.studyDays).sort(),
    commandHistory: mergeByKey(
      local.commandHistory,
      remote.commandHistory,
      item => `${item.createdAt}:${item.source}:${item.command}`,
      item => item.createdAt,
    ).sort((a, b) => b.createdAt - a.createdAt).slice(0, 200),
    labRecords,
    reviewCards,
    syncSnapshots: mergeByKey(local.syncSnapshots, remote.syncSnapshots, item => item.id, item => item.createdAt).slice(0, 10),
    communityDrafts: mergeByKey(local.communityDrafts, remote.communityDrafts, item => item.id, item => item.createdAt),
    userProfile: local.userProfile.createdAt <= remote.userProfile.createdAt ? local.userProfile : remote.userProfile,
  })
}
