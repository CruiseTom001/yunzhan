import { describe, expect, it, vi } from 'vitest'
import { persistFeedbackStatus } from './feedback-status.mjs'

const INPUT = {
  feedbackId: 1,
  status: 'seen',
  actorUserId: '00000000-0000-4000-8000-000000000001',
}

describe('persistFeedbackStatus', () => {
  it('updates status before auxiliary writes', async () => {
    const client = {
      query: vi.fn()
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: '1', status: 'seen' }] })
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ seen_at: new Date('2026-07-28T08:00:00Z') }] }),
    }
    const writeAudit = vi.fn().mockResolvedValue(undefined)

    const result = await persistFeedbackStatus(client, INPUT, { writeAudit })

    expect(client.query.mock.calls[0][0]).toContain('SET status = $2')
    expect(result).toMatchObject({ id: '1', status: 'seen' })
    expect(writeAudit).toHaveBeenCalledOnce()
  })

  it('keeps the status update when seen time and audit writes fail', async () => {
    const failures = []
    const client = {
      query: vi.fn()
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: '1', status: 'resolved' }] })
        .mockRejectedValueOnce(Object.assign(new Error('missing seen_at'), { code: '42703' })),
    }
    const writeAudit = vi.fn().mockRejectedValue(new Error('audit unavailable'))

    const result = await persistFeedbackStatus(
      client,
      { ...INPUT, status: 'resolved' },
      {
        writeAudit,
        onAuxiliaryError: stage => failures.push(stage),
      },
    )

    expect(result).toEqual({ id: '1', status: 'resolved', seenAt: null })
    expect(failures).toEqual(['seen_at', 'audit'])
  })

  it('returns null without auxiliary writes when feedback is missing', async () => {
    const client = {
      query: vi.fn().mockResolvedValue({ rowCount: 0, rows: [] }),
    }
    const writeAudit = vi.fn()

    await expect(persistFeedbackStatus(client, INPUT, { writeAudit })).resolves.toBeNull()
    expect(client.query).toHaveBeenCalledOnce()
    expect(writeAudit).not.toHaveBeenCalled()
  })
})
