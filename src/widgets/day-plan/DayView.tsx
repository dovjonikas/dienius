import { useEffect, useId, useRef, useState } from 'react'
import type { Task } from '../../lib/types'
import { actions, useAppData } from '../../lib/store'
import { isPushable } from '../../lib/pushRules'
import { addDays, formatDayTitle, todayKey } from '../../lib/dates'
import { isFirstRun } from '../../lib/onboarding'
import { starterTemplateInput, type StarterTemplate } from '../../lib/starterTemplates'
import { clearDraft, consumeDraft, saveDraft } from './draft'
import { parseQuickAdd } from './parse'
import { sortTasks } from './sort'
import { dayScore, formatDayScore } from './score'
import { computeCapacity, formatCapacityLine, parseMinutesInput } from './capacity'
import { TimelineGrid } from './TimelineGrid'
import { IfThenDayRule } from '../if-then/DayRule'
import { StarterOffers } from '../onboarding/StarterOffers'
import { TaskRow } from './TaskRow'
import { TaskActionsSheet } from './TaskActionsSheet'
import { resolveDrop, type DropTarget } from './dragDrop'

export interface DayViewProps {
  date: string
  onDateChange: (date: string) => void
}

/**
 * How far the pointer has to move before a release counts as a genuine
 * drop rather than a tap that merely started on a drag source - see the
 * comment on `dragStartRef` below. Small enough that a real drag of even
 * a few pixels still counts, large enough to absorb the jitter a finger
 * or a mouse naturally has while holding still.
 */
const MIN_DRAG_DISTANCE_PX = 8

