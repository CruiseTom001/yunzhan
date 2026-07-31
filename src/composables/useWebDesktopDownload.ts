import { computed, ref } from 'vue'
import { isDesktopRuntime } from '@/utils/desktopAuthPreferences'
import {
  DESKTOP_DOWNLOAD_UNAVAILABLE_MESSAGE,
  openWebDesktopDownloadUrl,
  resolveLandingDesktopDownloadUrl,
  shouldShowWebDesktopDownloadEntry,
  type OpenDesktopDownloadResult,
} from '@/utils/desktopDownloadUrl'
import { getDesktopLatestVersion } from '@/utils/desktopVersionApi'

/**
 * Web-only desktop installer download.
 * Does not touch auth, cookies, learning progress, or AI preferences.
 */
export function useWebDesktopDownload() {
  const downloadUrl = ref<string | null>(null)
  const errorMessage = ref('')
  const loading = ref(false)

  const showEntry = computed(() => shouldShowWebDesktopDownloadEntry(isDesktopRuntime()))

  async function loadDownloadUrl(): Promise<string | null> {
    if (!showEntry.value) {
      downloadUrl.value = null
      return null
    }

    loading.value = true
    try {
      const latest = await getDesktopLatestVersion()
      downloadUrl.value = resolveLandingDesktopDownloadUrl(latest.downloadUrl)
      return downloadUrl.value
    } catch {
      downloadUrl.value = null
      return null
    } finally {
      loading.value = false
    }
  }

  async function downloadDesktop(): Promise<OpenDesktopDownloadResult> {
    errorMessage.value = ''

    if (!showEntry.value) {
      errorMessage.value = DESKTOP_DOWNLOAD_UNAVAILABLE_MESSAGE
      return { ok: false, errorMessage: errorMessage.value }
    }

    if (!downloadUrl.value) {
      await loadDownloadUrl()
    }

    if (!downloadUrl.value) {
      errorMessage.value = DESKTOP_DOWNLOAD_UNAVAILABLE_MESSAGE
      return { ok: false, errorMessage: errorMessage.value }
    }

    const result = openWebDesktopDownloadUrl(downloadUrl.value)
    if (result.ok === false) {
      errorMessage.value = result.errorMessage
    }
    return result
  }

  function clearError(): void {
    errorMessage.value = ''
  }

  return {
    downloadUrl,
    errorMessage,
    loading,
    showEntry,
    loadDownloadUrl,
    downloadDesktop,
    clearError,
  }
}
