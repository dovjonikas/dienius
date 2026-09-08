import { useEffect, useId, useRef, useState } from 'react'
import { actions, useAppData } from '../../lib/store'
import { busyIntervals, useCalendarCache } from '../../lib/calendars'
import { shortWeekday } from '../../lib/dates'
import { nextSlotFor } from '../../widgets/day-plan/laterSlot'

export interface LaterStripProps {
  /** Announced when something is dragged onto a day, for a screen reader. */
  onScheduled: (message: string) => void
}

/** How far a pointer has to travel before a press counts as a drag. */
const MIN_DRAG_DISTANCE_PX = 6

/**
 * Later, beside the week, and the one thing it is allowed to do there.
 *
 * The shelf is deliberately hard to see: collapsed behind a plain count on
 * the day view, no badge, no colour, and it never comes looking for you -
 * CONVENTIONS section 14. None of that changes here. What changes is that
 * planning a week is the one moment when "what do I have that has no day"
 * is the question being asked, and answering it used to mean going to the
 * day view, opening a fold, and reading a list with no calendar next to it.
 *
 * So the same list, collapsed the same way, sits under the seven columns. It
 * still says nothing until it is opened, it still shows nothing but a count,
 * and it still has no age, no order but its own, and no way to nag. Dragging
 * an item onto a column is the whole of what it adds: what you have without a
 * day, beside what you have with one, and one gesture between them.
 *
 * The drop lands the item at the day's next free slot rather than at the
 * height it was dropped on. A week column is a timeline and a drop halfway
 * down it looks like it means 13:40, but the item being dragged has no time
 * and often no size - `nextSlotFor` puts it where the day genuinely has
 * room, which is the same arithmetic the day view's own pull uses and the
 * same answer quick-add's time control opens on. Until v2.7 this comment
 * said so while the drop itself landed the item with no time at all; the
 * arithmetic is shared now, so the sentence is true.
 */
export function LaterStrip({ onScheduled }: LaterStripProps) {
  const data = useAppData()
  const calendarCache = useCalendarCache()
  const [open, setOpen] = useState(false)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const listId = useId()
  const dragRef = useRef<{ id: string; title: string; minutes?: number; x: number; y: number } | null>(null)

  // Later's field keeps its wire name - see LaterItem in types.ts.
  const items = data.backlog

  useEffect(() => {
    function end(e: PointerEvent) {
      const drag = dragRef.current
      dragRef.current = null
      setDraggingId(null)
      if (!drag) return
      if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < MIN_DRAG_DISTANCE_PX) return

      const date = document
        .elementFromPoint(e.clientX, e.clientY)
        ?.closest<HTMLElement>('[data-week-date]')?.dataset.weekDate
      if (!date) return
      const now = new Date()
      const time = nextSlotFor({
        data,
        date,
        minutes: drag.minutes,
        busy: busyIntervals(date, data.settings.calendars, calendarCache),
        nowMinutes: now.getHours() * 60 + now.getMinutes(),
      })
      if (actions.scheduleLaterItem(drag.id, date, time)) {
        // The day's name, not its ISO key: "Move the ISA is on Tue" is a
        // sentence, "Move the ISA is on 2026-09-08" is a log line.
        onScheduled(`${drag.title} is on ${shortWeekday(date)}`)
      }
    }
    document.addEventListener('pointerup', end)
    document.addEventListener('pointercancel', end)
    return () => {
      document.removeEventListener('pointerup', end)
      document.removeEventListener('pointercancel', end)
    }
  }, [onScheduled, data, calendarCache])

  // Nothing at all rather than an empty fold. A shelf with nothing on it is
  // not a thing to look at, and the week has no room to spare for one.
  if (items.length === 0) return null

  return (
    <div className={open ? 'later-strip open' : 'later-strip'}>
      <button
        type="button"
        className="done-toggle"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen(o => !o)}
      >
        <span className="done-caret" aria-hidden="true" />
        Later
        {/* The count, in --faint, with no badge and no accent - the same rule
            the day view's fold and the scratch count already follow. A number
            that grows in red is a report card. */}
        <span className="later-count">{items.length}</span>
      </button>
      <ul className="later-strip-list" id={listId} hidden={!open}>
        {items.map(item => (
          <li key={item.id}>
            <button
              type="button"
              className={draggingId === item.id ? 'later-strip-item is-dragging' : 'later-strip-item'}
              // Drag onto a column to plan it. The press itself does nothing
              // else: an item here has no day, so there is no "open" for it to
              // do, and a tap that quietly scheduled it somewhere would be the
              // one thing this shelf must never do.
              onPointerDown={e => {
                if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
                  e.currentTarget.releasePointerCapture(e.pointerId)
                }
                dragRef.current = { id: item.id, title: item.title, minutes: item.minutes, x: e.clientX, y: e.clientY }
                setDraggingId(item.id)
              }}
            >
              {item.title}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
