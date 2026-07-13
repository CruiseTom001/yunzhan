import { describe, expect, it } from 'vitest'
import {
  parsePagination,
  validateEmail,
  validatePassword,
  validateProgressPayload,
  validateUsername,
  validateUuid,
  validateVerificationCode,
} from './validation.mjs'

function createValidProgress() {
  return {
    completedChapters: { git: [0, 1] },
    quizRecords: {
      'git-q1': { answeredAt: 1_700_000_000_000, isCorrect: true, attempts: 1 },
    },
    achievements: ['first-step'],
    lastVisited: 'git',
    lastRoute: '/course/git/chapter/1',
    totalTimeSpent: 3600,
    bookmarks: [{ courseId: 'git', chapterIndex: 1, createdAt: 1_700_000_000_000 }],
    studyDays: ['2026-07-13'],
    commandHistory: [{
      command: 'git status',
      output: 'On branch main',
      exitCode: 0,
      source: 'terminal',
      createdAt: 1_700_000_000_000,
    }],
    labRecords: {
      'git-lab': {
        labId: 'git-lab',
        status: 'passed',
        checkResults: { status: true },
        completedAt: 1_700_000_000_000,
      },
    },
    reviewCards: {},
    syncSnapshots: [],
    communityDrafts: [],
    userProfile: {
      id: '123e4567-e89b-42d3-a456-426614174000',
      name: '测试用户',
      targetRole: 'DevOps 工程师',
      level: 1,
      createdAt: 1_700_000_000_000,
    },
  }
}

describe('account input validation', () => {
  it('normalizes valid usernames and rejects unsafe credentials', () => {
    expect(validateUsername('  User.Name  ')).toBe('user.name')
    expect(validateUsername('../admin')).toBeNull()
    expect(validatePassword('short1')).toBeNull()
    expect(validatePassword('strong-password-2026')).toBe('strong-password-2026')
  })

  it('accepts strict UUID values only', () => {
    expect(validateUuid('123e4567-e89b-42d3-a456-426614174000')).toBeTruthy()
    expect(validateUuid('------------------------------------')).toBeNull()
  })

  it('normalizes email addresses and validates six-digit codes', () => {
    expect(validateEmail('  Learner@Example.COM ')).toBe('learner@example.com')
    expect(validateEmail('invalid@localhost')).toBeNull()
    expect(validateVerificationCode('012345')).toBe('012345')
    expect(validateVerificationCode('12345')).toBeNull()
  })

  it('bounds pagination values', () => {
    expect(parsePagination({ limit: '999', offset: '-3' })).toEqual({ limit: 100, offset: 0 })
  })
})

describe('cloud progress validation', () => {
  it('accepts a complete valid progress document', () => {
    expect(validateProgressPayload(createValidProgress())).toBe(true)
  })

  it('rejects unknown fields and malformed nested values', () => {
    expect(validateProgressPayload({ ...createValidProgress(), injected: true })).toBe(false)
    expect(validateProgressPayload({
      ...createValidProgress(),
      commandHistory: [{
        command: 'rm',
        output: '',
        exitCode: 0,
        source: 'forged',
        createdAt: 1,
      }],
    })).toBe(false)
  })

  it('rejects oversized history arrays', () => {
    const progress = createValidProgress()
    progress.commandHistory = Array.from({ length: 201 }, (_, index) => ({
      command: `echo ${index}`,
      output: String(index),
      exitCode: 0,
      source: 'terminal',
      createdAt: index,
    }))
    expect(validateProgressPayload(progress)).toBe(false)
  })
})
