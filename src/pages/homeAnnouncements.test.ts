import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'

const isRunning = ref(false)
const blocksAnnouncements = ref(false)

vi.mock('@/stores/onboarding', () => ({
  useOnboardingStore: () => ({
    get isRunning() { return isRunning.value },
    get blocksAnnouncements() { return blocksAnnouncements.value },
  }),
}))

vi.mock('@/utils/announcementApi', () => ({
  getLatestUnread: vi.fn(),
  listAnnouncements: vi.fn(),
  markAnnouncementRead: vi.fn(),
}))

vi.mock('@/stores/desktopUpdate', () => ({
  useDesktopUpdateStore: () => ({
    shouldRenderDialog: false,
  }),
}))

import { listAnnouncements } from '@/utils/announcementApi'
import { useAnnouncementsStore } from '@/stores/announcements'
import { ANNOUNCEMENT_ONBOARDING_BLOCK_MESSAGE } from '@/utils/announcementDisplay'

const mockedList = vi.mocked(listAnnouncements)

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  isRunning.value = false
  blocksAnnouncements.value = false
})

describe('announcements store onboarding guard', () => {
  it('blocks opening center during onboarding', async () => {
    isRunning.value = true
    const store = useAnnouncementsStore()
    const opened = await store.openCenter()
    expect(opened).toBe(false)
    expect(store.centerVisible).toBe(false)
    expect(store.centerBlockedMessage).toBe(ANNOUNCEMENT_ONBOARDING_BLOCK_MESSAGE)
    expect(mockedList).not.toHaveBeenCalled()
  })
})

describe('home announcement button visibility', () => {
  it('shows unread badge text from store', () => {
    const store = useAnnouncementsStore()
    store.unreadTotal = 3
    expect(store.unreadBadgeText).toBe('3')
    expect(store.hasUnread).toBe(true)
  })

  it('hides badge when no unread announcements', () => {
    const store = useAnnouncementsStore()
    store.unreadTotal = 0
    expect(store.hasUnread).toBe(false)
    expect(store.unreadBadgeText).toBe('')
  })
})

describe('announcement overlay exclusivity', () => {
  it('hides latest modal when center opens', async () => {
    mockedList.mockResolvedValue({ announcements: [], total: 0, unreadTotal: 0 })
    const store = useAnnouncementsStore()
    store.latestAnnouncement = {
      id: '1',
      title: '最新',
      content: '内容',
      publishedAt: 1,
    }
    store.latestModalVisible = true
    await store.openCenter()
    expect(store.centerVisible).toBe(true)
    expect(store.latestModalVisible).toBe(false)
  })
})
