import type { Task } from '../../lib/types'
import { isAnchor } from './capacity'

/**
 * Where a drag currently sits, resolved from `document.elementFromPoint`
 * the same way `CalendarView.tsx`'s own stamp-drag already does - see that
 * component's `handlePointerMove` for the established pattern this
 * follows. `null` means the pointer is not over anything this drag
 * recognises as a target (off the tray, off the document entirely), which
 * always resolves to no action - see `resolveDrop`.
 */
export type DropTarget = { type: 'tray' } | null

export type DragOutcome = { action: 'unanchor'; taskId: string } | { action: 'none' }

const NONE: DragOutcome = { action: 'none' }

/**
 * The pure "what does dropping this here do" rule behind dragging an
 * anchor's own block in the grid back onto the tray - see
 * docs/TIMELINE.md section 5. Only ever resolves to `unanchor`, and only
 * when dropped on the tray - dropped anywhere unrecognised is a no-op, so
 * a drag that "starts and goes nowhere" (the pointer leaving the document,
 * say) never half-changes anything.
 *
 * Placing a float by drag used to be this function's other half. It was
 * removed once the row's own drag handle was: a float already has two
 * fully independent, already-tested paths to the same outcome - the
 * tap-a-gap picker (`GapPicker.tsx`) and the row's own actions menu
 * (`TaskActionsSheet.tsx`), neither of which this function's removal
 * touches - so a third, pointer-only path that needed its own always-on
 * row control to reach was no longer earning the weight it cost every
 * row. See docs/TIMELINE.md section 5 for the fuller reasoning.
 *
 * Mirrors the store guard it hands off to: `actions.unanchorTask` refuses
 * a task with no time to clear, and this function refuses the same case
 * earlier so a rejected drop never even reaches the store. A task id that
 * does not resolve to a real task on the day, a done task, or one that is
 * not actually an anchor also resolves to `none` rather than throwing -
 * the same defensive posture `unanchorTask` itself already takes.
 */
export function resolveDrop(tasks: Task[], taskId: string, target: DropTarget): DragOutcome {
  const task = tasks.find(t => t.id === taskId)
  if (!task) return NONE
  if (!isAnchor(task) || task.done) return NONE
  if (!target || target.type !== 'tray') return NONE
  return { action: 'unanchor', taskId }
}
