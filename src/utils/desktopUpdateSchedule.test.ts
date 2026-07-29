import { describe, expect, it } from 'vitest'
import { DESKTOP_UPDATE_CHECK_INTERVAL_MS } from './desktopUpdateCheck'
import { computeNextPeriodicCheckDelay } from './desktopUpdateSchedule'

describe('computeNextPeriodicCheckDelay', () => {
  it('defaults to full interval when no prior check exists', () => {
    expect(computeNextPeriodicCheckDelay(null, 1_000)).toBe(DESKTOP_UPDATE_CHECK_INTERVAL_MS)
  })

  it('schedules from lastCheckedAt plus interval', () => {
    const lastCheckedAt = 1_000_000
    const now = lastCheckedAt + 2 * 60 * 60 * 1000
    expect(computeNextPeriodicCheckDelay(lastCheckedAt, now)).toBe(4 * 60 * 60 * 1000)
  })

  it('returns zero when interval already elapsed', () => {
    const lastCheckedAt = 1_000_000
    const now = lastCheckedAt + DESKTOP_UPDATE_CHECK_INTERVAL_MS + 500
    expect(computeNextPeriodicCheckDelay(lastCheckedAt, now)).toBe(0)
  })
})
