import { useEffect, useMemo, useRef, useState } from 'react'
import { useRestoreFocus } from '../../lib/useRestoreFocus'
import type { Task } from '../../lib/types'
import { actions, useAppData } from '../../lib/store'
import { offerUndo } from '../../lib/undo'
import type { ReplanMode } from '../../lib/replanState'
import { todayKey } from '../../lib/dates'
import { columnFor } from '../../lib/stamping'
import { busyIntervals, useCalendarCache } from '../../lib/calendars'
import { isRoutine } from '../../lib/taskIdentity'
import { usePointerCoarse } from '../../lib/viewport'
import { formatDuration, parseTimeInput, timeToMinutes, windowFor, type Interval } from './capacity'
import { currentMinutes, formatClock } from './timelineLayout'
import { Explain } from '../../views/Explain'
import {
  capitalise,
  findConflicts,
  formatFreeWindows,
  freeWindows,
  planInterrupt,
  planRescue,
  planShift,
  splitByPlan,
  type ConflictChoice,
  type Interruption,
  type ReplanPlan,
} from './replan'
import { DEFAULT_TITLE, SHAPES, dayChoices, dayLabel, dayWordsFor, defaultChoices, roundUp, shapeInterval, type Preset } from './interrupt'
import { parseInterruptLine, resolveDay, stripTokens, withTitle } from './interruptParse'
import { readRecentTitles, rememberTitle } from './replanPrefs'

/**
 * The replan sheet - the ten seconds between "the plan just broke" and
 * "most of it still fits". See replan.ts for the arithmetic; this is only
 * the asking and the one press.
 *
 * Built for the moment it is used in, which is a stressed one: every screen
 * is one question, the answer is shown before it is accepted, and the
 * summary is written to be read in three seconds on a phone. Nothing is
 * applied until Accept, and Accept is one commit with one undo.
 *
 * Since v2.2 it is mounted at the root and reads the store itself, given a
 * day, because "Something came up" is about any day of the week: the phone
 * rings about Thursday while Tuesday is on screen. The other three doors -
 * shift the rest, away, back - are about today whatever day was asked for,
 * since "everything from now" has no meaning on a day that has not begun.
 */

export interface ReplanSheetProps {
  /**
   * The day an interruption lands on to begin with. The sheet's own WHEN row
   * changes it without leaving; a day that has passed is read as today.
   */
  date: string
  mode: ReplanMode
  onClose: () => void
}

const DURATIONS = [15, 30, 45, 60, 90, 120]
const SHIFTS = [15, 30, 60]

/** As on the day view: never more than half a minute behind the real clock. */
const NOW_TICK_MS = 30_000

/** Everything one day's arithmetic needs, read from the store for that day. */
interface DayContext {
  tasks: Task[]
  window: Interval
  busy: Interval[]
  away: string | undefined
}

