import type { Task } from '../../lib/types'
import { actions, MAX_PUSHES } from '../../lib/store'
import { formatDuration } from './capacity'
import { useLongPress } from './useLongPress'

const PUSH_COUNT_WORDS: Record<number, string> = { 1: 'once', 2: 'twice' }

function pushCountLabel(count: number): string {
  return PUSH_COUNT_WORDS[count] ?? `${count} times`
}

export interface TaskRowProps {
  task: Task
  date: string
  isFullDay: boolean
  sizeEditingId: string | null
  sizeDraft: string
  onStartSizeEdit: (task: { id: string; minutes?: number }) => void
  onSizeDraftChange: (value: string) => void
  onCommitSizeEdit: (taskId: string) => void
  onCancelSizeEdit: (task: Task) => void
  /**
   * True while this exact task is the one currently picked up by step 7's
   * drag - see `DayView.tsx`. Purely a visual "lifted" state; the drop
   * logic itself lives entirely in the caller.
   */
  dragging: boolean
  /**
   * Wired to the row's own drag handle - see the handle's own comment
   * below for why it is a separate, small element rather than the whole
   * row. Omitted (and the handle not rendered at all) for a done task,
   * which is neither a placeable float nor an anchor worth un-anchoring.
   */
  onDragHandlePointerDown?: (e: React.PointerEvent) => void
  /**
   * Opens the long-press menu for this task - the touch-safe fallback
   * that does not depend on drag working at all. Also omitted for a done
   * task, for the same reason as the drag handle.
   */
  onLongPressOpen?: () => void
}

/**
 * One row in the task list - extracted from `DayView.tsx` unchanged in
 * markup and behaviour, so `useLongPress` (a hook) can be called once per
 * row rather than inside the loop that used to render these inline, which
 * the rules of hooks do not allow.
 */
export function TaskRow({
  task,
  date,
  isFullDay,
  sizeEditingId,
  sizeDraft,
  onStartSizeEdit,
  onSizeDraftChange,
  onCommitSizeEdit,
  onCancelSizeEdit,
  dragging,
  onDragHandlePointerDown,
  onLongPressOpen,
}: TaskRowProps) {
  const pushCount = task.pushCount ?? 0
  const atBound = !task.done && pushCount >= MAX_PUSHES
  // A long-press menu makes sense for anything drag also handles - a
  // not-done float (place it) or a not-done anchor (un-anchor it) - and
  // for nothing else, the same set `onDragHandlePointerDown` below is
  // wired for.
  const longPressEligible = !task.done && !!onLongPressOpen
  const longPress = useLongPress(() => onLongPressOpen?.())

  const classNames = ['task']
  if (task.done) classNames.push('done')
  if (atBound) classNames.push('task-maxed')
  if (dragging) classNames.push('dragging')
  const badgeId = `push-badge-${task.id}`
  const noteId = `push-note-${task.id}`
  const coreId = `core-badge-${task.id}`
  const showCoreBadge = !isFullDay && !!task.core
  const describedByIds = [
    atBound ? noteId : pushCount > 0 ? badgeId : undefined,
    showCoreBadge ? coreId : undefined,
  ].filter((id): id is string => !!id)
  const describedBy = describedByIds.length > 0 ? describedByIds.join(' ') : undefined

  return (
    <li className={classNames.join(' ')}>
      <div className="task-row">
        <label {...(longPressEligible ? longPress : {})}>
          <input
            type="checkbox"
            checked={task.done}
            aria-label={task.title}
            aria-describedby={describedBy}
            onChange={() => actions.toggleTask(date, task.id)}
          />
          <span className="check" aria-hidden="true" />
          {task.time && <span className="task-time">{task.time}</span>}
          <span className="task-title">{task.title}</span>
          {showCoreBadge && (
            <span id={coreId} className="task-core">core</span>
          )}
          {pushCount > 0 && !atBound && (
            <span id={badgeId} className="task-pushed">pushed {pushCountLabel(pushCount)}</span>
          )}
        </label>
        {sizeEditingId === task.id ? (
          <input
            className="task-size-input"
            inputMode="numeric"
            aria-label={`Size in minutes for ${task.title}`}
            value={sizeDraft}
            autoFocus
            onChange={e => onSizeDraftChange(e.target.value)}
            onBlur={() => onCommitSizeEdit(task.id)}
            onKeyDown={e => {
              if (e.key === 'Enter') onCommitSizeEdit(task.id)
              if (e.key === 'Escape') onCancelSizeEdit(task)
            }}
          />
        ) : (
          <button
            className={task.minutes !== undefined ? 'task-size' : 'task-size task-size-empty'}
            aria-label={
              task.minutes !== undefined
                ? `Change size for ${task.title}, currently ${formatDuration(task.minutes)}`
                : `Set size for ${task.title}`
            }
            onClick={() => onStartSizeEdit(task)}
          >
            {task.minutes !== undefined ? formatDuration(task.minutes) : 'size'}
          </button>
        )}
        {/* A float, not yet done, still eligible to move. Which one
            to push is the owner's call, not something the capacity
            line pre-selects - see the comment above it. */}
        {!task.time && !task.done && pushCount < MAX_PUSHES && (
          <button
            className="task-push"
            aria-label={`Push ${task.title} to tomorrow`}
            onClick={() => actions.pushTask(date, task.id)}
          >
            push
          </button>
        )}
        {/* The undo for tapping a gap - see docs/TIMELINE.md
            section 5. Placing is easy to do by accident on a
            phone, so this sits on the task's own row rather than
            behind a setting or a fading toast: whatever anchored a
            task, this always turns it back into a float. Not
            gated on how the task got its time - a hand-typed
            anchor from quick-add un-anchors exactly the same way a
            gap-placed one does, since both are just a task with a
            time either way. */}
        {task.time && !task.done && (
          <button
            className="task-unanchor"
            aria-label={`Remove time from ${task.title}`}
            onClick={() => actions.unanchorTask(date, task.id)}
          >
            remove time
          </button>
        )}
        <button
          className="task-delete"
          aria-label={atBound ? `Let go of ${task.title}` : `Delete ${task.title}`}
          onClick={() => actions.deleteTask(date, task.id)}
        >
          &times;
        </button>
        {/* Step 7's drag source - see docs/TIMELINE.md section 5 and the
            comment on `DayView.tsx`'s own drag wiring. A small dedicated
            handle rather than the whole row: the row's own tap-to-toggle
            target needs to stay scrollable with the page's default
            touch-action, so only this handle carries `touch-action: none`
            (in styles.css), the same disambiguation `docs/TIMELINE.md`
            asks for, applied to the smallest possible area instead of the
            whole row. Purely decorative and pointer-only - `aria-hidden`
            because the two things it can do (place a float, un-anchor a
            task) are both already fully reachable without it, through the
            tap-a-gap picker, the "remove time" button above, and the
            long-press menu this same row also offers. */}
        {onDragHandlePointerDown && (
          <span
            className="task-drag-handle"
            aria-hidden="true"
            data-drag-handle={task.id}
            onPointerDown={onDragHandlePointerDown}
          >
            &#8942;&#8942;
          </span>
        )}
      </div>
      {atBound && (
        <p id={noteId} className="task-maxed-note">
          {`Pushed ${pushCountLabel(pushCount)} - do it today, or let it go. Deleting counts as a decision, not a failure.`}
        </p>
      )}
    </li>
  )
}
