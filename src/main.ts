import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import './style.css'
import { useProgressStore } from './stores/progress'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(router)

const progressStore = useProgressStore()

router.isReady().then(async () => {
  await progressStore.whenStorageReady()

  const savedRoute = progressStore.progress.lastRoute
  const isDefaultEntry = router.currentRoute.value.fullPath === '/'
  if (isDefaultEntry && savedRoute && savedRoute !== '/') {
    await router.replace(savedRoute)
  }

  router.afterEach((to) => {
    progressStore.updateLastRoute(to.fullPath)
  })
})

app.mount('#app')
