import { describe, expect, it } from 'vitest'
import { chapterCounts } from '@/data/courses/index'
import {
  isBeginnerPathComplete,
  nextIncompleteChapter,
  resolveContinueTarget,
} from './continueLearning'

const baseChapterCounts = chapterCounts

describe('continueLearning', () => {
  it('enters first course chapter when no progress', () => {
    const target = resolveContinueTarget({
      chapterCounts: baseChapterCounts,
      completedChapters: {},
      lastVisited: null,
      lastRoute: null,
    })
    expect(target).toEqual({ courseId: 'computer-basics', chapterIndex: 0 })
  })

  it('continues last visited course when incomplete', () => {
    const target = resolveContinueTarget({
      chapterCounts: baseChapterCounts,
      completedChapters: { 'linux-basics': [0] },
      lastVisited: 'linux-basics',
      lastRoute: '/courses',
    })
    expect(target?.courseId).toBe('linux-basics')
    expect(target?.chapterIndex).toBe(1)
  })

  it('skips completed last visited and picks next incomplete course in path', () => {
    const linuxTotal = baseChapterCounts['linux-basics'] ?? 0
    const computerTotal = baseChapterCounts['computer-basics'] ?? 0
    const completedLinux = Array.from({ length: linuxTotal }, (_, index) => index)
    const completedComputer = Array.from({ length: computerTotal }, (_, index) => index)
    const target = resolveContinueTarget({
      chapterCounts: baseChapterCounts,
      completedChapters: {
        'computer-basics': completedComputer,
        'linux-basics': completedLinux,
      },
      lastVisited: 'linux-basics',
      lastRoute: `/course/linux-basics/chapter/${linuxTotal - 1}`,
    })
    expect(target?.courseId).toBe('networking')
    expect(target?.chapterIndex).toBe(0)
  })

  it('prefers incomplete lastRoute over completed lastVisited', () => {
    const linuxTotal = baseChapterCounts['linux-basics'] ?? 0
    const completedLinux = Array.from({ length: linuxTotal }, (_, index) => index)
    const target = resolveContinueTarget({
      chapterCounts: baseChapterCounts,
      completedChapters: {
        'linux-basics': completedLinux,
        networking: [0],
      },
      lastVisited: 'linux-basics',
      lastRoute: '/course/networking/chapter/1',
    })
    expect(target).toEqual({ courseId: 'networking', chapterIndex: 1 })
  })

  it('returns null when beginner path is fully complete', () => {
    const completedChapters: Record<string, number[]> = {}
    for (const [courseId, total] of Object.entries(baseChapterCounts)) {
      if (total > 0) completedChapters[courseId] = Array.from({ length: total }, (_, index) => index)
    }
    expect(isBeginnerPathComplete(baseChapterCounts, completedChapters)).toBe(true)
    expect(resolveContinueTarget({
      chapterCounts: baseChapterCounts,
      completedChapters,
      lastVisited: 'devops-project',
      lastRoute: '/course/devops-project/chapter/0',
    })).toBeNull()
  })

  it('nextIncompleteChapter returns null when course complete', () => {
    expect(nextIncompleteChapter([0, 1, 2], 3)).toBeNull()
  })
})
