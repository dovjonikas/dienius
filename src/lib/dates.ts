export interface MonthCell {
  key: string
  inMonth: boolean
}

export function dateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function todayKey(): string {
  return dateKey(new Date())
}

export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number)
  return dateKey(new Date(y, m - 1, d + n))
}

export function monthGrid(year: number, month: number): MonthCell[] {
  const first = new Date(year, month, 1)
  const offset = (first.getDay() + 6) % 7
  const cells: MonthCell[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(year, month, 1 - offset + i)
    cells.push({ key: dateKey(d), inMonth: d.getMonth() === month })
  }
  return cells
}

export function formatDayTitle(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

/**
 * The seven date keys of the week a date falls in, Monday first.
 *
 * Monday first because a week does - the same numbering `weekdayOf` and the
 * weekday-template mapping already use. A week that started on Sunday would
 * put the weekend on both ends of the view.
 */
export function weekOf(key: string): string[] {
  const [y, m, d] = key.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const mondayOffset = (date.getDay() + 6) % 7
  return Array.from({ length: 7 }, (_, i) => addDays(key, i - mondayOffset))
}

/** "1 - 7 September" or "29 September - 5 October", for a week's heading. */
export function formatWeekTitle(days: string[], opts: { short?: boolean } = {}): string {
  const first = days[0]
  const last = days[days.length - 1]
  const toDate = (k: string) => {
    const [y, m, d] = k.split('-').map(Number)
    return new Date(y, m - 1, d)
  }
  const a = toDate(first)
  const b = toDate(last)
  // Short month names where the title has to share a phone's width with two
  // arrows and a Today button: "2 - 4 Sep 2026" fits, "2 - 4 September 2026"
  // wraps the row it was meant to save.
  const month = (d: Date) => d.toLocaleDateString('en-US', { month: opts.short ? 'short' : 'long' })
  if (a.getMonth() === b.getMonth()) {
    return `${a.getDate()} - ${b.getDate()} ${month(b)} ${b.getFullYear()}`
  }
  const sameYear = a.getFullYear() === b.getFullYear()
  const left = sameYear ? `${a.getDate()} ${month(a)}` : `${a.getDate()} ${month(a)} ${a.getFullYear()}`
  return `${left} - ${b.getDate()} ${month(b)} ${b.getFullYear()}`
}

/** The short weekday label a column header uses. */
export function shortWeekday(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short' })
}
