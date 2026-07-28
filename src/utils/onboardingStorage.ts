import type { OnboardingStatus } from '@/utils/onboardingSteps'

export interface OnboardingCacheRecord {
  status: OnboardingStatus
  version: number
  stepId: string | null
  updatedAt: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isStatus(value: unknown): value is OnboardingStatus {
  return value === 'pending' || value === 'skipped' || value === 'completed'
}

function readCacheRecord(value: unknown): OnboardingCacheRecord | null {
  if (!isRecord(value)) return null
  if (!isStatus(value.status)) return null
  if (typeof value.version !== 'number' || !Number.isInteger(value.version) || value.version < 0) return null
  if (value.stepId !== null && value.stepId !== undefined && typeof value.stepId !== 'string') return null
  if (typeof value.updatedAt !== 'number' || !Number.isFinite(value.updatedAt)) return null
  const stepId = typeof value.stepId === 'string' ? value.stepId : null
  return {
    status: value.status,
    version: value.version,
    stepId,
    updatedAt: value.updatedAt,
  }
}

function buildStorageKey(userId: string) {
  return `yunzhan:onboarding:${userId}`
}

export function readOnboardingCache(userId: string): OnboardingCacheRecord | null {
  try {
    const raw = localStorage.getItem(buildStorageKey(userId))
    if (!raw) return null
    return readCacheRecord(JSON.parse(raw) as unknown)
  } catch {
    return null
  }
}

export function writeOnboardingCache(userId: string, record: OnboardingCacheRecord) {
  localStorage.setItem(buildStorageKey(userId), JSON.stringify(record))
}

export function clearOnboardingCache(userId: string) {
  localStorage.removeItem(buildStorageKey(userId))
}
