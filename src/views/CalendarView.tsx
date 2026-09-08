import { useEffect, useMemo, useRef, useState } from 'react'
import { actions, useAppData } from '../lib/store'
import { addDays, formatWeekTitle, monthGrid, todayKey, weekOf, type MonthCell } from '../lib/dates'
import { dateFromArrow, tabStopFor } from '../lib/gridKeys'
import { dayStat, keptEveryKeyTask, monthSummary, summaryLine } from '../lib/dayStats'
import { cellLabel, cellPoints, resolveTemplate, taskState } from '../lib/calendarCell'
import { DayCard } from './DayCard'
import { useCellLines, useIsWide } from '../lib/viewport'
import { NARROW_DAYS, WeekView, visibleWeekDays, type WeekReading } from './week/WeekView'
import { planWeekStamp, weekStampMessage } from './week/weekStamp'
import { Explain } from './Explain'
import { requestReplan } from '../lib/replanState'
import { hasJournal } from '../lib/journal'
import { datesWithNotes } from '../lib/scratch'


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
  /**
   * The date the week mode is centred on. Optional, with today as the
   * fallback, so every existing render of this view - and every test that
   * predates Week - keeps working with no wiring change.
   */
  date?: string
  onDateChange?: (date: string) => void
  /**
   * What was written on one day: the stream read at that day, and that day's
   * journal. Both optional, so every existing render of this view keeps
   * working with no wiring change - the buttons simply do nothing rather
   * than the whole component requiring the shell's two overlays.
   */
  onOpenNotes?: (date: string) => void
  onOpenJournal?: (date: string) => void
}

