import { describe, expect, it } from 'vitest'
import {
  CURRENT_TOUR_VERSION,
  getOnboardingStepIndex,
  getOnboardingStepsForMode,
  isOnboardingBlockingAnnouncements,
  matchesOnboardingRoute,
  onboardingSteps,
  resolveFirstBeginnerPathLab,
  resolveOnboardingStepRoute,
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

  it('matches course detail routes exactly for chapter steps', () => {
    const chapterStep = onboardingSteps.find(step => step.id === 'course-chapters')
    expect(chapterStep).toBeTruthy()
    expect(matchesOnboardingRoute(chapterStep!.route, '/course/computer-basics/chapter/0')).toBe(true)
    expect(matchesOnboardingRoute(chapterStep!.route, '/course/computer-basics/chapter/1')).toBe(false)
    expect(matchesOnboardingRoute('/courses', '/course/computer-basics/chapter/0')).toBe(false)
  })

  it('routes lab and full-mode complete steps to the first beginner-path lab chapter', () => {
    const labTarget = resolveFirstBeginnerPathLab()
    const labStep = onboardingSteps.find(step => step.id === 'course-lab')
    const completeStep = onboardingSteps.find(step => step.id === 'course-complete')

    expect(labTarget).toEqual({ courseId: 'computer-basics', chapterIndex: 1 })
    expect(labStep?.route).toBe(`/course/${labTarget.courseId}/chapter/${labTarget.chapterIndex}`)
    expect(labStep?.autoNavigate).toBe(true)
    expect(labStep?.navigationMessage).toBe('正在打开带实验的章节…')
    expect(labStep?.skipIfAnchorMissing).toBeUndefined()
    expect(resolveOnboardingStepRoute(completeStep!, 'full'))
      .toBe(`/course/${labTarget.courseId}/chapter/${labTarget.chapterIndex}`)
    expect(resolveOnboardingStepRoute(completeStep!, 'quick'))
      .toBe('/course/computer-basics/chapter/0')
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
