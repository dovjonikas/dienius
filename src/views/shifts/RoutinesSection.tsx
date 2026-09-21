import { useState } from 'react'
import { actions, getData, useAppData } from '../../lib/store'
import { dayKinds } from '../../lib/dayKinds'
import { addDays, shortWeekday, longWeekday } from '../../lib/dates'
import { offerUndo } from '../../lib/undo'
import { defaultCategoryId, resolvedColor } from '../../lib/categories'
import type { CategoryId } from '../../lib/categories'
import type { Routine, Template } from '../../lib/types'
import { DurationControl } from '../DurationControl'
import { TimePicker } from '../TimePicker'
import { Explain } from '../Explain'

/** A Sunday, from which weekday 0 to 6 is that many days on - for their names. */
const A_SUNDAY = '2026-09-20'

/** The week as it is read here: Monday first, Sunday last. */
const WEEK = [1, 2, 3, 4, 5, 6, 0]

const dayName = (weekday: number) => longWeekday(addDays(A_SUNDAY, weekday))
const dayShort = (weekday: number) => shortWeekday(addDays(A_SUNDAY, weekday))

/** A routine's rule as one string, for telling a change of rule from a change of name. */
function ruleOf(routine: Routine): string {
  const times = Object.entries(routine.times)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([kind, time]) => `${kind}:${time}`)
    .join(',')
  return `${routine.minutes}|${[...routine.weekdays].sort((a, b) => a - b).join('')}|${times}`
}

/** What a routine is, in one line: its days, its length, and its time on each kind. */
function routineLine(routine: Routine, kinds: Template[]): string {
  const days = WEEK.filter(d => routine.weekdays.includes(d)).map(dayShort).join(', ')
  const times = kinds.map(k => `${k.dayKind!.letter} ${routine.times[k.id] ?? 'needs a time'}`)
  return [days, `${routine.minutes} min`, ...times].join(' · ')
}

/**
 * Routines - rotating shifts, since v2.29, and docs/RESEARCH-SHIFTS.md section
 * 2.3. A routine is a commitment written once: a name, a category, a length,
 * the weekdays it is on, and a time for each kind of day, because the gym is at
 * five on a day shift and at nine after nights. Composition puts it on the
 * dates that match (`shiftDay.ts`); this is where it is written.
 *
 * It stands on the Templates tab, under the templates, because a kind of day is
 * a day template: the times a routine is asked for are the templates in the
 * list above it, read in the same breath.
 *
 * **Nothing is here until there is a kind of day.** A routine does nothing on a
 * date with no kind, so with no template marked the section is not drawn at all
 * - the offer is made where a kind is made, in a day template's own editor, and
 * this appears the moment one exists.
 *
 * **A kind with no time is left with none.** The day says a routine needs a
 * time there; the app never borrows the time from another kind or finds a gap -
 * that would put a gym session inside a shift.
 *
 * **A rule that changed is offered to the days ahead, once** - section 6.4. The
 * days already stamped from a routine are days somebody may have looked at, so
 * nothing follows the new rule without the press; what follows it is only what
 * still says what the rule said, and a date behind today is never touched.
 */
