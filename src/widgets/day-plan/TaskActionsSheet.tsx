import { useEffect, useRef } from 'react'
import type { Task } from '../../lib/types'
import { isPushable } from '../../lib/pushRules'
import { formatDuration, isAnchor } from './capacity'
import { canPlaceFloatInGap } from './gapPlacement'
import { boundNote } from './TaskRow'
import { computeTimelineLayout, formatClock, type TimelineGap } from './timelineLayout'

export interface TaskActionsSheetProps {
  /** The task the row was opened for - by its menu button or a long press. */
  task: Task
  /** The day's full task list - needed to compute which gaps exist at all. */
  tasks: Task[]
  onPlace: (taskId: string, time: string) => void
  onUnanchor: (taskId: string) => void
  onPush: (taskId: string) => void
  onSetOngoing: (taskId: string, ongoing: boolean) => void
  onDelete: (taskId: string) => void
  /**
   * Opens everything about this task that is edited rather than acted on -
   * see `TaskDetail.tsx`. Optional so every caller written before the sheet
   * had a door to it still compiles and renders exactly as it did.
   */
  onOpenDetails?: () => void
  onClose: () => void
}

const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

/**
 * The single home for everything a task's row does not scan or read at a
 * glance - see docs/RESEARCH-ADHD.md section 7 and the comment on
 * `TaskRow.tsx`. Opened by that row's own menu button (a real, focusable
 * control - keyboard and touch alike) or by holding the row - see
 * `useLongPress.ts` - so nothing here dropped below "reachable in one
 * extra deliberate action" for either input method.
 *
 * A plain, hand-rolled dialog, mirroring `GapPicker.tsx` exactly: focus
 * moves to the dialog on open, Escape and the scrim close it, Tab is
 * trapped to the sheet's own controls.
 *
 * What is offered is entirely a function of the task's own state, every
 * rule mirrored straight from what `TaskRow.tsx` used to gate the same
 * controls on directly, so nothing is offered here that was not already
 * reachable before this menu carried it:
 *
 * - **Placing or un-anchoring** - a float not yet done gets the same gap
 *   list `offerForGap` and the tap-a-gap picker already use, computed
 *   straight from `tasks` via `computeTimelineLayout` and filtered with
 *   `canPlaceFloatInGap`, so this menu can never offer a placement the
 *   grid itself would refuse. An anchor not yet done gets its one action,
 *   removing its time. Deliberately independent of whether the grid is
 *   currently expanded - this is the one place a float can be placed
 *   without opening the grid at all.
 * - **Pushing to tomorrow** - offered exactly where the old inline button
 *   was: a float, not done, still under the bound.
 * - **Marking, or un-marking, ongoing** - the push bound's own third
 *   choice. At the bound, the choice is offered alongside the bound's own
 *   sentence (`boundNote`, unchanged) shown as the sheet's opening line -
 *   the decision is made here, where its explanation now lives, not on a
 *   paragraph the row carried permanently. Already marked ongoing, the
 *   undo is offered instead.
 * - **Deleting** - always offered, worded as "let go" at the bound to
 *   match the bound's own three-way framing, plain "delete" otherwise.
 *   The only action a done task ever has left, since everything else above
 *   is gated on the task not being done.
 */
export function TaskActionsSheet({ task, tasks, onPlace, onUnanchor, onPush, onSetOngoing, onDelete, onOpenDetails, onClose }: TaskActionsSheetProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const anchor = isAnchor(task)
  const pushCount = task.pushCount ?? 0
  const isUnbounded = !!task.unbounded
  const atBound = !task.done && !isPushable(task)
  const canPlaceOrUnanchor = !task.done
  const canPush = !task.done && !anchor && isPushable(task)

  const gaps: TimelineGap[] =
    !task.done && !anchor
      ? computeTimelineLayout(tasks).gaps.filter(g => canPlaceFloatInGap(task.minutes, g.minutes))
      : []

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

  function push() {
    onPush(task.id)
    onClose()
  }

  function setOngoing(next: boolean) {
    onSetOngoing(task.id, next)
    onClose()
  }

  function deleteTask() {
    onDelete(task.id)
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
          {atBound && <p className="task-actions-note">{boundNote(pushCount)}</p>}

          {/* First, because it is the one entry that leads somewhere rather
              than doing something - everything below acts on the task and
              closes; this opens the rest of it. */}
          {onOpenDetails && (
            <button
              type="button"
              className="task-actions-row"
              onClick={() => {
                onClose()
                onOpenDetails()
              }}
            >
              Details
            </button>
          )}

          {canPlaceOrUnanchor && !anchor && (
            gaps.length === 0 ? (
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
            )
          )}

          {canPlaceOrUnanchor && anchor && (
            <button type="button" className="task-actions-row" onClick={removeTime}>
              Remove time from {task.title}
            </button>
          )}

          {canPush && (
            <button type="button" className="task-actions-row" onClick={push}>
              Push {task.title} to tomorrow
            </button>
          )}

          {atBound && (
            <button type="button" className="task-actions-row" onClick={() => setOngoing(true)}>
              Mark {task.title} as ongoing
            </button>
          )}

          {isUnbounded && (
            <button type="button" className="task-actions-row" onClick={() => setOngoing(false)}>
              Stop treating {task.title} as ongoing
            </button>
          )}

          <button type="button" className="task-actions-row" onClick={deleteTask}>
            {atBound ? `Let go of ${task.title}` : `Delete ${task.title}`}
          </button>
        </div>
      </div>
    </>
  )
}
