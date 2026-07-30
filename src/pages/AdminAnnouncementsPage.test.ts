// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import AdminAnnouncementsPage from './AdminAnnouncementsPage.vue'
import { ApiError } from '@/utils/apiClient'

vi.mock('@/utils/announcementApi', () => ({
  listAdminAnnouncements: vi.fn(),
  createAdminAnnouncement: vi.fn(),
  updateAdminAnnouncement: vi.fn(),
  deleteAdminAnnouncement: vi.fn(),
  repolishAdminAnnouncement: vi.fn(),
  regenerateAdminAnnouncementFromChangelog: vi.fn(),
  generateAdminAnnouncementFromChangelog: vi.fn(),
}))

import {
  generateAdminAnnouncementFromChangelog,
  listAdminAnnouncements,
} from '@/utils/announcementApi'

const mockedList = vi.mocked(listAdminAnnouncements)
const mockedGenerate = vi.mocked(generateAdminAnnouncementFromChangelog)

const DRAFT = {
  id: '9',
  title: '云栈桌面端 v1.2.6 更新',
  content: '云栈桌面端 v1.2.6 已发布。\n\n本次更新：\n新增：\n- 公告中心',
  publishedAt: 1700000000000,
  active: false,
  createdAt: 1700000000000,
  updatedAt: 1700000000000,
  category: 'desktop_release' as const,
  version: '1.2.6',
  sourceKey: 'desktop_release:1.2.6',
  sourceCommit: '0f3cdbe73add73b47ce0b251fdcc08e6f48a0a0d',
  generatedByAi: false,
  generationProvider: null,
  generationError: null,
}

function findButton(wrapper: VueWrapper, text: string) {
  const button = wrapper.findAll('button').find(item => item.text().includes(text))
  expect(button, `missing button: ${text}`).toBeTruthy()
  return button!
}

function mountPage() {
  return mount(AdminAnnouncementsPage, {
    global: {
      stubs: {
        Teleport: true,
        PageState: true,
      },
    },
  })
}

async function openGenerateDialog(wrapper: VueWrapper) {
  await findButton(wrapper, '补建更新草稿').trigger('click')
  await nextTick()
}

async function fillAndSubmitGenerate(
  wrapper: VueWrapper,
  {
    version,
    sourceCommit = '',
  }: {
    version: string
    sourceCommit?: string
  },
) {
  const versionInput = wrapper.find('input[placeholder="例如 1.2.6"]')
  await versionInput.setValue(version)
  if (sourceCommit) {
    await wrapper.find('input[placeholder="7-40 位 Git SHA"]').setValue(sourceCommit)
  }
  await nextTick()
  const generateForm = wrapper.findAll('form').find(item => item.html().includes('例如 1.2.6'))
  expect(generateForm).toBeTruthy()
  await generateForm!.trigger('submit.prevent')
  await flushPromises()
}

describe('AdminAnnouncementsPage generate-from-changelog dialog', () => {
  let wrapper: VueWrapper | null = null

  beforeEach(() => {
    vi.clearAllMocks()
    mockedList.mockResolvedValue({
      announcements: [],
      total: 0,
    })
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
  })

  it('submits the correct request body and refreshes the list on success', async () => {
    mockedGenerate.mockResolvedValueOnce({
      announcement: DRAFT,
      created: true,
      repaired: false,
      skipped: false,
    })
    wrapper = mountPage()
    await flushPromises()
    await openGenerateDialog(wrapper)
    mockedList.mockClear()
    await fillAndSubmitGenerate(wrapper, {
      version: '1.2.6',
      sourceCommit: '0f3cdbe73add73b47ce0b251fdcc08e6f48a0a0d',
    })

    expect(mockedGenerate).toHaveBeenCalledTimes(1)
    expect(mockedGenerate).toHaveBeenCalledWith({
      category: 'desktop_release',
      version: '1.2.6',
      sourceCommit: '0f3cdbe73add73b47ce0b251fdcc08e6f48a0a0d',
    })
    expect(mockedList).toHaveBeenCalled()
    expect(wrapper.text()).toMatch(/草稿已创建/)
    expect(wrapper.find('#generate-announcement-title').exists()).toBe(false)
  })

  it('closes dialog and shows page status when draft already exists', async () => {
    mockedGenerate.mockResolvedValueOnce({
      announcement: DRAFT,
      created: false,
      repaired: false,
      skipped: false,
    })
    wrapper = mountPage()
    await flushPromises()
    await openGenerateDialog(wrapper)
    expect(wrapper.find('#generate-announcement-title').exists()).toBe(true)
    mockedList.mockClear()
    await fillAndSubmitGenerate(wrapper, { version: '1.2.6' })

    expect(mockedGenerate).toHaveBeenCalledTimes(1)
    expect(mockedList).toHaveBeenCalled()
    expect(wrapper.find('#generate-announcement-title').exists()).toBe(false)
    expect(wrapper.find('.modal-backdrop').exists()).toBe(false)

    const status = wrapper.find('[role="status"]')
    expect(status.exists()).toBe(true)
    expect(status.text()).toMatch(/未重复创建/)
    expect(status.text()).toMatch(/未修改正文/)
    expect(status.text()).toMatch(/从更新日志重新生成/)
  })

  it('shows 409 conflict message and prevents double submit while pending', async () => {
    let rejectGenerate!: (error: unknown) => void
    mockedGenerate.mockImplementationOnce(() => new Promise((_, reject) => {
      rejectGenerate = reject
    }))
    wrapper = mountPage()
    await flushPromises()
    await openGenerateDialog(wrapper)
    const versionInput = wrapper.find('input[placeholder="例如 1.2.6"]')
    await versionInput.setValue('1.2.6')
    await nextTick()
    const generateForm = wrapper.findAll('form').find(item => item.html().includes('例如 1.2.6'))
    await generateForm!.trigger('submit.prevent')
    await nextTick()
    expect(wrapper.text()).toMatch(/处理中/)
    const pendingButton = findButton(wrapper, '处理中')
    expect(pendingButton.attributes('disabled')).toBeDefined()
    await generateForm!.trigger('submit.prevent')
    expect(mockedGenerate).toHaveBeenCalledTimes(1)

    rejectGenerate(new ApiError('该版本公告已经发布，不能补建覆盖。', 409, {
      error: '该版本公告已经发布，不能补建覆盖。',
    }))
    await flushPromises()
    expect(wrapper.text()).toMatch(/已经发布，不能补建覆盖/)
  })

  it('shows server 422 messages for missing changelog content', async () => {
    mockedGenerate.mockRejectedValueOnce(new ApiError('CHANGELOG 中未找到版本 9.9.9。', 422, {
      error: 'CHANGELOG 中未找到版本 9.9.9。',
    }))
    wrapper = mountPage()
    await flushPromises()
    await openGenerateDialog(wrapper)
    await fillAndSubmitGenerate(wrapper, { version: '9.9.9' })
    expect(wrapper.text()).toMatch(/未找到版本 9\.9\.9/)
  })
})
