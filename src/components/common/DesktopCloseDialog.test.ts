// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import DesktopCloseDialog from './DesktopCloseDialog.vue'

vi.mock('@/utils/authDialogFocus', () => ({
  lockBodyScroll: vi.fn(),
  trapFocus: vi.fn(),
  unlockBodyScroll: vi.fn(),
}))

function mountDialog(open = true) {
  return mount(DesktopCloseDialog, {
    props: { open },
    global: {
      stubs: { Teleport: true },
    },
  })
}

describe('DesktopCloseDialog', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('emits tray with remember flag when minimize action is chosen', async () => {
    const wrapper = mountDialog()
    await wrapper.get('input[type="checkbox"]').setValue(true)
    await wrapper.get('button.desktop-close-dialog-action').trigger('click')
    expect(wrapper.emitted('tray')?.[0]).toEqual([true])
  })

  it('emits cancel when cancel button is clicked', async () => {
    const wrapper = mountDialog()
    await wrapper.get('button.desktop-close-dialog-secondary').trigger('click')
    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })

  it('emits cancel when escape is pressed', async () => {
    const wrapper = mountDialog()
    await wrapper.find('.desktop-close-dialog-root').trigger('keydown', { key: 'Escape' })
    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })

  it('emits quit when exit action is clicked', async () => {
    const wrapper = mountDialog()
    const actions = wrapper.findAll('button.desktop-close-dialog-action')
    await actions[1]?.trigger('click')
    await flushPromises()
    expect(wrapper.emitted('quit')?.[0]).toEqual([false])
  })
})
