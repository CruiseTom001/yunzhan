import { describe, expect, it } from 'vitest'
import {
  CURRENT_TOUR_VERSION,
  getOnboardingStepIndex,
  isOnboardingBlockingAnnouncements,
  onboardingSteps,
  shouldAutoStartOnboarding,
} from '@/utils/onboardingSteps'

describe('onboardingSteps', () => {
  it('defines nine guided steps', () => {
    expect(onboardingSteps).toHaveLength(9)
    expect(onboardingSteps[0]?.id).toBe('welcome')
    expect(onboardingSteps.at(-1)?.id).toBe('finish')
  })

  it('resolves unknown step ids to the first step', () => {
    expect(getOnboardingStepIndex('missing-step')).toBe(0)
    expect(getOnboardingStepIndex('terminal')).toBe(3)
  })

  it('auto-starts only for pending new users on normal routes', () => {
    expect(shouldAutoStartOnboarding({
      status: 'pending',
      version: 0,
      isAuthenticated: true,
      routeName: 'home',
    })).toBe(true)

    expect(shouldAutoStartOnboarding({
      status: 'completed',
      version: CURRENT_TOUR_VERSION,
      isAuthenticated: true,
      routeName: 'home',
    })).toBe(false)

    expect(shouldAutoStartOnboarding({
      status: 'pending',
      version: 0,
      isAuthenticated: true,
      routeName: 'adminFeedback',
    })).toBe(false)
  })

  it('blocks announcements while pending or running', () => {
    expect(isOnboardingBlockingAnnouncements({
      isRunning: false,
      status: 'pending',
      version: 0,
    })).toBe(true)

    expect(isOnboardingBlockingAnnouncements({
      isRunning: true,
      status: 'completed',
      version: CURRENT_TOUR_VERSION,
    })).toBe(true)

    expect(isOnboardingBlockingAnnouncements({
      isRunning: false,
      status: 'skipped',
      version: CURRENT_TOUR_VERSION,
    })).toBe(false)
  })
})
