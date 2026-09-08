import { useLayoutEffect, useRef, useState } from 'react'
import { actions, useAppData } from '../lib/store'
import { formatDayTitle } from '../lib/dates'
import { dayStat } from '../lib/dayStats'
import { resolveTemplate } from '../lib/calendarCell'
import { categoryColor } from '../lib/categories'
import { useClickAway } from '../lib/useClickAway'
import { useRestoreFocus } from '../lib/useRestoreFocus'
import { sortTasks } from '../widgets/day-plan/sort'
import { placeDayCard, type Rect } from './dayCardPlacement'
import { clearDayNow, clearDayQuestion } from './clearDay'

export interface DayCardProps {
  date: string
  /**
   * The cell this card belongs to, and the grid it may not leave. Null in a
   * test that renders the card on its own, where jsdom has no layout to
   * measure anyway and the card simply draws where it is put.
   */
  anchor?: HTMLElement | null
  bounds?: HTMLElement | null
  onClose: () => void
  onOpenDay: () => void
  /** What was written on this day - see the note about honesty below. */
  onOpenNotes: () => void
  onOpenJournal: () => void
  /** Something came up on this day. Offered for today and the days ahead; nothing can come up in a day that has passed. */
  onInterrupt?: () => void
}

function rectOf(el: HTMLElement): Rect {
  const box = el.getBoundingClientRect()
  return { x: box.left, y: box.top, w: box.width, h: box.height }
}

/**
 * The whole of a day, without leaving the month.
 *
 * A month cell can hold three lines. A day has ten. The gap between those two
 * numbers is the reason the calendar read as unclear: everything past the
 * third line was reachable only by opening the day, which means leaving the
 * month, which means losing the thing you came to the month for - the shape
 * of the week around it.
 *
 * ## It opens, it does not peek
 *
 * Until v2.8 this appeared when a mouse rested on a cell for 400ms and left
 * the moment the pointer did - which meant the pointer could never get to
 * it. Everything on it was readable and nothing on it was reachable, and the
 * owner said so: *"we cannot move the mouse down onto that list"*. A state
 * nobody can act on is one CONVENTIONS section 25 does not keep, so the
 * hover went with its timer and a press opens this instead. It stays open
 * until Escape, a press outside it, or its own Close, and focus goes back to
 * the cell it came from. The quiet hint the hover was really for is still
 * there and always was: the cell says what is on the day.
 *
 * ## What it carries, and why it is allowed more than three things
 *
 * The old rule here was three actions and no more, and the reason was
 * exactly that this was a menu appearing because a cursor had stopped
 * moving. A surface somebody opened on purpose is allowed to carry what they
 * opened it for: the day's tasks, tickable where they are read, so ticking
 * one here ticks the day; the day itself; whatever was written on it; and
 * the one thing a week stamped mid-week needs, which is a way to empty a day
 * that has already been half lived.
 *
 * The one action that went is Stamp. It was here because the preview could
 * appear while a template was in hand, and a card cannot: a template in hand
 * turns every cell into a brush, so the press that used to open this stamps
 * instead and there is nothing for the button to add.
 *
 * ## What it is careful about
 *
 * - **No count of what was missed.** "6 of 9" is a fact about a list. "3
 *   missed" is a verdict, and this app does not hand those out - the same
 *   rule the evening close and the day stats already keep.
 * - **Notes are read by day, never written by day.** A note carries the date
 *   it was written on, so "what was written on Wednesday" is a reading of the
 *   one stream rather than a second place to put things - see
 *   `lib/scratch.ts` and CONVENTIONS section 11. Nothing here writes one.
 * - **It touches its cell.** See `dayCardPlacement.ts`: the gap is what the
 *   pointer could not cross.
 */
