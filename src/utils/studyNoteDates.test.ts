import { describe, expect, it } from 'vitest'
import {
  buildCalendarCells,
  formatLocalDate,
  shiftLocalDate,
  shiftMonthKey,
} from './studyNoteDates'

describe('studyNoteDates', () => {
  it('formats and shifts local dates across month boundary', () => {
    expect(formatLocalDate(new Date(2026, 6, 31))).toBe('2026-07-31')
    expect(shiftLocalDate('2026-07-31', 1)).toBe('2026-08-01')
    expect(shiftLocalDate('2026-08-01', -1)).toBe('2026-07-31')
  })

  it('shifts month keys across year boundary', () => {
    expect(shiftMonthKey('2026-01', -1)).toBe('2025-12')
    expect(shiftMonthKey('2025-12', 1)).toBe('2026-01')
  })

  it('handles leap day in calendar cells', () => {
    const cells = buildCalendarCells('2024-02', '2024-02-29', '2024-02-29')
    expect(cells.some(cell => cell.date === '2024-02-29' && cell.inMonth)).toBe(true)
  })

  it('marks selected date in calendar cells', () => {
    const cells = buildCalendarCells('2026-07', '2026-07-22', '2026-07-26')
    const selected = cells.find(cell => cell.date === '2026-07-22')
    expect(selected?.isSelected).toBe(true)
    expect(selected?.isToday).toBe(false)
  })
})
