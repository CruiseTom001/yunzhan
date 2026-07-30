import { computed, reactive, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { useDesktopUpdateStore } from '@/stores/desktopUpdate'
import { useOnboardingStore } from '@/stores/onboarding'
import {
  getLatestUnread,
  listAnnouncements,
  markAnnouncementRead,
  type Announcement,
  type AnnouncementListItem,
} from '@/utils/announcementApi'
import {
  ANNOUNCEMENT_DESKTOP_UPDATE_BLOCK_MESSAGE,
  ANNOUNCEMENT_LOAD_ERROR_MESSAGE,
  ANNOUNCEMENT_ONBOARDING_BLOCK_MESSAGE,
  ANNOUNCEMENT_PAGE_SIZE,
} from '@/utils/announcementDisplay'

function mergeAnnouncements(
  current: AnnouncementListItem[],
  incoming: AnnouncementListItem[],
): AnnouncementListItem[] {
  const map = new Map<string, AnnouncementListItem>()
  current.forEach((item) => map.set(item.id, item))
  incoming.forEach((item) => map.set(item.id, item))
  return Array.from(map.values()).sort((a, b) => {
    if (b.publishedAt !== a.publishedAt) return b.publishedAt - a.publishedAt
    return Number(b.id) - Number(a.id)
  })
}

export const useAnnouncementsStore = defineStore('announcements', () => {
  const authStore = useAuthStore()
  const onboardingStore = useOnboardingStore()
  const desktopUpdateStore = useDesktopUpdateStore()

  const announcements = ref<AnnouncementListItem[]>([])
  const total = ref(0)
  const unreadTotal = ref(0)
  const selectedAnnouncementId = ref<string | null>(null)
  const loading = ref(false)
  const loadingMore = ref(false)
  const errorMessage = ref('')
  const markReadError = ref('')
  const centerVisible = ref(false)
  const latestAnnouncement = ref<Announcement | null>(null)
  const latestModalVisible = ref(false)
  const suppressedLatestId = ref<string | null>(null)
  const initialized = ref(false)
  const centerBlockedMessage = ref('')
  const markReadInFlight = reactive(new Map<string, number>())

  let loadPromise: Promise<void> | null = null
  let loadMorePromise: Promise<void> | null = null
  let latestCheckPromise: Promise<void> | null = null
  let activeUserId: string | null = null
  let stateEpoch = 0
  let nextMarkReadOperationId = 1

  const selectedAnnouncement = computed(() => (
    announcements.value.find((item) => item.id === selectedAnnouncementId.value) ?? null
  ))

  const hasUnread = computed(() => unreadTotal.value > 0)

  const unreadBadgeText = computed(() => {
    if (!hasUnread.value) return ''
    if (unreadTotal.value > 99) return '99+'
    return String(unreadTotal.value)
  })

  const overlayBlocked = computed(() => (
    onboardingStore.blocksAnnouncements
    || desktopUpdateStore.shouldRenderDialog
  ))

  const shouldShowLatestModal = computed(() => (
    latestModalVisible.value
    && latestAnnouncement.value !== null
    && !centerVisible.value
    && !overlayBlocked.value
  ))

  function clearState() {
    announcements.value = []
    total.value = 0
    unreadTotal.value = 0
    selectedAnnouncementId.value = null
    loading.value = false
    loadingMore.value = false
    errorMessage.value = ''
    markReadError.value = ''
    centerVisible.value = false
    latestAnnouncement.value = null
    latestModalVisible.value = false
    suppressedLatestId.value = null
    centerBlockedMessage.value = ''
    loadPromise = null
    loadMorePromise = null
    latestCheckPromise = null
    markReadInFlight.clear()
    stateEpoch += 1
  }

  function resetForLogout() {
    initialized.value = false
    activeUserId = null
    clearState()
  }

  function isCurrentEpoch(requestEpoch: number): boolean {
    return requestEpoch === stateEpoch
  }

  async function refreshUnreadCount() {
    if (!authStore.isAuthenticated) return
    const requestEpoch = stateEpoch
    try {
      const result = await listAnnouncements({ limit: 1, offset: 0 })
      if (!isCurrentEpoch(requestEpoch)) return
      unreadTotal.value = result.unreadTotal
      total.value = result.total
    } catch {
      // 静默：未读数刷新失败不影响主流程
    }
  }

  async function loadAnnouncements(options: { reset?: boolean } = {}) {
    if (!authStore.isAuthenticated) return
    if (loadPromise) return loadPromise

    const reset = options.reset !== false
    if (reset) {
      loading.value = true
      errorMessage.value = ''
    }

    const requestEpoch = stateEpoch
    const requestPromise = (async () => {
      try {
        const result = await listAnnouncements({ limit: ANNOUNCEMENT_PAGE_SIZE, offset: 0 })
        if (!isCurrentEpoch(requestEpoch)) return
        announcements.value = result.announcements
        total.value = result.total
        unreadTotal.value = result.unreadTotal
        if (!selectedAnnouncementId.value && result.announcements.length > 0) {
          selectedAnnouncementId.value = result.announcements[0].id
        } else if (
          selectedAnnouncementId.value
          && !result.announcements.some((item) => item.id === selectedAnnouncementId.value)
        ) {
          selectedAnnouncementId.value = result.announcements[0]?.id ?? null
        }
      } catch {
        if (!isCurrentEpoch(requestEpoch)) return
        errorMessage.value = ANNOUNCEMENT_LOAD_ERROR_MESSAGE
      } finally {
        if (isCurrentEpoch(requestEpoch)) {
          loading.value = false
        }
        if (loadPromise === requestPromise) {
          loadPromise = null
        }
      }
    })()

    loadPromise = requestPromise
    return loadPromise
  }

  async function loadMore() {
    if (!authStore.isAuthenticated || loadingMore.value || loadMorePromise) return
    if (announcements.value.length >= total.value) return

    loadingMore.value = true
    errorMessage.value = ''

    const requestEpoch = stateEpoch
    const requestPromise = (async () => {
      try {
        const result = await listAnnouncements({
          limit: ANNOUNCEMENT_PAGE_SIZE,
          offset: announcements.value.length,
        })
        if (!isCurrentEpoch(requestEpoch)) return
        announcements.value = mergeAnnouncements(announcements.value, result.announcements)
        total.value = result.total
        unreadTotal.value = result.unreadTotal
      } catch {
        if (!isCurrentEpoch(requestEpoch)) return
        errorMessage.value = ANNOUNCEMENT_LOAD_ERROR_MESSAGE
      } finally {
        if (isCurrentEpoch(requestEpoch)) {
          loadingMore.value = false
        }
        if (loadMorePromise === requestPromise) {
          loadMorePromise = null
        }
      }
    })()

    loadMorePromise = requestPromise
    return loadMorePromise
  }

  async function checkLatestUnread() {
    if (!authStore.isAuthenticated || centerVisible.value || overlayBlocked.value) return
    if (latestCheckPromise) return latestCheckPromise

    const requestEpoch = stateEpoch
    const requestPromise = (async () => {
      try {
        const latest = await getLatestUnread()
        if (!isCurrentEpoch(requestEpoch)) return
        if (!latest || latest.id === suppressedLatestId.value) {
          latestAnnouncement.value = null
          latestModalVisible.value = false
          return
        }
        latestAnnouncement.value = latest
        latestModalVisible.value = true
      } catch {
        if (!isCurrentEpoch(requestEpoch)) return
        latestAnnouncement.value = null
        latestModalVisible.value = false
      } finally {
        if (latestCheckPromise === requestPromise) {
          latestCheckPromise = null
        }
      }
    })()

    latestCheckPromise = requestPromise
    return latestCheckPromise
  }

  function selectAnnouncement(id: string) {
    selectedAnnouncementId.value = id
    markReadError.value = ''
  }

  async function markRead(id: string) {
    if (markReadInFlight.has(id)) return false
    markReadError.value = ''
    const requestEpoch = stateEpoch
    const operationId = nextMarkReadOperationId
    nextMarkReadOperationId += 1
    markReadInFlight.set(id, operationId)
    const target = announcements.value.find((item) => item.id === id)
    const wasUnread = target?.read === false
    try {
      await markAnnouncementRead(id)
      if (!isCurrentEpoch(requestEpoch)) return false
      announcements.value = announcements.value.map((item) => (
        item.id === id ? { ...item, read: true } : item
      ))
      if (wasUnread) {
        unreadTotal.value = Math.max(0, unreadTotal.value - 1)
      }
      if (latestAnnouncement.value?.id === id) {
        latestAnnouncement.value = null
        latestModalVisible.value = false
      }
      return true
    } catch {
      if (!isCurrentEpoch(requestEpoch)) return false
      markReadError.value = '标记已读失败，请稍后再试。'
      return false
    } finally {
      if (markReadInFlight.get(id) === operationId) {
        markReadInFlight.delete(id)
      }
    }
  }

  function isMarkReadInFlight(id: string): boolean {
    return markReadInFlight.has(id)
  }

  function closeLatestModal() {
    if (latestAnnouncement.value) {
      suppressedLatestId.value = latestAnnouncement.value.id
    }
    latestModalVisible.value = false
  }

  async function dismissLatest() {
    if (!latestAnnouncement.value) return
    const target = latestAnnouncement.value
    latestModalVisible.value = false
    suppressedLatestId.value = target.id
    await markRead(target.id)
  }

  function closeCenter() {
    centerVisible.value = false
    centerBlockedMessage.value = ''
  }

  async function openCenter() {
    centerBlockedMessage.value = ''
    if (onboardingStore.isRunning || onboardingStore.blocksAnnouncements) {
      centerBlockedMessage.value = ANNOUNCEMENT_ONBOARDING_BLOCK_MESSAGE
      return false
    }
    if (desktopUpdateStore.shouldRenderDialog) {
      centerBlockedMessage.value = ANNOUNCEMENT_DESKTOP_UPDATE_BLOCK_MESSAGE
      return false
    }
    if (latestModalVisible.value) {
      closeLatestModal()
    }
    centerVisible.value = true
    if (announcements.value.length === 0 && !loading.value) {
      await loadAnnouncements({ reset: true })
    }
    return true
  }

  function initialize() {
    if (!authStore.isAuthenticated || !authStore.user) return
    const userId = authStore.user.id
    if (initialized.value && activeUserId === userId) return

    if (activeUserId && activeUserId !== userId) {
      resetForLogout()
    }

    activeUserId = userId
    initialized.value = true
    void refreshUnreadCount()
    void checkLatestUnread()
  }

  watch(
    () => authStore.user?.id ?? null,
    (userId, previousUserId) => {
      if (!userId) {
        resetForLogout()
        return
      }
      if (previousUserId && previousUserId !== userId) {
        resetForLogout()
      }
      initialize()
    },
    { immediate: true },
  )

  watch(overlayBlocked, (blocked) => {
    if (blocked) {
      latestModalVisible.value = false
      return
    }
    if (initialized.value && !centerVisible.value) {
      void checkLatestUnread()
    }
  })

  watch(centerVisible, (visible) => {
    if (visible) {
      latestModalVisible.value = false
    }
  })

  return {
    announcements,
    total,
    unreadTotal,
    selectedAnnouncementId,
    selectedAnnouncement,
    loading,
    loadingMore,
    errorMessage,
    markReadError,
    centerVisible,
    latestAnnouncement,
    latestModalVisible,
    shouldShowLatestModal,
    initialized,
    hasUnread,
    unreadBadgeText,
    centerBlockedMessage,
    initialize,
    loadAnnouncements,
    loadMore,
    openCenter,
    closeCenter,
    selectAnnouncement,
    markRead,
    isMarkReadInFlight,
    refreshUnreadCount,
    resetForLogout,
    checkLatestUnread,
    closeLatestModal,
    dismissLatest,
  }
})
