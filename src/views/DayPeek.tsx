import { useLayoutEffect, useRef, useState } from 'react'
import { useAppData } from '../lib/store'
import { formatDayTitle } from '../lib/dates'
import { resolveTemplate } from '../lib/calendarCell'
import { hasJournal } from '../lib/journal'
import { sortTasks } from '../widgets/day-plan/sort'
import { placeDayCard, type Rect } from './dayCardPlacement'

export interface DayPeekProps {
  date: string
  /** The cell it is about, and the grid it may not leave. */
  anchor: HTMLElement | null
  bounds: HTMLElement | null
  /** Whether anything was written on this day - the calendar walks the note stream once, for the whole grid. */
  noted: boolean
}

/** How many key tasks are named before the rest become a number. */
const KEY_NAMES = 3

function rectOf(el: HTMLElement): Rect {
  const box = el.getBoundingClientRect()
  return { x: box.left, y: box.top, w: box.width, h: box.height }
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
}

/**
 * What is on a day, without pressing anything.
 *
 * ## Why this is allowed to exist when the hover card was not
 *
 * Until v2.8 resting on a cell for 400ms opened the day card - the real one,
 * with its tick boxes and its four doors - and it closed the moment the
 * pointer left the cell, so the pointer could never reach it. Everything on
 * it was readable and nothing on it was reachable, and the owner said so:
 * *"we cannot move the mouse down onto that list"*. A state nobody can act on
 * is one CONVENTIONS section 25 does not keep, and it went.
 *
 * This is the other half of that reading, and the difference is the whole
 * design: **there is nothing here to reach.** No button, no box to tick, no
 * link. It is four facts about a day, and a surface that asks nothing of the
 * pointer cannot be a surface the pointer fails to arrive at. The card still
 * opens on a press and is still the only thing that acts.
 *
 * ## What it says
 *
 * Which day, what shape of day it came from, how much is on it and which of
 * that is key, and whether anything was written that day. The cell already
 * carries two or three of the day's lines; this is the count behind them,
 * the key ones by name, and the two marks in the corner spelled out.
 *
 * ## What it is careful about
 *
 * - **It never covers the day it is about.** `placeDayCard` puts it against
 *   the cell on whichever side has room, and its last resort - covering the
 *   cell - is refused here rather than taken: if the only place it fits is
 *   over its own subject, it does not appear at all.
 * - **It never moves anything.** Fixed to the page, out of the flow, so
 *   nothing under it shifts by a pixel when it appears. CONVENTIONS 24 is
 *   about layout moving under a pointer; a layer arriving over the top is
 *   not that, and it arrives on a fade rather than a slide.
 * - **It is not read aloud.** The cell's own `aria-label` already says the
 *   same facts to a screen reader - see `cellLabel` - so a second copy in
 *   the tree would be the same day announced twice. This is the eye's copy.
 */
export function DayPeek({ date, anchor, bounds, noted }: DayPeekProps) {
  const data = useAppData()
  const ref = useRef<HTMLDivElement>(null)
  const [spot, setSpot] = useState<{ left: number; top: number } | null>(null)
  const [fits, setFits] = useState(true)

  const day = data.days[date]
  const tasks = sortTasks(day?.tasks ?? [])
  const keys = tasks.filter(t => t.highlight)
  const template = resolveTemplate(day?.templateId ?? null, data.templates)
  const journalled = hasJournal(day)

  useLayoutEffect(() => {
    const peek = ref.current
    if (!peek || !anchor || !bounds) return
    function place() {
      const cell = rectOf(anchor!)
      const size = { w: peek!.offsetWidth, h: peek!.offsetHeight }
      const at = placeDayCard(cell, size, rectOf(bounds!), { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight })
      // The refusal, rather than the clamp: a layer over the day it
      // describes is worse than no layer, because the three lines it is a
      // longer copy of are the ones it would be hiding.
      setFits(!overlaps({ x: at.left, y: at.top, w: size.w, h: size.h }, cell))
      setSpot({ left: at.left, top: at.top })
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [anchor, bounds, date])

  return (
    <div
      ref={ref}
      className="day-peek"
      aria-hidden="true"
      hidden={!fits}
      style={spot ? { left: `${spot.left}px`, top: `${spot.top}px` } : { opacity: 0 }}
    >
      <span className="day-peek-date">{formatDayTitle(date)}</span>
      {template && (
        <span className="day-peek-template">
          <span className="day-peek-dot" style={{ ['--chip' as string]: template.color }} />
          {template.name}
        </span>
      )}
      <span className="day-peek-count">
        {tasks.length === 0
          ? 'Nothing on it'
          : `${tasks.length} ${tasks.length === 1 ? 'task' : 'tasks'}${keys.length > 0 ? `, ${keys.length} key` : ''}`}
      </span>
      {keys.length > 0 && (
        <ul className="day-peek-keys">
          {keys.slice(0, KEY_NAMES).map(t => (
            <li key={t.id}>{t.title}</li>
          ))}
          {keys.length > KEY_NAMES && <li className="day-peek-more">and {keys.length - KEY_NAMES} more</li>}
        </ul>
      )}
      {(journalled || noted) && (
        <span className="day-peek-written">
          {journalled && noted ? 'Journal and a note' : journalled ? 'Journal written' : 'A note written'}
        </span>
      )}
    </div>
  )
}
