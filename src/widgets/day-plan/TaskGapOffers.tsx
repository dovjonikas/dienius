import { useEffect, useRef, useState } from 'react'
import type { DayType, Task } from '../../lib/types'
import { formatDuration } from './capacity'
import { describeGapNeighbors, matchTaskToGaps, VISIBLE_ROW_LIMIT, type GapWithContext } from './gapPlacement'
import { formatClock } from './timelineLayout'

export interface TaskGapOffersProps {
  /** The float this sheet was opened for - selected by tapping its own title, see TaskRow.tsx. */
  task: Task
  /** The day's full task list - needed to compute which gaps exist at all. */
  tasks: Task[]
  dayType: DayType | undefined
  /** Called with the task's own id and the clock time to place it at. The caller places it and ends the selection. */
  onPlace: (taskId: string, time: string) => void
  onClose: () => void
}

const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

/**
 * The sheet a selected task opens: the inverse of `GapPicker.tsx`. That one
 * starts from a gap and asks what fits it; this one starts from a task -
 * selected by tapping its own title in `TaskRow.tsx` - and asks where it
 * fits, using `matchTaskToGaps` to read the same arithmetic the other way
 * round rather than a second version of it.
 *
 * A plain, hand-rolled dialog, mirroring `GapPicker.tsx` and
 * `TaskActionsSheet.tsx` exactly: focus moves to the dialog itself on open,
 * Escape and the scrim close it, Tab is trapped to the sheet's own
 * controls. Named for the task it was opened for (`aria-label={task.title}`)
 * rather than a generic "gaps" label, since that is the one thing every
 * state below has in common.
 *
 * Every non-matched state - no size, already timed, some other anchor's
 * size unknown - is said in a single plain sentence rather than an empty
 * list, and a matched task with nothing that fits is said just as plainly:
 * a full day is a real outcome, not a failure to explain away. Nothing
 * here ever ranks the gaps it lists or pre-selects one; they are offered in
 * the order they occur in the day, and ignoring all of them is exactly as
 * valid an outcome as tapping one - see docs/DECISIONS.md.
 *
 * Caps what it shows to `VISIBLE_ROW_LIMIT` rows before asking, exactly
 * like `GapPicker.tsx` - see that constant's own doc comment in
 * gapPlacement.ts for why four is the number.
 */
export function TaskGapOffers({ task, tasks, dayType, onPlace, onClose }: TaskGapOffersProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const [expanded, setExpanded] = useState(false)

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

  function place(gap: GapWithContext) {
    onPlace(task.id, formatClock(gap.start))
  }

  const match = matchTaskToGaps(tasks, dayType, task.id)

  function renderBody() {
    switch (match.kind) {
      case 'no-size':
        return <p className="task-gap-offers-note">{task.title}'s size isn't set - give it a size to see where it fits.</p>
      case 'already-timed':
        return <p className="task-gap-offers-note">{task.title} already has a time.</p>
      case 'unknown':
        return <p className="task-gap-offers-note">Gaps aren't shown - not every timed task above has a size yet.</p>
      case 'matched': {
        if (match.gaps.length === 0) {
          return <p className="task-gap-offers-note">No gap today is {formatDuration(task.minutes!)} or longer.</p>
        }
        const rows = expanded ? match.gaps : match.gaps.slice(0, VISIBLE_ROW_LIMIT)
        const hiddenCount = match.gaps.length - rows.length
        return (
          <>
            <ul className="task-gap-offers-list">
              {rows.map(gap => {
                const neighbors = describeGapNeighbors(gap)
                return (
                  <li key={gap.start}>
                    <button type="button" className="task-gap-offers-row" onClick={() => place(gap)}>
                      <span className="task-gap-offers-row-time">
                        {formatClock(gap.start)} to {formatClock(gap.end)}
                      </span>
                      <span className="task-gap-offers-row-detail">
                        {formatDuration(gap.minutes)} free{neighbors ? `, ${neighbors}` : ''}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
            {!expanded && hiddenCount > 0 && (
              <button type="button" className="task-gap-offers-more" onClick={() => setExpanded(true)}>
                {`Show ${hiddenCount} more`}
              </button>
            )}
          </>
        )
      }
    }
  }

  return (
    <>
      <button type="button" className="task-gap-offers-scrim" aria-hidden="true" tabIndex={-1} onClick={onClose} />
      <div
        className="task-gap-offers"
        role="dialog"
        aria-modal="true"
        aria-label={task.title}
        ref={dialogRef}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        <div className="task-gap-offers-header">
          <h3 className="task-gap-offers-title">{task.title}</h3>
          <button type="button" className="task-gap-offers-close" aria-label="Close" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="task-gap-offers-body">{renderBody()}</div>
      </div>
    </>
  )
}
