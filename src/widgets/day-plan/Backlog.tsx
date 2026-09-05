import { useId, useRef, useState } from 'react'
import { actions, useAppData } from '../../lib/store'
import { categoryColor, categoryLabel } from '../../lib/categories'
import { useCalendarCache, busyIntervals } from '../../lib/calendars'
import { todayKey } from '../../lib/dates'
import { useListReorder } from '../../views/useListReorder'
import { Explain } from '../../views/Explain'
import { formatDuration } from './capacity'
import { suggestSlot } from './autoSlot'

export interface BacklogProps {
  /** The day an item is pulled onto. */
  date: string
}

/**
 * The things you have decided to do that are not for any particular day.
 *
 * The fourth shelf, and the one that had to argue hardest for its place. A
 * scratch note is text with nothing attached; an inbox line is a thought
 * nobody has decided about yet; a float is a task on a day with no time. None
 * of them is "I am definitely doing this, just not this week", and that is
 * the thing that used to sit in the inbox being re-read every morning because
 * there was nowhere else for it to go.
 *
 * The whole design is in what it does *not* do. It is collapsed by default
 * behind a count, exactly like the inbox and the Done fold - so the day view
 * never mentions it unless you go looking. Nothing shows how old an item is,
 * and nothing can, because nothing records it (see `BacklogItem`). There is
 * no badge colour, no "overdue", no count in the header, and no nudge. A list
 * with two hundred things in it must be able to sit there saying nothing,
 * because the alternative is the thing this app exists to take away.
 *
 * What it *does* do is be easy to pull from. One press puts an item on the
 * day at the next free slot that holds it - the same arithmetic quick-add's
 * own time control uses - carrying its size and its colour with it, and takes
 * it out of the backlog in the same commit.
 */
export function Backlog({ date }: BacklogProps) {
  const data = useAppData()
  const calendarCache = useCalendarCache()
  const [open, setOpen] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const listId = useId()
  const listRef = useRef<HTMLUListElement>(null)
  const reorder = useListReorder(listRef, (id, to) => actions.moveBacklogItem(id, to))
  const items = data.backlog

  if (items.length === 0) return null

  const day = data.days[date]
  const template = day?.templateId ? data.templates.find(t => t.id === day.templateId) : undefined
  const now = new Date()

  /**
   * Where this item would go on the day being looked at. Worked out at the
   * moment of the press rather than shown on the row: a backlog that displays
   * a time for every line has quietly become a plan for a day nobody made.
   */
  function slotFor(minutes: number | undefined): string | undefined {
    return suggestSlot({
      tasks: day?.tasks ?? [],
      durationMinutes: minutes ?? 30,
      busy: busyIntervals(date, data.settings.calendars, calendarCache),
      sleepProfileId: day?.sleepProfileId ?? template?.sleepProfileId,
      sleep: { profiles: data.settings.sleepProfiles },
      notBefore: date === todayKey() ? now.getHours() * 60 + now.getMinutes() : undefined,
    })
  }

  return (
    <div className={open ? 'backlog-section open' : 'backlog-section'}>
      <div className="shelf-head">
        <button
          type="button"
          className="done-toggle"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen(o => !o)}
        >
          <span className="done-caret" aria-hidden="true" />
          Backlog
          {/* The count, and nothing else. In --faint, with no accent and no
              badge colour - the same rule the scratch count follows. A number
              that grows in red is a report card. */}
          <span className="backlog-count">{items.length}</span>
        </button>
        <Explain id="backlog" align="end" />
      </div>
      <ul className="backlog-list" id={listId} ref={listRef}>
        {items.map((item, index) => (
          <li
            key={item.id}
            className={[
              'backlog-item',
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
                actions.moveBacklogItem(item.id, index + (e.key === 'ArrowUp' ? -1 : 1))
              }}
            >
              <span className="library-item-grip-dots" aria-hidden="true" />
            </button>
            <span className="backlog-item-main">
              <span className="backlog-item-title">{item.title}</span>
              <span className="backlog-item-meta">
                {item.category && (
                  <span
                    className="backlog-item-cat"
                    style={{ ['--cat' as string]: categoryColor(item.category, data.categories) } as React.CSSProperties}
                  >
                    {categoryLabel(item.category, data.categories)}
                  </span>
                )}
                {item.minutes !== undefined && <span className="backlog-item-size">{formatDuration(item.minutes)}</span>}
              </span>
            </span>
            <div className="backlog-item-actions">
              <button
                type="button"
                className="inbox-item-plan"
                aria-label={`Put "${item.title}" on this day`}
                onClick={() => actions.scheduleBacklogItem(item.id, date, slotFor(item.minutes))}
              >
                Add to day
              </button>
              {/* The same confirming second tap the inbox and the if-then
                  board already take. This is a decision somebody made once
                  and deliberately parked; a stray thumb should not lose it. */}
              <button
                type="button"
                className={confirmId === item.id ? 'inbox-item-delete danger' : 'inbox-item-delete'}
                aria-label={confirmId === item.id ? `Confirm delete "${item.title}"` : `Delete "${item.title}"`}
                onBlur={() => setConfirmId(current => (current === item.id ? null : current))}
                onClick={() => {
                  if (confirmId === item.id) {
                    actions.deleteBacklogItem(item.id)
                    setConfirmId(null)
                  } else {
                    setConfirmId(item.id)
                  }
                }}
              >
                {confirmId === item.id ? 'Sure?' : '×'}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
