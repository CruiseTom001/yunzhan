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
import { listAuditLogs } from './auditApi'

const mockedApiRequest = vi.mocked(apiRequest)

function mockResponse(payload: unknown): ReturnType<typeof apiRequest> {
  return Promise.resolve(payload)
}

beforeEach(() => {
  mockedApiRequest.mockReset()
})

describe('auditApi type guards', () => {
  it('parses a valid audit log list with actor and target', async () => {
    const payload = {
      logs: [
        {
          id: 'a-1',
          action: 'user.update',
          metadata: { role: 'super_admin', status: 'active' },
          createdAt: 1700000000000,
          actor: { id: 'u-1', username: 'admin', displayName: 'Admin' },
          target: { id: 'u-2', username: 'alice', displayName: 'Alice' },
        },
      ],
      total: 1,
      limit: 50,
      offset: 0,
    }
    mockedApiRequest.mockReturnValueOnce(mockResponse(payload))
    const result = await listAuditLogs({ limit: 50, offset: 0 })
    expect(result.total).toBe(1)
    expect(result.logs).toHaveLength(1)
    const entry = result.logs[0]
    expect(entry.actor?.username).toBe('admin')
    expect(entry.target?.displayName).toBe('Alice')
    // metadata 保持 Record<string, unknown>，消费方需自行收窄
    expect(entry.metadata).toEqual({ role: 'super_admin', status: 'active' })
  })

  it('accepts null actor and null target', async () => {
    const payload = {
      logs: [
        {
          id: 'a-2',
          action: 'system.cleanup',
          metadata: {},
          createdAt: 1700000000000,
          actor: null,
          target: null,
        },
      ],
      total: 1,
      limit: 50,
      offset: 0,
    }
    mockedApiRequest.mockReturnValueOnce(mockResponse(payload))
    const result = await listAuditLogs()
    expect(result.logs[0].actor).toBeNull()
    expect(result.logs[0].target).toBeNull()
  })

  it('rejects when logs array is missing', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({ total: 0, limit: 50, offset: 0 }))
    await expect(listAuditLogs()).rejects.toThrow('无效审计日志')
  })

  it('rejects when total is not an integer', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({
      logs: [], total: '5', limit: 50, offset: 0,
    }))
    await expect(listAuditLogs()).rejects.toThrow('无效审计日志')
  })

  it('rejects a log entry with missing id', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({
      logs: [
        {
          action: 'user.update',
          metadata: {},
          createdAt: 1700000000000,
          actor: null,
          target: null,
        },
      ],
      total: 1, limit: 50, offset: 0,
    }))
    await expect(listAuditLogs()).rejects.toThrow('无效数据')
  })

  it('rejects a log entry with non-record metadata', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({
      logs: [
        {
          id: 'a-3',
          action: 'user.update',
          metadata: 'oops',
          createdAt: 1,
          actor: null,
          target: null,
        },
      ],
      total: 1, limit: 50, offset: 0,
    }))
    await expect(listAuditLogs()).rejects.toThrow('无效数据')
  })

  it('rejects a log entry with invalid actor shape', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({
      logs: [
        {
          id: 'a-4',
          action: 'user.update',
          metadata: {},
          createdAt: 1,
          actor: { id: 'u-1', username: 123, displayName: 'Admin' },
          target: null,
        },
      ],
      total: 1, limit: 50, offset: 0,
    }))
    await expect(listAuditLogs()).rejects.toThrow('无效数据')
  })

  it('builds query string with provided filters', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({ logs: [], total: 0, limit: 30, offset: 10 }))
    await listAuditLogs({ query: 'admin', action: 'auth.login', limit: 30, offset: 10 })
    const calledPath = mockedApiRequest.mock.calls[0]?.[0] as string
    expect(calledPath).toContain('query=admin')
    expect(calledPath).toContain('action=auth.login')
    expect(calledPath).toContain('limit=30')
    expect(calledPath).toContain('offset=10')
  })

  it('falls back to default limit and offset when omitted', async () => {
    mockedApiRequest.mockReturnValueOnce(mockResponse({ logs: [], total: 0, limit: 50, offset: 0 }))
    await listAuditLogs()
    const calledPath = mockedApiRequest.mock.calls[0]?.[0] as string
    expect(calledPath).toContain('limit=50')
    expect(calledPath).toContain('offset=0')
  })
})
