import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import './style.css'
import { useProgressStore } from './stores/progress'
import { useAuthStore } from './stores/auth'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)

async function bootstrap() {
  const authStore = useAuthStore()
  const progressStore = useProgressStore()
  const authReady = authStore.initialize()

  router.beforeEach(async (to) => {
    await authReady
    if (to.meta.public) {
      return authStore.isAuthenticated && to.name === 'login' ? { name: 'home' } : true
    }
    if (!authStore.isAuthenticated) {
      return { name: 'login', query: { redirect: to.fullPath } }
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
  } else {
    await progressStore.unbindAccount()
  }

  await router.isReady()
  const savedRoute = progressStore.progress.lastRoute
  const isDefaultEntry = router.currentRoute.value.fullPath === '/'
  if (authStore.user && isDefaultEntry && savedRoute && savedRoute !== '/' && savedRoute !== '/login') {
    await router.replace(savedRoute)
  }

  router.afterEach((to) => {
    if (authStore.isAuthenticated && to.name !== 'login') {
      progressStore.updateLastRoute(to.fullPath)
    }
  })
  app.mount('#app')
}

void bootstrap()