export function ReplanSheet(props: ReplanSheetProps) {
  useRestoreFocus()
  const data = useAppData()
  const calendarCache = useCalendarCache()
  const [mode, setMode] = useState<ReplanMode>(props.mode)
  const today = todayKey()
  const [nowMinutes, setNowMinutes] = useState(() => currentMinutes())

  useEffect(() => {
    const timer = setInterval(() => setNowMinutes(currentMinutes()), NOW_TICK_MS)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        props.onClose()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [props])

  /**
   * One day as the arithmetic sees it. The sleep schedule is the day's own,
   * else its template's through `columnFor` - a week template's Wednesday
   * can be a night shift while its Saturday is not - else the default, the
   * same three steps the day view takes; somebody else's calendar is time
   * already spoken for on that day.
   */
  function contextFor(date: string): DayContext {
    const day = data.days[date]
    const template = day?.templateId ? data.templates.find(t => t.id === day.templateId) : undefined
    const sleepProfileId = day?.sleepProfileId ?? (template ? columnFor(template, date).sleepProfileId : undefined)
    return {
      tasks: day?.tasks ?? [],
      window: windowFor(sleepProfileId, { profiles: data.settings.sleepProfiles }),
      busy: busyIntervals(date, data.settings.calendars, calendarCache),
      away: day?.away,
    }
  }

  const todayContext = contextFor(today)
  const titles = new Map(todayContext.tasks.map(t => [t.id, t.title]))

  function accept(date: string, plan: ReplanPlan, label: string, clearAway = false) {
    const wasAway = todayContext.away
    const { undo } = actions.applyReplan(date, plan)
    if (clearAway) actions.setAway(today, undefined)
    offerUndo(label, () => {
      undo()
      if (clearAway && wasAway) actions.setAway(today, wasAway)
    })
    props.onClose()
  }

  return (
    <div className="replan-scrim" onClick={props.onClose}>
      <div className="replan" role="dialog" aria-label="Replan" data-keeps-keys="" onClick={e => e.stopPropagation()}>
        {mode === 'menu' && (
          <Menu away={todayContext.away} onPick={setMode} onClose={props.onClose} />
        )}
        {mode === 'interrupt' && (
          <Interrupt
            initialDate={props.date}
            today={today}
            nowMinutes={nowMinutes}
            contextFor={contextFor}
            onAccept={accept}
            onBack={() => setMode('menu')}
            onClose={props.onClose}
          />
        )}
        {mode === 'shift' && (
          <Shift
            tasks={todayContext.tasks}
            nowMinutes={nowMinutes}
            window={todayContext.window}
            titles={titles}
            onAccept={plan => accept(today, plan, 'Day replanned')}
            onBack={() => setMode('menu')}
          />
        )}
        {mode === 'away' && (
          <Away
            nowMinutes={nowMinutes}
            onAway={() => {
              actions.setAway(today, formatClock(nowMinutes))
              props.onClose()
            }}
            onBack={() => setMode('menu')}
          />
        )}
        {mode === 'back' && (
          <Back
            tasks={todayContext.tasks}
            nowMinutes={nowMinutes}
            window={todayContext.window}
            busy={todayContext.busy}
            titles={titles}
            away={todayContext.away}
            onAccept={plan => accept(today, plan, 'Day replanned', true)}
            onNotNow={() => {
              actions.setAway(today, undefined)
              props.onClose()
            }}
          />
        )}
      </div>
    </div>
  )
}

// --- the menu -----------------------------------------------------------------

function Menu({ away, onPick, onClose }: { away: string | undefined; onPick: (m: ReplanMode) => void; onClose: () => void }) {
  return (
    <>
      <Head title="Replan" onClose={onClose} />
      <div className="replan-menu">
        {/* The line under each door is the same copy the rest of the app
            explains itself with, from lib/explain.ts, printed rather than
            hidden behind an (i) - nobody can choose between three doors from
            their names alone, and an explanation behind a second decision is
            not an explanation. */}
        <button type="button" className="replan-choice" onClick={() => onPick('interrupt')}>
          <strong>Something came up</strong>
          <Explain id="replan-interrupt" inline />
        </button>
        <button type="button" className="replan-choice" onClick={() => onPick('shift')}>
          <strong>Shift the rest</strong>
          <Explain id="replan-shift" inline />
        </button>
        {away ? (
          <button type="button" className="replan-choice" onClick={() => onPick('back')}>
            <strong>I'm back</strong>
            <span>Away since {away}. See what still fits in the time left.</span>
          </button>
        ) : (
          <button type="button" className="replan-choice" onClick={() => onPick('away')}>
            <strong>Away</strong>
            <Explain id="replan-away" inline />
          </button>
        )}
      </div>
    </>
  )
}

function Head({ title, onClose, onBack }: { title: string; onClose?: () => void; onBack?: () => void }) {
  return (
    <div className="replan-head">
      {onBack && (
        <button type="button" className="replan-back" aria-label="Back" onClick={onBack}>
          &larr;
        </button>
      )}
      <h2 className="replan-title">{title}</h2>
      {onClose && (
        <button type="button" className="task-detail-close" aria-label="Close replan" onClick={onClose}>
          &times;
        </button>
      )}
    </div>
  )
}

// --- something came up, for any day ---------------------------------------------

interface InterruptProps {
  initialDate: string
  today: string
  nowMinutes: number
  contextFor: (date: string) => DayContext
  onAccept: (date: string, plan: ReplanPlan, label: string) => void
  onBack: () => void
  onClose: () => void
}

/**
 * The one screen the phone call is answered on.
 *
 * Two rows of chips - when, and what is gone - then the words, then the
 * plan, then Accept: the order a call is answered in, and the order a thumb
 * reaches on a phone held in one hand. Everything is proposed before
 * anything is asked: choosing when shows what the interruption lands on and
 * where each block goes, and a row is pressed only to say otherwise.
 *
 * The typed line and the chips are one truth, CONVENTIONS section 16's rule
 * for quick-add kept the cheap way: where the line names a day, a time or a
 * shape, the line wins and the chips redraw to show it; where it says
 * nothing, the chips speak. Pressing a chip takes that kind of word out of
 * the line, so the two can never disagree.
 *
 * Choosing a day opens it, through `actions.ensureDay`, exactly as looking
 * at it would - see lib/ensureDay.ts for why a pure preview could not do
 * this job. What is planned against is then what Accept lands on.
 */
function Interrupt({ initialDate, today, nowMinutes, contextFor, onAccept, onBack, onClose }: InterruptProps) {
  const [chosenDate, setChosenDate] = useState(initialDate < today ? today : initialDate)
  const [chosenPreset, setChosenPreset] = useState<Preset | null>(null)
  /** What was typed into From; null means nothing was, and the default stands. */
  const [startText, setStartText] = useState<string | null>(null)
  const [chosenMinutes, setChosenMinutes] = useState(30)
  const [line, setLine] = useState('')
  /** Only what is not the default - see `defaultChoices`. */
  const [choices, setChoices] = useState<Record<string, ConflictChoice>>({})
  const [expanded, setExpanded] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)
  const [recent] = useState(readRecentTitles)
  const coarse = usePointerCoarse()
  const lineRef = useRef<HTMLInputElement>(null)

  // A keyboard raised on open would sit over the two rows of chips and the
  // Accept this screen is for, so on a finger nothing takes focus; on a mouse
  // the words are the fastest path and the field has the cursor.
  useEffect(() => {
    if (!coarse) lineRef.current?.focus()
  }, [coarse])

  const parsed = useMemo(() => parseInterruptLine(line), [line])
  const date = parsed.day ? resolveDay(parsed.day, today) : chosenDate
  const isToday = date === today

  useEffect(() => {
    actions.ensureDay(date)
  }, [date])

  const ctx = contextFor(date)
  const { window } = ctx
  // Where fitting may start: now on today, and nothing that has already
  // happened is moved; the start of the waking window on a day still ahead.
  const from = isToday ? Math.min(roundUp(nowMinutes), window.end) : window.start
  const words = dayWordsFor(date, today)
  const chips = dayChoices(today)

  const lineSpeaksOfTime = parsed.start !== undefined || parsed.end !== undefined || parsed.minutes !== undefined || parsed.open === true
  const preset: Preset | null =
    parsed.shape ??
    (lineSpeaksOfTime
      ? parsed.open && parsed.end === undefined && parsed.minutes === undefined
        ? 'open'
        : 'custom'
      : chosenPreset)

  const defaultStart = isToday ? from : Math.min(Math.max(window.start, 9 * 60), window.end)
  const typedStart = startText !== null ? parseTimeInput(startText) : undefined
  const startMinutes =
    parsed.start ??
    (parsed.end !== undefined
      ? from
      : typedStart !== undefined
        ? timeToMinutes(typedStart)
        : startText === null
          ? defaultStart
          : undefined)
  const minutes = parsed.end !== undefined && startMinutes !== undefined ? parsed.end - startMinutes : parsed.minutes ?? chosenMinutes

  const title = parsed.title || DEFAULT_TITLE
  let interruption: Interruption | null = null
  if (preset === 'open') {
    if (startMinutes !== undefined) interruption = { title, start: startMinutes }
  } else if (preset === 'custom') {
    if (startMinutes !== undefined && minutes > 0) interruption = { title, start: startMinutes, minutes }
  } else if (preset) {
    const span = shapeInterval(preset, window, from)
    if (span) interruption = { title, start: span.start, minutes: span.end - span.start }
  }

  const conflicts = interruption ? findConflicts(ctx.tasks, interruption) : []
  const allChoices: Record<string, ConflictChoice> = { ...defaultChoices(conflicts), ...choices }
  const plan = interruption ? planInterrupt(ctx.tasks, interruption, allChoices, window, ctx.busy, { from, words }) : null
  // The answer for the person on the phone: what is left of the day once
  // the plan is in. The interruption is busy for its length, or to bedtime
  // when nobody knows its length - which is what "don't know" means.
  const free =
    plan && interruption
      ? formatFreeWindows(
          freeWindows(
            splitByPlan(ctx.tasks, plan).staying,
            window,
            [...ctx.busy, { start: interruption.start, end: interruption.minutes === undefined ? window.end : interruption.start + interruption.minutes }],
            from,
          ),
          window,
          words,
        )
      : null

  function pickDay(next: string) {
    setLine(stripTokens(line, ['day']))
    setChosenDate(next)
    setChoices({})
    setPicking(false)
  }

  function pickPreset(next: Preset) {
    setLine(stripTokens(line, ['shape', 'time', 'length', 'open']))
    setChosenPreset(next)
    setChoices({})
  }

  function editStart(text: string) {
    setLine(stripTokens(line, ['time']))
    setStartText(text)
  }

  function pickMinutes(next: number) {
    setLine(stripTokens(line, ['length', 'open']))
    setChosenMinutes(next)
    setChosenPreset('custom')
  }

  function pickRecent(name: string) {
    setLine(withTitle(line, name))
  }

  function setAll(choice: ConflictChoice) {
    setChoices(Object.fromEntries(conflicts.map(c => [c.id, choice])))
  }

  function accept() {
    if (!plan) return
    rememberTitle(title)
    // The free line is not carried into the toast. It was tried: the toast
    // is a pill, and "Free on Tuesday: 08:15-10:00, 13:00-13:30, 14:15-17:30,
    // 18:10-21:00, after 21:30" wrapped it into a column seven lines tall on
    // a phone. The line is read here, before Accept, with the phone still
    // at the ear - which is when the caller is asking.
    const dayName = isToday ? 'Day' : capitalise(words.day.replace(/^on /, ''))
    onAccept(date, plan, `${dayName} replanned`)
  }

  const startValue = parsed.start !== undefined ? formatClock(parsed.start) : startText ?? formatClock(defaultStart)
  const nextWord = capitalise(words.next)

  return (
    <>
      <Head title="Something came up" onBack={onBack} onClose={onClose} />
      <div className="replan-body">
        <div className="replan-section">
          <span className="replan-label" id="replan-when-label">When</span>
          <div className="replan-chips" role="group" aria-labelledby="replan-when-label">
            {chips.map(c => (
              <button
                key={c.date}
                type="button"
                className={date === c.date ? 'replan-chip active' : 'replan-chip'}
                aria-pressed={date === c.date}
                onClick={() => pickDay(c.date)}
              >
                {c.label}
              </button>
            ))}
            {!chips.some(c => c.date === date) && (
              <button type="button" className="replan-chip active" aria-pressed onClick={() => setPicking(true)}>
                {dayLabel(date, today)}
              </button>
            )}
            <button
              type="button"
              className={picking ? 'replan-chip active' : 'replan-chip'}
              aria-pressed={picking}
              aria-expanded={picking}
              onClick={() => setPicking(p => !p)}
            >
              Pick a day
            </button>
            {picking && (
              <input
                type="date"
                className="replan-date-input"
                aria-label="Which day"
                min={today}
                value={date}
                onChange={e => e.target.value && pickDay(e.target.value)}
              />
            )}
          </div>
        </div>

        <div className="replan-section">
          <span className="replan-label" id="replan-shape-label">What is gone</span>
          <div className="replan-chips" role="group" aria-labelledby="replan-shape-label">
            {SHAPES.map(s => {
              const possible = shapeInterval(s.id, window, from) !== null
              return (
                <button
                  key={s.id}
                  type="button"
                  className={preset === s.id ? 'replan-chip active' : 'replan-chip'}
                  aria-pressed={preset === s.id}
                  disabled={!possible}
                  title={possible ? undefined : 'Already behind you'}
                  onClick={() => pickPreset(s.id)}
                >
                  {s.label}
                </button>
              )
            })}
            <button
              type="button"
              className={preset === 'custom' ? 'replan-chip active' : 'replan-chip'}
              aria-pressed={preset === 'custom'}
              onClick={() => pickPreset('custom')}
            >
              A time
            </button>
            <button
              type="button"
              className={preset === 'open' ? 'replan-chip active' : 'replan-chip'}
              aria-pressed={preset === 'open'}
              onClick={() => pickPreset('open')}
            >
              Don't know how long
            </button>
          </div>
          {(preset === 'custom' || preset === 'open') && (
            <div className="replan-row">
              <label className="field replan-when">
                <span className="field-label">From</span>
                <input value={startValue} inputMode="numeric" placeholder="14:00" aria-label="Start time" onChange={e => editStart(e.target.value)} />
              </label>
              {preset === 'custom' && (
                <div className="field">
                  <span className="field-label" id="replan-length-label">How long</span>
                  <div className="replan-chips" role="group" aria-labelledby="replan-length-label">
                    {DURATIONS.map(d => (
                      <button
                        key={d}
                        type="button"
                        className={minutes === d ? 'replan-chip active' : 'replan-chip'}
                        aria-pressed={minutes === d}
                        onClick={() => pickMinutes(d)}
                      >
                        {formatDuration(d)}
                      </button>
                    ))}
                    {/* "10-13" is three hours, which no chip says. The row
                        shows the length it was given rather than six unlit
                        chips beside a range that clearly has one. */}
                    {minutes > 0 && !DURATIONS.includes(minutes) && <span className="replan-chip active">{formatDuration(minutes)}</span>}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="replan-section">
          <label className="field">
            <span className="field-label">What</span>
            <input
              ref={lineRef}
              value={line}
              placeholder={DEFAULT_TITLE}
              maxLength={120}
              aria-label="What came up"
              onChange={e => setLine(e.target.value)}
            />
          </label>
          {recent.length > 0 && (
            <div className="replan-chips" role="group" aria-label="Recent names">
              {recent.map(name => (
                <button
                  key={name}
                  type="button"
                  className={parsed.title.toLowerCase() === name.toLowerCase() ? 'replan-chip active' : 'replan-chip'}
                  aria-pressed={parsed.title.toLowerCase() === name.toLowerCase()}
                  onClick={() => pickRecent(name)}
                >
                  {name}
                </button>
              ))}
            </div>
          )}
        </div>

        {plan && conflicts.length > 0 && (
          <div className="replan-conflicts">
            <div className="replan-conflicts-head">
              <span className="replan-label">In the way</span>
              <span className="replan-forall" role="group" aria-label="For all of them">
                <button type="button" className="link-button" onClick={() => setAll('squeeze')}>Move</button>
                <button type="button" className="link-button" onClick={() => setAll('tomorrow')}>{nextWord}</button>
                <button type="button" className="link-button" onClick={() => setAll('drop')}>Skip</button>
              </span>
            </div>
            <ul className="replan-list">
              {conflicts.map(task => {
                const choice = allChoices[task.id] ?? 'squeeze'
                const move = plan.moves.find(m => m.taskId === task.id)
                const routine = isRoutine(task)
                // "Gaps" with "tomorrow" beside it read as a contradiction;
                // it is not one, there was simply no gap left. Say that.
                const outcome =
                  choice === 'drop'
                    ? routine ? 'skipped' : 'gone'
                    : choice === 'keep'
                      ? 'stays'
                      : move
                        ? `at ${move.time}`
                        : choice === 'tomorrow'
                          ? words.next
                          : `no room, ${words.next}`
                const open = expanded === task.id
                return (
                  <li key={task.id} className={`replan-item is-row is-${choice}`}>
                    <button
                      type="button"
                      className="replan-row-button"
                      aria-expanded={open}
                      aria-label={`${task.title}, ${task.time}: ${outcome}. Change what happens to it`}
                      onClick={() => setExpanded(open ? null : task.id)}
                    >
                      <span className="replan-item-title">
                        {task.highlight && <span className="replan-key" aria-hidden="true">*</span>}
                        {task.title}
                        <span className="replan-item-was"> {task.time}</span>
                      </span>
                      <span className="replan-item-outcome">{outcome}</span>
                    </button>
                    {open && (
                      <div className="segmented replan-seg" role="group" aria-label={`What to do with ${task.title}`}>
                        {(['squeeze', 'tomorrow', 'drop', 'keep'] as const).map(c => (
                          <button
                            key={c}
                            type="button"
                            className={choice === c ? 'active' : ''}
                            aria-pressed={choice === c}
                            onClick={() => setChoices({ ...choices, [task.id]: c })}
                          >
                            {c === 'squeeze' ? 'Move' : c === 'tomorrow' ? nextWord : c === 'drop' ? (routine ? 'Skip' : 'Drop') : 'Keep'}
                          </button>
                        ))}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>
      {/* Outside the scrolling body on purpose. With five things in the way
          the list is taller than the sheet, and the two sentences this whole
          screen exists to produce - what is free, and what moves - have to
          be on screen whatever the list is doing. */}
      {plan && (
        <div className="replan-summary" role="status">
          {free && <strong className="replan-free">{free}</strong>}
          <span>{plan.summary}</span>
        </div>
      )}
      <div className="replan-foot">
        <button type="button" className="btn-primary" disabled={!plan} onClick={accept}>
          Accept
        </button>
        <button type="button" className="btn-secondary" onClick={onBack}>
          Cancel
        </button>
      </div>
    </>
  )
}

// --- shift the rest --------------------------------------------------------------

interface ShiftProps {
  tasks: Task[]
  nowMinutes: number
  window: Interval
  titles: Map<string, string>
  onAccept: (plan: ReplanPlan) => void
  onBack: () => void
}

function Shift({ tasks, nowMinutes, window, titles, onAccept, onBack }: ShiftProps) {
  const [delta, setDelta] = useState(30)
  const [custom, setCustom] = useState('')
  const plan = planShift(tasks, nowMinutes, delta, window)

  function pickCustom(text: string) {
    setCustom(text)
    const n = Number.parseInt(text, 10)
    if (Number.isFinite(n) && n > 0) setDelta(n)
  }

  return (
    <>
      <Head title="Shift the rest" onBack={onBack} />
      <div className="replan-body">
        <div className="replan-chips" role="group" aria-label="How much later">
          {SHIFTS.map(d => (
            <button
              key={d}
              type="button"
              className={delta === d && custom === '' ? 'replan-chip active' : 'replan-chip'}
              aria-pressed={delta === d && custom === ''}
              onClick={() => {
                setCustom('')
                setDelta(d)
              }}
            >
              +{formatDuration(d)}
            </button>
          ))}
          <label className="replan-custom">
            <span className="visually-hidden">Custom minutes</span>
            <input value={custom} inputMode="numeric" placeholder="min" onChange={e => pickCustom(e.target.value)} />
          </label>
        </div>
        <PlanList plan={plan} tasks={tasks} titles={titles} />
      </div>
      <p className="replan-summary" role="status">{plan.summary}</p>
      <div className="replan-foot">
        <button type="button" className="btn-primary" disabled={plan.moves.length + plan.tomorrow.length === 0} onClick={() => onAccept(plan)}>
          Accept
        </button>
        <button type="button" className="btn-secondary" onClick={onBack}>
          Cancel
        </button>
      </div>
    </>
  )
}

// --- away, and back ---------------------------------------------------------------

function Away({ nowMinutes, onAway, onBack }: { nowMinutes: number; onAway: () => void; onBack: () => void }) {
  return (
    <>
      <Head title="Away" onBack={onBack} />
      <div className="replan-body">
        <p className="replan-text">
          The day pauses at {formatClock(nowMinutes)}. Nothing nudges you while you are gone. When you are back, one
          press fits what still fits into the time left.
        </p>
      </div>
      <div className="replan-foot">
        <button type="button" className="btn-primary" onClick={onAway}>
          Away
        </button>
        <button type="button" className="btn-secondary" onClick={onBack}>
          Cancel
        </button>
      </div>
    </>
  )
}

interface BackProps {
  tasks: Task[]
  nowMinutes: number
  window: Interval
  busy: Interval[]
  titles: Map<string, string>
  away: string | undefined
  onAccept: (plan: ReplanPlan) => void
  onNotNow: () => void
}

function Back({ tasks, nowMinutes, window, busy, titles, away, onAccept, onNotNow }: BackProps) {
  const plan = planRescue(tasks, nowMinutes, window, busy)
  const nothing = plan.moves.length + plan.tomorrow.length === 0
  return (
    <>
      <Head title="I'm back" />
      <div className="replan-body">
        {away && <p className="replan-text">Away since {away}. Here is the rest of the day, from {formatClock(nowMinutes)}.</p>}
        <PlanList plan={plan} tasks={tasks} titles={titles} />
      </div>
      <p className="replan-summary replan-summary-lead" role="status">{plan.summary}</p>
      <div className="replan-foot">
        {nothing ? (
          <button type="button" className="btn-primary" onClick={onNotNow}>
            Back to the day
          </button>
        ) : (
          <>
            <button type="button" className="btn-primary" onClick={() => onAccept(plan)}>
              Accept
            </button>
            <button type="button" className="btn-secondary" onClick={onNotNow}>
              Not now
            </button>
          </>
        )}
      </div>
    </>
  )
}

/** What the plan does to each task it touches, one line each. */
function PlanList({ plan, tasks, titles }: { plan: ReplanPlan; tasks: Task[]; titles: Map<string, string> }) {
  const rows: { id: string; title: string; was: string | undefined; outcome: string; kind: 'move' | 'tomorrow' | 'keep' }[] = []
  const byId = new Map(tasks.map(t => [t.id, t]))
  for (const m of plan.moves) rows.push({ id: m.taskId, title: titles.get(m.taskId) ?? '', was: byId.get(m.taskId)?.time, outcome: `at ${m.time}`, kind: 'move' })
  for (const id of plan.keep) rows.push({ id, title: titles.get(id) ?? '', was: byId.get(id)?.time, outcome: 'stays', kind: 'keep' })
  for (const id of plan.tomorrow) rows.push({ id, title: titles.get(id) ?? '', was: byId.get(id)?.time, outcome: 'tomorrow', kind: 'tomorrow' })
  if (rows.length === 0) return null
  return (
    <ul className="replan-list">
      {rows.map(r => (
        <li key={r.id} className={`replan-item is-${r.kind}`}>
          <span className="replan-item-title">
            {byId.get(r.id)?.highlight && <span className="replan-key" aria-label="Key task">*</span>}
            {r.title}
            {r.was && <span className="replan-item-was"> {r.was}</span>}
          </span>
          <span className="replan-item-outcome">{r.outcome}</span>
        </li>
      ))}
    </ul>
  )
}
