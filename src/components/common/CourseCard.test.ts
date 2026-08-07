/**
 * @vitest-environment jsdom
 */
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import CourseCard from '@/components/common/CourseCard.vue'
import { courseIndex } from '@/data/courses/index'

const course = courseIndex[0]

describe('CourseCard completion state', () => {
  it('keeps a completed course visibly marked and accessible', () => {
    const wrapper = mount(CourseCard, {
      props: { course, progress: 100, completedCount: 8 },
    })

    expect(wrapper.classes()).toContain('course-card-complete')
    expect(wrapper.attributes('aria-label')).toContain('，已完成')
    expect(wrapper.find('.course-complete-label').text()).toContain('已完成')
  })

  it('does not mark a partially completed course as complete', () => {
    const wrapper = mount(CourseCard, {
      props: { course, progress: 50, completedCount: 4 },
    })

    expect(wrapper.classes()).not.toContain('course-card-complete')
    expect(wrapper.find('.course-complete-label').exists()).toBe(false)
  })
})
