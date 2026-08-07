import type { QuizOption, QuizQuestion } from '@/types'

function getCorrectOptionLabels(question: QuizQuestion): string {
  return question.options
    .filter((option) => option.isCorrect)
    .map((option) => option.id.toUpperCase())
    .join('、')
}

/**
 * 为缺少选项级内容的历史题目生成可读的确定性解析。
 * 题目级 explanation 仍是知识事实来源，选项解析不会引入新的事实。
 */
export function buildOptionExplanation(question: QuizQuestion, option: QuizOption): string {
  const customExplanation = option.explanation?.trim()
  if (customExplanation) return customExplanation

  const knowledgeBasis = question.explanation.trim()
  if (option.isCorrect) {
    return `「${option.text}」是正确答案。${knowledgeBasis}`
  }

  return `「${option.text}」不是本题正确答案；正确答案为 ${getCorrectOptionLabels(question)}。${knowledgeBasis}`
}

export function withOptionExplanations(question: QuizQuestion): QuizQuestion {
  return {
    ...question,
    options: question.options.map((option) => ({
      ...option,
      explanation: buildOptionExplanation(question, option),
    })),
  }
}
