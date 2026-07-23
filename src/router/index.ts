import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/pages/LoginPage.vue'),
      meta: { public: true, hideChrome: true },
    },
    {
      path: '/landing',
      name: 'landing',
      component: () => import('@/pages/LandingPage.vue'),
      meta: { public: true, hideChrome: true },
    },
    {
      path: '/',
      name: 'home',
      component: () => import('@/pages/HomePage.vue'),
      meta: { public: true },
    },
    {
      path: '/courses',
      name: 'courses',
      component: () => import('@/pages/CourseListPage.vue'),
      meta: { public: true },
    },
    {
      path: '/course/:id',
      name: 'course',
      component: () => import('@/pages/CourseDetailPage.vue'),
      meta: { public: true },
    },
    {
      path: '/course/:id/chapter/:chapterIndex',
      name: 'courseChapter',
      component: () => import('@/pages/CourseDetailPage.vue'),
      meta: { public: true },
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
      path: '/review',
      name: 'review',
      component: () => import('@/pages/ReviewPage.vue'),
    },
    {
      path: '/study-notes',
      name: 'studyNotes',
      component: () => import('@/pages/DailyStudyNotesPage.vue'),
    },
    {
      path: '/terminal',
      name: 'terminal',
      component: () => import('@/pages/TerminalPage.vue'),
    },
    {
      path: '/admin/users',
      name: 'adminUsers',
      component: () => import('@/pages/AdminUsersPage.vue'),
      meta: { requiresSuperAdmin: true },
    },
    {
      path: '/account',
      name: 'account',
      component: () => import('@/pages/AccountPage.vue'),
    },
    {
      path: '/admin/audit',
      name: 'adminAudit',
      component: () => import('@/pages/AdminAuditPage.vue'),
      meta: { requiresSuperAdmin: true },
    },
    {
      path: '/admin/feedback',
      name: 'adminFeedback',
      component: () => import('@/pages/AdminFeedbackPage.vue'),
      meta: { requiresSuperAdmin: true },
    },
    {
      path: '/admin/announcements',
      name: 'adminAnnouncements',
      component: () => import('@/pages/AdminAnnouncementsPage.vue'),
      meta: { requiresSuperAdmin: true },
    },
    {
      path: '/admin/desktop-releases',
      name: 'adminDesktopReleases',
      component: () => import('@/pages/AdminDesktopReleasesPage.vue'),
      meta: { requiresSuperAdmin: true },
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'notFound',
      component: () => import('@/pages/NotFoundPage.vue'),
    },
  ],
})

export default router
