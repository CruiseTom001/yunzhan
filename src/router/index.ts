import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/pages/HomePage.vue'),
    },
    {
      path: '/courses',
      name: 'courses',
      component: () => import('@/pages/CourseListPage.vue'),
    },
    {
      path: '/course/:id',
      name: 'course',
      component: () => import('@/pages/CourseDetailPage.vue'),
    },
    {
      path: '/course/:id/chapter/:chapterIndex',
      name: 'courseChapter',
      component: () => import('@/pages/CourseDetailPage.vue'),
    },
    {
      path: '/quiz',
      name: 'quiz',
      component: () => import('@/pages/QuizPage.vue'),
    },
    {
      path: '/quiz/:categoryId',
      name: 'quizCategory',
      component: () => import('@/pages/QuizPage.vue'),
    },
    {
      path: '/progress',
      name: 'progress',
      component: () => import('@/pages/ProgressPage.vue'),
    },
    {
      path: '/terminal',
      name: 'terminal',
      component: () => import('@/pages/TerminalPage.vue'),
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'notFound',
      component: () => import('@/pages/NotFoundPage.vue'),
    },
  ],
})

export default router