export function DayCard({
  date,
  anchor,
  bounds,
  onClose,
  onOpenDay,
  onOpenNotes,
  onOpenJournal,
  onInterrupt,
}: DayCardProps) {
  useRestoreFocus()
  const data = useAppData()
  const ref = useRef<HTMLDivElement>(null)
  const [spot, setSpot] = useState<{ left: number; top: number } | null>(null)
  const [armed, setArmed] = useState(false)
  const day = data.days[date]
  const tasks = sortTasks(day?.tasks ?? [])
  const template = resolveTemplate(day?.templateId, data.templates)
  const stat = dayStat(day)

  useClickAway(ref, true, onClose)

  // Measured rather than flipped by four nth-child rules the way the hover
  // preview was: those knew which column a cell was in and nothing about how
  // tall the card had come out, so a long day in the last row went off the
  // bottom of the grid. A layout effect, so the card is placed before it is
  // painted rather than one frame after.
  useLayoutEffect(() => {
    const card = ref.current
    if (!card || !anchor || !bounds) return
    function place() {
      const host = card!.offsetParent
      const origin = host instanceof HTMLElement ? host.getBoundingClientRect() : { left: 0, top: 0 }
      const at = placeDayCard(
        rectOf(anchor!),
        { w: card!.offsetWidth, h: card!.offsetHeight },
        rectOf(bounds!),
        { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight },
      )
      setSpot({ left: at.left - origin.left, top: at.top - origin.top })
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [anchor, bounds, date])

  return (
    <div
      ref={ref}
      className="day-card"
      role="dialog"
      aria-label={formatDayTitle(date)}
      data-keeps-keys=""
      style={spot ? { left: `${spot.left}px`, top: `${spot.top}px` } : undefined}
    >
      <div className="day-card-head">
        <span className="day-card-date">{formatDayTitle(date)}</span>
        {template && <span className="day-card-template">{template.name}</span>}
        <button type="button" className="day-card-close" aria-label="Close" onClick={onClose}>
          &times;
        </button>
      </div>

      {tasks.length === 0 ? (
        <p className="day-card-empty">Nothing on this day yet.</p>
      ) : (
        <ul className="day-card-list">
          {tasks.map(t => {
            const color = categoryColor(t.category, data.categories) ?? template?.color
            return (
              <li
                key={t.id}
                className={[t.done ? 'is-done' : '', t.highlight ? 'is-key' : ''].filter(Boolean).join(' ')}
                style={color ? ({ ['--block' as string]: color } as React.CSSProperties) : undefined}
              >
                {/* The task list's own contract, so a tick here is a tick on
                    the day: the real checkbox carries the name and the drawn
                    box beside it is what a finger lands on. See TaskRow. */}
                <label className="day-card-check">
                  <input
                    type="checkbox"
                    checked={!!t.done}
                    aria-label={t.title}
                    onChange={() => actions.toggleTask(date, t.id)}
                  />
                  <span className="check" aria-hidden="true" />
                  <span className="day-card-time">{t.time ?? ''}</span>
                  <span className="day-card-title">{t.title}</span>
                </label>
              </li>
            )
          })}
        </ul>
      )}

      {/* Two facts, and neither is a verdict: how much of the list happened,
          and how much of it moved to another day. No third line counting what
          did not - see the doc comment above. */}
      {stat.rate !== null && (
        <p className="day-card-stats">
          <span>
            {stat.done} of {stat.total} done
          </span>
          {stat.pushed > 0 && <span>{stat.pushed} moved on</span>}
        </p>
      )}

      {armed ? (
        /* Asked in the card, in the place the press was made, rather than in
           a sheet over the month: a modal for a one-line question is a second
           surface for one decision - the same shape the template rail's
           "Replace X with Y?" already takes. */
        <div className="day-card-ask">
          <p className="day-card-question">{clearDayQuestion(date, tasks.length)}</p>
          <div className="day-card-actions">
            <button
              type="button"
              className="btn-danger is-armed"
              onClick={() => {
                clearDayNow(date)
                setArmed(false)
              }}
            >
              Clear
            </button>
            <button type="button" className="btn-secondary" onClick={() => setArmed(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="day-card-actions">
            <button type="button" className="btn-secondary" onClick={onOpenDay}>
              Open day
            </button>
            {/* Plain words, and no count on either: the cell this card is
                anchored to already carries the two marks that say whether
                anything is written here, and a number on the button would be
                the same fact said twice one inch apart - CONVENTIONS section
                23. What each opens is that day's, not the general view. */}
            <button type="button" className="btn-secondary" onClick={onOpenNotes}>
              Notes
            </button>
            <button type="button" className="btn-secondary" onClick={onOpenJournal}>
              Journal
            </button>
            {onInterrupt && (
              <button type="button" className="btn-secondary" onClick={onInterrupt}>
                Something came up
              </button>
            )}
          </div>
          {tasks.length > 0 && (
            <div className="day-card-actions">
              <button type="button" className="btn-danger day-card-clear" onClick={() => setArmed(true)}>
                Clear this day
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
