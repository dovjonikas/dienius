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

/**
 * The month as whole Monday-to-Sunday weeks: as many as the month actually
 * touches, and no more.
 *
 * It used to be a flat 42 cells, six rows, always. September 2026 starts on
 * a Tuesday and has thirty days, so it fills five rows exactly - and the
 * sixth was a whole week of October, drawn under the month, spending a
 * seventh of the height on days that belong to a month nobody asked for.
 * That height is the thing the zero-scroll rule in CONVENTIONS section 4
 * fights for on a 1366x768 laptop.
 *
 * A trailing partial week is still drawn whole, because a week with three
 * empty cells at the end is what a calendar looks like; it is a week the
 * month is genuinely in.
 */
export function monthGrid(year: number, month: number): MonthCell[] {
  const first = new Date(year, month, 1)
  const offset = (first.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const weeks = Math.ceil((offset + daysInMonth) / 7)
  const cells: MonthCell[] = []
  for (let i = 0; i < weeks * 7; i++) {
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
 * The weekday on its own - "Wednesday".
 *
 * The day header's heading at the wide breakpoint, where the whole title has
 * to fit the width of the month it stands over: the full form is 250px in
 * that type and the month is 240 wide with two arrows in front of it, so the
 * heading carries the word and the line under it carries the date. See
 * DayHeader.
 */
export function weekdayName(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long' })
}

/** The rest of it - "September 30" - for the line under that heading. */
export function monthAndDay(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
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

/**
 * A date short enough to sit on a row beside something else: "Sat 12 Sep".
 *
 * `formatDayTitle` spells the weekday and the month out in full, which is
 * right for a heading and 142px wide on a phone. A note's row carries the
 * date and four actions together, and the full title pushed the actions
 * onto a second line - so one note in a list stood taller than the rest for
 * a reason nobody reading it could see.
 */
export function formatDayShort(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

/** The short weekday label a column header uses. */
export function shortWeekday(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short' })
}

/**
 * "Wednesday", on its own.
 *
 * For a sentence that names a day inside a surface that already says which
 * date it is about - "Clear 9 tasks from Wednesday?" on a card headed
 * "Wednesday, September 30". The full title there would say the date twice.
 */
export function longWeekday(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long' })
}
