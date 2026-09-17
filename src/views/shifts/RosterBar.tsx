import { useState } from 'react'
import { readCycle } from '../../lib/rosterDraft'
import { monthAndDay, monthEnd } from '../../lib/dates'
import type { Template } from '../../lib/types'

/**
 * The roster's own bar in the month - rotating shifts, since v2.29, and
 * docs/RESEARCH-SHIFTS.md section 2.5.
 *
 * The month is where a rota is laid out, because a rota arrives as a month:
 * eight rows of letters on a photograph from the employer. A tap on a date
 * walks it through the kinds and round again, so laying out a week is seven
 * taps and nothing to choose first; Clear is the other gesture, kept apart
 * from the tap so neither can be the other by accident.
 *
 * **The cycle** is for the part of a rota that repeats: a sequence of kinds and
 * the date it starts on, filling to the end of that month in one press. The
 * last one used is kept on the device, because next month's is usually the same
 * pattern moved on.
 *
 * Nothing here reaches the plan. What is laid out waits on this device until it
 * is applied, which is stage 7, and the bar says how much is waiting.
 */
export function RosterBar({
  kinds,
  waiting,
  clearing,
  today,
  monthStart,
  onLeave,
  onClearing,
  onFill,
  onThrowAway,
}: {
  kinds: Template[]
  /** How many dates the draft holds. */
  waiting: number
  /** Whether a tap takes the kind off rather than walking to the next. */
  clearing: boolean
  today: string
  /** The first of the month on screen, where a cycle starts unless it is behind today. */
  monthStart: string
  onLeave: () => void
  onClearing: (next: boolean) => void
  onFill: (kinds: string[], from: string) => void
  onThrowAway: () => void
}) {
  const [cycling, setCycling] = useState(false)
  const last = readCycle()
  const [sequence, setSequence] = useState<string[]>(last?.kinds.filter(id => kinds.some(k => k.id === id)) ?? [])
  const [from, setFrom] = useState(monthStart > today ? monthStart : today)
  const letterOf = (id: string) => kinds.find(k => k.id === id)?.dayKind?.letter ?? '?'

  return (
    <div className="roster-bar">
      <div className="roster-bar-row">
        {/* The mode, on: pressed again it gives the month back. A tool like
            the two beside it, because that is what it is now. */}
        <button type="button" className="roster-tool is-on" aria-pressed={true} onClick={onLeave}>
          Roster
        </button>
        {/* The letters, once, so a date drawn with one can be read. */}
        <span className="roster-legend">
          {kinds.map(kind => (
            <span key={kind.id} className="roster-legend-kind">
              <span className="roster-legend-letter" style={{ ['--chip' as string]: kind.color } as React.CSSProperties}>
                {kind.dayKind!.letter}
              </span>
              {kind.name}
            </span>
          ))}
        </span>
        <button
          type="button"
          className={clearing ? 'roster-tool is-on' : 'roster-tool'}
          aria-pressed={clearing}
          onClick={() => onClearing(!clearing)}
        >
          Clear
        </button>
        <button type="button" className="roster-tool" aria-expanded={cycling} onClick={() => setCycling(c => !c)}>
          Cycle
        </button>
      </div>

      <div className="roster-bar-row roster-bar-said">
        <p className="muted roster-line">
          {clearing ? 'A tap takes the kind off a date.' : 'A tap walks a date through the kinds. Nothing reaches the plan until it is applied.'}
        </p>
        <p className="muted roster-waiting" role="status">
          {waiting === 0 ? 'Nothing waiting yet.' : `${waiting} ${waiting === 1 ? 'day' : 'days'} waiting`}
        </p>
        {waiting > 0 && (
          <button type="button" className="btn-quiet" onClick={onThrowAway}>
            Throw it away
          </button>
        )}
      </div>

      {cycling && (
        <div className="roster-cycle">
          <div className="field">
            <span className="routines-group-label">The cycle</span>
            <div className="duration-chips roster-cycle-kinds" role="group" aria-label="The cycle">
              {kinds.map(kind => (
                <button key={kind.id} type="button" onClick={() => setSequence(s => [...s, kind.id])}>
                  {kind.dayKind!.letter} {kind.name}
                </button>
              ))}
            </div>
          </div>

          {/* The sequence as it stands, in letters, with the way to take the
              last one back off: a sequence is built by pressing, so the mistake
              it makes is one press too many. */}
          <div className="roster-cycle-row">
            <p className="roster-sequence" aria-label="The cycle so far">
              {sequence.length === 0 ? 'Press the kinds in the order they come round.' : sequence.map(letterOf).join(' ')}
            </p>
            {sequence.length > 0 && (
              <button type="button" className="btn-quiet" onClick={() => setSequence(s => s.slice(0, -1))}>
                Take the last one off
              </button>
            )}
          </div>

          <div className="roster-cycle-row">
            <label className="field">
              <span className="field-label">Starting on</span>
              <input type="date" className="roster-cycle-date" aria-label="Starting on" min={today} value={from} onChange={e => e.target.value && setFrom(e.target.value)} />
            </label>
            <button
              type="button"
              className="btn-primary"
              disabled={sequence.length === 0}
              onClick={() => {
                onFill(sequence, from)
                setCycling(false)
              }}
            >
              Fill to the end of the month
            </button>
          </div>
          <p className="muted roster-line">It fills to {monthAndDay(monthEnd(from))}, and changes nothing behind today.</p>
        </div>
      )}
    </div>
  )
}
