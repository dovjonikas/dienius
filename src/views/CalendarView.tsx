import { useEffect, useMemo, useRef, useState } from 'react'
import { actions, useAppData } from '../lib/store'
import { monthGrid, todayKey, type MonthCell } from '../lib/dates'
import { dayStat, keptEveryKeyTask, monthSummary, summaryLine, type DayStat } from '../lib/dayStats'
import { formatDuration } from '../widgets/day-plan/capacity'
import { cellLabel, resolveTemplate, taskState } from '../lib/calendarCell'
import { YearStrip } from '../widgets/year-strip/YearStrip'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

// monthGrid always returns 6 complete weeks of 7 days, Monday first - see
// dates.ts. Splitting it back into weeks here is what lets the grid wrap
// each week in its own role="row", which role="grid" requires of a
// role="gridcell" child.
function weeksOf(cells: MonthCell[]): MonthCell[][] {
  const weeks: MonthCell[][] = []
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7))
  }
  return weeks
}

// cellLabel, taskState and resolveTemplate moved to lib/calendarCell.ts -
// docs/LAYOUT-WIDE.md section 5, build step 5 - so MiniCalendar.tsx can
// share the exact same rules instead of re-deriving them. No behaviour
// change here; this file just imports them back.

interface CalendarViewProps {
  onOpenDay: (date: string) => void
  /**
   * Switches to the Templates tab - only used to point at it from the
   * empty-templates message below. Optional so every existing render of
   * this view (and every existing test) keeps working with no prop at
   * all; the button that needs it simply falls back to doing nothing
   * rather than the whole component requiring a wiring change everywhere
   * it is used just to add one message.
   */
  onOpenTemplates?: () => void
}

