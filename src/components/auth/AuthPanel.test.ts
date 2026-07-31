/**
 * @vitest-environment jsdom
 */
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AuthPanel from '@/components/auth/AuthPanel.vue'
import { useAuthStore } from '@/stores/auth'

vi.mock('@/stores/progress', () => ({
  useProgressStore: () => ({
    bindAccount: vi.fn(async () => {}),
  }),
}))

describe('AuthPanel login preferences', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    delete (window as { electronAPI?: unknown }).electronAPI
  })

  it('shows web stay signed in option by default', async () => {
    const wrapper = mount(AuthPanel, {
      props: { initialMode: 'login' },
    })
    expect(wrapper.find('#remember-web-login').exists()).toBe(true)
    expect((wrapper.find('#remember-web-login').element as HTMLInputElement).checked).toBe(true)
    expect(wrapper.find('#remember-desktop-identifier').exists()).toBe(false)
    expect(wrapper.find('#auto-login-on-startup').exists()).toBe(false)
  })

  it('submits remember flag on web login', async () => {
    const authStore = useAuthStore()
    const loginSpy = vi.spyOn(authStore, 'login').mockResolvedValue({
      id: '1',
      username: 'user',
      displayName: '用户',
      email: null,
      emailVerifiedAt: null,
      role: 'user',
      status: 'active',
      createdAt: 0,
      updatedAt: 0,
      lastLoginAt: null,
    })
    vi.spyOn(authStore, 'initialize').mockResolvedValue()

    const wrapper = mount(AuthPanel, {
      props: { initialMode: 'login' },
    })
    await wrapper.find('#login-identifier').setValue('user@example.com')
    await wrapper.find('#login-password').setValue('ValidPass123')
    await wrapper.find('#remember-web-login').setValue(false)
    await wrapper.find('form.auth-form').trigger('submit.prevent')
    await flushPromises()

    expect(loginSpy).toHaveBeenCalledWith('user@example.com', 'ValidPass123', {
      remember: false,
      desktopPreferences: undefined,
    })
  })

  it('shows desktop remember account and auto login options', async () => {
    const invoke = vi.fn(async (channel: string) => {
      if (channel === 'auth:getDesktopLoginPreferences') {
        return {
          rememberIdentifier: true,
          autoLogin: false,
          identifier: 'user@example.com',
          autoLoginAvailable: true,
          autoLoginDisabledReason: null,
        }
      }
      return null
    })
    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      value: { invoke },
    })

    const wrapper = mount(AuthPanel, {
      props: { initialMode: 'login' },
    })
    await flushPromises()
    expect(wrapper.find('#remember-desktop-identifier').exists()).toBe(true)
    expect(wrapper.find('#remember-web-login').exists()).toBe(false)
    expect(wrapper.find('#auto-login-on-startup').exists()).toBe(true)
    expect((wrapper.find('#login-identifier').element as HTMLInputElement).value).toBe('user@example.com')
    expect((wrapper.find('#login-password').element as HTMLInputElement).value).toBe('')
  })

  it('links auto login checkbox to remember account on desktop', async () => {
    const invoke = vi.fn(async (channel: string) => {
      if (channel === 'auth:getDesktopLoginPreferences') {
        return {
          rememberIdentifier: false,
          autoLogin: false,
          identifier: '',
          autoLoginAvailable: true,
          autoLoginDisabledReason: null,
        }
      }
      if (channel === 'auth:setDesktopLoginPreferences') {
        return {
          rememberIdentifier: true,
          autoLogin: true,
          identifier: '',
        }
      }
      return null
    })
    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      value: { invoke },
    })

    const wrapper = mount(AuthPanel, {
      props: { initialMode: 'login' },
    })
    await flushPromises()
    await wrapper.find('#auto-login-on-startup').setValue(true)
    expect((wrapper.find('#remember-desktop-identifier').element as HTMLInputElement).checked).toBe(true)
  })

  it('clears password when switching auth mode', async () => {
    const wrapper = mount(AuthPanel, {
      props: { initialMode: 'login' },
    })
    await wrapper.find('#login-password').setValue('ValidPass123')
    await wrapper.get('[role="tab"]').trigger('click')
    expect((wrapper.find('#login-password').element as HTMLInputElement).value).toBe('')
  })
})