export function CalendarView({
  onOpenDay,
  onOpenTemplates,
  date,
  onDateChange,
  onOpenNotes,
  onOpenJournal,
}: CalendarViewProps) {
  const data = useAppData()
  const now = new Date()
  // Month first, then Week: the larger scale is the one the tab opens on,
  // and the segment reads down from it. See WeekView.tsx for why this is a
  // mode here rather than a seventh tab.
  const [mode, setMode] = useState<'month' | 'week'>('month')
  const [weekDate, setWeekDate] = useState(() => date ?? todayKey())
  const isWide = useIsWide()
  const cellLines = useCellLines()
  // The week's own controls sit in the calendar bar, on the same row as the
  // mode toggle, rather than in a row of their own inside the week: on a
  // phone that row cost a fifth of the grid it was steering.
  const weekDays = useMemo(() => visibleWeekDays(weekDate, isWide), [weekDate, isWide])
  const weekStamp = useMemo(() => planWeekStamp(weekOf(weekDate), data), [weekDate, data])
  const [weekAnnouncement, setWeekAnnouncement] = useState('')
  function changeWeekDate(next: string) {
    setWeekDate(next)
    onDateChange?.(next)
  }
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [stampTemplateId, setStampTemplateId] = useState<string | null>(null)
  const [staged, setStaged] = useState<Record<string, string | null>>({})
  const [reading, setReading] = useState<WeekReading>('grid')
  // Which day is open, and null every other moment. A press opens it and it
  // stays open until it is closed - see DayCard.tsx for why the 400ms hover
  // that used to do this could not work.
  const [openDate, setOpenDate] = useState<string | null>(null)
  const painting = useRef<'apply' | 'erase' | null>(null)
  // One tab stop for the whole grid and the arrows to walk it - the same
  // roving pattern as the day view's mini calendar, for the same reason:
  // forty-two buttons were forty-two Tabs. See lib/gridKeys.ts.
  const [roving, setRoving] = useState<string | null>(null)
  const [pendingFocus, setPendingFocus] = useState<string | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  const cells = useMemo(() => monthGrid(year, month), [year, month])
  // Over the month's real days only, not the six-week grid - a February
  // summary should not be diluted by the March days shown around it.
  const summary = useMemo(
    () => summaryLine(monthSummary(data.days, cells.filter(c => c.inMonth).map(c => c.key))),
    [data.days, cells],
  )
  const weeks = useMemo(() => weeksOf(cells), [cells])
  const today = todayKey()
  const tabStop = tabStopFor(cells, [roving, date, today])
  // One walk of the stream for the whole grid rather than one per cell - see
  // datesWithNotes.
  const noteDays = useMemo(() => datesWithNotes(data.scratch), [data.scratch])
  // Read during render rather than held in state: the card is drawn in the
  // same pass as the grid it is anchored to, so the cell is already there.
  const anchorEl = openDate ? gridRef.current?.querySelector<HTMLElement>(`[data-date="${openDate}"]`) ?? null : null

  useEffect(() => {
    if (!pendingFocus) return
    const el = gridRef.current?.querySelector<HTMLElement>(`[data-date="${pendingFocus}"]`)
    if (!el) return
    el.focus()
    setPendingFocus(null)
  }, [pendingFocus, year, month])

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
    const [y, m] = next.split('-').map(Number)
    setYear(y)
    setMonth(m - 1)
    setPendingFocus(next)
  }

  function shiftMonth(delta: number) {
    const d = new Date(year, month + delta, 1)
    setYear(d.getFullYear())
    setMonth(d.getMonth())
    // The card is anchored to a cell, and turning the month takes that cell
    // off the screen. Nothing to anchor to is nothing to show.
    setOpenDate(null)
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
    // A template in hand turns every cell into a brush, and a card standing
    // over four of them is a card in the way of the stroke.
    setOpenDate(null)
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
          screen whose whole job is to fit a month of squares without
          scrolling. */}
      <div className="calendar-bar">
        {mode === 'month' ? (
          <div className="calendar-nav">
            <button aria-label="Previous month" onClick={() => shiftMonth(-1)}>&larr;</button>
            <h2>{MONTHS[month]} {year}</h2>
            <button aria-label="Next month" onClick={() => shiftMonth(1)}>&rarr;</button>
          </div>
        ) : (
          <>
            <div className="calendar-nav">
              <button
                aria-label={isWide ? 'Previous week' : 'Earlier days'}
                onClick={() => changeWeekDate(addDays(weekDate, isWide ? -7 : -NARROW_DAYS))}
              >
                &larr;
              </button>
              {/* The days actually on screen, short-form on a phone so the
                  title and its arrows share one row with Today. */}
              <h2>{formatWeekTitle(weekDays, { short: !isWide })}</h2>
              <button
                aria-label={isWide ? 'Next week' : 'Later days'}
                onClick={() => changeWeekDate(addDays(weekDate, isWide ? 7 : NARROW_DAYS))}
              >
                &rarr;
              </button>
            </div>
            <button type="button" className="btn-secondary calendar-today" onClick={() => changeWeekDate(todayKey())}>
              Today
            </button>
            {/* The phone rings while the week is the screen that shows the
                day it is about. Opens the one sheet over the week, on the
                day the week is centred on when that day is still ahead, and
                the sheet's own row moves it. */}
            <button
              type="button"
              className="btn-secondary calendar-came-up"
              onClick={() => requestReplan('interrupt', weekDate >= today ? weekDate : today)}
            >
              Something came up
            </button>
            {/* Only where there is a mapping to apply, and only on a screen
                that shows the week it would stamp. A button that explains it
                cannot do anything is worse than a button that is not there,
                and "Stamp week" above three days is a promise about four
                days you cannot see. */}
            {isWide && weekStamp.mapped > 0 && (
              <button
                type="button"
                className="btn-secondary"
                disabled={Object.keys(weekStamp.stamps).length === 0}
                data-tip={
                  Object.keys(weekStamp.stamps).length === 0
                    ? 'Nothing left to stamp this week'
                    : 'Stamp the days your weekday plan names, leaving anything you have already arranged alone'
                }
                onClick={() => {
                  if (Object.keys(weekStamp.stamps).length > 0) actions.stamp(weekStamp.stamps)
                  setWeekAnnouncement(weekStampMessage(weekStamp))
                }}
              >
                Stamp week
              </button>
            )}
            <p className="visually-hidden" aria-live="polite">{weekAnnouncement}</p>
          </>
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
            className={mode === 'week' ? 'active' : ''}
            aria-pressed={mode === 'week'}
            onClick={() => setMode('week')}
          >
            Week
          </button>
        </div>

        {/* Only while the week is showing, and after the mode it belongs to,
            because it is a question about that mode rather than about the
            calendar. Grid is the default: the shape of a week is the thing
            this view was built for, and a list is what every other screen in
            this app already is. */}
        {mode === 'week' && (
          <div className="segmented segmented-quiet" role="group" aria-label="How to read the week">
            <button
              type="button"
              className={reading === 'grid' ? 'active' : ''}
              aria-pressed={reading === 'grid'}
              onClick={() => setReading('grid')}
            >
              Grid
            </button>
            <button
              type="button"
              className={reading === 'agenda' ? 'active' : ''}
              aria-pressed={reading === 'agenda'}
              onClick={() => setReading('agenda')}
            >
              Agenda
            </button>
          </div>
        )}
      </div>

      {mode === 'month' && (
        <>

          {data.templates.length > 0 && (
            <div className="stamp-bar">
              <Explain id="stamp">
                <span className="muted">Stamp</span>
              </Explain>
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

          <div
            ref={gridRef}
            className="calendar-grid"
            role="grid"
            aria-label={`${MONTHS[month]} ${year}`}
            onKeyDown={onGridKeyDown}
            onFocus={e => {
              const focused = (e.target as HTMLElement).dataset.date
              if (focused) setRoving(focused)
            }}
          >
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
                  // A day that is over. The future has nothing to report and
                  // says nothing - a "0/9" on Thursday is not information, it
                  // is an accusation about a day that has not started - and
                  // neither has today, which is still being lived.
                  const past = cell.key < today
                  const stat = past ? dayStat(data.days[cell.key]) : undefined
                  const showStats = !!stat && stat.rate !== null
                  // Every day shows what is on it, the same way: two or three
                  // lines, decided by the viewport's height - see useCellLines
                  // for why that decision cannot live in the stylesheet - and
                  // "+N" for the rest. A day that is over gives the last line
                  // to how it went, so the cell's height never changes for
                  // it. Below 600px the lines are hidden the way the template
                  // name already was. Until v2.4 a past day was its score and
                  // a future day its lines, and the month read as two
                  // different calendars meeting at today.
                  const points = cellPoints(data.days[cell.key], showStats ? Math.max(1, cellLines - 1) : cellLines)
                  // Whether anything is written on the day. Two marks, never
                  // a number and never a colour that means a value - see the
                  // .cell-written rules in the stylesheet.
                  const journalled = hasJournal(data.days[cell.key])
                  const noted = noteDays.has(cell.key)
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
                      tabIndex={cell.key === tabStop ? 0 : -1}
                      className={classes}
                      // The colour as a variable, not a fill: the stylesheet
                      // mixes a wash of it into the theme's own surface and
                      // draws a strip of it along the top, so the theme's
                      // inks stay readable on a stamped day. A solid pastel
                      // fill with dark ink pinned on it was a piece of the
                      // light theme sitting in the dark one.
                      style={template ? ({ ['--chip' as string]: template.color } as React.CSSProperties) : undefined}
                      aria-label={cellLabel(cell, template?.name, state, { journal: journalled, note: noted })}
                      aria-current={cell.key === today ? 'date' : undefined}
                      aria-expanded={stampTemplateId ? undefined : openDate === cell.key}
                      onPointerDown={e => handlePointerDown(cell.key, e)}
                      onPointerEnter={() => handlePointerEnter(cell.key)}
                      // A press opens the day's card, here, against this
                      // cell. Opening the day itself is one of the things on
                      // it, because the month is what somebody came to the
                      // month for and leaving it should be asked for.
                      onClick={() => !stampTemplateId && setOpenDate(cell.key)}
                    >
                      <span className="cell-num" aria-hidden="true">{Number(cell.key.slice(8))}</span>
                      {showStats && (
                        <span className="cell-stats" aria-hidden="true">
                          <span className="cell-ratio">
                            {stat!.done}/{stat!.total}
                          </span>
                          {stat!.pushed > 0 && <span className="cell-pushed">&rarr;{stat!.pushed}</span>}
                          {keptEveryKeyTask(stat!) && <span className="cell-kept" />}
                        </span>
                      )}
                      {points.points.length > 0 ? (
                        /* What is actually on the day, rather than what the
                           shape of day was called. A template's name is a
                           word somebody chose two months ago; "09:00 Job
                           hunt" is Thursday. The third line is dropped by
                           the stylesheet where a cell is too short for it -
                           the cell's height never grows for this. */
                        <span className="cell-points" aria-hidden="true">
                          {points.points.map(p => (
                            <span key={p.id} className={p.key ? 'cell-point is-key' : 'cell-point'}>
                              {p.time && <span className="cell-point-time">{p.time}</span>}
                              <span className="cell-point-title">{p.title}</span>
                            </span>
                          ))}
                          {points.more > 0 && <span className="cell-more">+{points.more}</span>}
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
                      {/* Something is written on this day, and that is all
                          either mark says. The journal's is filled and a
                          note's is an outline of the same ink, both in the
                          corner the number is not in. */}
                      {(journalled || noted) && (
                        <span className="cell-written" aria-hidden="true">
                          {journalled && <span className="cell-written-journal" />}
                          {noted && <span className="cell-written-note" />}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>

          {/* After the grid in the document, so Tab from the cell that opened
              it walks straight into it, and outside the grid so that its own
              buttons are not buttons inside a button. Placed against its cell
              by measurement - see dayCardPlacement.ts. */}
          {openDate && (
            <DayCard
              // Keyed on the day, so walking the grid with the arrows and
              // pressing Enter on a second cell builds a new card rather than
              // moving this one - which would carry an armed "Clear 9 tasks
              // from Wednesday?" over onto Thursday.
              key={openDate}
              date={openDate}
              anchor={anchorEl}
              bounds={gridRef.current}
              onClose={() => setOpenDate(null)}
              onOpenDay={() => onOpenDay(openDate)}
              onOpenNotes={() => onOpenNotes?.(openDate)}
              onOpenJournal={() => onOpenJournal?.(openDate)}
              onInterrupt={openDate >= today ? () => requestReplan('interrupt', openDate) : undefined}
            />
          )}

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

      {mode === 'week' && (
        <WeekView date={weekDate} onDateChange={changeWeekDate} onOpenDay={onOpenDay} reading={reading} />
      )}
    </section>
  )
}

