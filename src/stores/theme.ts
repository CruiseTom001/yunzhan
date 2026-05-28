/**
 * 主题切换：状态持久化到 localStorage。
 */
import { computed, ref, watch } from 'vue'

const STORAGE_KEY = 'yunzhan-theme'

const isDark = ref<boolean>(loadTheme())

function loadTheme(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light') return false
    if (stored === 'dark') return true
  } catch {
    // Ignore storage failures in restricted browser contexts.
  }
  return true
}

function applyTheme(dark: boolean) {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
}

function persistTheme(dark: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, dark ? 'dark' : 'light')
  } catch {
    // Ignore storage failures in restricted browser contexts.
  }
}

function toggleTheme() {
  isDark.value = !isDark.value
}

applyTheme(isDark.value)

watch(isDark, (val) => {
  applyTheme(val)
  persistTheme(val)
})

const theme = computed<'dark' | 'light'>(() => isDark.value ? 'dark' : 'light')

export function useTheme() {
  return { isDark, theme, toggleTheme }
}
