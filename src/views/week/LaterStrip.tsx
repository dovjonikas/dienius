import { useEffect, useId, useRef, useState } from 'react'
import { actions, useAppData } from '../../lib/store'

export interface SomedayStripProps {
  /** Announced when something is dragged onto a day, for a screen reader. */
  onScheduled: (message: string) => void
}

/** How far a pointer has to travel before a press counts as a drag. */
const MIN_DRAG_DISTANCE_PX = 6

/**
 * The backlog, beside the week, and the one thing it is allowed to do there.
 *
 * The fourth shelf is deliberately hard to see: collapsed behind a plain
 * count on the day view, no badge, no colour, and it never comes looking for
 * you - CONVENTIONS section 14. None of that changes here. What changes is
 * that planning a week is the one moment when "what do I have that has no
 * day" is the question being asked, and answering it used to mean going to
 * the day view, opening a fold, and reading a list with no calendar next to
 * it.
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
 * and often no size - `scheduleBacklogItem` puts it where the day genuinely
 * has room, which is the same arithmetic the day view's own backlog pull uses
 * and the same answer quick-add's time control opens on.
 */
export function SomedayStrip({ onScheduled }: SomedayStripProps) {
  const data = useAppData()
  const [open, setOpen] = useState(false)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const listId = useId()
  const dragRef = useRef<{ id: string; title: string; x: number; y: number } | null>(null)

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
      if (actions.scheduleBacklogItem(drag.id, date)) {
        onScheduled(`${drag.title} is on ${date}`)
      }
    }
    document.addEventListener('pointerup', end)
    document.addEventListener('pointercancel', end)
    return () => {
      document.removeEventListener('pointerup', end)
      document.removeEventListener('pointercancel', end)
    }
  }, [onScheduled])

  // Nothing at all rather than an empty fold. A shelf with nothing on it is
  // not a thing to look at, and the week has no room to spare for one.
  if (items.length === 0) return null

  return (
    <div className={open ? 'someday open' : 'someday'}>
      <button
        type="button"
        className="done-toggle"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen(o => !o)}
      >
        <span className="done-caret" aria-hidden="true" />
        Someday
        {/* The count, in --faint, with no badge and no accent - the same rule
            the backlog fold and the scratch count already follow. A number
            that grows in red is a report card. */}
        <span className="backlog-count">{items.length}</span>
      </button>
      <ul className="someday-list" id={listId} hidden={!open}>
        {items.map(item => (
          <li key={item.id}>
            <button
              type="button"
              className={draggingId === item.id ? 'someday-item is-dragging' : 'someday-item'}
              // Drag onto a column to plan it. The press itself does nothing
              // else: an item here has no day, so there is no "open" for it to
              // do, and a tap that quietly scheduled it somewhere would be the
              // one thing this shelf must never do.
              onPointerDown={e => {
                if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
                  e.currentTarget.releasePointerCapture(e.pointerId)
                }
                dragRef.current = { id: item.id, title: item.title, x: e.clientX, y: e.clientY }
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