export function CalendarView({ onOpenDay, onOpenTemplates }: CalendarViewProps) {
  const data = useAppData()
  const now = new Date()
  const [mode, setMode] = useState<'month' | 'year'>('month')
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [stampTemplateId, setStampTemplateId] = useState<string | null>(null)
  const [staged, setStaged] = useState<Record<string, string | null>>({})
  const painting = useRef<'apply' | 'erase' | null>(null)

  const cells = useMemo(() => monthGrid(year, month), [year, month])
  // Over the month's real days only, not the six-week grid - a February
  // summary should not be diluted by the March days shown around it.
  const summary = useMemo(
    () => summaryLine(monthSummary(data.days, cells.filter(c => c.inMonth).map(c => c.key))),
    [data.days, cells],
  )
  const weeks = useMemo(() => weeksOf(cells), [cells])
  const today = todayKey()

  function shiftMonth(delta: number) {
    const d = new Date(year, month + delta, 1)
    setYear(d.getFullYear())
    setMonth(d.getMonth())
  }

  function effectiveTemplateId(date: string): string | null {
    if (date in staged) return staged[date]
    return data.days[date]?.templateId ?? null
  }

  function stampCell(date: string, mode: 'apply' | 'erase') {
    if (!stampTemplateId) return
    setStaged(prev => ({ ...prev, [date]: mode === 'apply' ? stampTemplateId : null }))
  }

  function handlePointerDown(date: string, e: React.PointerEvent<HTMLButtonElement>) {
    if (!stampTemplateId) return
    // Touch devices capture the pointer to the element the gesture started on,
    // so onPointerEnter never fires on the cells the finger later passes over.
    // Releasing capture here lets the browser deliver pointer events to
    // whatever cell is actually under the finger as it moves.
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    const mode = effectiveTemplateId(date) === stampTemplateId ? 'erase' : 'apply'
    painting.current = mode
    stampCell(date, mode)
  }

  function handlePointerEnter(date: string) {
    if (painting.current) stampCell(date, painting.current)
  }

  function handlePointerMove(e: React.PointerEvent<HTMLElement>) {
    if (!painting.current) return
    const el = document.elementFromPoint(e.clientX, e.clientY)
    const date = el?.closest<HTMLElement>('[data-date]')?.dataset.date
    if (date) stampCell(date, painting.current)
  }

  function endPainting() {
    painting.current = null
  }

  // A finger can lift outside the calendar section entirely (over the browser
  // chrome, or past the edge of the viewport during a fast drag), in which case
  // the section's own onPointerUp/onPointerLeave never fire. Listening on the
  // document guarantees painting always stops, so a stray hover afterward
  // cannot keep stamping cells.
  useEffect(() => {
    document.addEventListener('pointerup', endPainting)
    document.addEventListener('pointercancel', endPainting)
    return () => {
      document.removeEventListener('pointerup', endPainting)
      document.removeEventListener('pointercancel', endPainting)
    }
  }, [])

  function selectTemplate(id: string) {
    setStampTemplateId(prev => (prev === id ? null : id))
  }

  function save() {
    actions.stamp(staged)
    setStaged({})
    setStampTemplateId(null)
  }

  function cancel() {
    setStaged({})
    setStampTemplateId(null)
  }

  const stagedCount = Object.keys(staged).length
  const hasChanges = stagedCount > 0

  return (
    <section
      className="calendar"
      onPointerUp={endPainting}
      onPointerLeave={endPainting}
      onPointerCancel={endPainting}
      onPointerMove={handlePointerMove}
    >
      {/* One row: the arrows, the month, and the mode toggle. It used to be
          three stacked blocks, which cost about 130px of vertical space on a
          screen whose whole job is to fit twelve months of squares without
          scrolling. */}
      <div className="calendar-bar">
        {mode === 'month' ? (
          <div className="calendar-nav">
            <button aria-label="Previous month" onClick={() => shiftMonth(-1)}>&larr;</button>
            <h2>{MONTHS[month]} {year}</h2>
            <button aria-label="Next month" onClick={() => shiftMonth(1)}>&rarr;</button>
          </div>
        ) : (
          <div className="calendar-nav">
            <h2>{year}</h2>
          </div>
        )}

        {/* One quiet line about the month, where a heading's subtitle would
            be. Never on a month nobody used - see summaryLine. */}
        {mode === 'month' && summary && <span className="calendar-summary">{summary}</span>}

        <div className="segmented" role="group" aria-label="Calendar view">
          <button
            type="button"
            className={mode === 'month' ? 'active' : ''}
            aria-pressed={mode === 'month'}
            onClick={() => setMode('month')}
          >
            Month
          </button>
          <button
            type="button"
            className={mode === 'year' ? 'active' : ''}
            aria-pressed={mode === 'year'}
            onClick={() => setMode('year')}
          >
            Year
          </button>
        </div>
      </div>

      {mode === 'month' && (
        <>

          {data.templates.length > 0 && (
            <div className="stamp-bar">
              <span className="muted">Stamp:</span>
              {data.templates.map(t => (
                <button
                  key={t.id}
                  className={stampTemplateId === t.id ? 'template-chip selected' : 'template-chip'}
                  aria-pressed={stampTemplateId === t.id}
                  style={{ ['--chip' as string]: t.color } as React.CSSProperties}
                  onClick={() => selectTemplate(t.id)}
                >
                  <span className="template-chip-dot" aria-hidden="true" />
                  {t.name}
                </button>
              ))}
            </div>
          )}

          {/* Without this, an install with no templates yet just shows a
              month grid with no stamp bar and no explanation for why - a
              silent gap rather than a dead end that says what to do about
              it. */}
          {data.templates.length === 0 && (
            <div className="stamp-bar-empty">
              <p className="muted">No templates yet, so there is nothing here to stamp onto a day.</p>
              <button type="button" className="btn-primary" onClick={onOpenTemplates}>Create a template</button>
            </div>
          )}

          <div className="calendar-grid" role="grid" aria-label={`${MONTHS[month]} ${year}`}>
            {/* display: contents keeps this row invisible to the CSS grid
                that lays cells out in seven columns across the whole
                .calendar-grid, while still nesting it under the grid in the
                DOM - which is what role="row" needs to be valid here. */}
            <div role="row" style={{ display: 'contents' }}>
              {WEEKDAYS.map(d => (
                <span key={d} role="columnheader" className="weekday">{d}</span>
              ))}
            </div>
            {weeks.map((week, i) => (
              <div key={i} role="row" style={{ display: 'contents' }}>
                {week.map(cell => {
                  const templateId = effectiveTemplateId(cell.key)
                  const template = resolveTemplate(templateId, data.templates)
                  const state = taskState(data.days[cell.key])
                  // A day that has happened, or is happening. The future has
                  // nothing to report and says nothing - a "0/9" on Thursday
                  // is not information, it is an accusation about a day that
                  // has not started.
                  const past = cell.key <= today
                  const stat = past ? dayStat(data.days[cell.key]) : undefined
                  const showStats = !!stat && stat.rate !== null
                  const classes = [
                    'cell',
                    cell.inMonth ? '' : 'outside',
                    cell.key === today ? 'today' : '',
                    cell.key in staged ? 'staged' : '',
                    template ? 'cell-has-template' : '',
                    state !== 'none' ? 'cell-has-tasks' : '',
                    state === 'done' ? 'cell-tasks-done' : '',
                    showStats ? `cell-tone-${stat!.tone}` : '',
                  ].filter(Boolean).join(' ')
                  return (
                    <button
                      key={cell.key}
                      role="gridcell"
                      data-date={cell.key}
                      className={classes}
                      style={template ? { background: template.color } : undefined}
                      aria-label={cellLabel(cell, template?.name, state)}
                      aria-current={cell.key === today ? 'date' : undefined}
                      // The fuller summary on a pointer. A title rather than a
                      // custom tooltip: it is a handful of numbers on hover, it
                      // costs nothing, and it is one less thing that can be left
                      // open when the pointer moves away.
                      title={showStats ? cellTooltip(stat!, template?.name) : undefined}
                      onPointerDown={e => handlePointerDown(cell.key, e)}
                      onPointerEnter={() => handlePointerEnter(cell.key)}
                      onClick={() => !stampTemplateId && onOpenDay(cell.key)}
                    >
                      <span className="cell-num" aria-hidden="true">{Number(cell.key.slice(8))}</span>
                      {showStats ? (
                        <span className="cell-stats" aria-hidden="true">
                          <span className="cell-ratio">
                            {stat!.done}/{stat!.total}
                          </span>
                          {stat!.pushed > 0 && <span className="cell-pushed">&rarr;{stat!.pushed}</span>}
                          {keptEveryKeyTask(stat!) && <span className="cell-kept" />}
                        </span>
                      ) : (
                        template && <span className="cell-template" aria-hidden="true">{template.name}</span>
                      )}
                      {/* The bar, along the bottom edge. A ring in a corner was
                          the other option and lost: a 52px cell has no corner to
                          spare, and a bar reads as a proportion at two pixels
                          where a ring needs eight. */}
                      {showStats && (
                        <span className="cell-bar" aria-hidden="true">
                          <span className="cell-bar-fill" style={{ width: `${Math.round((stat!.rate ?? 0) * 100)}%` }} />
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>

          {hasChanges && (
            <div className="stamp-actions">
              <p className="muted stamp-count">
                {stagedCount} {stagedCount === 1 ? 'day' : 'days'} staged
              </p>
              <div className="stamp-buttons">
                <button className="primary" onClick={save}>Save</button>
                <button className="btn-secondary" onClick={cancel}>Cancel</button>
              </div>
            </div>
          )}

          {stampTemplateId && !hasChanges && (
            <p className="muted stamp-hint">Click or drag across days to stamp. Click a stamped day to clear it.</p>
          )}
        </>
      )}

      {mode === 'year' && <YearStrip onOpenDay={onOpenDay} />}
    </section>
  )
}

/**
 * The fuller summary a pointer gets. Deliberately sentence-shaped rather than
 * a table of figures: it is read in passing, once, and a list of labelled
 * numbers takes longer to parse than the cell it is explaining.
 */
function cellTooltip(stat: DayStat, templateName: string | undefined): string {
  const parts: string[] = []
  if (templateName) parts.push(templateName)
  parts.push(`${stat.done} of ${stat.total} done`)
  if (stat.pushed > 0) parts.push(`${stat.pushed} carried on`)
  if (stat.highlights > 0) parts.push(`${stat.highlightsDone} of ${stat.highlights} key`)
  if (stat.focusMinutes > 0) parts.push(`${formatDuration(stat.focusMinutes)} deep work`)
  return parts.join(' - ')
}
