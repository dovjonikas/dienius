import { useEffect, useRef } from 'react'
import type { Task } from '../../lib/types'
import { formatDuration, isAnchor } from './capacity'
import { canPlaceFloatInGap } from './gapPlacement'
import { computeTimelineLayout, formatClock, type TimelineGap } from './timelineLayout'

export interface TaskActionsSheetProps {
  /** The task the row was long-pressed on. */
  task: Task
  /** The day's full task list - needed to compute which gaps exist at all. */
  tasks: Task[]
  onPlace: (taskId: string, time: string) => void
  onUnanchor: (taskId: string) => void
  onClose: () => void
}

const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

/**
 * The touch-safe fallback docs/TIMELINE.md section 5 asks for: "a
 * long-press menu does the same thing, because the calendar drag already
 * has a documented history of not working on touch in this repo." Opened
 * by holding a task's row - see `useLongPress.ts` - it does exactly the
 * two things step 7's drag does, through the same store actions
 * (`placeFloat` / `unanchorTask` in `store.ts`, called by the caller via
 * `onPlace`/`onUnanchor`) rather than a third path.
 *
 * A plain, hand-rolled dialog, mirroring `GapPicker.tsx` exactly: focus
 * moves to the dialog on open, Escape and the scrim close it, Tab is
 * trapped to the sheet's own controls.
 *
 * For a float, the gaps offered are computed straight from `tasks` via
 * `computeTimelineLayout` and filtered with `canPlaceFloatInGap` - the
 * same two pure functions the grid and the tap-a-gap picker already use,
 * so this menu can never offer a placement the grid itself would refuse.
 * Deliberately independent of whether the grid is currently expanded:
 * this is the one place a float can be placed without opening the grid at
 * all, which is exactly what makes it the sensible answer to a collapsed
 * grid, not just a drag fallback - see docs/TIMELINE.md section 5's own
 * disclosure toggle and the comment on `DayView.tsx`'s drag handling.
 *
 * For an anchor, there is exactly one action: remove its time. No menu of
 * one is hidden behind a second tap - the single row is the whole content.
 */
export function TaskActionsSheet({ task, tasks, onPlace, onUnanchor, onClose }: TaskActionsSheetProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const anchor = isAnchor(task)

  const gaps: TimelineGap[] = anchor
    ? []
    : computeTimelineLayout(tasks).gaps.filter(g => canPlaceFloatInGap(task.minutes, g.minutes))

  useEffect(() => {
    dialogRef.current?.focus()
  }, [])

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
      return
    }
    if (e.key !== 'Tab') return
    const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    if (!focusables || focusables.length === 0) return
    const list = Array.from(focusables)
    const first = list[0]
    const last = list[list.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  function place(gap: TimelineGap) {
    onPlace(task.id, formatClock(gap.startMinutes))
    onClose()
  }

  function removeTime() {
    onUnanchor(task.id)
    onClose()
  }

  return (
    <>
      <button type="button" className="task-actions-scrim" aria-hidden="true" tabIndex={-1} onClick={onClose} />
      <div
        className="task-actions-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={task.title}
        ref={dialogRef}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        <div className="task-actions-header">
          <h3 className="task-actions-title">{task.title}</h3>
          <button type="button" className="task-actions-close" aria-label="Close" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="task-actions-body">
          {anchor ? (
            <button type="button" className="task-actions-row" onClick={removeTime}>
              Remove time from {task.title}
            </button>
          ) : gaps.length === 0 ? (
            <p className="task-actions-empty">No free gaps to place this into right now.</p>
          ) : (
            <ul className="task-actions-list">
              {gaps.map(gap => {
                const label = `${formatDuration(gap.minutes)} free, ${formatClock(gap.startMinutes)} to ${formatClock(gap.endMinutes)}`
                return (
                  <li key={gap.startMinutes}>
                    <button type="button" className="task-actions-row" onClick={() => place(gap)}>
                      {label}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </>
  )
}
