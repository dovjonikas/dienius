import { useState } from 'react'
import { readCycle } from '../../lib/rosterDraft'
import { formatDayShort, formatWeekTitle, monthAndDay, monthEnd, weekOf } from '../../lib/dates'
import type { RosterPreview } from '../../lib/rosterPreview'
import type { HandEdits } from '../../lib/shiftDay'
import type { Template } from '../../lib/types'

/** What was changed by hand on a date, in the words the question about it uses. */
function handWords(hand: HandEdits): string {
  const parts = []
  if (hand.done > 0) parts.push(`${hand.done} done`)
  if (hand.moved > 0) parts.push(`${hand.moved} moved`)
  if (hand.deleted > 0) parts.push(`${hand.deleted} taken off`)
  return parts.join(', ')
}

/** What a week costs, in one line, and nothing where it costs nothing. */
function weekWords(week: RosterPreview['weeks'][number]): string {
  const parts = []
  if (week.needsTime > 0) parts.push(`${week.needsTime} ${week.needsTime === 1 ? 'routine needs' : 'routines need'} a time`)
  if (week.runsInto > 0) parts.push(`${week.runsInto} ${week.runsInto === 1 ? 'runs' : 'run'} into something`)
  if (week.handEdited > 0) parts.push(`${week.handEdited} ${week.handEdited === 1 ? 'day' : 'days'} changed by hand`)
  return parts.join(' \u00b7 ')
}

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
 * **Apply says what it will do first** - section 6.1, and lib/rosterPreview.ts:
 * the weeks, the letter each date would take, what it would cost in routines
 * with no time or routines running into something, and every day that was
 * changed by hand, each with the way to leave it alone. Nothing reaches the
 * plan until that press; the bar says how much is waiting until then.
 */
export function RosterBar({
  kinds,
  waiting,
  clearing,
  today,
  monthStart,
  preview,
  onLeave,
  onClearing,
  onFill,
  onThrowAway,
  onApply,
}: {
  kinds: Template[]
  /** How many dates the draft holds. */
  waiting: number
  /** Whether a tap takes the kind off rather than walking to the next. */
  clearing: boolean
  today: string
  /** The first of the month on screen, where a cycle starts unless it is behind today. */
  monthStart: string
  /** What applying the draft would do, as lib/rosterPreview.ts reads it. */
  preview: RosterPreview
  onLeave: () => void
  onClearing: (next: boolean) => void
  onFill: (kinds: string[], from: string) => void
  onThrowAway: () => void
  /** Applies every date the draft holds except the ones left alone. */
  onApply: (leftOut: string[]) => void
}) {
  const [cycling, setCycling] = useState(false)
  const [applying, setApplying] = useState(false)
  const [leftOut, setLeftOut] = useState<string[]>([])
  // Thrown away while the preview was open, there is nothing left to say.
  const showingPreview = applying && waiting > 0
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
        {/* Apply says what it will do before it does it - section 6.1. It is
            the last thing in the row because it is the last thing done. */}
        {waiting > 0 && (
          <button
            type="button"
            className="btn-primary roster-apply"
            aria-expanded={applying}
            onClick={() => {
              setApplying(open => !open)
              setCycling(false)
            }}
          >
            Apply
          </button>
        )}
      </div>

      <div className="roster-bar-row roster-bar-said">
        <p className="muted roster-line">
          {clearing ? 'A tap takes the kind off a date.' : 'A tap walks a date through the kinds. Nothing reaches the plan until Apply.'}
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

      {showingPreview && (
        <div className="roster-preview" role="group" aria-label="What Apply will do">
          {preview.changing === 0 ? (
            <p className="muted roster-line">Nothing to apply: every date is already what the roster says.</p>
          ) : (
            <>
              {preview.weeks.map(week => (
                <div key={week.from} className="roster-preview-week">
                  <div className="roster-preview-week-head">
                    <span className="routines-group-label">{formatWeekTitle(weekOf(week.from), { short: true })}</span>
                    <span className="muted roster-preview-cost">{weekWords(week)}</span>
                  </div>
                  <ul className="roster-preview-dates">
                    {week.dates.map(date => {
                      const left = leftOut.includes(date.date)
                      const said = [
                        formatDayShort(date.date),
                        date.kind?.name ?? 'No kind',
                        date.hand ? `changed by hand: ${handWords(date.hand)}` : '',
                        left ? 'left alone' : '',
                      ]
                        .filter(Boolean)
                        .join(', ')
                      return (
                        <li key={date.date} className={left ? 'roster-preview-date is-left' : 'roster-preview-date'} aria-label={said}>
                          <span className="roster-preview-letter" style={{ ['--chip' as string]: date.kind?.color } as React.CSSProperties}>
                            {date.letter ?? ''}
                          </span>
                          <span className="roster-preview-day">{formatDayShort(date.date)}</span>
                          <span className="roster-preview-kind">{date.kind?.name ?? 'No kind'}</span>
                          {date.hand && (
                            <>
                              <span className="roster-preview-hand">changed by hand: {handWords(date.hand)}</span>
                              <button
                                type="button"
                                className={left ? 'roster-tool is-on' : 'roster-tool'}
                                aria-pressed={left}
                                onClick={() => setLeftOut(dates => (left ? dates.filter(d => d !== date.date) : [...dates, date.date]))}
                              >
                                Leave it
                              </button>
                            </>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
              {preview.unchanged > 0 && (
                <p className="muted roster-line">
                  {preview.unchanged} {preview.unchanged === 1 ? 'day is' : 'days are'} already what the roster says, and stay as they are.
                </p>
              )}
              <p className="muted roster-line">What you added by hand stays on every day either way.</p>
              <div className="roster-preview-actions">
                <button type="button" className="btn-quiet" onClick={() => setApplying(false)}>
                  Not now
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={preview.changing - leftOut.length === 0}
                  onClick={() => {
                    onApply(leftOut)
                    setApplying(false)
                    setLeftOut([])
                  }}
                >
                  Apply {preview.changing - leftOut.length} {preview.changing - leftOut.length === 1 ? 'day' : 'days'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

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
