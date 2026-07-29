import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'

const STORAGE_KEY = 'yunzhan-preferences'

interface PreferencesState {
  reduceMotion: boolean | null
}

function readStoredPreferences(): PreferencesState {
  if (typeof window === 'undefined') return { reduceMotion: null }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { reduceMotion: null }
    const parsed = JSON.parse(raw) as PreferencesState
    return {
      reduceMotion: typeof parsed.reduceMotion === 'boolean' ? parsed.reduceMotion : null,
    }
  } catch {
    return { reduceMotion: null }
  }
}

function persistPreferences(state: PreferencesState) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // 存储失败不影响使用
  }
}

function systemReduceMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export const usePreferencesStore = defineStore('preferences', () => {
  const stored = readStoredPreferences()
  const reduceMotionOverride = ref<boolean | null>(stored.reduceMotion)
  const systemPrefersReduceMotion = ref(systemReduceMotion())

  const reduceMotion = computed(() => reduceMotionOverride.value ?? systemPrefersReduceMotion.value)

  function setReduceMotion(value: boolean | null) {
    reduceMotionOverride.value = value
    persistPreferences({ reduceMotion: value })
  }

  if (typeof window !== 'undefined' && window.matchMedia) {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => {
      systemPrefersReduceMotion.value = media.matches
    }
    if (media.addEventListener) {
      media.addEventListener('change', update)
    } else {
      media.addListener(update)
    }
    watch(() => reduceMotionOverride.value, () => {
      persistPreferences({ reduceMotion: reduceMotionOverride.value })
    })
  }

  return {
    reduceMotion,
    reduceMotionOverride,
    systemPrefersReduceMotion,
    setReduceMotion,
  }
})
