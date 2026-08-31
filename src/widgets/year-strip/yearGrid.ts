import type { DayPlan, Template } from '../../lib/types'
import { dateKey } from '../../lib/dates'
import { dayScore } from '../day-plan/score'

/**
 * One day's worth of what the year strip needs to draw and describe a cell.
 * `weekday` is 0 (Monday) through 6 (Sunday), the same convention
 * `monthGrid` in `dates.ts` already uses. `weekIndex` is which column the
 * day falls in, counting continuously from the first Monday on or before
 * January 1st - it does not reset at month boundaries, so the grid reads
 * as one continuous strip rather than twelve separate ones.
 *
 * `complete` mirrors `dayScore`'s own definition of a finished day: every
 * counted task done, on a day that had at least one counted task in the
 * first place. `planned` is `dayScore`'s own `planned` flag - true the
 * moment the day has at least one counted task, whether or not a template
 * put it there. A day with no plan at all has both `planned: false` and
 * `complete: false`; a day with a real, unfinished task has `planned: true`
 * and `complete: false` - `planned` is what lets the strip tell those two
 * apart even though neither one is complete. Without it, a hand-planned
 * day, a day a task was pushed onto, or a day whose template was later
 * deleted rendered exactly like an empty one - see `formatYearCellLabel`
 * for how the distinction reaches the accessible name, and
 * `docs/DECISIONS.md` for why.
 */
export interface YearCell {
  key: string
  date: Date
  month: number
  weekday: number
  weekIndex: number
  templateColor?: string
  templateName?: string
  planned: boolean
  complete: boolean
}

/**
 * Builds one cell per calendar day of `year`, in date order. A day with no
 * stored plan at all gets no template color and `complete: false` - the
 * same "nothing to measure" treatment `dayScore` already gives an empty
 * day, not a darker shade of the same grid.
 *
 * Walks the year one `Date` field-increment at a time (`setDate`) rather
 * than doing millisecond arithmetic, the same way `addDays` in `dates.ts`
 * does - millisecond math over a date range that crosses a daylight-saving
 * change silently drifts by an hour, which is exactly the kind of bug that
 * would misplace a handful of cells by one column without ever throwing.
 */
export function buildYearCells(
  year: number,
  days: Record<string, DayPlan>,
  templates: Template[],
): YearCell[] {
  const jan1 = new Date(year, 0, 1)
  const jan1Weekday = (jan1.getDay() + 6) % 7
  const end = new Date(year, 11, 31)
  const cells: YearCell[] = []

  let weekday = jan1Weekday
  let weekIndex = 0
  for (const d = new Date(year, 0, 1); d <= end; d.setDate(d.getDate() + 1)) {
    const key = dateKey(d)
    const day = days[key]
    const template = day?.templateId ? templates.find(t => t.id === day.templateId) : undefined
    const score = dayScore(day?.tasks ?? [], day?.dayType)

    cells.push({
      key,
      date: new Date(d),
      month: d.getMonth(),
      weekday,
      weekIndex,
      templateColor: template?.color,
      templateName: template?.name,
      planned: score.planned,
      complete: score.planned && score.done === score.total,
    })

    if (weekday === 6) {
      weekday = 0
      weekIndex += 1
    } else {
      weekday += 1
    }
  }

  return cells
}

/** Which column each month's first day lands in, for a label above the grid. */
export interface MonthLabel {
  month: number
  weekIndex: number
}

export function monthLabelPositions(cells: YearCell[]): MonthLabel[] {
  const labels: MonthLabel[] = []
  let lastMonth = -1
  for (const cell of cells) {
    if (cell.month !== lastMonth) {
      labels.push({ month: cell.month, weekIndex: cell.weekIndex })
      lastMonth = cell.month
    }
  }
  return labels
}

/** How many columns the grid needs to fit every cell. */
export function weekCount(cells: YearCell[]): number {
  if (cells.length === 0) return 0
  return cells[cells.length - 1].weekIndex + 1
}

const DATE_FORMAT: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric', year: 'numeric' }

/**
 * The accessible name for one cell - a full date, plus the day's template
 * name and completion state if either applies. Deliberately never mentions
 * an empty day's absence of a plan; there is nothing to announce about a
 * day with nothing on it beyond the date itself. A planned day that is not
 * yet complete says so explicitly - "has unfinished tasks" - rather than
 * relying on the visible marker alone, the same honesty the month grid's
 * own cellLabel extends.
 */
export function formatYearCellLabel(cell: YearCell): string {
  const parts = [cell.date.toLocaleDateString('en-US', DATE_FORMAT)]
  if (cell.templateName) parts.push(cell.templateName)
  if (cell.complete) parts.push('completed')
  else if (cell.planned) parts.push('has unfinished tasks')
  return parts.join(', ')
}
