import { useId, useRef, useState } from 'react'
import { actions, useAppData } from '../../lib/store'
import { categoryColor, categoryLabel } from '../../lib/categories'
import { useCalendarCache, busyIntervals } from '../../lib/calendars'
import { useListReorder } from '../../views/useListReorder'
import { Explain } from '../../views/Explain'
import { formatDuration } from './capacity'
import { nextSlotFor } from './laterSlot'

export interface LaterProps {
  /** The day an item is pulled onto. */
  date: string
}

/**
 * Later: the things to do that are not for any particular day.
 *
 * The one undated shelf, since v2.7 - the inbox and the backlog before it
 * were two folds whose rows looked the same and had the same two ways out,
 * and the only thing "decided" ever tracked was which button had been
 * pressed. See docs/STATE.md, the v2.7 decisions, and `LaterItem`.
 *
 * The whole design is in what it does *not* do. It is collapsed by default
 * behind a count, exactly like the Done fold - so the day view never
 * mentions it unless you go looking. Nothing shows how old an item is, and
 * nothing can, because nothing records it. There is no badge colour, no
 * "overdue", no count in the header, and no nudge. A list with two hundred
 * things in it must be able to sit there saying nothing, because the
 * alternative is the thing this app exists to take away.
 *
 * What it *does* do is be easy to pull from. One press puts an item on the
 * day at the next free slot that holds it - the same arithmetic quick-add's
 * own time control uses, see laterSlot.ts - carrying its size and its colour
 * with it, and takes it out of Later in the same commit.
 */
export function Later({ date }: LaterProps) {
  const data = useAppData()
  const calendarCache = useCalendarCache()
  const [open, setOpen] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const listId = useId()
  const listRef = useRef<HTMLUListElement>(null)
  const reorder = useListReorder(listRef, (id, to) => actions.moveLaterItem(id, to))
  // Later's field keeps its wire name - see LaterItem in types.ts.
  const items = data.backlog

  if (items.length === 0) return null

  function pull(id: string, minutes: number | undefined) {
    const now = new Date()
    const time = nextSlotFor({
      data,
      date,
      minutes,
      busy: busyIntervals(date, data.settings.calendars, calendarCache),
      nowMinutes: now.getHours() * 60 + now.getMinutes(),
    })
    actions.scheduleLaterItem(id, date, time)
  }

  return (
    <div className={open ? 'later-section open' : 'later-section'}>
      {/* The sentence hangs off the fold itself - see views/Explain.tsx for
          why it has no marker of its own. */}
      <Explain id="later" className="explain-block">
        <button
          type="button"
          className="done-toggle"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen(o => !o)}
        >
          <span className="done-caret" aria-hidden="true" />
          Later
          {/* The count, and nothing else. In --faint, with no accent and no
              badge colour - the same rule the scratch count follows. A number
              that grows in red is a report card. */}
          <span className="later-count">{items.length}</span>
        </button>
      </Explain>
      <ul className="later-list" id={listId} ref={listRef}>
        {items.map((item, index) => (
          <li
            key={item.id}
            className={[
              'later-item',
              reorder.draggingId === item.id ? 'is-dragging' : '',
              reorder.overIndex === index && reorder.draggingId !== null && reorder.draggingId !== item.id ? 'is-over' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            data-reorder-index={index}
          >
            {/* Order is the only ranking this list has, so it has to be
                reachable by every input: dragged with a finger or a pointer,
                and nudged a place at a time with the arrow keys. */}
            <button
              type="button"
              className="library-item-grip"
              aria-label={`Reorder ${item.title}, position ${index + 1} of ${items.length}`}
              onPointerDown={e => reorder.start(item.id, index, e)}
              onKeyDown={e => {
                if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
                e.preventDefault()
                actions.moveLaterItem(item.id, index + (e.key === 'ArrowUp' ? -1 : 1))
              }}
            >
              <span className="library-item-grip-dots" aria-hidden="true" />
            </button>
            <span className="later-item-main">
              <span className="later-item-title">{item.title}</span>
              <span className="later-item-meta">
                {item.category && (
                  <span
                    className="later-item-cat"
                    style={{ ['--cat' as string]: categoryColor(item.category, data.categories) } as React.CSSProperties}
                  >
                    {categoryLabel(item.category, data.categories)}
                  </span>
                )}
                {item.minutes !== undefined && <span className="later-item-size">{formatDuration(item.minutes)}</span>}
              </span>
            </span>
            <div className="later-item-actions">
              <button
                type="button"
                className="later-item-plan"
                aria-label={`Put "${item.title}" on this day`}
                onClick={() => pull(item.id, item.minutes)}
              >
                Onto this day
              </button>
              {/* The same confirming second tap the if-then board already
                  takes. This is something somebody wrote down and parked
                  on purpose; a stray thumb should not lose it. */}
              <button
                type="button"
                className={confirmId === item.id ? 'later-item-delete danger' : 'later-item-delete'}
                aria-label={confirmId === item.id ? `Confirm delete "${item.title}"` : `Delete "${item.title}"`}
                onBlur={() => setConfirmId(current => (current === item.id ? null : current))}
                onClick={() => {
                  if (confirmId === item.id) {
                    actions.deleteLaterItem(item.id)
                    setConfirmId(null)
                  } else {
                    setConfirmId(item.id)
                  }
                }}
              >
                {confirmId === item.id ? 'Delete?' : '×'}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
