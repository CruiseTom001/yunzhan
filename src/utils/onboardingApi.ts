import { apiRequest } from '@/utils/apiClient'
import type { OnboardingStatus } from '@/utils/onboardingSteps'
import { CURRENT_TOUR_VERSION } from '@/utils/onboardingSteps'

export interface OnboardingState {
  status: OnboardingStatus
  version: number
  stepId: string | null
  updatedAt: number | null
  tourVersion: number
}

export interface OnboardingPatchInput {
  status?: OnboardingStatus
  stepId?: string | null
  version?: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isStatus(value: unknown): value is OnboardingStatus {
  return value === 'pending' || value === 'skipped' || value === 'completed'
}

function readOnboardingState(value: unknown): OnboardingState | null {
  if (!isRecord(value)) return null
  if (!isStatus(value.status)) return null
  if (typeof value.version !== 'number' || !Number.isInteger(value.version) || value.version < 0) return null
  if (value.stepId !== null && value.stepId !== undefined && typeof value.stepId !== 'string') return null
  if (value.updatedAt !== null && (typeof value.updatedAt !== 'number' || !Number.isFinite(value.updatedAt))) return null
  if (typeof value.tourVersion !== 'number' || !Number.isInteger(value.tourVersion)) return null
  const stepId = typeof value.stepId === 'string' ? value.stepId : null
  const updatedAt = typeof value.updatedAt === 'number' ? value.updatedAt : null
  return {
    status: value.status,
    version: value.version,
    stepId,
    updatedAt,
    tourVersion: value.tourVersion,
  }
}

export async function fetchOnboardingState(): Promise<OnboardingState> {
  const payload = await apiRequest('/me/onboarding')
  const state = readOnboardingState(payload)
  if (!state) throw new Error('引导状态数据无效。')
  return state
}

export async function updateOnboardingState(input: OnboardingPatchInput): Promise<OnboardingState> {
  const payload = await apiRequest('/me/onboarding', {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
  const state = readOnboardingState(payload)
  if (!state) throw new Error('引导状态更新返回无效。')
  return state
}

export function createTerminalOnboardingState(status: OnboardingStatus, stepId: string | null = null): OnboardingState {
  return {
    status,
    version: status === 'pending' ? 0 : CURRENT_TOUR_VERSION,
    stepId,
    updatedAt: Date.now(),
    tourVersion: CURRENT_TOUR_VERSION,
  }
}
