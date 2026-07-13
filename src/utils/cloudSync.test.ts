import { describe, expect, it } from 'vitest'
import { mergeLearningProgress } from './cloudSync'
import { normalizeProgress } from './storage'

describe('cloud progress merge', () => {
  it('preserves completions from both devices and keeps the newest quiz answer', () => {
    const local = normalizeProgress({
      completedChapters: { git: [0, 1] },
      quizRecords: {
        'git-q1': { answeredAt: 200, isCorrect: true, attempts: 2 },
      },
      studyDays: ['2026-07-13'],
      totalTimeSpent: 200,
    })
    const remote = normalizeProgress({
      completedChapters: { git: [1, 2], docker: [0] },
      quizRecords: {
        'git-q1': { answeredAt: 100, isCorrect: false, attempts: 3 },
      },
      studyDays: ['2026-07-12'],
      totalTimeSpent: 150,
    })

    const merged = mergeLearningProgress(local, remote)

    expect(merged.completedChapters.git).toEqual([0, 1, 2])
    expect(merged.completedChapters.docker).toEqual([0])
    expect(merged.quizRecords['git-q1']).toEqual({ answeredAt: 200, isCorrect: true, attempts: 3 })
    expect(merged.studyDays).toEqual(['2026-07-12', '2026-07-13'])
    expect(merged.totalTimeSpent).toBe(200)
  })

  it('deduplicates command history from concurrent devices', () => {
    const sharedCommand = {
      command: 'git status',
      output: 'clean',
      exitCode: 0,
      source: 'terminal' as const,
      createdAt: 300,
    }
    const local = normalizeProgress({ commandHistory: [sharedCommand] })
    const remote = normalizeProgress({ commandHistory: [sharedCommand] })

    expect(mergeLearningProgress(local, remote).commandHistory).toHaveLength(1)
  })
})
