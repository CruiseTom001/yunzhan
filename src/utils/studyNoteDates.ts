export interface CalendarCell {
  date: string
  day: number
  inMonth: boolean
  isToday: boolean
  isSelected: boolean
}

export function formatLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parseLocalDate(date: string): Date | null {
  const parsed = new Date(`${date}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

export function shiftLocalDate(date: string, deltaDays: number): string {
  const current = parseLocalDate(date) ?? new Date()
  current.setDate(current.getDate() + deltaDays)
  return formatLocalDate(current)
}

export function shiftMonthKey(monthKey: string, deltaMonths: number): string {
  const [yearText, monthText] = monthKey.split('-')
  const year = Number(yearText)
  const month = Number(monthText)
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return formatLocalDate(new Date()).slice(0, 7)
  }
  const cursor = new Date(year, month - 1 + deltaMonths, 1)
  return formatLocalDate(cursor).slice(0, 7)
}

export function buildCalendarMonthLabel(monthKey: string): string {
  const [yearText, monthText] = monthKey.split('-')
  const year = Number(yearText)
  const month = Number(monthText)
  if (!Number.isInteger(year) || !Number.isInteger(month)) return monthKey
  return `${year}年${month}月`
}

export function buildCalendarCells(
  monthKey: string,
  selectedDate: string,
  today: string = formatLocalDate(new Date()),
): CalendarCell[] {
  const [yearText, monthText] = monthKey.split('-')
  const year = Number(yearText)
  const monthIndex = Number(monthText) - 1
  if (!Number.isInteger(year) || !Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    return []
  }

  const firstOfMonth = new Date(year, monthIndex, 1)
  const mondayBasedPad = (firstOfMonth.getDay() + 6) % 7
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  const daysInPrevMonth = new Date(year, monthIndex, 0).getDate()
  const cells: CalendarCell[] = []

  for (let index = 0; index < 42; index += 1) {
    const dayOffset = index - mondayBasedPad
    let cellDate: Date
    let inMonth = true
    if (dayOffset < 0) {
      cellDate = new Date(year, monthIndex - 1, daysInPrevMonth + dayOffset + 1)
      inMonth = false
    } else if (dayOffset >= daysInMonth) {
      cellDate = new Date(year, monthIndex + 1, dayOffset - daysInMonth + 1)
      inMonth = false
    } else {
      cellDate = new Date(year, monthIndex, dayOffset + 1)
    }
    const date = formatLocalDate(cellDate)
    cells.push({
      date,
      day: cellDate.getDate(),
      inMonth,
      isToday: date === today,
      isSelected: date === selectedDate,
    })
  }
  return cells
}
