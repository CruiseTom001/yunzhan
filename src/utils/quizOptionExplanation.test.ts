import { describe, expect, it } from 'vitest'
import type { QuizQuestion } from '@/types'
import { allQuestions } from '@/data/quizzes/all'
import { buildOptionExplanation, withOptionExplanations } from './quizOptionExplanation'

describe('quiz option explanations', () => {
  it('provides an explanation for every option in every question bank', () => {
    expect(allQuestions.length).toBeGreaterThan(0)
    for (const question of allQuestions) {
      expect(question.options.length, question.id).toBeGreaterThan(0)
      for (const option of question.options) {
        expect(option.explanation?.trim(), `${question.id}/${option.id}`).toBeTruthy()
      }
    }
  })

  it('keeps custom option explanations and generates deterministic fallbacks', () => {
    const question: QuizQuestion = {
      id: 'test-question',
      categoryId: 'test',
      type: 'single',
      question: '测试题',
      options: [
        { id: 'a', text: '正确', isCorrect: true, explanation: '自定义正确解析。' },
        { id: 'b', text: '错误', isCorrect: false },
      ],
      explanation: '题目知识依据。',
      difficulty: 'beginner',
    }

    expect(buildOptionExplanation(question, question.options[0])).toBe('自定义正确解析。')
    expect(buildOptionExplanation(question, question.options[1])).toContain('「错误」不是本题正确答案；正确答案为 A')
    expect(withOptionExplanations(question).options).toEqual([
      { id: 'a', text: '正确', isCorrect: true, explanation: '自定义正确解析。' },
      { id: 'b', text: '错误', isCorrect: false, explanation: '「错误」不是本题正确答案；正确答案为 A。题目知识依据。' },
    ])
  })
})
