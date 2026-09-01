import { useEffect, useState } from 'react'
import { useAppData } from '../../lib/store'
import { monthGrid, todayKey, type MonthCell } from '../../lib/dates'
import { cellLabel, resolveTemplate, taskState } from '../../lib/calendarCell'

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
 */
export function MiniCalendar({ date, onDateChange }: MiniCalendarProps) {
  const data = useAppData()
  const [{ year, month }, setYearMonth] = useState(() => monthOf(date))

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

  const cells = monthGrid(year, month)
  const weeks = weeksOf(cells)
  const today = todayKey()

  function shiftMonth(delta: number) {
    const d = new Date(year, month + delta, 1)
    setYearMonth({ year: d.getFullYear(), month: d.getMonth() })
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

      <div className="mini-calendar-grid" role="grid" aria-label={`${MONTHS[month]} ${year}`}>
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
