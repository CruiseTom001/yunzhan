/**
 * @vitest-environment jsdom
 */
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import QuizPage from '@/pages/QuizPage.vue'
import { allQuestions } from '@/data/quizzes/all'

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/quiz', component: QuizPage }],
  })
}

describe('QuizPage option explanations', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('shows an explanation card for every option after answering', async () => {
    const router = createTestRouter()
    await router.push('/quiz')
    await router.isReady()

    const wrapper = mount(QuizPage, {
      global: { plugins: [router] },
    })
    const firstOption = allQuestions[0].options[0]
    const optionButton = wrapper.findAll('button').find((button) => button.text().includes(firstOption.text))
    expect(optionButton).toBeDefined()

    await optionButton!.trigger('click')
    await nextTick()

    const explanationCards = wrapper.findAll('.quiz-option-explanation')
    expect(explanationCards).toHaveLength(allQuestions[0].options.length)
    for (const card of explanationCards) {
      expect(card.text().trim().length).toBeGreaterThan(0)
    }
  })
})
