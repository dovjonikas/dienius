import type { Task } from '../../lib/types'
import { actions } from '../../lib/store'
import { isPushable } from '../../lib/pushRules'
import { formatDuration } from './capacity'
import { useLongPress } from './useLongPress'

const PUSH_COUNT_WORDS: Record<number, string> = { 1: 'once', 2: 'twice' }

export function pushCountLabel(count: number): string {
  return PUSH_COUNT_WORDS[count] ?? `${count} times`
}

/**
 * The push bound's own do-or-delete sentence, unchanged from the copy that
 * used to sit on every maxed row as its own paragraph - see
 * docs/DECISIONS.md's push-bound section. It still exists verbatim; it now
 * lives as the announced half of the row's quiet state mark (below) and as
 * the actions menu's own opening line, rather than as permanent height on
 * every row that reaches the bound.
 */
export function boundNote(pushCount: number): string {
  return `Pushed ${pushCountLabel(pushCount)} - do it today, let it go, or mark it ongoing. Deleting counts as a decision, not a failure.`
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
   * Opens the row's actions menu - the single home for everything on this
   * task that is acted on rather than scanned: placing or un-anchoring,
   * pushing, marking ongoing, and deleting. See docs/TIMELINE.md section 5
   * and `TaskActionsSheet.tsx`. Always supplied, even for a done task,
   * because delete has to stay reachable from somewhere - see the menu
   * button below.
   */
  onOpenActions: () => void
}

/**
 * One row in the task list - kept deliberately light. The research behind
 * this shape is docs/RESEARCH-ADHD.md section 7: visual working memory
 * holds about four integrated objects, so a row that shows six loud
 * controls is not showing six things, it is showing noise with one or two
 * real things in it. What is left here is what gets scanned (the checkbox,
 * time, title), what gets read second (duration, and at most one quiet
 * state mark), and a single door - the actions menu - to everything that
 * is acted on but rarely: placing, un-anchoring, pushing, marking ongoing,
 * and deleting. See `TaskActionsSheet.tsx` for what is behind that door.
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
  onOpenActions,
}: TaskRowProps) {
  const pushCount = task.pushCount ?? 0
  const isUnbounded = !!task.unbounded
  // isPushable already returns true for an unbounded task regardless of
  // pushCount, so a task that has been marked ongoing never re-enters the
  // maxed state just because pushCount keeps climbing - see its own doc
  // comment in pushRules.ts.
  const atBound = !task.done && !isPushable(task)
  // A long press makes sense for anything the actions menu can act on - a
  // not-done float or a not-done anchor - and for nothing else. A done
  // task still reaches the same menu, just through the always-visible menu
  // button below rather than a hold gesture, since the only thing left to
  // do with it (delete) does not need a hold to discover.
  const longPressEligible = !task.done
  const longPress = useLongPress(onOpenActions)

  const classNames = ['task']
  if (task.done) classNames.push('done')
  if (atBound) classNames.push('task-maxed')
  const stateId = `task-state-${task.id}`
  const coreId = `core-badge-${task.id}`
  const showCoreBadge = !isFullDay && !!task.core
  // Once a task is marked ongoing, pushed-N-times stops being shown at all
  // - see docs/DECISIONS.md. That count is exactly the kind of "how long
  // has this been carried" measurement the feature exists to avoid once a
  // task has already been declared standing rather than stalled; it only
  // ever describes something worth deciding on for a task still under the
  // bound.
  const showPushedMark = pushCount > 0 && !atBound && !isUnbounded
  // atBound, isUnbounded and showPushedMark were already mutually
  // exclusive in the logic above (isPushable is unconditionally true for
  // an unbounded task, and showPushedMark explicitly excludes both) - so
  // this is genuinely "at most one" state, a single quiet mark rather than
  // the three separate badges/buttons/paragraph this row used to carry for
  // the same three states. core is the one independent axis and can still
  // sit alongside it.
  const describedByIds = [
    atBound || isUnbounded || showPushedMark ? stateId : undefined,
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
          {/* The one quiet mark for whichever of the three mutually
              exclusive push states applies - see the comment on
              showPushedMark above. Visibly short in every case; the
              at-bound case additionally carries the full do-or-delete
              sentence as a visually-hidden continuation of the same
              element, so it is still announced in full even though it no
              longer sits on screen as its own paragraph. The sentence
              itself is also shown in full, not hidden, the moment the
              actions menu opens for this task - see TaskActionsSheet.tsx -
              so nothing about the bound's meaning was made harder to find,
              only quieter until asked for. */}
          {atBound ? (
            <span id={stateId} className="task-state">
              pushed {pushCountLabel(pushCount)}
              <span className="visually-hidden"> - do it today, let it go, or mark it ongoing. Deleting counts as a decision, not a failure.</span>
            </span>
          ) : isUnbounded ? (
            <span id={stateId} className="task-state">
              ongoing
              <span className="visually-hidden">, exempt from the push bound</span>
            </span>
          ) : showPushedMark ? (
            <span id={stateId} className="task-state">pushed {pushCountLabel(pushCount)}</span>
          ) : null}
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
        {/* The single door to everything else this task can do - place or
            un-anchor, push, mark ongoing, delete - see
            docs/TIMELINE.md section 5 and TaskActionsSheet.tsx. Always
            visible, never a hover reveal: this repo has already fixed that
            class of bug once (see styles.css), and this button is now the
            only path to some of what it opens, so it cannot be allowed to
            regress into one. A real, focusable button - reachable and
            operable with a keyboard exactly like every other control on
            this row, not just a pointer gesture. */}
        <button
          type="button"
          className="task-menu-button"
          aria-label={`More actions for ${task.title}`}
          onClick={onOpenActions}
        >
          &#8942;
        </button>
      </div>
    </li>
  )
}
