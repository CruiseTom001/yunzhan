// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import AnnouncementCenterDialog from './AnnouncementCenterDialog.vue'
import { useAnnouncementsStore } from '@/stores/announcements'

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

vi.mock('@/stores/desktopUpdate', () => ({
  useDesktopUpdateStore: () => ({
    shouldRenderDialog: false,
  }),
}))

vi.mock('@/utils/authDialogFocus', () => ({
  lockBodyScroll: vi.fn(),
  trapFocus: vi.fn(),
  unlockBodyScroll: vi.fn(),
}))

import { markAnnouncementRead } from '@/utils/announcementApi'

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

function mountDialog() {
  const store = useAnnouncementsStore()
  store.announcements = [{ ...LIST_ITEM }]
  store.total = 1
  store.unreadTotal = 1
  store.selectedAnnouncementId = '1'
  store.centerVisible = true

  const wrapper = mount(AnnouncementCenterDialog, {
    global: {
      stubs: { Teleport: true },
    },
  })
  return { store, wrapper }
}

describe('AnnouncementCenterDialog mark read button', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  it('disables button and shows pending text while request is in flight', async () => {
    let resolveCall: (() => void) | null = null
    mockedMarkRead.mockImplementation(() => new Promise<void>((resolve) => {
      resolveCall = resolve
    }))

    const { store, wrapper } = mountDialog()
    const button = wrapper.find('.primary-button')
    expect(button.exists()).toBe(true)
    expect(button.text()).toContain('标记已读')
    expect(button.attributes('disabled')).toBeUndefined()

    await button.trigger('click')
    await nextTick()

    const pendingButton = wrapper.find('.primary-button')
    expect(mockedMarkRead).toHaveBeenCalledTimes(1)
    expect(pendingButton.attributes('disabled')).toBeDefined()
    expect(pendingButton.text()).toContain('处理中…')

    resolveCall?.()
    await flushPromises()
    await nextTick()

    expect(store.selectedAnnouncement?.read).toBe(true)
    expect(wrapper.find('.primary-button').exists()).toBe(false)

    wrapper.unmount()
  })

  it('restores button state after request failure', async () => {
    let rejectCall: ((error: Error) => void) | null = null
    mockedMarkRead.mockImplementation(() => new Promise<void>((_resolve, reject) => {
      rejectCall = reject
    }))

    const { store, wrapper } = mountDialog()
    const button = wrapper.find('.primary-button')

    await button.trigger('click')
    await nextTick()
    expect(wrapper.find('.primary-button').attributes('disabled')).toBeDefined()

    rejectCall?.(new Error('network'))
    await flushPromises()
    await nextTick()

    const restoredButton = wrapper.find('.primary-button')
    expect(restoredButton.exists()).toBe(true)
    expect(restoredButton.attributes('disabled')).toBeUndefined()
    expect(restoredButton.text()).toContain('标记已读')
    expect(store.markReadError).toContain('标记已读失败')

    wrapper.unmount()
  })

  it('calls API only once for repeated clicks during flight', async () => {
    let resolveCall: (() => void) | null = null
    mockedMarkRead.mockImplementation(() => new Promise<void>((resolve) => {
      resolveCall = resolve
    }))

    const { wrapper } = mountDialog()
    const button = wrapper.find('.primary-button')

    await button.trigger('click')
    await nextTick()

    const pendingButton = wrapper.find('.primary-button')
    await pendingButton.trigger('click')
    await pendingButton.trigger('click')
    await nextTick()

    expect(mockedMarkRead).toHaveBeenCalledTimes(1)

    resolveCall?.()
    await flushPromises()

    wrapper.unmount()
  })
})
