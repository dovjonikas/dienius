import { useEffect, useMemo, useRef, useState } from 'react'
import type { Task } from '../../lib/types'
import { actions } from '../../lib/store'
import { offerUndo } from '../../lib/undo'
import type { ReplanMode } from '../../lib/replanState'
import { formatDuration, parseTimeInput, timeToMinutes, windowFor, type Interval, type SleepSettings } from './capacity'
import { formatClock } from './timelineLayout'
import {
  findConflicts,
  planInterrupt,
  planRescue,
  planShift,
  type ConflictChoice,
  type Interruption,
  type ReplanPlan,
} from './replan'

/**
 * The replan sheet - the ten seconds between "the plan just broke" and
 * "most of it still fits". See replan.ts for the arithmetic; this is only
 * the asking and the one press.
 *
 * Built for the moment it is used in, which is a stressed one: every screen
 * is one question, the answer is shown before it is accepted, and the
 * summary is written to be read in three seconds on a phone. Nothing is
 * applied until Accept, and Accept is one commit with one undo.
 */

export interface ReplanSheetProps {
  date: string
  tasks: Task[]
  nowMinutes: number
  sleep: SleepSettings
  sleepProfileId: string | undefined
  /** External calendar time, which is never a gap. */
  busy: Interval[]
  /** The time the person went away, while they are. */
  away: string | undefined
  mode: ReplanMode
  onClose: () => void
}

const DURATIONS = [15, 30, 45, 60, 90, 120]
const SHIFTS = [15, 30, 60]

function roundUp(minutes: number, step = 5): number {
  return Math.ceil(minutes / step) * step
}

