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
  generateAdminAnnouncementPairFromChangelog: vi.fn(),
}))

import {
  generateAdminAnnouncementPairFromChangelog,
  listAdminAnnouncements,
} from '@/utils/announcementApi'

const mockedList = vi.mocked(listAdminAnnouncements)
const mockedGenerate = vi.mocked(generateAdminAnnouncementPairFromChangelog)

const WEB_DRAFT = {
  id: '8',
  title: '云栈网站 v1.2.6 更新',
  content: '网站更新内容',
  publishedAt: 1700000000000,
  active: false,
  createdAt: 1700000000000,
  updatedAt: 1700000000000,
  category: 'web_release' as const,
  version: '1.2.6',
  sourceKey: 'web_release:1.2.6',
  sourceCommit: null,
  generatedByAi: false,
  generationProvider: null,
  generationError: null,
}

const DESKTOP_DRAFT = {
  ...WEB_DRAFT,
  id: '9',
  title: '云栈桌面端 v1.2.6 更新',
  category: 'desktop_release' as const,
  sourceKey: 'desktop_release:1.2.6',
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
    version = '',
    sourceCommit = '',
  }: {
    version?: string
    sourceCommit?: string
  },
) {
  if (version) {
    await wrapper.find('input[placeholder="例如 1.2.6"]').setValue(version)
  }
  if (sourceCommit) {
    await wrapper.find('input[placeholder="7-40 位 Git SHA（可选）"]').setValue(sourceCommit)
  }
  await nextTick()
  const generateForm = wrapper.findAll('form').find(item => item.html().includes('例如 1.2.6'))
  expect(generateForm).toBeTruthy()
  await generateForm!.trigger('submit.prevent')
  await flushPromises()
}

describe('AdminAnnouncementsPage paired generate dialog', () => {
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

  it('submits pair generate once, shows channel statuses, and refreshes list once', async () => {
    mockedGenerate.mockResolvedValueOnce({
      version: '1.2.6',
      sourceCommit: '0f3cdbe73add73b47ce0b251fdcc08e6f48a0a0d',
      results: {
        web: { status: 'created', announcement: WEB_DRAFT, message: '网站端草稿已创建（仍为未发布）。' },
        desktop: { status: 'already_exists', announcement: DESKTOP_DRAFT, message: '桌面端草稿已存在，未重复创建，也未修改正文。' },
      },
    })
    wrapper = mountPage()
    await flushPromises()
    await openGenerateDialog(wrapper)
    expect(wrapper.text()).not.toMatch(/公告类型/)
    expect(wrapper.text()).toMatch(/生成网站与桌面端草稿/)
    mockedList.mockClear()
    await fillAndSubmitGenerate(wrapper, {
      version: '1.2.6',
      sourceCommit: '0f3cdbe73add73b47ce0b251fdcc08e6f48a0a0d',
    })

    expect(mockedGenerate).toHaveBeenCalledTimes(1)
    expect(mockedGenerate).toHaveBeenCalledWith({
      version: '1.2.6',
      sourceCommit: '0f3cdbe73add73b47ce0b251fdcc08e6f48a0a0d',
    })
    expect(mockedList).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toMatch(/网站端：已创建/)
    expect(wrapper.text()).toMatch(/桌面端：已存在/)
    expect(wrapper.find('#generate-announcement-title').exists()).toBe(true)
  })

  it('shows skipped and created from real pair protocol without invalid announcement error', async () => {
    mockedGenerate.mockResolvedValueOnce({
      version: '1.2.8',
      sourceCommit: null,
      results: {
        web: {
          status: 'skipped',
          announcement: null,
          message: '本版本没有用户侧公告内容。',
        },
        desktop: {
          status: 'created',
          announcement: DESKTOP_DRAFT,
          message: '桌面端草稿已创建（仍为未发布）。',
        },
      },
    })
    wrapper = mountPage()
    await flushPromises()
    await openGenerateDialog(wrapper)
    mockedList.mockClear()
    await fillAndSubmitGenerate(wrapper, { version: '1.2.8' })
    expect(mockedGenerate).toHaveBeenCalledTimes(1)
    expect(mockedList).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toMatch(/网站端：无用户侧内容/)
    expect(wrapper.text()).toMatch(/桌面端：已创建/)
    expect(wrapper.text()).not.toMatch(/无效公告数据/)
  })

  it('prevents double submit while pending', async () => {
    let resolveGenerate!: (value: unknown) => void
    mockedGenerate.mockImplementationOnce(() => new Promise(resolve => {
      resolveGenerate = resolve
    }))
    wrapper = mountPage()
    await flushPromises()
    await openGenerateDialog(wrapper)
    await wrapper.find('input[placeholder="例如 1.2.6"]').setValue('1.2.6')
    await nextTick()
    const generateForm = wrapper.findAll('form').find(item => item.html().includes('例如 1.2.6'))
    await generateForm!.trigger('submit.prevent')
    await nextTick()
    expect(wrapper.text()).toMatch(/处理中/)
    expect(findButton(wrapper, '处理中').attributes('disabled')).toBeDefined()
    await generateForm!.trigger('submit.prevent')
    expect(mockedGenerate).toHaveBeenCalledTimes(1)

    resolveGenerate({
      version: '1.2.6',
      sourceCommit: null,
      results: {
        web: { status: 'skipped', announcement: null, message: '网站端无用户侧更新内容，已跳过。' },
        desktop: { status: 'failed', announcement: null, message: '桌面端生成失败：AI 超时' },
      },
    })
    await flushPromises()
    expect(wrapper.text()).toMatch(/网站端：无用户侧内容/)
    expect(wrapper.text()).toMatch(/桌面端：失败/)
  })

  it('shows request-level errors without clearing channel-less form', async () => {
    mockedGenerate.mockRejectedValueOnce(new ApiError('输入版本 1.2.6 与 commit 对应 package.json 版本 1.2.7 不一致。', 400, {
      error: '输入版本 1.2.6 与 commit 对应 package.json 版本 1.2.7 不一致。',
    }))
    wrapper = mountPage()
    await flushPromises()
    await openGenerateDialog(wrapper)
    await fillAndSubmitGenerate(wrapper, {
      version: '1.2.6',
      sourceCommit: 'abcdef1',
    })
    expect(wrapper.text()).toMatch(/版本 1\.2\.6.*1\.2\.7 不一致/)
  })
})
