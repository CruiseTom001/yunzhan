/**
 * @vitest-environment jsdom
 */
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { ApiError } from '@/utils/apiClient'
import { DESKTOP_AUTO_LOGIN_PERSIST_WARNING } from '@/utils/desktopAuthPreferences'
import { useAuthStore } from '@/stores/auth'

const { apiRequestMock, clearDesktopAutoLoginSessionMock, syncDesktopLoginPreferencesAfterLoginMock } = vi.hoisted(() => ({
  apiRequestMock: vi.fn(),
  clearDesktopAutoLoginSessionMock: vi.fn(),
  syncDesktopLoginPreferencesAfterLoginMock: vi.fn(),
}))

vi.mock('@/utils/apiClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/apiClient')>()
  return {
    ...actual,
    apiRequest: apiRequestMock,
  }
})

vi.mock('@/utils/desktopAuthPreferences', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/desktopAuthPreferences')>()
  return {
    ...actual,
    isDesktopRuntime: vi.fn(() => true),
    clearDesktopAutoLoginSession: clearDesktopAutoLoginSessionMock,
    syncDesktopLoginPreferencesAfterLogin: syncDesktopLoginPreferencesAfterLoginMock,
  }
})

const AUTH_USER = {
  id: '33333333-3333-4333-8333-333333333333',
  username: 'user',
  displayName: '用户',
  email: 'user@example.com',
  emailVerifiedAt: Date.now(),
  role: 'user' as const,
  status: 'active' as const,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  lastLoginAt: Date.now(),
}

