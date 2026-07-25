/**
 * 主题切换：支持显式深/浅，以及跟随系统 prefers-color-scheme。
 * 无本地偏好时默认跟随系统；用户手动切换后写入 localStorage。
 */
import { computed, ref, watch } from 'vue'

const STORAGE_KEY = 'yunzhan-theme'

type ThemePreference = 'dark' | 'light' | 'system'

function getSystemDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return true
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function loadPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark') return stored
    if (stored === 'system') return 'system'
  } catch {
    // Ignore storage failures in restricted browser contexts.
  }
  return 'system'
}

function resolveDark(preferenceValue: ThemePreference): boolean {
  if (preferenceValue === 'system') return getSystemDark()
  return preferenceValue === 'dark'
}

function applyTheme(dark: boolean) {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
  document.documentElement.classList.toggle('dark', dark)
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) {
    meta.setAttribute('content', dark ? '#0a0a14' : '#f8fafc')
  }
}

function persistPreference(preferenceValue: ThemePreference) {
  try {
    if (preferenceValue === 'system') {
      localStorage.removeItem(STORAGE_KEY)
      return
    }
    localStorage.setItem(STORAGE_KEY, preferenceValue)
  } catch {
    // Ignore storage failures in restricted browser contexts.
  }
}

const preference = ref<ThemePreference>(loadPreference())
const isDark = ref<boolean>(resolveDark(preference.value))

function syncResolvedTheme() {
  isDark.value = resolveDark(preference.value)
}

function toggleTheme() {
  // 手动切换写入显式偏好，不再跟随系统，直到清除存储
  preference.value = isDark.value ? 'light' : 'dark'
}

applyTheme(isDark.value)

watch(preference, (value) => {
  syncResolvedTheme()
  persistPreference(value)
})

watch(isDark, (val) => {
  applyTheme(val)
})

if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  const mediaListener = () => {
    if (preference.value === 'system') {
      syncResolvedTheme()
    }
  }
  if (typeof mediaQuery.addEventListener === 'function') {
    mediaQuery.addEventListener('change', mediaListener)
  } else {
    mediaQuery.addListener(mediaListener)
  }
}

const theme = computed<'dark' | 'light'>(() => (isDark.value ? 'dark' : 'light'))
const themePreference = computed(() => preference.value)

export function useTheme() {
  return { isDark, theme, themePreference, toggleTheme }
}
