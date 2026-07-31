// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, nextTick } from 'vue'
import { useDesktopCloseHandler } from '@/composables/useDesktopCloseHandler'
import { useDesktopUpdateStore } from '@/stores/desktopUpdate'
import {
  createContentDirtyGuard,
  registerAppQuitGuard,
  resetAppQuitGuardsForTests,
} from '@/utils/appQuitGuard'
import type { DesktopCloseRequestedPayload } from '@/utils/desktopCloseBehavior'

const resolveDesktopClose = vi.fn(async () => ({ ok: true, action: 'cancel' }))
const acknowledgeDesktopClose = vi.fn(async () => ({ ok: true, ignored: false }))
let closeRequestedListener: ((payload: DesktopCloseRequestedPayload) => void) | null = null

function installDesktopApi() {
  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    value: {
      invoke: vi.fn(),
      getUpdaterState: vi.fn(async () => ({ status: 'idle' })),
      checkForDesktopUpdate: vi.fn(),
      downloadDesktopUpdate: vi.fn(),
      installDesktopUpdate: vi.fn(),
      onDesktopUpdaterStateChanged: vi.fn(() => vi.fn()),
      onCloseRequested: vi.fn((listener: (payload: DesktopCloseRequestedPayload) => void) => {
        closeRequestedListener = listener
        return () => {
          closeRequestedListener = null
        }
      }),
      acknowledgeDesktopClose,
      resolveDesktopClose,
    },
  })
}

const Host = defineComponent({
  setup() {
    const handler = useDesktopCloseHandler()
    return { handler }
  },
  template: '<div />',
})

describe('useDesktopCloseHandler', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    resetAppQuitGuardsForTests()
    resolveDesktopClose.mockClear()
    acknowledgeDesktopClose.mockClear()
    closeRequestedListener = null
    installDesktopApi()
    useDesktopUpdateStore()
  })

  afterEach(() => {
    resetAppQuitGuardsForTests()
    delete (window as { electronAPI?: unknown }).electronAPI
  })

  it('shows close dialog on first ask close request', async () => {
    const wrapper = mount(Host)
    await flushPromises()
    expect(closeRequestedListener).toBeTypeOf('function')

    closeRequestedListener?.({ behavior: 'ask' })
    await flushPromises()
    expect(acknowledgeDesktopClose).toHaveBeenCalled()
    expect(wrapper.vm.handler.closeDialogVisible.value).toBe(true)
    expect(resolveDesktopClose).not.toHaveBeenCalled()
  })

  it('auto quits when remembered behavior is quit and guards pass', async () => {
    mount(Host)
    await flushPromises()

    closeRequestedListener?.({ behavior: 'quit' })
    await flushPromises()
    expect(acknowledgeDesktopClose).toHaveBeenCalled()
    expect(resolveDesktopClose).toHaveBeenCalledWith({ action: 'quit', remember: false })
  })

  it('subscribes to close requests during setup before mount', () => {
    expect(closeRequestedListener).toBeNull()
    mount(Host)
    expect(closeRequestedListener).toBeTypeOf('function')
  })

  it('shows unsaved guard before close dialog when content is dirty', async () => {
    const draft = { content: 'edited', lastSaved: 'saved' }
    registerAppQuitGuard(createContentDirtyGuard(() => draft.content, () => draft.lastSaved))

    const wrapper = mount(Host)
    await flushPromises()

    closeRequestedListener?.({ behavior: 'ask' })
    await flushPromises()
    expect(wrapper.vm.handler.unsavedDialogVisible.value).toBe(true)
    expect(wrapper.vm.handler.closeDialogVisible.value).toBe(false)
  })

  it('continues to close dialog after unsaved confirm', async () => {
    const draft = { content: 'edited', lastSaved: 'saved' }
    registerAppQuitGuard(createContentDirtyGuard(() => draft.content, () => draft.lastSaved))

    const wrapper = mount(Host)
    await flushPromises()
    closeRequestedListener?.({ behavior: 'ask' })
    await flushPromises()

    await wrapper.vm.handler.handleUnsavedConfirm()
    await nextTick()
    expect(wrapper.vm.handler.unsavedDialogVisible.value).toBe(false)
    expect(wrapper.vm.handler.closeDialogVisible.value).toBe(true)
  })

  it('cancels close when unsaved guard is dismissed', async () => {
    const draft = { content: 'edited', lastSaved: 'saved' }
    registerAppQuitGuard(createContentDirtyGuard(() => draft.content, () => draft.lastSaved))

    const wrapper = mount(Host)
    await flushPromises()
    closeRequestedListener?.({ behavior: 'ask' })
    await flushPromises()

    await wrapper.vm.handler.handleUnsavedCancel()
    await flushPromises()
    expect(resolveDesktopClose).toHaveBeenCalledWith({ action: 'cancel', remember: false })
  })

  it('cancels close while update is installing', async () => {
    const store = useDesktopUpdateStore()
    store.applyUpdaterState({ status: 'installing' })

    mount(Host)
    await flushPromises()
    closeRequestedListener?.({ behavior: 'tray' })
    await flushPromises()
    expect(resolveDesktopClose).toHaveBeenCalledWith({ action: 'cancel', remember: false })
  })

  it('cleans up close listener on unmount', async () => {
    const unsubscribe = vi.fn()
    const api = window.electronAPI
    if (!api) throw new Error('electronAPI missing in test')
    vi.spyOn(api, 'onCloseRequested').mockReturnValue(unsubscribe)

    const wrapper = mount(Host)
    await flushPromises()
    wrapper.unmount()
    expect(unsubscribe).toHaveBeenCalled()
  })
})
