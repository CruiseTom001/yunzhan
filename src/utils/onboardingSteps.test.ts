import { describe, expect, it } from 'vitest'
import {
  CURRENT_TOUR_VERSION,
  getOnboardingStepIndex,
  getOnboardingStepsForMode,
  isOnboardingBlockingAnnouncements,
  matchesOnboardingRoute,
  onboardingSteps,
  shouldAutoStartOnboarding,
} from '@/utils/onboardingSteps'

describe('onboardingSteps', () => {
  it('defines quick and full guided tutorial flows', () => {
    expect(onboardingSteps.length).toBe(19)
    expect(onboardingSteps[0]?.id).toBe('welcome')
    expect(onboardingSteps.at(-1)?.id).toBe('finish')

    const quickSteps = getOnboardingStepsForMode('quick')
    const fullSteps = getOnboardingStepsForMode('full')

    expect(quickSteps).toHaveLength(12)
    expect(fullSteps).toHaveLength(19)
    expect(quickSteps.every(step => step.audience === 'quick')).toBe(true)
    expect(fullSteps.some(step => step.audience === 'detail')).toBe(true)
  })

  it('resolves unknown step ids to the first step', () => {
    expect(getOnboardingStepIndex('missing-step', 'quick')).toBe(0)
    expect(getOnboardingStepIndex('terminal-console', 'full')).toBeGreaterThan(0)
  })

  it('matches course detail routes for chapter steps', () => {
    const chapterStep = onboardingSteps.find(step => step.id === 'course-chapters')
    expect(chapterStep).toBeTruthy()
    expect(matchesOnboardingRoute(chapterStep!.route, '/course/computer-basics/chapter/1')).toBe(true)
    expect(matchesOnboardingRoute('/courses', '/course/computer-basics/chapter/0')).toBe(false)
  })

  it('keeps lab step informational when anchor is missing', () => {
    const labStep = onboardingSteps.find(step => step.id === 'course-lab')
    expect(labStep?.skipIfAnchorMissing).toBe(true)
    expect(labStep?.fallbackAnchorId).toBeUndefined()
    expect(labStep?.missingDescription).toContain('交互式实验')
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
