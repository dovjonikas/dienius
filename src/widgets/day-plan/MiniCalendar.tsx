import { useEffect, useRef, useState } from 'react'
import { useAppData } from '../../lib/store'
import { monthGrid, todayKey, type MonthCell } from '../../lib/dates'
import { cellLabel, resolveTemplate, taskState } from '../../lib/calendarCell'
import { dateFromArrow, tabStopFor } from '../../lib/gridKeys'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

// Same split CalendarView.tsx already uses, for the same reason: role="grid"
// requires role="row" children wrapping the role="gridcell" buttons.
function weeksOf(cells: MonthCell[]): MonthCell[][] {
  const weeks: MonthCell[][] = []
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7))
  }
  return weeks
}

function monthOf(dateKey: string): { year: number; month: number } {
  const [y, m] = dateKey.split('-').map(Number)
  return { year: y, month: m - 1 }
}

export interface MiniCalendarProps {
  /** The date currently open in the day view - shown with its own visual
   * mark, distinct from today's, and what decides which month opens on
   * mount and on any later change from outside (the day-nav arrows). */
  date: string
  /** The exact callback DayView already receives from its own caller - no
   * new prop wiring needed above DayView, see docs/LAYOUT-WIDE.md
   * section 5. */
  onDateChange: (date: string) => void
}

/**
 * A small month grid for fast date navigation without leaving the day
 * being planned - docs/LAYOUT-WIDE.md section 3.1. Read-only: no paint-drag,
 * no stamping (that stays a Calendar-tab action, unchanged). Reuses the
 * exact cell rules CalendarView.tsx already established
 * (monthGrid, calendarCell.ts's taskState/resolveTemplate/cellLabel)
 * rather than inventing a second navigation model. Rendered only when
 * useIsWide() is true - see DayView.tsx.
 *
 * ## One tab stop, and the arrows
 *
 * Thirty-five buttons were thirty-five tab stops, and they sat between the
 * navigation rail and everything on the day: the quick-add field was the
 * sixtieth Tab from the top of the page. A grid is one stop - the day
 * being viewed, or today, or the first of the month - and the arrow keys
 * walk it, turning the month when they walk off its edge. The cell that
 * was last focused keeps the stop, so leaving the grid and coming back
 * lands where the person left. The arithmetic is `lib/gridKeys.ts`.
 */
export function MiniCalendar({ date, onDateChange }: MiniCalendarProps) {
  const data = useAppData()
  const [{ year, month }, setYearMonth] = useState(() => monthOf(date))
  // The cell the keyboard last rested on, when that differs from the viewed
  // day; and a cell to focus once a month turned by an arrow is drawn.
  const [roving, setRoving] = useState<string | null>(null)
  const [pending, setPending] = useState<string | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  // Follows the day currently open across a month boundary - stepping the
  // day view's own prev/next day arrows across, say, the 1st of a month
  // should not leave this rail showing a month with nothing highlighted in
  // it. A person who has browsed the mini calendar itself to a different
  // month is not fighting this: it only re-syncs when `date` itself
  // changes, which happens by clicking a cell here or the day-nav arrows,
  // never by this component's own month navigation below.
  useEffect(() => {
    setYearMonth(monthOf(date))
  }, [date])

  useEffect(() => {
    if (!pending) return
    const el = gridRef.current?.querySelector<HTMLElement>(`[data-date="${pending}"]`)
    if (!el) return
    el.focus()
    setPending(null)
  }, [pending, year, month])

  const cells = monthGrid(year, month)
  const weeks = weeksOf(cells)
  const today = todayKey()
  const stop = tabStopFor(cells, [roving, date, today])

  function shiftMonth(delta: number) {
    const d = new Date(year, month + delta, 1)
    setYearMonth({ year: d.getFullYear(), month: d.getMonth() })
  }

  function onGridKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const from = (e.target as HTMLElement).dataset.date
    if (!from) return
    const next = dateFromArrow(e.key, from)
    if (!next) return
    e.preventDefault()
    const el = gridRef.current?.querySelector<HTMLElement>(`[data-date="${next}"]`)
    if (el) {
      el.focus()
      return
    }
    // Off the edge of the grid: turn the month, then focus once it is drawn.
    setYearMonth(monthOf(next))
    setPending(next)
  }

  return (
    <div className="mini-calendar">
      <div className="mini-calendar-nav">
        <button type="button" aria-label="Previous month" onClick={() => shiftMonth(-1)}>
          &larr;
        </button>
        <span className="mini-calendar-title">{MONTHS[month]} {year}</span>
        <button type="button" aria-label="Next month" onClick={() => shiftMonth(1)}>
          &rarr;
        </button>
      </div>

      <div
        ref={gridRef}
        className="mini-calendar-grid"
        role="grid"
        aria-label={`${MONTHS[month]} ${year}`}
        onKeyDown={onGridKeyDown}
        onFocus={e => {
          const focused = (e.target as HTMLElement).dataset.date
          if (focused) setRoving(focused)
        }}
      >
        {/* display: contents keeps this row invisible to the CSS grid that
            lays cells out in seven columns, while still nesting it under
            the grid in the DOM - the same technique CalendarView.tsx's own
            week rows already use, which is what role="row" needs to be
            valid here. */}
        <div role="row" style={{ display: 'contents' }}>
          {WEEKDAYS.map(d => (
            <span key={d} role="columnheader" className="mini-weekday" aria-label={d}>
              {d[0]}
            </span>
          ))}
        </div>
        {weeks.map((week, i) => (
          <div key={i} role="row" style={{ display: 'contents' }}>
            {week.map(cell => {
              const template = resolveTemplate(data.days[cell.key]?.templateId, data.templates)
              const state = taskState(data.days[cell.key])
              const classes = [
                'mini-cell',
                cell.inMonth ? '' : 'outside',
                cell.key === today ? 'today' : '',
                cell.key === date ? 'viewing' : '',
                template ? 'mini-cell-has-template' : '',
                state !== 'none' ? 'mini-cell-has-tasks' : '',
              ].filter(Boolean).join(' ')
              return (
                <button
                  key={cell.key}
                  type="button"
                  role="gridcell"
                  className={classes}
                  data-date={cell.key}
                  tabIndex={cell.key === stop ? 0 : -1}
                  style={template ? { background: template.color } : undefined}
                  aria-label={cellLabel(cell, template?.name, state)}
                  aria-current={cell.key === today ? 'date' : undefined}
                  onClick={() => onDateChange(cell.key)}
                >
                  {Number(cell.key.slice(8))}
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
