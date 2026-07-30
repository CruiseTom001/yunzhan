// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import AdminDesktopReleasesPage from './AdminDesktopReleasesPage.vue'
import { ApiError } from '@/utils/apiClient'

vi.mock('@/utils/desktopVersionApi', () => ({
  listAdminDesktopReleases: vi.fn(),
  createAdminDesktopRelease: vi.fn(),
  updateAdminDesktopRelease: vi.fn(),
  deleteAdminDesktopRelease: vi.fn(),
  syncAdminDesktopReleaseFromGitHub: vi.fn(),
}))

import {
  listAdminDesktopReleases,
  syncAdminDesktopReleaseFromGitHub,
} from '@/utils/desktopVersionApi'

const mockedList = vi.mocked(listAdminDesktopReleases)
const mockedSync = vi.mocked(syncAdminDesktopReleaseFromGitHub)

const RECORD = {
  id: 1,
  version: '1.2.7',
  minSupported: '1.2.5',
  downloadUrl: 'https://github.com/CruiseTom001/yunzhan/releases/download/v1.2.7/yunzhan-setup-1.2.7.exe',
  releaseNotes: '修复桌面端更新失败后无法正确重试的问题。',
  enabled: false,
  createdAt: 1700000000000,
  updatedAt: 1700000000000,
}

function findButton(wrapper: VueWrapper, text: string) {
  const button = wrapper.findAll('button').find(item => item.text().includes(text))
  expect(button, `missing button: ${text}`).toBeTruthy()
  return button!
}

describe('AdminDesktopReleasesPage GitHub sync', () => {
  let wrapper: VueWrapper | null = null

  beforeEach(() => {
    vi.clearAllMocks()
    mockedList.mockResolvedValue({ releases: [], total: 0 })
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
  })

  it('syncs from GitHub once, refreshes list and shows success message', async () => {
    mockedSync.mockResolvedValueOnce({
      ok: true,
      created: true,
      alreadyExists: false,
      message: '已创建为未启用，请检查后启用。',
      release: RECORD,
    })
    wrapper = mount(AdminDesktopReleasesPage, {
      global: { stubs: { Teleport: true } },
    })
    await flushPromises()
    await findButton(wrapper, '从 GitHub 同步').trigger('click')
    await nextTick()
    mockedList.mockClear()

    await wrapper.find('input[placeholder="例如 1.2.7"]').setValue('1.2.7')
    await nextTick()
    const form = wrapper.findAll('form').find(item => item.html().includes('例如 1.2.7'))
    expect(form).toBeTruthy()
    await form!.trigger('submit.prevent')
    await flushPromises()

    expect(mockedSync).toHaveBeenCalledTimes(1)
    expect(mockedSync).toHaveBeenCalledWith({ version: '1.2.7' })
    expect(mockedList).toHaveBeenCalled()
    expect(wrapper.find('[role="status"]').text()).toMatch(/未启用/)
    expect(wrapper.find('#sync-desktop-release-title').exists()).toBe(false)
  })

  it('shows already-exists message and prevents double submit while pending', async () => {
    let resolveSync!: (value: unknown) => void
    mockedSync.mockImplementationOnce(() => new Promise(resolve => {
      resolveSync = resolve
    }))
    wrapper = mount(AdminDesktopReleasesPage, {
      global: { stubs: { Teleport: true } },
    })
    await flushPromises()
    await findButton(wrapper, '从 GitHub 同步').trigger('click')
    await nextTick()
    await wrapper.find('input[placeholder="例如 1.2.7"]').setValue('1.2.7')
    await nextTick()
    const form = wrapper.findAll('form').find(item => item.html().includes('例如 1.2.7'))
    await form!.trigger('submit.prevent')
    await nextTick()
    expect(wrapper.text()).toMatch(/同步中/)
    await form!.trigger('submit.prevent')
    expect(mockedSync).toHaveBeenCalledTimes(1)

    resolveSync({
      ok: true,
      created: false,
      alreadyExists: true,
      message: '版本记录已存在，未覆盖。',
      release: RECORD,
    })
    await flushPromises()
    expect(wrapper.find('[role="status"]').text()).toMatch(/已存在，未覆盖/)
  })

  it('shows sync errors from the server', async () => {
    mockedSync.mockRejectedValueOnce(new ApiError('缺少 Release 资产：latest.yml', 400, {
      error: '缺少 Release 资产：latest.yml',
    }))
    wrapper = mount(AdminDesktopReleasesPage, {
      global: { stubs: { Teleport: true } },
    })
    await flushPromises()
    await findButton(wrapper, '从 GitHub 同步').trigger('click')
    await nextTick()
    await wrapper.find('input[placeholder="例如 1.2.7"]').setValue('1.2.7')
    await nextTick()
    const form = wrapper.findAll('form').find(item => item.html().includes('例如 1.2.7'))
    await form!.trigger('submit.prevent')
    await flushPromises()
    expect(wrapper.find('[role="alert"]').text()).toMatch(/缺少 Release 资产/)
  })
})