export function DayView({ date, onDateChange }: DayViewProps) {
  const data = useAppData()
  const [input, setInput] = useState(() => consumeDraft(date))
  const [sizeEditingId, setSizeEditingId] = useState<string | null>(null)
  const [sizeDraft, setSizeDraft] = useState('')
  const day = data.days[date]
  const tasks = sortTasks(day?.tasks ?? [])
  const template = day?.templateId
    ? data.templates.find(t => t.id === day.templateId)
    : undefined
  const unfinishedTasks = tasks.filter(t => !t.done)
  const pushableCount = unfinishedTasks.filter(isPushable).length
  const heldCount = unfinishedTasks.length - pushableCount
  const isToday = date === todayKey()
  const isFullDay = (day?.dayType ?? 'full') === 'full'
  const score = dayScore(day?.tasks ?? [], day?.dayType)
  const formattedScore = formatDayScore(score)
  const scoreLabel = score.planned
    ? isFullDay
      ? `${score.done} of ${score.total} done`
      : `${score.done} of ${score.total} core tasks done`
    : undefined

  const capacity = computeCapacity(day?.tasks ?? [], day?.dayType)
  const capacityLine = formatCapacityLine(capacity)
  const timelineExpanded = data.settings.timelineExpanded
  const timelineGridId = useId()
  // Derived straight from the data itself, not a stored flag - see
  // docs/DECISIONS.md, "offer without installing." True only while there is
  // genuinely nothing here yet: no template ever saved, no day that ever
  // held a real task. The moment either exists, this - and the teaching
  // state below - never shows again on its own, and comes back on its own
  // if everything is erased.
  const firstRun = isFirstRun(data)

  function handleUseStarter(starter: StarterTemplate) {
    // One tap does both things the offer promises: a real, editable
    // template gets added to the templates list, and it is stamped onto
    // the exact day being viewed - so tapping an offer on an empty day
    // leaves that day genuinely planned, not just a template sitting
    // unused elsewhere. actions.stamp reuses the same path the calendar's
    // own stamp bar already commits through, not a second way to fill a
    // day's tasks in from a template.
    const template = actions.addTemplate(starterTemplateInput(starter))
    actions.stamp({ [date]: template.id })
  }

  function handleAdd() {
    const parsed = parseQuickAdd(input)
    if (!parsed) return
    actions.addTask(date, parsed.title, parsed.time)
    setInput('')
    clearDraft()
  }

  function handleInputChange(text: string) {
    setInput(text)
    saveDraft(date, text)
  }

  function startSizeEdit(task: { id: string; minutes?: number }) {
    setSizeEditingId(task.id)
    setSizeDraft(task.minutes !== undefined ? String(task.minutes) : '')
  }

  function commitSizeEdit(taskId: string) {
    const trimmed = sizeDraft.trim()
    if (trimmed === '') {
      actions.setTaskMinutes(date, taskId, undefined)
    } else {
      const parsed = parseMinutesInput(sizeDraft)
      // A non-empty value that does not parse is left untouched rather
      // than clearing a size that was already there - a stray keystroke
      // should not silently erase a real estimate.
      if (parsed !== undefined) actions.setTaskMinutes(date, taskId, parsed)
    }
    setSizeEditingId(null)
  }

  function cancelSizeEdit(task: Task) {
    // Restore the draft to what it was before this edit started, so that
    // if the browser still fires a blur as this input unmounts, the
    // commit it triggers is a harmless no-op rather than saving whatever
    // was left half-typed.
    setSizeDraft(task.minutes !== undefined ? String(task.minutes) : '')
    setSizeEditingId(null)
  }

  // Step 7's drag - docs/TIMELINE.md section 5: "dragging an anchor's own
  // block in the grid back onto the tray un-anchors it." Follows
  // CalendarView.tsx's own pointer approach exactly, since that component
  // already solved touch drag in this repo the hard way: release pointer
  // capture on pointerdown so the browser keeps delivering events to
  // whatever is actually under the finger, and clean up on document-level
  // pointerup/pointercancel so a finger lifted anywhere - off the day view
  // entirely, past the edge of the screen - always ends the drag instead
  // of leaving it stuck on.
  //
  // Placing a float by dragging it out of its own row used to be this same
  // machinery's other direction, started from a small dedicated handle on
  // every draggable row. It was removed along with that handle - see the
  // comment on TaskRow.tsx's own actions-menu button - once the row's
  // actions menu made a float placeable through a genuine one-extra-tap
  // path that needs neither a live drag gesture nor the grid expanded, the
  // same outcome the tap-a-gap picker already offered independently. Only
  // an anchor's own visual block in the grid still starts a drag now; a
  // float's row has nothing left that does.
  //
  // A ref, not state, holds what is being dragged: it needs to be read
  // synchronously inside the document listener below without that
  // listener being re-subscribed on every render.
  const dragRef = useRef<string | null>(null)
  // Where the drag started, so a release can be told apart from a mere
  // tap - see the distance check in handleUp below. An anchor block has no
  // click behaviour of its own today (it is decorative), so without this
  // guard a plain tap on it - pointerdown immediately followed by
  // pointerup at the same spot - would resolve to the tray target and
  // un-anchor the task with no actual drag having happened.
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null)
  const [dragAnnouncement, setDragAnnouncement] = useState('')
  const [actionsSheetTaskId, setActionsSheetTaskId] = useState<string | null>(null)

  function endDrag() {
    dragRef.current = null
    dragStartRef.current = null
    setDraggingTaskId(null)
  }

  function startDrag(taskId: string, e: React.PointerEvent) {
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    e.preventDefault()
    dragRef.current = taskId
    dragStartRef.current = { x: e.clientX, y: e.clientY }
    setDraggingTaskId(taskId)
  }

  function targetAt(clientX: number, clientY: number): DropTarget {
    const el = document.elementFromPoint(clientX, clientY)
    if (!el) return null
    if (el.closest('[data-tray-zone]')) return { type: 'tray' }
    return null
  }

  function applyOutcome(outcome: ReturnType<typeof resolveDrop>) {
    if (outcome.action === 'unanchor') {
      const task = day?.tasks.find(t => t.id === outcome.taskId)
      if (actions.unanchorTask(date, outcome.taskId)) {
        setDragAnnouncement(task ? `${task.title} no longer has a set time.` : 'No longer has a set time.')
      }
    }
  }

  useEffect(() => {
    function handleUp(e: PointerEvent) {
      if (!dragRef.current) return
      const taskId = dragRef.current
      const start = dragStartRef.current
      const movedEnough = !start || Math.hypot(e.clientX - start.x, e.clientY - start.y) >= MIN_DRAG_DISTANCE_PX
      const target = movedEnough ? targetAt(e.clientX, e.clientY) : null
      const outcome = resolveDrop(day?.tasks ?? [], taskId, target)
      endDrag()
      applyOutcome(outcome)
    }
    function handleCancel() {
      // A drag that goes nowhere - the gesture was cancelled by the
      // browser, or interrupted some other way - leaves state untouched,
      // never a half-removed task.
      endDrag()
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && dragRef.current) endDrag()
    }
    document.addEventListener('pointerup', handleUp)
    document.addEventListener('pointercancel', handleCancel)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerup', handleUp)
      document.removeEventListener('pointercancel', handleCancel)
      document.removeEventListener('keydown', handleKeyDown)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, date])

  const actionsSheetTask = actionsSheetTaskId ? day?.tasks.find(t => t.id === actionsSheetTaskId) : undefined

  return (
    <section className="day-view" data-tray-zone>
      <div className="day-nav">
        <button aria-label="Previous day" onClick={() => onDateChange(addDays(date, -1))}>
          &larr;
        </button>
        <div className="day-title">
          <h2>{isToday ? 'Today' : formatDayTitle(date)}</h2>
          {isToday && <span className="day-subtitle">{formatDayTitle(date)}</span>}
          {formattedScore && (
            <span className="day-score">
              <span aria-hidden="true">
                {formattedScore}
                {!isFullDay && <span className="day-score-note"> core</span>}
              </span>
              <span className="visually-hidden">{scoreLabel}</span>
            </span>
          )}
          {template && (
            <span className="day-template" style={{ background: template.color }}>
              {template.name}
            </span>
          )}
        </div>
        <button aria-label="Next day" onClick={() => onDateChange(addDays(date, 1))}>
          &rarr;
        </button>
      </div>

      {/* Purely informational - no embedded action. Being over is stated as
          a fact; which float moves to tomorrow, if any, is decided on that
          float's own row below, not pre-selected here. See
          docs/TIMELINE.md section 8. */}
      {capacityLine && (
        <div className="capacity-line">
          <p>{capacityLine}</p>
        </div>
      )}

      {/* One quiet if-then rule, rotated in from the board that used to be
          its own tab - see docs/TIMELINE.md section 6. Self-contained: it
          reads its own data and renders nothing when there is no eligible
          rule for today, the same way the capacity line above renders
          nothing for an empty day. */}
      <IfThenDayRule date={date} />

      {/* The grid's own disclosure, collapsed by default - see
          docs/RESEARCH-ADHD.md section 7 and docs/TIMELINE.md section 5.
          A sibling of the capacity line rather than nested inside it: that
          line only ever states the arithmetic, with no action of its own
          embedded in it - see the sentence's own comment above - and this
          toggle is a separate control, not part of that sentence. A proper
          disclosure, not a CSS-hidden panel: the region it names is only in
          the DOM while open, so a screen reader never lands on a picture it
          cannot currently see, and there is nothing extra to skip past
          while it is closed. Only shown when there is actually something to
          show - a day with no anchors has no grid to draw either way, see
          TimelineGrid.tsx. */}
      {capacity.anchorCount > 0 && (
        <button
          type="button"
          className="timeline-toggle"
          aria-expanded={timelineExpanded}
          aria-controls={timelineGridId}
          onClick={() => actions.setTimelineExpanded(!timelineExpanded)}
        >
          {timelineExpanded ? 'Hide timeline' : 'Show timeline'}
        </button>
      )}

      {timelineExpanded && (
        <TimelineGrid
          id={timelineGridId}
          tasks={day?.tasks ?? []}
          templateColor={template?.color}
          onPlaceFloat={(taskId, time) => actions.placeFloat(date, taskId, time)}
          onAnchorPointerDown={(taskId, e) => startDrag(taskId, e)}
          draggingTaskId={draggingTaskId}
          isToday={isToday}
        />
      )}

      {/* Announces a drag-driven un-anchor, or a placement or removal made
          through the actions menu, to screen reader users - the same way
          TimelineGrid.tsx's own live region already covers the tap-a-gap
          path. A separate region because these fire from gestures
          TimelineGrid never sees: the drag can end outside the grid
          entirely, and the menu is not part of it at all. */}
      <p className="visually-hidden" aria-live="polite">{dragAnnouncement}</p>

      <input
        className="quick-add"
        placeholder="Add a task... try 14:00 Call mom"
        value={input}
        onChange={e => handleInputChange(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleAdd()}
      />

      {tasks.length === 0 && firstRun && (
        <div className="first-run">
          <p className="first-run-lede">
            Dienius plans a day from a template: a reusable set of blocks you stamp onto a date instead
            of retyping it every morning. Tap one below to add it as a real template and set up today -
            edit or delete it any time afterward.
          </p>
          <StarterOffers onUse={handleUseStarter} />
          <p className="first-run-note">
            There are also eleven color themes here, light and dark - see them under Settings.
          </p>
        </div>
      )}
      {tasks.length === 0 && !firstRun && (
        <p className="empty">Nothing planned. Stamp a template from the calendar, or add a task above.</p>
      )}

      <ul className="task-list">
        {tasks.map(task => (
          <TaskRow
            key={task.id}
            task={task}
            date={date}
            isFullDay={isFullDay}
            sizeEditingId={sizeEditingId}
            sizeDraft={sizeDraft}
            onStartSizeEdit={startSizeEdit}
            onSizeDraftChange={setSizeDraft}
            onCommitSizeEdit={commitSizeEdit}
            onCancelSizeEdit={cancelSizeEdit}
            onOpenActions={() => setActionsSheetTaskId(task.id)}
          />
        ))}
      </ul>

      {pushableCount > 0 && (
        <button className="rollover" onClick={() => actions.rolloverUnfinished(date)}>
          {heldCount > 0
            ? `Push ${pushableCount} to tomorrow - ${heldCount} staying here`
            : `Push ${pushableCount} unfinished to tomorrow`}
        </button>
      )}
      {pushableCount === 0 && heldCount > 0 && (
        <p className="rollover-note">Nothing left to push - the rest are waiting on a decision.</p>
      )}

      {actionsSheetTask && (
        <TaskActionsSheet
          task={actionsSheetTask}
          tasks={day?.tasks ?? []}
          onPlace={(taskId, time) => {
            if (actions.placeFloat(date, taskId, time)) {
              setDragAnnouncement(`${actionsSheetTask.title} placed at ${time}.`)
            }
          }}
          onUnanchor={taskId => {
            if (actions.unanchorTask(date, taskId)) {
              setDragAnnouncement(`${actionsSheetTask.title} no longer has a set time.`)
            }
          }}
          onPush={taskId => actions.pushTask(date, taskId)}
          onSetOngoing={(taskId, ongoing) => actions.setTaskUnbounded(date, taskId, ongoing)}
          onDelete={taskId => actions.deleteTask(date, taskId)}
          onClose={() => setActionsSheetTaskId(null)}
        />
      )}
    </section>
  )
}
