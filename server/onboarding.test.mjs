import { describe, expect, it } from 'vitest'
import { CURRENT_TOUR_VERSION, toOnboardingResponse } from './onboarding.mjs'

describe('onboarding helpers', () => {
  it('serializes onboarding fields for API responses', () => {
    const updatedAt = new Date('2026-07-28T08:00:00.000Z')
    expect(toOnboardingResponse({
      onboarding_status: 'pending',
      onboarding_version: 0,
      onboarding_step: 'welcome',
      onboarding_updated_at: updatedAt,
    })).toEqual({
      status: 'pending',
      version: 0,
      stepId: 'welcome',
      updatedAt: updatedAt.getTime(),
      tourVersion: CURRENT_TOUR_VERSION,
    })
  })
})
