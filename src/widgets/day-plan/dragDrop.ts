import type { Task } from '../../lib/types'
import { isAnchor } from './capacity'
import { canPlaceFloatInGap } from './gapPlacement'

/** Which kind of drag is in progress - decided once, at pointer-down, from the row that started it. */
export type DragKind = 'float' | 'anchor'

/**
 * Where a drag currently sits, resolved from `document.elementFromPoint`
 * the same way `CalendarView.tsx`'s own stamp-drag already does - see that
 * component's `handlePointerMove` for the established pattern this
 * follows. `null` means the pointer is not over anything this drag
 * recognises as a target (off the grid, off the tray, off the document
 * entirely), which always resolves to no action - see `resolveDrop`.
 */
export type DropTarget =
  | { type: 'gap'; startMinutes: number; gapMinutes: number }
  | { type: 'tray' }
  | null

export type DragOutcome =
  | { action: 'place'; taskId: string; startMinutes: number }
  | { action: 'unanchor'; taskId: string }
  | { action: 'none' }

const NONE: DragOutcome = { action: 'none' }

/**
 * The pure "what does dropping this here do" rule behind both directions
 * of step 7's drag and its long-press-menu fallback - see
 * docs/TIMELINE.md section 5. Deliberately mirrors the two store guards it
 * hands off to: `actions.placeFloat` refuses a task that already has a
 * time, `actions.unanchorTask` refuses one that does not, and this
 * function refuses the same cases earlier so a rejected drop never even
 * reaches the store - the row it started from settles back with nothing
 * changed rather than the store silently declining an action the UI
 * already offered.
 *
 * **A float only ever resolves to `place`, and only onto a gap it is
 * allowed into.** "Allowed" is `canPlaceFloatInGap` - the exact rule the
 * tap-a-gap picker already uses, not a second one - so a float that would
 * never appear in that gap's picker can never be dropped there either.
 * Dropped on the tray, or anywhere unrecognised, is a no-op: a float is
 * already in the tray, so there is nothing for that drop to do.
 *
 * **An anchor only ever resolves to `unanchor`, and only when dropped on
 * the tray.** Dropped on a gap is refused rather than re-timing the
 * anchor to that gap - this drag only ever does the two things
 * docs/TIMELINE.md section 5 asks for, not a third, unrequested one.
 * Dropped anywhere unrecognised is also a no-op, so a drag that "starts
 * and goes nowhere" - the pointer leaving the document, say - never
 * half-changes anything.
 *
 * A task id that does not resolve to a real task on the day, or one whose
 * actual shape does not match the `kind` the drag started as (a race with
 * some other update mid-drag), also resolves to `none` rather than
 * throwing - the same defensive posture `placeFloat`/`unanchorTask`
 * themselves already take.
 */
export function resolveDrop(tasks: Task[], kind: DragKind, taskId: string, target: DropTarget): DragOutcome {
  const task = tasks.find(t => t.id === taskId)
  if (!task) return NONE

  if (kind === 'float') {
    if (isAnchor(task) || task.done) return NONE
    if (!target || target.type !== 'gap') return NONE
    if (!canPlaceFloatInGap(task.minutes, target.gapMinutes)) return NONE
    return { action: 'place', taskId, startMinutes: target.startMinutes }
  }

  // kind === 'anchor'
  if (!isAnchor(task) || task.done) return NONE
  if (!target || target.type !== 'tray') return NONE
  return { action: 'unanchor', taskId }
}
