import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/utils/apiClient', () => ({
  ApiError: class ApiError extends Error {
    constructor(message: string, public readonly status: number, public readonly payload: unknown) {
      super(message)
    }
  },
  apiRequest: vi.fn(),
}))

import { apiRequest } from '@/utils/apiClient'
import {
  changeAccountPassword,
  confirmEmailChange,
  deleteAccount,
  exportAccountData,
  listAccountSessions,
  requestEmailChangeCode,
  revokeAccountSession,
  revokeOtherAccountSessions,
  updateAccountProfile,
} from './accountApi'

const mockedApiRequest = vi.mocked(apiRequest)

const VALID_USER = {
  id: 'u-1',
  username: 'alice',
  displayName: 'Alice',
  email: 'alice@example.com',
  emailVerifiedAt: 1700000000000,
  role: 'user',
  status: 'active',
  createdAt: 1700000000000,
  updatedAt: 1700000000000,
  lastLoginAt: 1700000000000,
}

function mockResponse(payload: unknown): ReturnType<typeof apiRequest> {
  return Promise.resolve(payload)
}

beforeEach(() => {
  mockedApiRequest.mockReset()
})

describe('accountApi type guards', () => {
  it('reads a valid user profile update response', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({ user: VALID_USER }))
    const user = await updateAccountProfile({ username: 'alice', displayName: 'Alice' })
    expect(user.username).toBe('alice')
  })

  it('rejects profile response missing username', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({ user: { ...VALID_USER, username: 12 } }))
    await expect(updateAccountProfile({ username: '12', displayName: 'A' })).rejects.toThrow('无效用户资料')
  })

  it('rejects profile response with invalid role', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({ user: { ...VALID_USER, role: 'root' } }))
    await expect(updateAccountProfile({ username: 'x', displayName: 'x' })).rejects.toThrow('无效用户资料')
  })

  it('accepts ok payload for password change', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({ ok: true }))
    await expect(changeAccountPassword({ currentPassword: 'a', newPassword: 'b' })).resolves.toBeUndefined()
  })

  it('rejects password change when ok is missing', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({ ok: false }))
    await expect(changeAccountPassword({ currentPassword: 'a', newPassword: 'b' })).rejects.toThrow('无效改密结果')
  })

  it('reads cooldown seconds for email change code request', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({ ok: true, cooldownSeconds: 60 }))
    const cooldown = await requestEmailChangeCode({ email: 'x@y.com', currentPassword: 'a' })
    expect(cooldown).toBe(60)
  })

  it('rejects non-integer cooldown', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({ cooldownSeconds: 12.5 }))
    await expect(requestEmailChangeCode({ email: 'x@y.com', currentPassword: 'a' })).rejects.toThrow('无效验证码结果')
  })

  it('rejects out-of-range cooldown', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({ cooldownSeconds: 9999 }))
    await expect(requestEmailChangeCode({ email: 'x@y.com', currentPassword: 'a' })).rejects.toThrow('无效验证码结果')
  })

  it('reads updated user after email confirmation', async () => {
    const updatedUser = { ...VALID_USER, email: 'new@example.com' }
    mockedApiRequest.mockReturnValueOnce(mockResponse({ user: updatedUser }))
    const user = await confirmEmailChange({ email: 'new@example.com', code: '123456', currentPassword: 'a' })
    expect(user.email).toBe('new@example.com')
  })

  it('parses a valid session list', async () => {
    const sessionsPayload = {
      sessions: [
        {
          id: 's-1',
          userAgent: 'Mozilla/5.0',
          current: true,
          createdAt: 1700000000000,
          lastUsedAt: 1700000000000,
          expiresAt: 1700000000000,
        },
        {
          id: 's-2',
          userAgent: '',
          current: false,
          createdAt: 1700000000000,
          lastUsedAt: 1700000000000,
          expiresAt: 1700000000000,
        },
      ],
    }
    mockedApiRequest.mockReturnValueOnce(mockResponse(sessionsPayload))
    const sessions = await listAccountSessions()
    expect(sessions).toHaveLength(2)
    expect(sessions[0].current).toBe(true)
    expect(sessions[1].userAgent).toBe('')
  })

  it('rejects session list with invalid current flag', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({
      sessions: [{
        id: 's-1', userAgent: 'ua', current: 'yes',
        createdAt: 1, lastUsedAt: 1, expiresAt: 1,
      }],
    }))
    await expect(listAccountSessions()).rejects.toThrow('会话列表包含无效数据')
  })

  it('accepts ok payload for revoke session', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({ ok: true }))
    await expect(revokeAccountSession('s-1')).resolves.toBeUndefined()
  })

  it('accepts ok payload for revoke other sessions', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({ ok: true }))
    await expect(revokeOtherAccountSessions()).resolves.toBeUndefined()
  })

  it('exports account data with unknown progress preserved', async () => {
    const exportPayload = {
      account: VALID_USER,
      progress: { completedChapters: { git: [0] } },
      progressVersion: 3,
      progressUpdatedAt: 1700000000000,
      exportedAt: 1700000000000,
    }
    mockedApiRequest.mockReturnValueOnce(mockResponse(exportPayload))
    const data = await exportAccountData()
    expect(data.progressVersion).toBe(3)
    // progress 保持 unknown，外部消费方不应假定为具体类型
    expect(data.progress).toEqual({ completedChapters: { git: [0] } })
  })

  it('rejects export with invalid account', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({
      account: { ...VALID_USER, id: 123 },
      progress: null,
      progressVersion: 0,
      progressUpdatedAt: null,
      exportedAt: 1,
    }))
    await expect(exportAccountData()).rejects.toThrow('无效导出数据')
  })

  it('rejects export with non-integer progressVersion', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({
      account: VALID_USER,
      progress: null,
      progressVersion: 1.5,
      progressUpdatedAt: null,
      exportedAt: 1,
    }))
    await expect(exportAccountData()).rejects.toThrow('无效导出数据')
  })

  it('accepts ok payload for account deletion', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({ ok: true }))
    await expect(deleteAccount({ currentPassword: 'a', confirmation: 'alice' })).resolves.toBeUndefined()
  })

  it('rejects account deletion when ok absent', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({ ok: false }))
    await expect(deleteAccount({ currentPassword: 'a', confirmation: 'alice' })).rejects.toThrow('无效注销结果')
  })
})
