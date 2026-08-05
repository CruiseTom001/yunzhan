import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises } from '@vue/test-utils'

vi.mock('@/utils/announcementApi', () => ({
  getLatestUnread: vi.fn(),
  listAnnouncements: vi.fn(),
  markAllAnnouncementsRead: vi.fn(),
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
  markAllAnnouncementsRead,
  markAnnouncementRead,
} from '@/utils/announcementApi'
import { useAuthStore } from '@/stores/auth'
import { useAnnouncementsStore } from '@/stores/announcements'

const mockedList = vi.mocked(listAnnouncements)
const mockedLatest = vi.mocked(getLatestUnread)
const mockedMarkRead = vi.mocked(markAnnouncementRead)
const mockedMarkAllRead = vi.mocked(markAllAnnouncementsRead)

const LIST_ITEM = {
  id: '1',
  title: '公告一',
  content: '内容一',
  publishedAt: 1700000000000,
  read: false,
  category: 'general' as const,
  version: null,
}

function authenticateTestUser(userId = 'user-1') {
  const authStore = useAuthStore()
  authStore.$patch({
    status: 'authenticated',
    user: {
      id: userId,
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

  it('marks all announcements read and zeroes unread count', async () => {
    mockedMarkAllRead.mockResolvedValue(undefined)

    const store = useAnnouncementsStore()
    store.announcements = [
      { ...LIST_ITEM, id: '1' },
      { ...LIST_ITEM, id: '2', read: true },
    ]
    store.unreadTotal = 1

    const result = await store.markAllRead()
    expect(result).toBe(true)
    expect(store.announcements.every((item) => item.read)).toBe(true)
    expect(store.unreadTotal).toBe(0)
    expect(mockedMarkAllRead).toHaveBeenCalledOnce()
  })

  it('clears latest modal after mark all read', async () => {
    mockedMarkAllRead.mockResolvedValue(undefined)

    const store = useAnnouncementsStore()
    store.latestAnnouncement = { id: '9', title: '最新', content: 'x', publishedAt: 1 }
    store.latestModalVisible = true

    await store.markAllRead()
    expect(store.latestAnnouncement).toBeNull()
    expect(store.latestModalVisible).toBe(false)
  })

  it('keeps unread count when mark all read fails', async () => {
    mockedMarkAllRead.mockRejectedValue(new Error('network'))

    const store = useAnnouncementsStore()
    store.announcements = [{ ...LIST_ITEM, id: '1' }]
    store.unreadTotal = 1

    const result = await store.markAllRead()
    expect(result).toBe(false)
    expect(store.announcements[0].read).toBe(false)
    expect(store.unreadTotal).toBe(1)
    expect(store.markReadError).toBe('标记已读失败，请稍后再试。')
  })

  it('deduplicates concurrent mark all read calls', async () => {
    let resolveFirst: () => void = () => {}
    mockedMarkAllRead.mockImplementation(() => new Promise<void>((resolve) => {
      resolveFirst = resolve
    }))

    const store = useAnnouncementsStore()
    store.announcements = [{ ...LIST_ITEM, id: '1' }]
    store.unreadTotal = 1

    const first = store.markAllRead()
    const second = store.markAllRead()
    expect(store.markAllReadInFlight).toBe(true)
    resolveFirst()
    await Promise.all([first, second])

    expect(mockedMarkAllRead).toHaveBeenCalledOnce()
    expect(store.markAllReadInFlight).toBe(false)
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

  it('deduplicates concurrent mark read calls', async () => {
    let resolveCall: (() => void) | null = null
    mockedMarkRead.mockImplementation(() => new Promise<void>((resolve) => {
      resolveCall = resolve
    }))

    const store = useAnnouncementsStore()
    store.announcements = [LIST_ITEM]
    store.unreadTotal = 1

    const first = store.markRead('1')
    const second = store.markRead('1')
    expect(mockedMarkRead).toHaveBeenCalledTimes(1)

    resolveCall?.()
    await Promise.all([first, second])
    expect(store.unreadTotal).toBe(0)
    expect(store.announcements[0].read).toBe(true)
  })

  it('tracks in-flight state reactively and clears it after success', async () => {
    let resolveCall: (() => void) | null = null
    mockedMarkRead.mockImplementation(() => new Promise<void>((resolve) => {
      resolveCall = resolve
    }))

    const store = useAnnouncementsStore()
    store.announcements = [LIST_ITEM]
    store.unreadTotal = 1

    expect(store.isMarkReadInFlight('1')).toBe(false)
    const pending = store.markRead('1')
    expect(store.isMarkReadInFlight('1')).toBe(true)

    resolveCall?.()
    await pending
    expect(store.isMarkReadInFlight('1')).toBe(false)
  })

  it('clears in-flight state after failure', async () => {
    let rejectCall: ((error: Error) => void) | null = null
    mockedMarkRead.mockImplementation(() => new Promise<void>((_resolve, reject) => {
      rejectCall = reject
    }))

    const store = useAnnouncementsStore()
    store.announcements = [LIST_ITEM]
    store.unreadTotal = 1

    const pending = store.markRead('1')
    expect(store.isMarkReadInFlight('1')).toBe(true)

    rejectCall?.(new Error('failed'))
    await pending
    expect(store.isMarkReadInFlight('1')).toBe(false)
    expect(store.announcements[0].read).toBe(false)
    expect(store.unreadTotal).toBe(1)
  })

  it('clears in-flight set on logout', async () => {
    let resolveCall: (() => void) | null = null
    mockedMarkRead.mockImplementation(() => new Promise<void>((resolve) => {
      resolveCall = resolve
    }))

    const store = useAnnouncementsStore()
    store.announcements = [LIST_ITEM]
    store.unreadTotal = 1

    const pending = store.markRead('1')
    expect(store.isMarkReadInFlight('1')).toBe(true)

    store.resetForLogout()
    expect(store.isMarkReadInFlight('1')).toBe(false)

    resolveCall?.()
    await pending
  })

  it('ignores stale markRead result after logout and account switch', async () => {
    const resolvers: Array<() => void> = []
    mockedMarkRead.mockImplementation(() => new Promise<void>((resolve) => {
      resolvers.push(resolve)
    }))

    const store = useAnnouncementsStore()
    store.announcements = [{ ...LIST_ITEM }]
    store.unreadTotal = 1
    store.latestAnnouncement = {
      id: '1',
      title: '公告一',
      content: '内容一',
      publishedAt: 1700000000000,
    }
    store.latestModalVisible = true

    const accountAPending = store.markRead('1')
    expect(store.isMarkReadInFlight('1')).toBe(true)
    expect(resolvers).toHaveLength(1)

    store.resetForLogout()
    expect(store.isMarkReadInFlight('1')).toBe(false)

    store.announcements = [{ ...LIST_ITEM, title: '账号 B 公告' }]
    store.unreadTotal = 3
    store.latestAnnouncement = {
      id: '1',
      title: '账号 B 公告',
      content: '内容一',
      publishedAt: 1700000000000,
    }
    store.latestModalVisible = true

    const accountBPending = store.markRead('1')
    expect(store.isMarkReadInFlight('1')).toBe(true)
    expect(resolvers).toHaveLength(2)

    resolvers[0]?.()
    const accountAResult = await accountAPending
    expect(accountAResult).toBe(false)
    expect(store.announcements[0].read).toBe(false)
    expect(store.announcements[0].title).toBe('账号 B 公告')
    expect(store.unreadTotal).toBe(3)
    expect(store.latestAnnouncement?.title).toBe('账号 B 公告')
    expect(store.latestModalVisible).toBe(true)
    expect(store.markReadError).toBe('')
    expect(store.isMarkReadInFlight('1')).toBe(true)

    resolvers[1]?.()
    const accountBResult = await accountBPending
    expect(accountBResult).toBe(true)
    expect(store.announcements[0].read).toBe(true)
    expect(store.unreadTotal).toBe(2)
    expect(store.isMarkReadInFlight('1')).toBe(false)
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

  async function settleAuthenticatedStore() {
    mockedList.mockResolvedValue({
      announcements: [],
      total: 0,
      unreadTotal: 0,
    })
    mockedLatest.mockResolvedValue(null)
    authenticateTestUser()
    const store = useAnnouncementsStore()
    await flushPromises()
    vi.clearAllMocks()
    return store
  }

  it('ignores stale loadAnnouncements result after logout and account switch', async () => {
    const store = await settleAuthenticatedStore()

    type ListResult = Awaited<ReturnType<typeof listAnnouncements>>
    const resolvers: Array<(value: ListResult) => void> = []
    mockedList.mockImplementation(() => new Promise<ListResult>((resolve) => {
      resolvers.push(resolve)
    }))

    const accountAPending = store.loadAnnouncements({ reset: true })
    expect(store.loading).toBe(true)
    expect(resolvers).toHaveLength(1)

    store.resetForLogout()
    expect(store.loading).toBe(false)
    expect(store.announcements).toEqual([])

    authenticateTestUser()
    const accountBPending = store.loadAnnouncements({ reset: true })
    expect(store.loading).toBe(true)
    expect(resolvers).toHaveLength(2)

    resolvers[0]?.({
      announcements: [{ ...LIST_ITEM, title: '账号 A 公告' }],
      total: 1,
      unreadTotal: 1,
    })
    await accountAPending

    expect(store.loading).toBe(true)
    expect(store.announcements).toEqual([])
    expect(store.unreadTotal).toBe(0)
    expect(store.errorMessage).toBe('')

    resolvers[1]?.({
      announcements: [{ ...LIST_ITEM, id: 'b1', title: '账号 B 公告' }],
      total: 1,
      unreadTotal: 1,
    })
    await accountBPending

    expect(store.loading).toBe(false)
    expect(store.announcements).toHaveLength(1)
    expect(store.announcements[0].title).toBe('账号 B 公告')
    expect(store.unreadTotal).toBe(1)
  })

  it('ignores stale checkLatestUnread result after logout and account switch', async () => {
    const store = await settleAuthenticatedStore()

    type LatestResult = Awaited<ReturnType<typeof getLatestUnread>>
    const resolvers: Array<(value: LatestResult) => void> = []
    mockedLatest.mockImplementation(() => new Promise<LatestResult>((resolve) => {
      resolvers.push(resolve)
    }))

    const accountAPending = store.checkLatestUnread()
    expect(resolvers).toHaveLength(1)

    store.resetForLogout()
    expect(store.latestAnnouncement).toBeNull()
    expect(store.latestModalVisible).toBe(false)

    authenticateTestUser()
    const accountBPending = store.checkLatestUnread()
    expect(resolvers).toHaveLength(2)

    resolvers[0]?.({
      id: 'a1',
      title: '账号 A 最新',
      content: 'A',
      publishedAt: 1700000000000,
    })
    await accountAPending

    expect(store.latestAnnouncement).toBeNull()
    expect(store.latestModalVisible).toBe(false)

    resolvers[1]?.({
      id: 'b1',
      title: '账号 B 最新',
      content: 'B',
      publishedAt: 1700000000001,
    })
    await accountBPending

    expect(store.latestAnnouncement?.id).toBe('b1')
    expect(store.latestAnnouncement?.title).toBe('账号 B 最新')
    expect(store.latestModalVisible).toBe(true)
  })

  it('ignores stale refreshUnreadCount result after logout and account switch', async () => {
    const store = await settleAuthenticatedStore()

    type ListResult = Awaited<ReturnType<typeof listAnnouncements>>
    const resolvers: Array<(value: ListResult) => void> = []
    mockedList.mockImplementation(() => new Promise<ListResult>((resolve) => {
      resolvers.push(resolve)
    }))

    const accountAPending = store.refreshUnreadCount()
    expect(resolvers).toHaveLength(1)

    store.resetForLogout()
    store.total = 9
    store.unreadTotal = 4

    resolvers[0]?.({
      announcements: [{ ...LIST_ITEM, title: '账号 A' }],
      total: 1,
      unreadTotal: 1,
    })
    await accountAPending

    expect(store.total).toBe(9)
    expect(store.unreadTotal).toBe(4)
  })

  it('ignores stale loadAnnouncements after markAllRead without resetting loading', async () => {
    const store = await settleAuthenticatedStore()

    type ListResult = Awaited<ReturnType<typeof listAnnouncements>>
    let resolveLoad: ((value: ListResult) => void) | null = null
    mockedList.mockImplementation(() => new Promise<ListResult>((resolve) => {
      resolveLoad = resolve
    }))
    mockedMarkAllRead.mockResolvedValue(undefined)

    store.centerVisible = true
    const loadPending = store.loadAnnouncements({ reset: true })
    expect(store.loading).toBe(true)

    store.announcements = [
      { ...LIST_ITEM, id: '1', read: false },
      { ...LIST_ITEM, id: '2', read: false, title: '公告二' },
    ]
    store.total = 2
    store.unreadTotal = 2
    store.latestAnnouncement = {
      id: '1',
      title: '最新',
      content: 'x',
      publishedAt: 1700000000000,
    }
    store.latestModalVisible = true

    const markResult = await store.markAllRead()
    expect(markResult).toBe(true)
    expect(store.unreadTotal).toBe(0)
    expect(store.announcements.every((item) => item.read)).toBe(true)
    expect(store.latestAnnouncement).toBeNull()
    expect(store.latestModalVisible).toBe(false)

    resolveLoad?.({
      announcements: [
        { ...LIST_ITEM, id: '1', read: false },
        { ...LIST_ITEM, id: '2', read: false, title: '公告二' },
      ],
      total: 2,
      unreadTotal: 2,
    })
    await loadPending
    await flushPromises()

    expect(store.loading).toBe(false)
    expect(store.unreadTotal).toBe(0)
    expect(store.announcements.every((item) => item.read)).toBe(true)
    expect(store.latestAnnouncement).toBeNull()
    expect(store.latestModalVisible).toBe(false)
  })

  it('ignores stale loadMore after markAllRead without resetting loadingMore', async () => {
    const store = await settleAuthenticatedStore()

    type ListResult = Awaited<ReturnType<typeof listAnnouncements>>
    let resolveMore: ((value: ListResult) => void) | null = null
    mockedList.mockImplementation(() => new Promise<ListResult>((resolve) => {
      resolveMore = resolve
    }))
    mockedMarkAllRead.mockResolvedValue(undefined)

    store.announcements = [{ ...LIST_ITEM, id: '1', read: false }]
    store.total = 3
    store.unreadTotal = 2
    store.centerVisible = true

    const morePending = store.loadMore()
    expect(store.loadingMore).toBe(true)

    await store.markAllRead()
    expect(store.unreadTotal).toBe(0)
    expect(store.announcements.every((item) => item.read)).toBe(true)

    resolveMore?.({
      announcements: [
        { ...LIST_ITEM, id: '2', read: false, title: '第二页未读' },
      ],
      total: 3,
      unreadTotal: 2,
    })
    await morePending
    await flushPromises()

    expect(store.loadingMore).toBe(false)
    expect(store.unreadTotal).toBe(0)
    expect(store.announcements.every((item) => item.read)).toBe(true)
    expect(store.announcements.some((item) => item.id === '2' && item.read === false)).toBe(false)
  })

  it('ignores stale checkLatestUnread after markAllRead', async () => {
    const store = await settleAuthenticatedStore()

    type LatestResult = Awaited<ReturnType<typeof getLatestUnread>>
    let resolveLatest: ((value: LatestResult) => void) | null = null
    mockedLatest.mockImplementation(() => new Promise<LatestResult>((resolve) => {
      resolveLatest = resolve
    }))
    mockedMarkAllRead.mockResolvedValue(undefined)

    const latestPending = store.checkLatestUnread()
    expect(resolveLatest).not.toBeNull()

    store.announcements = [{ ...LIST_ITEM, id: '9', read: false }]
    store.unreadTotal = 1
    await store.markAllRead()
    expect(store.unreadTotal).toBe(0)
    expect(store.latestAnnouncement).toBeNull()
    expect(store.latestModalVisible).toBe(false)

    resolveLatest?.({
      id: '9',
      title: '旧未读最新',
      content: 'should not resurrect',
      publishedAt: 1700000000000,
    })
    await latestPending
    await flushPromises()

    expect(store.unreadTotal).toBe(0)
    expect(store.latestAnnouncement).toBeNull()
    expect(store.latestModalVisible).toBe(false)
  })

  it('does not clear account B markAllReadInFlight when account A request finishes', async () => {
    const store = await settleAuthenticatedStore()

    const resolvers: Array<() => void> = []
    mockedMarkAllRead.mockImplementation(() => new Promise<void>((resolve) => {
      resolvers.push(resolve)
    }))
    mockedList.mockResolvedValue({
      announcements: [],
      total: 0,
      unreadTotal: 0,
    })
    mockedLatest.mockResolvedValue(null)

    store.announcements = [{ ...LIST_ITEM, id: 'a1', read: false }]
    store.unreadTotal = 1
    const accountAPending = store.markAllRead()
    expect(store.markAllReadInFlight).toBe(true)
    expect(resolvers).toHaveLength(1)

    store.resetForLogout()
    expect(store.markAllReadInFlight).toBe(false)

    authenticateTestUser('user-2')
    await flushPromises()
    store.announcements = [{ ...LIST_ITEM, id: 'b1', read: false }]
    store.unreadTotal = 1

    const accountBPending = store.markAllRead()
    expect(store.markAllReadInFlight).toBe(true)
    expect(resolvers).toHaveLength(2)

    resolvers[0]?.()
    await accountAPending
    expect(store.markAllReadInFlight).toBe(true)

    resolvers[1]?.()
    await accountBPending
    expect(store.markAllReadInFlight).toBe(false)
    expect(store.unreadTotal).toBe(0)
    expect(store.announcements.every((item) => item.read)).toBe(true)
  })

  it('schedules controlled refresh once when stale load leaves empty list', async () => {
    const store = await settleAuthenticatedStore()

    type ListResult = Awaited<ReturnType<typeof listAnnouncements>>
    const resolvers: Array<(value: ListResult) => void> = []
    mockedList.mockImplementation(() => new Promise<ListResult>((resolve) => {
      resolvers.push(resolve)
    }))
    mockedMarkAllRead.mockResolvedValue(undefined)

    const loadPending = store.loadAnnouncements({ reset: true })
    expect(store.loading).toBe(true)
    expect(store.announcements).toHaveLength(0)
    expect(resolvers).toHaveLength(1)

    await store.markAllRead()
    expect(store.unreadTotal).toBe(0)

    resolvers[0]?.({
      announcements: [{ ...LIST_ITEM, id: '1', read: false }],
      total: 1,
      unreadTotal: 1,
    })
    await loadPending
    await flushPromises()

    expect(resolvers).toHaveLength(2)
    expect(store.loading).toBe(true)

    resolvers[1]?.({
      announcements: [{ ...LIST_ITEM, id: '1', read: true }],
      total: 1,
      unreadTotal: 0,
    })
    await flushPromises()

    expect(resolvers).toHaveLength(2)
    expect(store.loading).toBe(false)
    expect(store.announcements).toHaveLength(1)
    expect(store.announcements[0].read).toBe(true)
    expect(store.unreadTotal).toBe(0)
  })

  it('does not trigger controlled refresh for account B after account A stale load', async () => {
    const store = await settleAuthenticatedStore()

    type ListResult = Awaited<ReturnType<typeof listAnnouncements>>
    const resolvers: Array<(value: ListResult) => void> = []
    mockedList.mockImplementation(() => new Promise<ListResult>((resolve) => {
      resolvers.push(resolve)
    }))
    mockedMarkAllRead.mockResolvedValue(undefined)
    mockedLatest.mockResolvedValue(null)

    const accountAPending = store.loadAnnouncements({ reset: true })
    expect(store.announcements).toHaveLength(0)
    expect(resolvers).toHaveLength(1)
    await store.markAllRead()

    store.resetForLogout()
    mockedList.mockResolvedValue({
      announcements: [],
      total: 0,
      unreadTotal: 0,
    })
    mockedLatest.mockResolvedValue(null)
    authenticateTestUser('user-2')
    await flushPromises()
    vi.clearAllMocks()
    mockedList.mockResolvedValue({
      announcements: [],
      total: 0,
      unreadTotal: 0,
    })
    mockedLatest.mockResolvedValue(null)

    resolvers[0]?.({
      announcements: [{ ...LIST_ITEM, id: 'a1', read: false }],
      total: 1,
      unreadTotal: 1,
    })
    await accountAPending
    await flushPromises()

    expect(mockedList).not.toHaveBeenCalled()
    expect(store.announcements).toEqual([])
    expect(store.unreadTotal).toBe(0)
    expect(store.loading).toBe(false)
  })

  it('ignores stale loadMore result after logout and account switch', async () => {
    const store = await settleAuthenticatedStore()

    type ListResult = Awaited<ReturnType<typeof listAnnouncements>>
    const resolvers: Array<(value: ListResult) => void> = []
    mockedList.mockImplementation(() => new Promise<ListResult>((resolve) => {
      resolvers.push(resolve)
    }))

    store.announcements = [{ ...LIST_ITEM, title: '账号 A 第一页' }]
    store.total = 3
    store.unreadTotal = 3

    const accountAPending = store.loadMore()
    expect(store.loadingMore).toBe(true)
    expect(resolvers).toHaveLength(1)

    store.resetForLogout()
    expect(store.loadingMore).toBe(false)
    expect(store.announcements).toEqual([])

    store.announcements = [{ ...LIST_ITEM, id: 'b1', title: '账号 B 第一页' }]
    store.total = 4
    store.unreadTotal = 2
    authenticateTestUser()

    const accountBPending = store.loadMore()
    expect(store.loadingMore).toBe(true)
    expect(resolvers).toHaveLength(2)

    resolvers[0]?.({
      announcements: [{ ...LIST_ITEM, id: 'a2', title: '账号 A 第二页' }],
      total: 3,
      unreadTotal: 3,
    })
    await accountAPending

    expect(store.loadingMore).toBe(true)
    expect(store.announcements.map((item) => item.id)).toEqual(['b1'])
    expect(store.announcements.map((item) => item.title)).toEqual(['账号 B 第一页'])
    expect(store.total).toBe(4)
    expect(store.unreadTotal).toBe(2)
    expect(store.errorMessage).toBe('')

    resolvers[1]?.({
      announcements: [{ ...LIST_ITEM, id: 'b2', title: '账号 B 第二页' }],
      total: 4,
      unreadTotal: 2,
    })
    await accountBPending

    expect(store.loadingMore).toBe(false)
    expect(store.announcements.map((item) => item.id)).toEqual(['b1', 'b2'])
    expect(store.announcements.some((item) => item.id === 'a2')).toBe(false)
    expect(store.total).toBe(4)
    expect(store.unreadTotal).toBe(2)
  })
})