export function RoutinesSection() {
  const data = useAppData()
  const kinds = dayKinds(data.templates)
  const [open, setOpen] = useState<{ id?: string } | null>(null)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<CategoryId | undefined>(undefined)
  const [minutes, setMinutes] = useState(30)
  const [weekdays, setWeekdays] = useState<number[]>([])
  const [times, setTimes] = useState<Record<string, string>>({})
  /** The routine whose rule just changed, while the offer about it stands. */
  const [changed, setChanged] = useState<string | null>(null)

  if (kinds.length === 0) return null

  function start(routine?: Routine) {
    setOpen({ id: routine?.id })
    setTitle(routine?.title ?? '')
    setCategory(routine?.category ?? defaultCategoryId(data.categories))
    setMinutes(routine?.minutes ?? 30)
    setWeekdays(routine?.weekdays ?? [])
    setTimes(routine ? { ...routine.times } : {})
  }

  function save() {
    if (!open) return
    const input = { title, category, minutes, weekdays, times }
    if (open.id) {
      // What the days were made from, and what they would be made from now.
      // Compared after the write rather than before it, so the comparison is
      // against what was actually kept - cleanRoutine drops a time for a kind
      // that is no longer one, and that is not a change to offer.
      const before = data.routines.find(r => r.id === open.id)
      actions.updateRoutine(open.id, input)
      const after = getData().routines.find(r => r.id === open.id)
      setChanged(before && after && ruleOf(before) !== ruleOf(after) ? after.title : null)
    } else {
      actions.addRoutine(input)
    }
    setOpen(null)
  }

  function follow() {
    const { undo } = actions.followRoutines()
    offerUndo('The days ahead follow it', undo)
    setChanged(null)
  }

  function remove(routine: Routine) {
    const { undo } = actions.removeRoutine(routine.id)
    offerUndo(`${routine.title} removed`, undo)
  }

  const canSave = title.trim().length > 0 && weekdays.length > 0

  return (
    <section className="routines" aria-labelledby="routines-heading">
      <div className="routines-head">
        <h3 id="routines-heading">Routines</h3>
        {!open && (
          <button type="button" className="btn-secondary" onClick={() => start()}>
            New routine
          </button>
        )}
      </div>
      <p className="muted routines-line">
        <Explain id="routine" inline />
      </p>

      {data.routines.length > 0 && (
        <ul className="routines-list">
          {data.routines.map(routine => (
            <li key={routine.id} className="routines-row">
              <span className="routines-row-title">{routine.title}</span>
              <span className="routines-row-line">{routineLine(routine, kinds)}</span>
              <button type="button" className="btn-quiet" aria-label={`Edit ${routine.title}`} onClick={() => start(routine)}>
                Edit
              </button>
              <button type="button" className="btn-quiet" aria-label={`Remove ${routine.title}`} onClick={() => remove(routine)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      {data.routines.length === 0 && !open && <p className="routines-none">Nothing yet.</p>}

      {/* Offered where the routine was saved, and only until it is answered.
          Neither answer is the loud one: a day already stamped is somebody's. */}
      {changed && (
        <div className="routines-offer" role="status">
          <span className="routines-offer-said">{changed} changed. The days ahead can follow it.</span>
          <button type="button" className="btn-secondary" onClick={follow}>
            Update them
          </button>
          <button type="button" className="btn-quiet" onClick={() => setChanged(null)}>
            Leave them
          </button>
        </div>
      )}

      {open && (
        <div className="routines-form">
          <div className="routines-form-row">
            <label className="field routines-name">
              <span className="field-label">Name</span>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="What you do" autoFocus />
            </label>
            <div className="field">
              <span className="field-label">For</span>
              <DurationControl minutes={minutes} stepperLabel="For, in minutes" onChange={m => setMinutes(m ?? 30)} />
            </div>
          </div>

          <div className="field">
            <span className="field-label">On these days</span>
            <div className="duration-chips routines-days" role="group" aria-label="On these days">
              {WEEK.map(weekday => (
                <button
                  key={weekday}
                  type="button"
                  className={weekdays.includes(weekday) ? 'is-on' : ''}
                  aria-label={dayName(weekday)}
                  aria-pressed={weekdays.includes(weekday)}
                  onClick={() => setWeekdays(days => (days.includes(weekday) ? days.filter(d => d !== weekday) : [...days, weekday]))}
                >
                  {dayShort(weekday)}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <span className="field-label">Category</span>
            <div className="category-picker" role="group" aria-label="Category for this routine">
              {data.categories.map(c => (
                <button
                  key={c.id}
                  type="button"
                  className={c.id === category ? 'category-swatch selected' : 'category-swatch'}
                  style={{ ['--cat' as string]: resolvedColor(c) } as React.CSSProperties}
                  aria-pressed={c.id === category}
                  aria-label={c.label}
                  data-tip={c.label}
                  onClick={() => setCategory(c.id)}
                />
              ))}
            </div>
          </div>

          {/* A time for each kind of day, and none is an answer: the day it
              lands on says it needs one rather than the app inventing it. */}
          <div className="field">
            <span className="routines-group-label">At, on each kind of day</span>
            <div className="routines-times">
              {kinds.map(kind => (
                <div key={kind.id} className="field routines-time">
                  <span className="field-label">
                    {kind.dayKind!.letter} {kind.name}
                  </span>
                  <TimePicker
                    value={times[kind.id] ?? ''}
                    ariaLabel={`Time on ${kind.name}`}
                    placeholder="No time"
                    onChange={next => setTimes(t => ({ ...t, [kind.id]: next }))}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="routines-form-actions">
            <button type="button" className="btn-quiet" onClick={() => setOpen(null)}>
              Cancel
            </button>
            <button type="button" className="btn-primary" disabled={!canSave} onClick={save}>
              Save routine
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
