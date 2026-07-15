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
  listAdminFeedback,
  listMyFeedback,
  submitFeedback,
  updateFeedbackStatus,
} from './feedbackApi'

const mockedApiRequest = vi.mocked(apiRequest)

const VALID_MY_FEEDBACK = {
  id: 'f-1',
  category: 'suggestion',
  content: '希望增加夜间模式',
  contact: 'alice@example.com',
  status: 'open',
  createdAt: 1700000000000,
  seenAt: null,
}

function mockResponse(payload: unknown): ReturnType<typeof apiRequest> {
  return Promise.resolve(payload)
}

beforeEach(() => {
  mockedApiRequest.mockReset()
})

describe('feedbackApi type guards', () => {
  it('accepts ok payload for submit', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({ ok: true }))
    await expect(submitFeedback({ category: 'suggestion', content: '希望增加夜间模式' })).resolves.toBeUndefined()
  })

  it('rejects submit when ok missing', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({ ok: false }))
    await expect(submitFeedback({ category: 'bug', content: '崩溃' })).rejects.toThrow('无效反馈结果')
  })

  it('passes through contact as optional', async () => {
    mockedApiRequest.mockImplementationOnce(async (_path, options) => {
      const body = JSON.parse((options as RequestInit).body as string)
      expect(body.contact).toBeUndefined()
      return { ok: true }
    })
    await submitFeedback({ category: 'other', content: '建议' })
  })

  it('parses my feedback list', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({
      feedbacks: [VALID_MY_FEEDBACK, {
        id: 'f-2',
        category: 'bug',
        content: '修复 bug',
        contact: null,
        status: 'resolved',
        createdAt: 1700000000000,
        seenAt: 1700000000000,
      }],
    }))
    const list = await listMyFeedback()
    expect(list).toHaveLength(2)
    expect(list[0].contact).toBe('alice@example.com')
    expect(list[1].contact).toBeNull()
    expect(list[1].status).toBe('resolved')
  })

  it('rejects my feedback list with invalid category', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({
      feedbacks: [{ ...VALID_MY_FEEDBACK, category: 'complaint' }],
    }))
    await expect(listMyFeedback()).rejects.toThrow('包含无效数据')
  })

  it('rejects my feedback list with non-string content', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({
      feedbacks: [{ ...VALID_MY_FEEDBACK, content: 42 }],
    }))
    await expect(listMyFeedback()).rejects.toThrow('包含无效数据')
  })

  it('rejects my feedback payload without feedbacks array', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({ ok: true }))
    await expect(listMyFeedback()).rejects.toThrow('无效反馈列表')
  })

  it('parses admin feedback list with user reference', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({
      feedbacks: [{
        ...VALID_MY_FEEDBACK,
        user: {
          id: 'u-1',
          username: 'alice',
          displayName: 'Alice',
        },
      }],
      total: 1,
      limit: 50,
      offset: 0,
    }))
    const result = await listAdminFeedback({ status: 'open', limit: 50, offset: 0 })
    expect(result.total).toBe(1)
    expect(result.feedbacks[0].user?.username).toBe('alice')
  })

  it('accepts admin feedback with null user (deleted account)', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({
      feedbacks: [{ ...VALID_MY_FEEDBACK, user: null }],
      total: 1, limit: 50, offset: 0,
    }))
    const result = await listAdminFeedback()
    expect(result.feedbacks[0].user).toBeNull()
  })

  it('rejects admin feedback with invalid user shape', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({
      feedbacks: [{
        ...VALID_MY_FEEDBACK,
        user: { id: 'u-1', username: 12, displayName: 'A' },
      }],
      total: 1, limit: 50, offset: 0,
    }))
    await expect(listAdminFeedback()).rejects.toThrow('包含无效数据')
  })

  it('rejects admin feedback list without total integer', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({
      feedbacks: [], total: '5', limit: 50, offset: 0,
    }))
    await expect(listAdminFeedback()).rejects.toThrow('无效反馈列表')
  })

  it('builds admin query string with status filter', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({
      feedbacks: [], total: 0, limit: 50, offset: 0,
    }))
    await listAdminFeedback({ status: 'seen', limit: 30, offset: 10 })
    const calledPath = mockedApiRequest.mock.calls[0]?.[0] as string
    expect(calledPath).toContain('status=seen')
    expect(calledPath).toContain('limit=30')
    expect(calledPath).toContain('offset=10')
  })

  it('accepts ok payload for update status', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({ ok: true, status: 'seen' }))
    await expect(updateFeedbackStatus('1', 'seen')).resolves.toBeUndefined()
  })

  it('rejects update status when ok missing', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({ ok: false }))
    await expect(updateFeedbackStatus('1', 'resolved')).rejects.toThrow('无效反馈更新结果')
  })
})
