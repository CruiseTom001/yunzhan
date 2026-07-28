import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import './style.css'
import { useProgressStore } from './stores/progress'
import { useAuthStore } from './stores/auth'
import { useOnboardingStore } from './stores/onboarding'
import { buildUnauthenticatedGuardRedirect } from './utils/authRedirect'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)

async function bootstrap() {
  const authStore = useAuthStore()
  const progressStore = useProgressStore()
  const onboardingStore = useOnboardingStore()
  const authReady = authStore.initialize()

  router.beforeEach(async (to) => {
    await authReady
    if (to.meta.public) {
      // 已登录用户访问落地页：跳回首页
      if (authStore.isAuthenticated && to.name === 'landing') {
        return { name: 'home' }
      }
      return true
    }
    if (!authStore.isAuthenticated) {
      // 未登录用户只能访问落地页；访问学习页时引导登录
      return buildUnauthenticatedGuardRedirect(to.fullPath)
    }
    if (to.meta.requiresSuperAdmin && !authStore.isSuperAdmin) {
      return { name: 'home' }
    }
    return true
  })

  app.use(router)
  await authReady
  if (authStore.user) {
    await progressStore.bindAccount(authStore.user.id, authStore.user.displayName)
    await onboardingStore.initialize()
  } else {
    await progressStore.unbindAccount()
    onboardingStore.resetForLogout()
  }

  await router.isReady()
  const savedRoute = progressStore.progress.lastRoute
  const isDefaultEntry = router.currentRoute.value.fullPath === '/'
  if (
    authStore.user
    && !onboardingStore.shouldDeferLastRouteRestore
    && isDefaultEntry
    && savedRoute
    && savedRoute !== '/'
    && !savedRoute.startsWith('/login')
  ) {
    await router.replace(savedRoute)
  }

  router.afterEach((to) => {
    if (authStore.isAuthenticated && to.name !== 'landing') {
      progressStore.updateLastRoute(to.fullPath)
    }
  })
  app.mount('#app')
}

void bootstrap()
