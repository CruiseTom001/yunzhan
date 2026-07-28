import { describe, expect, it } from 'vitest'
import {
  CURRENT_TOUR_VERSION,
  getOnboardingStepIndex,
  isOnboardingBlockingAnnouncements,
  matchesOnboardingRoute,
  onboardingSteps,
  shouldAutoStartOnboarding,
} from '@/utils/onboardingSteps'

describe('onboardingSteps', () => {
  it('defines the guided tutorial flow with main and page-detail steps', () => {
    expect(onboardingSteps.length).toBeGreaterThanOrEqual(18)
    expect(onboardingSteps[0]?.id).toBe('welcome')
    expect(onboardingSteps.at(-1)?.id).toBe('finish')
    expect(onboardingSteps.some(step => step.scope === 'main')).toBe(true)
    expect(onboardingSteps.some(step => step.scope === 'page-detail')).toBe(true)
  })

  it('resolves unknown step ids to the first step', () => {
    expect(getOnboardingStepIndex('missing-step')).toBe(0)
    expect(getOnboardingStepIndex('terminal-console')).toBeGreaterThan(0)
  })

  it('matches course detail routes for chapter steps', () => {
    const chapterStep = onboardingSteps.find(step => step.id === 'course-chapters')
    expect(chapterStep).toBeTruthy()
    expect(matchesOnboardingRoute(chapterStep!.route, '/course/computer-basics/chapter/1')).toBe(true)
    expect(matchesOnboardingRoute('/courses', '/course/computer-basics/chapter/0')).toBe(false)
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
