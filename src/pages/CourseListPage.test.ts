/**
 * @vitest-environment jsdom
 */
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CourseListPage from '@/pages/CourseListPage.vue'
import { chapterCounts } from '@/data/courses/index'
import { useProgressStore } from '@/stores/progress'

vi.stubGlobal('IntersectionObserver', class {
  observe() {}
  unobserve() {}
  disconnect() {}
})

vi.stubGlobal('matchMedia', () => ({
  matches: false,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
}))

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/courses', component: CourseListPage }],
  })
}

describe('CourseListPage completion highlighting', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('highlights the same completed course in the recommended route and library', async () => {
    const progressStore = useProgressStore()
    const totalChapters = chapterCounts['computer-basics']
    progressStore.progress.completedChapters['computer-basics'] = Array.from(
      { length: totalChapters },
      (_, index) => index,
    )
    const router = createTestRouter()
    await router.push('/courses')
    await router.isReady()

    const wrapper = mount(CourseListPage, {
      global: { plugins: [router] },
    })
    await nextTick()

    const recommended = wrapper.find('.learning-order-course.is-complete')
    const library = wrapper.find('.course-card-complete')
    expect(recommended.exists()).toBe(true)
    expect(recommended.text()).toContain('已完成')
    expect(library.exists()).toBe(true)
    expect(library.attributes('aria-label')).toContain('，已完成')
  })

  it('does not highlight a course when only some chapters are complete', async () => {
    const progressStore = useProgressStore()
    progressStore.progress.completedChapters['computer-basics'] = [0]
    const router = createTestRouter()
    await router.push('/courses')
    await router.isReady()

    const wrapper = mount(CourseListPage, {
      global: { plugins: [router] },
    })
    await nextTick()

    expect(wrapper.find('.learning-order-course.is-complete').exists()).toBe(false)
    expect(wrapper.find('.course-card-complete').exists()).toBe(false)
  })
})
