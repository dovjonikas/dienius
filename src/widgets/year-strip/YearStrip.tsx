import { useEffect, useMemo, useRef, useState } from 'react'
import { useAppData } from '../../lib/store'
import { addDays, todayKey } from '../../lib/dates'
import { buildYearCells, formatYearCellLabel, monthLabelPositions, weekCount, type YearCell } from './yearGrid'

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

// Only the days that stay legible at cell scale get a letter; the rest are
// present as empty slots so the row still lines up with the grid below it.
const WEEKDAY_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', '']

interface YearStripProps {
  onOpenDay: (date: string) => void
}

/**
 * A year-at-a-glance strip: one cell per day, colored by that day's
 * template. It deliberately does not aggregate anything - no total, no
 * percentage, no streak - see `docs/DECISIONS.md`. What it shows is
 * texture: which days had which kind of shape, and roughly when, nothing
 * more.
 *
 * 365 cells is too many to make each one its own stop in the page's tab
 * order - that is the same hostility a GitHub-style contribution graph is
 * usually accused of. Instead the grid is one stop, using the standard
 * roving-tabindex pattern a calendar date grid would use: arrow keys move
 * a single focus point from day to day, and only the focused cell's date
 * (plus its template and completion, if any) is ever announced.
 */
export function YearStrip({ onOpenDay }: YearStripProps) {
  const data = useAppData()
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const today = todayKey()
  const gridRef = useRef<HTMLDivElement>(null)
  const pendingFocusKey = useRef<string | null>(null)

  const cells = useMemo(() => buildYearCells(year, data.days, data.templates), [year, data.days, data.templates])
  const months = useMemo(() => monthLabelPositions(cells), [cells])
  const columns = weekCount(cells)

  // A cell is too small to carry its template's name as text, so color ends
  // up doing the work alone in the grid itself - this list is the other
  // channel: which templates actually appear in the year on screen, named
  // next to their color, the same way a template's name already sits next
  // to its color everywhere else in the app. Built from the templates this
  // year's cells actually reference, not the full template list, so a
  // template stamped only in some other year does not show up here.
  const usedTemplates = useMemo(() => {
    const seen = new Map<string, string>()
    for (const cell of cells) {
      if (cell.templateColor && cell.templateName && !seen.has(cell.templateColor)) {
        seen.set(cell.templateColor, cell.templateName)
      }
    }
    return Array.from(seen, ([color, name]) => ({ color, name }))
  }, [cells])

  const defaultActiveKey = year === currentYear ? today : `${year}-01-01`
  const [activeKey, setActiveKey] = useState(defaultActiveKey)

  // Changing year moves the roving tab stop back to a sensible default
  // (today, if the new year is the current one) without stealing focus -
  // a person just browsing years by clicking the nav buttons should not
  // suddenly find keyboard focus yanked into the grid.
  useEffect(() => {
    setActiveKey(year === currentYear ? today : `${year}-01-01`)
  }, [year, currentYear, today])

  useEffect(() => {
    if (!pendingFocusKey.current) return
    const key = pendingFocusKey.current
    pendingFocusKey.current = null
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${key}"]`)?.focus()
  }, [activeKey])

  function moveFocusTo(key: string) {
    if (!key.startsWith(String(year))) return
    pendingFocusKey.current = key
    setActiveKey(key)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, cell: YearCell) {
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault()
        moveFocusTo(addDays(cell.key, -1))
        return
      case 'ArrowRight':
        e.preventDefault()
        moveFocusTo(addDays(cell.key, 1))
        return
      case 'ArrowUp':
        e.preventDefault()
        moveFocusTo(addDays(cell.key, -7))
        return
      case 'ArrowDown':
        e.preventDefault()
        moveFocusTo(addDays(cell.key, 7))
        return
      case 'Home':
        e.preventDefault()
        moveFocusTo(`${year}-01-01`)
        return
      case 'End':
        e.preventDefault()
        moveFocusTo(`${year}-12-31`)
        return
      default:
        return
    }
  }

  function shiftYear(delta: number) {
    setYear(y => y + delta)
  }

  return (
    <section className="year-strip">
      <div className="calendar-nav">
        <button aria-label="Previous year" onClick={() => shiftYear(-1)}>&larr;</button>
        <h2>{year}</h2>
        <button aria-label="Next year" onClick={() => shiftYear(1)}>&rarr;</button>
      </div>

      <div className="year-scroll">
        <div className="year-weekdays" aria-hidden="true">
          {WEEKDAY_LABELS.map((label, i) => (
            <span key={i}>{label}</span>
          ))}
        </div>
        <div className="year-grid-scroll">
          <div
            className="year-grid"
            role="grid"
            aria-label={`Days of ${year}`}
            aria-describedby="year-strip-legend"
            ref={gridRef}
            style={{ gridTemplateColumns: `repeat(${Math.max(columns, 1)}, var(--year-cell))` }}
          >
            {months.map(m => (
              <span
                key={m.month}
                aria-hidden="true"
                className="year-month-label"
                style={{ gridColumn: m.weekIndex + 1, gridRow: 1 }}
              >
                {MONTH_LABELS[m.month]}
              </span>
            ))}
            {cells.map(cell => {
              const isToday = cell.key === today
              const classNames = ['year-cell']
              if (cell.complete) classNames.push('year-cell-complete')
              if (isToday) classNames.push('today')
              return (
                <button
                  key={cell.key}
                  type="button"
                  role="gridcell"
                  data-date={cell.key}
                  className={classNames.join(' ')}
                  style={{
                    gridColumn: cell.weekIndex + 1,
                    gridRow: cell.weekday + 2,
                    background: cell.templateColor,
                  }}
                  tabIndex={cell.key === activeKey ? 0 : -1}
                  aria-current={isToday ? 'date' : undefined}
                  aria-label={formatYearCellLabel(cell)}
                  onFocus={() => setActiveKey(cell.key)}
                  onKeyDown={e => handleKeyDown(e, cell)}
                  onClick={() => onOpenDay(cell.key)}
                />
              )
            })}
          </div>
        </div>
      </div>

      {usedTemplates.length > 0 && (
        <div className="year-template-legend">
          {usedTemplates.map(t => (
            <span key={t.color} className="year-legend-chip" style={{ background: t.color }}>
              {t.name}
            </span>
          ))}
        </div>
      )}

      <p id="year-strip-legend" className="muted year-strip-legend">
        A colored cell had a plan for that day. A ringed cell means everything planned for that
        day was done.
      </p>
    </section>
  )
}