export function ReplanSheet(props: ReplanSheetProps) {
  const [mode, setMode] = useState<ReplanMode>(props.mode)
  const window = useMemo(() => windowFor(props.sleepProfileId, props.sleep), [props.sleepProfileId, props.sleep])
  const titles = useMemo(() => new Map(props.tasks.map(t => [t.id, t.title])), [props.tasks])

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

  function accept(plan: ReplanPlan, clearAway = false) {
    const { undo } = actions.applyReplan(props.date, plan)
    if (clearAway) actions.setAway(props.date, undefined)
    offerUndo('Day replanned', () => {
      undo()
      if (clearAway && props.away) actions.setAway(props.date, props.away)
    })
    props.onClose()
  }

  return (
    <div className="replan-scrim" onClick={props.onClose}>
      <div className="replan" role="dialog" aria-label="Replan" data-keeps-keys="" onClick={e => e.stopPropagation()}>
        {mode === 'menu' && (
          <Menu away={props.away} onPick={setMode} onClose={props.onClose} />
        )}
        {mode === 'interrupt' && (
          <Interrupt
            tasks={props.tasks}
            nowMinutes={props.nowMinutes}
            window={window}
            busy={props.busy}
            onAccept={plan => accept(plan)}
            onBack={() => setMode('menu')}
          />
        )}
        {mode === 'shift' && (
          <Shift
            tasks={props.tasks}
            nowMinutes={props.nowMinutes}
            window={window}
            titles={titles}
            onAccept={plan => accept(plan)}
            onBack={() => setMode('menu')}
          />
        )}
        {mode === 'away' && (
          <Away
            nowMinutes={props.nowMinutes}
            onAway={() => {
              actions.setAway(props.date, formatClock(props.nowMinutes))
              props.onClose()
            }}
            onBack={() => setMode('menu')}
          />
        )}
        {mode === 'back' && (
          <Back
            tasks={props.tasks}
            nowMinutes={props.nowMinutes}
            window={window}
            busy={props.busy}
            titles={titles}
            away={props.away}
            onAccept={plan => accept(plan, true)}
            onNotNow={() => {
              actions.setAway(props.date, undefined)
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
        <button type="button" className="replan-choice" onClick={() => onPick('interrupt')}>
          <strong>Something came up</strong>
          <span>A new block lands. What it hits moves into the gaps, to tomorrow, or goes.</span>
        </button>
        <button type="button" className="replan-choice" onClick={() => onPick('shift')}>
          <strong>Shift the rest</strong>
          <span>Everything from now, later. What no longer fits before sleep is named.</span>
        </button>
        {away ? (
          <button type="button" className="replan-choice" onClick={() => onPick('back')}>
            <strong>I'm back</strong>
            <span>Away since {away}. See what still fits in the time left.</span>
          </button>
        ) : (
          <button type="button" className="replan-choice" onClick={() => onPick('away')}>
            <strong>Away</strong>
            <span>Pause the day. No nudges until you are back, then one rescue.</span>
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

// --- something came up ----------------------------------------------------------

interface InterruptProps {
  tasks: Task[]
  nowMinutes: number
  window: Interval
  busy: Interval[]
  onAccept: (plan: ReplanPlan) => void
  onBack: () => void
}

function Interrupt({ tasks, nowMinutes, window, busy, onAccept, onBack }: InterruptProps) {
  const [title, setTitle] = useState('')
  const [start, setStart] = useState(() => formatClock(Math.min(roundUp(nowMinutes), window.end - 5)))
  const [minutes, setMinutes] = useState<number | undefined>(30)
  const [choices, setChoices] = useState<Record<string, ConflictChoice>>({})
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  const startMinutes = parseTimeInput(start) ? timeToMinutes(parseTimeInput(start)!) : undefined
  const interruption: Interruption | null =
    title.trim() && startMinutes !== undefined ? { title: title.trim(), start: startMinutes, minutes } : null
  const conflicts = interruption ? findConflicts(tasks, interruption) : []
  const plan = interruption ? planInterrupt(tasks, interruption, choices, window, busy) : null

  function setAll(choice: ConflictChoice) {
    setChoices(Object.fromEntries(conflicts.map(c => [c.id, choice])))
  }

  return (
    <>
      <Head title="Something came up" onBack={onBack} />
      <div className="replan-body">
        <label className="field">
          <span className="field-label">What</span>
          <input ref={titleRef} value={title} placeholder="Dentist" maxLength={80} onChange={e => setTitle(e.target.value)} />
        </label>
        <div className="replan-row">
          <label className="field replan-when">
            <span className="field-label">When</span>
            <input value={start} inputMode="numeric" placeholder="14:00" aria-label="Start time" onChange={e => setStart(e.target.value)} />
          </label>
          <div className="field">
            <span className="field-label">How long</span>
            <div className="replan-chips" role="group" aria-label="How long">
              {DURATIONS.map(d => (
                <button
                  key={d}
                  type="button"
                  className={minutes === d ? 'replan-chip active' : 'replan-chip'}
                  aria-pressed={minutes === d}
                  onClick={() => setMinutes(d)}
                >
                  {formatDuration(d)}
                </button>
              ))}
              <button
                type="button"
                className={minutes === undefined ? 'replan-chip active' : 'replan-chip'}
                aria-pressed={minutes === undefined}
                onClick={() => setMinutes(undefined)}
              >
                Don't know
              </button>
            </div>
          </div>
        </div>

        {interruption && conflicts.length > 0 && (
          <div className="replan-conflicts">
            <div className="replan-conflicts-head">
              <span className="replan-label">In the way</span>
              <span className="replan-forall" role="group" aria-label="For all of them">
                <button type="button" className="link-button" onClick={() => setAll('squeeze')}>Into gaps</button>
                <button type="button" className="link-button" onClick={() => setAll('tomorrow')}>Tomorrow</button>
                <button type="button" className="link-button" onClick={() => setAll('drop')}>Drop</button>
              </span>
            </div>
            <ul className="replan-list">
              {conflicts.map(task => {
                const choice = choices[task.id] ?? 'squeeze'
                const move = plan?.moves.find(m => m.taskId === task.id)
                // "Gaps" with "tomorrow" beside it read as a contradiction;
                // it is not one, there was simply no gap left. Say that.
                const outcome =
                  choice === 'drop'
                    ? 'gone'
                    : choice === 'keep'
                      ? 'stays'
                      : move
                        ? `at ${move.time}`
                        : choice === 'tomorrow'
                          ? 'tomorrow'
                          : 'no room, tomorrow'
                return (
                  <li key={task.id} className="replan-item">
                    <span className="replan-item-title">
                      {task.title}
                      <span className="replan-item-was"> {task.time}</span>
                    </span>
                    <span className="replan-item-outcome">{outcome}</span>
                    <div className="segmented replan-seg" role="group" aria-label={`What to do with ${task.title}`}>
                      {(['squeeze', 'tomorrow', 'drop'] as const).map(c => (
                        <button
                          key={c}
                          type="button"
                          className={choice === c ? 'active' : ''}
                          aria-pressed={choice === c}
                          onClick={() => setChoices({ ...choices, [task.id]: c })}
                        >
                          {c === 'squeeze' ? 'Gaps' : c === 'tomorrow' ? 'Tomorrow' : 'Drop'}
                        </button>
                      ))}
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

      </div>
      {/* Outside the scrolling body on purpose. With five things in the way
          the list is taller than the sheet, and the one sentence this whole
          screen exists to produce was below the fold - the person under
          time pressure saw a list and no answer. */}
      {plan && <p className="replan-summary" role="status">{plan.summary}</p>}
      <div className="replan-foot">
        <button type="button" className="btn-primary" disabled={!plan} onClick={() => plan && onAccept(plan)}>
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
