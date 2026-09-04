import type { LibraryList, Task } from '../../lib/types'
import { currentItem, isItemFinished, progressLabel } from '../../lib/library'
import { isPushable } from '../../lib/pushRules'
import { formatDuration, isAnchor } from './capacity'
import { categoryColor, categoryLabel } from '../../lib/categories'
import { useLongPress } from './useLongPress'

const PUSH_COUNT_WORDS: Record<number, string> = { 1: 'once', 2: 'twice' }

// Not exported - boundNote below is the one other place a push count needs
// to read as a word rather than a digit, and it already sits in this same
// file, so nothing outside it has ever needed this on its own.
function pushCountLabel(count: number): string {
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
  isFullDay: boolean
  /**
   * True while this row is playing its finishing animation on the way down
   * to the Done section - see `DONE_LEAVE_MS` in `DayView.tsx`, which owns
   * both the timing and which row it applies to. Purely a class on the card;
   * the task itself is already done in the store by the time this is true.
   */
  leaving?: boolean
  /**
   * True for the one task happening right now - see `activeTask` in
   * capacity.ts. `DayView` decides; this row only draws it.
   */
  active?: boolean
  /**
   * How many minutes of the active task are left, when it is this row. Passed
   * in rather than computed here so the card, the block on the timeline and
   * the header's own line are all counting from the same tick.
   */
  minutesLeft?: number
  /** Opens the full-screen countdown for this task - see `FocusView.tsx`. */
  onFocus?: () => void
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
  /**
   * Opens everything this row deliberately does not show - see
   * `TaskDetail.tsx`. Optional so a caller that has not adopted it yet (and
   * every test written before it existed) renders exactly as before.
   */
  onOpenDetails?: () => void
  /** Opens the pointer's own quick menu at a point - see TaskContextMenu. */
  onContextMenu?: (x: number, y: number) => void
  /** Every list, so a bound task can show how far through its book it is. */
  library?: LibraryList[]
  /**
   * Checking the task off, or unchecking it. Routed up to `DayView` rather
   * than calling `actions.toggleTask` here the way this row used to, because
   * finishing a task is no longer a change to this row alone: it also starts
   * the hand-off that moves the card into the Done section. The store write
   * still happens first and unconditionally up there - see
   * `handleToggleDone`.
   */
  onToggleDone: (taskId: string, wasDone: boolean) => void
  /**
   * True while this task is the one selected for "where does this fit" -
   * see `TaskGapOffers.tsx` and the module comment on the title button
   * below. Only ever true for one row at a time; DayView.tsx owns which.
   */
  selected: boolean
  /**
   * Opens or closes "where does this fit" for this task - tapping the
   * title again while already selected ends it, the same toggle either
   * direction. Not called at all for a row that is not selectable (an
   * anchor, or a task already done) - see `selectable` below.
   */
  onToggleSelect: () => void
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
  isFullDay,
  leaving = false,
  active = false,
  minutesLeft,
  onFocus,
  sizeEditingId,
  sizeDraft,
  onStartSizeEdit,
  onSizeDraftChange,
  onCommitSizeEdit,
  onCancelSizeEdit,
  onOpenActions,
  onOpenDetails,
  onContextMenu,
  library = [],
  onToggleDone,
  selected,
  onToggleSelect,
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
  // Only a float still worth placing can be selected - an anchor already
  // has a position, and a done task has nothing left to schedule. Tapping
  // the title of anything else still does nothing, exactly as it always
  // has - see the module comment below for why the title is the gesture at
  // all rather than a new control.
  const selectable = !task.done && !isAnchor(task)
  const subtasks = task.subtasks ?? []
  const subtaskCount = subtasks.length
  const doneSubtaskCount = subtasks.filter(s => s.done).length
  // A ref that resolves to nothing - the list or the item was deleted -
  // draws nothing at all, the same contract every other dangling id in this
  // app keeps. See Task.libraryRef.
  const boundList = task.libraryRef ? library.find(l => l.id === task.libraryRef!.listId) : undefined
  const boundItem = boundList?.items.find(i => i.id === task.libraryRef!.itemId)
  // "ch 12/12" is a true thing to say about a book that just ended and a
  // useless one: what somebody wants to know at that moment is whether the
  // list carries on, and it does - the block is bound to the list, so the
  // next time it comes round it is about the book named here. Same sentence
  // the Library's own card makes, said on the card the tick happened on.
  const boundNext =
    boundList && boundItem && isItemFinished(boundItem) ? currentItem(boundList) : undefined
  const boundLabel = !boundList || !boundItem
    ? undefined
    : boundNext
      ? `finished - next is ${boundNext.title}`
      : progressLabel(boundList, boundItem)
  // The pace note rides along with the binding: "one section a day" is the
  // thing that was actually decided and the thing that has been forgotten by
  // the time the block comes round on a Thursday. It says nothing about
  // whether the pace was kept - nothing in this app measures it - it is just
  // the sentence being repeated back at the moment it is useful.
  const boundPace = boundItem?.pace

  // Selecting has to live somewhere that (a) is not the checkbox, so it
  // cannot be mistaken for completing the task, and (b) is not the row's
  // own actions menu, which already opens a sheet of its own and would
  // make "select" one more thing buried behind "more actions" rather than
  // the one-tap gesture the brief asks for. The title is the one part of
  // the row that reads as "this task" without reading as an action on it -
  // a real, focusable button rather than the plain span it used to be,
  // still sitting inside the row's own label but never forwarding its
  // click to the checkbox underneath, exactly the way TaskActionsSheet's
  // own long-press menu already has to stop the label's default click
  // forwarding once it fires. Pressing it again while already selected
  // deselects - the same toggle either direction, and exactly as
  // reversible as opening a picture and closing it again.
  function handleSelectClick(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    onToggleSelect()
  }

  // The same colour this task's block carries on the timeline, on the card's
  // own left edge - see `categories.ts`. Nothing else about the card changes
  // colour: the edge is a 3px mark, not a fill, so a list of six categories
  // still reads as one calm column rather than six competing ones.
  const catColor = categoryColor(task.category)
  const catName = categoryLabel(task.category)

  const classNames = ['task']
  if (catColor) classNames.push('task-cat')
  if (active) classNames.push('task-active')
  if (task.done) classNames.push('done')
  if (leaving) classNames.push('task-leaving')
  if (atBound) classNames.push('task-maxed')
  if (task.highlight) classNames.push('task-key')
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
    <li
      className={classNames.join(' ')}
      data-task-id={task.id}
      style={catColor ? ({ ['--cat' as string]: catColor } as React.CSSProperties) : undefined}
      onDoubleClick={onOpenDetails}
      onContextMenu={
        onContextMenu
          ? e => {
              e.preventDefault()
              onContextMenu(e.clientX, e.clientY)
            }
          : undefined
      }
    >
      {/* Two rows, not one: the title on its own line at full weight, and
          everything that qualifies it - the time, the size, whether it is
          core, whichever push state applies - gathered underneath in one
          quiet line. The old row put all six side by side at nearly the
          same size, which is six things to read before knowing what the
          task is. See docs/RESEARCH-ADHD.md section 7: what gets scanned
          first has to be visibly first.

          The label still wraps exactly the checkbox and the title, so
          tapping the words toggles the task and a long press anywhere on
          them opens the actions menu, both unchanged. The meta line sits
          outside it, because the controls in it (size, and nothing else
          today) have to be able to take a click of their own without the
          label forwarding it to the checkbox. */}
      <div className="task-row">
        <label className="task-check" {...(longPressEligible ? longPress : {})}>
          <input
            type="checkbox"
            checked={task.done}
            aria-label={task.title}
            aria-describedby={describedBy}
            onChange={() => onToggleDone(task.id, task.done)}
          />
          {/* The tour points at the drawn box, not the real input: the input
              is a zero-width, invisible control, and a spotlight around it
              was a spotlight around nothing. Clicking the box toggles it
              through the label exactly as a finger would. */}
          <span className="check" aria-hidden="true" data-tour="task-check" />
          {selectable ? (
            <button
              type="button"
              className="task-title task-title-select"
              data-select-task={task.id}
              aria-pressed={selected}
              onClick={handleSelectClick}
            >
              {task.title}
            </button>
          ) : (
            <span className="task-title">{task.title}</span>
          )}
        </label>
        <div className="task-meta">
          {task.time && <span className="task-time">{task.time}</span>}
          {/* The category, named rather than left as colour alone - the edge
              carries it at a glance, this carries it for anyone who cannot
              use the colour, and both say the same thing. */}
          {catName && <span className="task-cat-name">{catName}</span>}
          {/* The countdown, on the one card that is currently running. Real
              text, not a bar: "38 min left" is a number a person can act on,
              where a bar only says "some of it". */}
          {active && minutesLeft !== undefined && (
            <span className="task-left">{formatDuration(minutesLeft)} left</span>
          )}
          {showCoreBadge && (
            <span id={coreId} className="task-core">core</span>
          )}
          {/* Three marks, each earned by something the task actually is.
              None of them is a control - they are read, and the detail sheet
              is where they are changed - so none of them spends a tap
              target on a row that already has four. */}
          {subtaskCount > 0 && (
            <span className="task-steps" title="Steps done">
              {doneSubtaskCount}/{subtaskCount}
              <span className="visually-hidden"> steps done</span>
            </span>
          )}
          {boundLabel && (
            <span className={boundNext ? 'task-library is-next' : 'task-library'} title={boundLabel}>
              {boundLabel}
            </span>
          )}
          {boundPace && <span className="task-pace">{boundPace}</span>}
          {task.note && (
            <span className="task-note-mark" title="Has a note">
              note
            </span>
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
              <span className="visually-hidden">, exempt from being pushed to tomorrow</span>
            </span>
          ) : showPushedMark ? (
            <span id={stateId} className="task-state">pushed {pushCountLabel(pushCount)}</span>
          ) : null}
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
        </div>
        {/* The single door to everything else this task can do - place or
            un-anchor, push, mark ongoing, delete - see
            docs/TIMELINE.md section 5 and TaskActionsSheet.tsx. Always
            visible, never a hover reveal: this repo has already fixed that
            class of bug once (see styles.css), and this button is now the
            only path to some of what it opens, so it cannot be allowed to
            regress into one. A real, focusable button - reachable and
            operable with a keyboard exactly like every other control on
            this row, not just a pointer gesture. */}
        {/* Only ever on the running card - a timer that is not attached to
            something already happening is a pomodoro, which is a different
            idea about time and not the one this app is built on. See
            FocusView.tsx. */}
        {active && onFocus && (
          <button type="button" className="task-focus-button" data-tour="focus" onClick={onFocus}>
            Focus
          </button>
        )}
        <button
          type="button"
          className="task-menu-button"
          data-tour="task-menu"
          aria-label={`More actions for ${task.title}`}
          onClick={onOpenActions}
        >
          &#8942;
        </button>
      </div>
    </li>
  )
}
