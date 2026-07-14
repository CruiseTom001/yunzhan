import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { AuthUser, UserRole, UserStatus } from '@/types/auth'
import { ApiError, apiRequest } from '@/utils/apiClient'

export interface RegistrationInput {
  email: string
  code: string
  username: string
  displayName: string
  password: string
}

export interface PasswordResetInput {
  email: string
  code: string
  password: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isRole(value: unknown): value is UserRole {
  return value === 'user' || value === 'super_admin'
}

function isStatus(value: unknown): value is UserStatus {
  return value === 'active' || value === 'disabled'
}

function isTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function readAuthUser(value: unknown): AuthUser | null {
  if (!isRecord(value)) return null
  if (
    typeof value.id !== 'string'
    || typeof value.username !== 'string'
    || typeof value.displayName !== 'string'
    || (value.email !== null && typeof value.email !== 'string')
    || (value.emailVerifiedAt !== null && !isTimestamp(value.emailVerifiedAt))
    || !isRole(value.role)
    || !isStatus(value.status)
    || !isTimestamp(value.createdAt)
    || !isTimestamp(value.updatedAt)
    || (value.lastLoginAt !== null && !isTimestamp(value.lastLoginAt))
  ) return null
  return {
    id: value.id,
    username: value.username,
    displayName: value.displayName,
    email: typeof value.email === 'string' ? value.email : null,
    emailVerifiedAt: isTimestamp(value.emailVerifiedAt) ? value.emailVerifiedAt : null,
    role: value.role,
    status: value.status,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    lastLoginAt: isTimestamp(value.lastLoginAt) ? value.lastLoginAt : null,
  }
}

function readUserResponse(value: unknown) {
  if (!isRecord(value)) return null
  return readAuthUser(value.user)
}

function readCooldownSeconds(value: unknown) {
  if (!isRecord(value) || typeof value.cooldownSeconds !== 'number') return null
  return Number.isInteger(value.cooldownSeconds) && value.cooldownSeconds > 0 && value.cooldownSeconds <= 600
    ? value.cooldownSeconds
    : null
}

function readOkResponse(value: unknown) {
  return isRecord(value) && value.ok === true
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null)
  const status = ref<'idle' | 'loading' | 'authenticated' | 'anonymous' | 'error'>('idle')
  const errorMessage = ref('')
  let initialization: Promise<void> | null = null

  const isAuthenticated = computed(() => user.value !== null)
  const isSuperAdmin = computed(() => user.value?.role === 'super_admin')

  function initialize() {
    if (initialization) return initialization
    status.value = 'loading'
    initialization = apiRequest('/auth/me')
      .then((payload) => {
        const authenticatedUser = readUserResponse(payload)
        if (!authenticatedUser) throw new Error('账号服务返回了无效用户数据。')
        user.value = authenticatedUser
        status.value = 'authenticated'
      })
      .catch((error: unknown) => {
        user.value = null
        if (error instanceof ApiError && error.status === 401) {
          status.value = 'anonymous'
          return
        }
        status.value = 'error'
        errorMessage.value = error instanceof Error ? error.message : '账号服务初始化失败。'
      })
    return initialization
  }

  async function login(username: string, password: string) {
    status.value = 'loading'
    errorMessage.value = ''
    try {
      const payload = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      })
      const authenticatedUser = readUserResponse(payload)
      if (!authenticatedUser) throw new Error('账号服务返回了无效用户数据。')
      user.value = authenticatedUser
      status.value = 'authenticated'
      return authenticatedUser
    } catch (error: unknown) {
      user.value = null
      status.value = 'anonymous'
      errorMessage.value = error instanceof Error ? error.message : '登录失败。'
      throw error
    }
  }

  async function requestRegistrationCode(email: string) {
    const payload = await apiRequest('/auth/register/code', {
      method: 'POST',
      body: JSON.stringify({ email }),
    })
    const cooldownSeconds = readCooldownSeconds(payload)
    if (!cooldownSeconds) throw new Error('账号服务返回了无效验证码结果。')
    return cooldownSeconds
  }

  async function requestPasswordResetCode(email: string) {
    const payload = await apiRequest('/auth/password-reset/code', {
      method: 'POST',
      body: JSON.stringify({ email }),
    })
    const cooldownSeconds = readCooldownSeconds(payload)
    if (!cooldownSeconds) throw new Error('账号服务返回了无效验证码结果。')
    return cooldownSeconds
  }

  async function resetPassword(input: PasswordResetInput) {
    const payload = await apiRequest('/auth/password-reset', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    if (!readOkResponse(payload)) throw new Error('账号服务返回了无效密码重置结果。')
  }

  async function register(input: RegistrationInput) {
    status.value = 'loading'
    errorMessage.value = ''
    try {
      const payload = await apiRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify(input),
      })
      const registeredUser = readUserResponse(payload)
      if (!registeredUser) throw new Error('账号服务返回了无效用户数据。')
      user.value = registeredUser
      status.value = 'authenticated'
      return registeredUser
    } catch (error: unknown) {
      user.value = null
      status.value = 'anonymous'
      errorMessage.value = error instanceof Error ? error.message : '注册失败。'
      throw error
    }
  }

  async function logout() {
    try {
      await apiRequest('/auth/logout', { method: 'POST' })
    } finally {
      user.value = null
      status.value = 'anonymous'
      errorMessage.value = ''
    }
  }

  return {
    user,
    status,
    errorMessage,
    isAuthenticated,
    isSuperAdmin,
    initialize,
    login,
    requestRegistrationCode,
    requestPasswordResetCode,
    register,
    resetPassword,
    logout,
  }
})
