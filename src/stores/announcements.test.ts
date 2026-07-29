import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('@/utils/announcementApi', () => ({
  getLatestUnread: vi.fn(),
  listAnnouncements: vi.fn(),
  markAnnouncementRead: vi.fn(),
}))

vi.mock('@/stores/onboarding', () => ({
  useOnboardingStore: () => ({
    blocksAnnouncements: false,
    isRunning: false,
  }),
}))

const desktopUpdateDialogVisible = { value: false }

vi.mock('@/stores/desktopUpdate', () => ({
  useDesktopUpdateStore: () => ({
    get shouldRenderDialog() {
      return desktopUpdateDialogVisible.value
    },
  }),
}))

import {
  getLatestUnread,
  listAnnouncements,
  markAnnouncementRead,
} from '@/utils/announcementApi'
import { useAuthStore } from '@/stores/auth'
import { useAnnouncementsStore } from '@/stores/announcements'

const mockedList = vi.mocked(listAnnouncements)
const mockedLatest = vi.mocked(getLatestUnread)
const mockedMarkRead = vi.mocked(markAnnouncementRead)

const LIST_ITEM = {
  id: '1',
  title: '公告一',
  content: '内容一',
  publishedAt: 1700000000000,
  read: false,
  category: 'general' as const,
  version: null,
}

function authenticateTestUser() {
  const authStore = useAuthStore()
  authStore.$patch({
    status: 'authenticated',
    user: {
      id: 'user-1',
      username: 'test',
      displayName: 'Test',
      email: 'test@example.com',
      emailVerifiedAt: null,
      role: 'user',
      status: 'active',
    },
  })
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  desktopUpdateDialogVisible.value = false
})

describe('announcements store', () => {
  it('loads announcements on first open', async () => {
    mockedList.mockResolvedValue({
      announcements: [LIST_ITEM],
      total: 1,
      unreadTotal: 1,
    })

    authenticateTestUser()

    const store = useAnnouncementsStore()
    await store.openCenter()
    expect(store.centerVisible).toBe(true)
    expect(store.announcements).toHaveLength(1)
    expect(store.unreadTotal).toBe(1)
  })

  it('decrements unread count after mark read', async () => {
    mockedList.mockResolvedValue({
      announcements: [LIST_ITEM],
      total: 1,
      unreadTotal: 1,
    })
    mockedMarkRead.mockResolvedValue(undefined)

    const store = useAnnouncementsStore()
    store.announcements = [LIST_ITEM]
    store.unreadTotal = 1
    store.selectedAnnouncementId = '1'

    await store.markRead('1')
    expect(store.announcements[0].read).toBe(true)
    expect(store.unreadTotal).toBe(0)
  })

  it('does not decrement unread count when marking an already read announcement', async () => {
    mockedMarkRead.mockResolvedValue(undefined)

    const store = useAnnouncementsStore()
    store.announcements = [{ ...LIST_ITEM, read: true }]
    store.unreadTotal = 0

    await store.markRead('1')
    expect(store.unreadTotal).toBe(0)
  })

  it('does not decrement unread count when mark read API fails', async () => {
    mockedMarkRead.mockRejectedValue(new Error('failed'))

    const store = useAnnouncementsStore()
    store.announcements = [LIST_ITEM]
    store.unreadTotal = 2

    await store.markRead('1')
    expect(store.unreadTotal).toBe(2)
  })

  it('blocks opening center while desktop update dialog is visible', async () => {
    desktopUpdateDialogVisible.value = true
    authenticateTestUser()

    const store = useAnnouncementsStore()
    const opened = await store.openCenter()
    expect(opened).toBe(false)
    expect(store.centerVisible).toBe(false)
    expect(store.centerBlockedMessage).toContain('桌面端更新')
  })

  it('keeps detail visible when mark read fails', async () => {
    mockedMarkRead.mockRejectedValue(new Error('failed'))

    const store = useAnnouncementsStore()
    store.announcements = [LIST_ITEM]
    store.selectedAnnouncementId = '1'

    await store.markRead('1')
    expect(store.markReadError).toContain('标记已读失败')
    expect(store.selectedAnnouncement?.id).toBe('1')
  })

  it('deduplicates load more results by id', async () => {
    authenticateTestUser()
    mockedList
      .mockResolvedValueOnce({
        announcements: [LIST_ITEM],
        total: 2,
        unreadTotal: 2,
      })
      .mockResolvedValueOnce({
        announcements: [{ ...LIST_ITEM, id: '2', title: '公告二' }],
        total: 2,
        unreadTotal: 2,
      })

    const store = useAnnouncementsStore()
    store.announcements = [LIST_ITEM]
    store.total = 2

    await store.loadMore()
    expect(store.announcements.map((item) => item.id)).toEqual(['2', '1'])
  })

  it('clears state on logout', () => {
    const store = useAnnouncementsStore()
    store.announcements = [LIST_ITEM]
    store.unreadTotal = 1
    store.resetForLogout()
    expect(store.announcements).toEqual([])
    expect(store.unreadTotal).toBe(0)
    expect(store.initialized).toBe(false)
  })

  it('suppresses latest modal after close without marking read', async () => {
    authenticateTestUser()
    mockedLatest.mockResolvedValue({
      id: '9',
      title: '最新',
      content: '内容',
      publishedAt: 1700000000000,
    })

    const store = useAnnouncementsStore()
    await store.checkLatestUnread()
    expect(store.latestModalVisible).toBe(true)
    store.closeLatestModal()
    expect(store.shouldShowLatestModal).toBe(false)

    await store.checkLatestUnread()
    expect(store.shouldShowLatestModal).toBe(false)
  })
})