describe('auth store desktop session cleanup', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    apiRequestMock.mockReset()
    clearDesktopAutoLoginSessionMock.mockReset()
    syncDesktopLoginPreferencesAfterLoginMock.mockReset()
    clearDesktopAutoLoginSessionMock.mockResolvedValue({
      rememberIdentifier: true,
      autoLogin: false,
      identifier: 'user@example.com',
      autoLoginAvailable: true,
      autoLoginDisabledReason: null,
      warning: null,
      hadAutoLogin: true,
    })
  })

  it('logout stays anonymous when desktop cleanup rejects', async () => {
    apiRequestMock.mockResolvedValueOnce({ ok: true })
    clearDesktopAutoLoginSessionMock.mockRejectedValueOnce(new Error('ipc failed'))
    const authStore = useAuthStore()
    authStore.user = AUTH_USER
    authStore.status = 'authenticated'

    await expect(authStore.logout()).resolves.toBeUndefined()
    expect(authStore.status).toBe('anonymous')
    expect(authStore.user).toBeNull()
  })

  it('initialize becomes anonymous when /auth/me returns 401 and cleanup rejects', async () => {
    apiRequestMock.mockRejectedValueOnce(new ApiError('未登录', 401, null))
    clearDesktopAutoLoginSessionMock.mockRejectedValueOnce(new Error('ipc failed'))
    const authStore = useAuthStore()

    await authStore.initialize()
    expect(authStore.status).toBe('anonymous')
    expect(authStore.user).toBeNull()
  })

  it('applySecurityUpdate(null) immediately becomes anonymous', () => {
    const authStore = useAuthStore()
    authStore.user = AUTH_USER
    authStore.status = 'authenticated'

    authStore.applySecurityUpdate(null)
    expect(authStore.status).toBe('anonymous')
    expect(authStore.user).toBeNull()
  })

  it('clearLocalSession immediately becomes anonymous', () => {
    const authStore = useAuthStore()
    authStore.user = AUTH_USER
    authStore.status = 'authenticated'

    authStore.clearLocalSession()
    expect(authStore.status).toBe('anonymous')
    expect(authStore.user).toBeNull()
  })

  it('keeps authenticated when login succeeds but desktop preference save warns', async () => {
    apiRequestMock.mockResolvedValueOnce({ user: AUTH_USER })
    syncDesktopLoginPreferencesAfterLoginMock.mockResolvedValueOnce({
      rememberIdentifier: true,
      autoLogin: false,
      identifier: 'user@example.com',
      autoLoginAvailable: true,
      autoLoginDisabledReason: null,
      warning: DESKTOP_AUTO_LOGIN_PERSIST_WARNING,
    })
    const authStore = useAuthStore()

    await expect(authStore.login('user@example.com', 'ValidPass123', {
      desktopPreferences: {
        rememberIdentifier: true,
        autoLogin: true,
        identifier: 'user@example.com',
      },
    })).resolves.toMatchObject({ username: 'user' })

    expect(authStore.status).toBe('authenticated')
    expect(authStore.sessionNotice).toBe(DESKTOP_AUTO_LOGIN_PERSIST_WARNING)
    expect(authStore.sessionNotice).not.toContain('yunzhan_session')
    expect(apiRequestMock).toHaveBeenCalledTimes(1)
  })

  it('keeps authenticated when desktop preference sync rejects', async () => {
    apiRequestMock.mockResolvedValueOnce({ user: AUTH_USER })
    syncDesktopLoginPreferencesAfterLoginMock.mockRejectedValueOnce(new Error('ipc rejected /tmp/desktop-auto-login.bin'))
    const authStore = useAuthStore()

    await expect(authStore.login('user@example.com', 'ValidPass123', {
      desktopPreferences: {
        rememberIdentifier: true,
        autoLogin: true,
        identifier: 'user@example.com',
      },
    })).resolves.toMatchObject({ username: 'user' })

    expect(authStore.status).toBe('authenticated')
    expect(authStore.user).toMatchObject({ username: 'user' })
    expect(authStore.sessionNotice).toBe(DESKTOP_AUTO_LOGIN_PERSIST_WARNING)
    expect(authStore.sessionNotice).not.toContain('/tmp/')
    expect(authStore.sessionNotice).not.toContain('ipc rejected')
    expect(apiRequestMock).toHaveBeenCalledTimes(1)
  })

  it('becomes anonymous when login API fails', async () => {
    apiRequestMock.mockRejectedValueOnce(new ApiError('账号或密码错误', 401, null))
    const authStore = useAuthStore()

    await expect(authStore.login('user@example.com', 'WrongPass123')).rejects.toBeInstanceOf(ApiError)
    expect(authStore.status).toBe('anonymous')
    expect(authStore.user).toBeNull()
    expect(syncDesktopLoginPreferencesAfterLoginMock).not.toHaveBeenCalled()
  })

  it('sets session notice after delayed desktop cleanup on 401 initialize', async () => {
    apiRequestMock.mockRejectedValueOnce(new ApiError('未登录', 401, null))
    let resolveCleanup: ((value: unknown) => void) | null = null
    clearDesktopAutoLoginSessionMock.mockImplementationOnce(() => new Promise((resolve) => {
      resolveCleanup = resolve
    }))
    const authStore = useAuthStore()

    const initPromise = authStore.initialize()
    await flushPromises()
    expect(authStore.status).toBe('anonymous')
    expect(authStore.sessionNotice).toBe('')

    resolveCleanup?.({
      rememberIdentifier: true,
      autoLogin: false,
      identifier: 'user@example.com',
      autoLoginAvailable: true,
      autoLoginDisabledReason: null,
      warning: null,
      hadAutoLogin: true,
    })
    await initPromise
    await flushPromises()
    expect(authStore.sessionNotice).toBe('自动登录信息已失效，请重新登录。')
  })

  it('clears session notice on logout', async () => {
    apiRequestMock.mockResolvedValueOnce({ ok: true })
    const authStore = useAuthStore()
    authStore.user = AUTH_USER
    authStore.status = 'authenticated'
    authStore.sessionNotice = DESKTOP_AUTO_LOGIN_PERSIST_WARNING

    await authStore.logout()
    expect(authStore.sessionNotice).toBe('')
  })
})
