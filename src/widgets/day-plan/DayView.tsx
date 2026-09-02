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
import { activeTask as findActiveTask, computeCapacity, formatCapacityLine, formatDuration, minutesLeft, parseMinutesInput } from './capacity'
import { currentMinutes, formatClock } from './timelineLayout'
import { TimelineGrid } from './TimelineGrid'
import { StarterOffers } from '../onboarding/StarterOffers'
import { TaskRow } from './TaskRow'
import { TaskActionsSheet } from './TaskActionsSheet'
import { TaskGapOffers } from './TaskGapOffers'
import { FocusView } from './FocusView'
import { resolveDrop, type DropTarget } from './dragDrop'
import { useIsWide } from '../../lib/viewport'
import { CATEGORIES, DEFAULT_CATEGORY } from '../../lib/categories'
import type { CategoryId } from '../../lib/categories'
import { MiniCalendar } from './MiniCalendar'
import { TemplateRail } from './TemplateRail'

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

/**
 * How long a task that has just been checked stays in the open list before
 * it moves down into the Done section - long enough for the card's own
 * finishing animation (.task-leaving in styles.css) to actually be seen.
 *
 * The move is the point of the interaction: the list gets shorter every time
 * something is finished, so by the end of a day the screen is nearly empty
 * and the progress bar is full. Doing it instantly on the click makes the
 * card vanish, which reads as "did I just delete that?" rather than as
 * progress. Holding it for a beat first turns the same state change into
 * something watched. Kept in sync by hand with the animation duration in
 * styles.css; if the two ever disagree, the shorter one is what is seen.
 */
const DONE_LEAVE_MS = 420

/**
 * How often the header's clock and the "what is happening now" mark are
 * recomputed. Half a minute rather than a full one so the minute shown is
 * never more than thirty seconds behind the real one - a planner has no
 * reason to animate every second (see the same reasoning on the grid's own
 * indicator in docs/RESEARCH-TIMELINE-UI.md section 5 point 7), but a clock
 * that can sit a whole minute wrong is a clock nobody trusts. One state
 * update on a timer, and only ever on a day that is actually today.
 */
const NOW_TICK_MS = 30_000

export function DayView({ date, onDateChange }: DayViewProps) {
  const data = useAppData()
  const [input, setInput] = useState(() => consumeDraft(date))
  const [sizeEditingId, setSizeEditingId] = useState<string | null>(null)
  const [sizeDraft, setSizeDraft] = useState('')
  // The task currently playing its finishing animation - see DONE_LEAVE_MS.
  // It is already done in the store the instant the checkbox is clicked;
  // this only holds it in the open list for the length of the animation, so
  // nothing here can ever disagree with what is actually saved.
  const [leavingId, setLeavingId] = useState<string | null>(null)
  const [doneOpen, setDoneOpen] = useState(false)
  // Which category the next quick-added task gets. Session state, not stored:
  // it follows what you are doing right now, and the point of a default is
  // that most tasks typed in one sitting belong together - carrying that
  // across days would be a guess about tomorrow instead.
  const [newCategory, setNewCategory] = useState<CategoryId>(DEFAULT_CATEGORY)
  // Which task the full-screen countdown is open on, if any. Held by id
  // rather than by the task object so that finishing it - or having it change
  // underneath, from another tab writing the same storage key - resolves
  // against live data on the next render instead of pinning a stale copy.
  const [focusTaskId, setFocusTaskId] = useState<string | null>(null)
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const doneListId = useId()
  const day = data.days[date]
  const tasks = sortTasks(day?.tasks ?? [])
  const template = day?.templateId
    ? data.templates.find(t => t.id === day.templateId)
    : undefined
  const unfinishedTasks = tasks.filter(t => !t.done)
  const pushableCount = unfinishedTasks.filter(isPushable).length
  const heldCount = unfinishedTasks.length - pushableCount
  const isToday = date === todayKey()
  const [nowMinutes, setNowMinutes] = useState(() => currentMinutes())
  useEffect(() => {
    if (!isToday) return
    const timer = setInterval(() => setNowMinutes(currentMinutes()), NOW_TICK_MS)
    return () => clearInterval(timer)
  }, [isToday])
  const isFullDay = (day?.dayType ?? 'full') === 'full'
  const score = dayScore(day?.tasks ?? [], day?.dayType)
  const formattedScore = formatDayScore(score)
  const scoreLabel = score.planned
    ? isFullDay
      ? `${score.done} of ${score.total} done`
      : `${score.done} of ${score.total} core tasks done`
    : undefined
  const progressPercent = score.planned && score.total > 0 ? (score.done / score.total) * 100 : 0

  // The open list and the Done section, split from the one sorted list
  // rather than sorted differently - sortTasks stays the single source of
  // order within each. A task mid-animation counts as still open, which is
  // what keeps it drawn in place while its card plays out.
  const openTasks = tasks.filter(t => !t.done || t.id === leavingId)
  const doneTasks = tasks.filter(t => t.done && t.id !== leavingId)

  // Worked out once here and handed to both the grid and the task list, so a
  // block and its card can never disagree about which task is current. Only
  // ever on today: "now" has no honest position on a day in the past or the
  // future - the same rule the grid's own time indicator already follows.
  const runningTask = isToday ? findActiveTask(day?.tasks ?? [], nowMinutes) : undefined
  const runningLeft = runningTask ? minutesLeft(runningTask, nowMinutes) : undefined

  const sleep = { sleepWindow: data.settings.sleepWindow, nightSleepWindow: data.settings.nightSleepWindow }
  const capacity = computeCapacity(day?.tasks ?? [], day?.dayType, sleep)
  const capacityLine = formatCapacityLine(capacity)
  const timelineExpanded = data.settings.timelineExpanded
  // docs/LAYOUT-WIDE.md section 5, build step 2: at the wide breakpoint the
  // grid mounts unconditionally, bypassing the phone's own disclosure - see
  // isTimelineVisible below. This is a live device fact (useIsWide), never
  // written to settings, so it cannot itself change what timelineExpanded
  // stores; resizing back below the breakpoint restores whatever the
  // phone's own choice already was.
  const isWide = useIsWide()
  const isTimelineVisible = timelineExpanded || isWide
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
    actions.addTask(date, parsed.title, parsed.time, newCategory)
    setInput('')
    clearDraft()
  }

  function handleInputChange(text: string) {
    setInput(text)
    saveDraft(date, text)
  }

  // Checking a task off. The store write happens first and unconditionally,
  // so the score, the timeline block and everything else derived from it all
  // update on the click itself; only where the row is *drawn* waits. Undoing
  // (unchecking something that is still mid-animation) cancels the hold
  // rather than leaving a task pinned in the open list by a timer nobody
  // can see any more.
  function handleToggleDone(taskId: string, wasDone: boolean) {
    actions.toggleTask(date, taskId)
    if (leaveTimer.current) clearTimeout(leaveTimer.current)
    if (wasDone) {
      setLeavingId(null)
      return
    }
    setLeavingId(taskId)
    leaveTimer.current = setTimeout(() => setLeavingId(null), DONE_LEAVE_MS)
  }

  useEffect(() => () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current)
  }, [])

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
  // The one task currently selected for "where does this fit" - see
  // TaskRow.tsx's own title button and TaskGapOffers.tsx. Only ever one at
  // a time: selecting a different task's title while one is already
  // selected simply moves the selection rather than stacking sheets, since
  // there is only ever one thing to decide about at once.
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  // Where focus lands once the sheet above closes - the same trigger's own
  // title button when it still renders one, or the task list itself when
  // it does not (placing a float turns it into an anchor, whose title is
  // no longer a select button at all) - see the effect below, and
  // TimelineGrid.tsx's own `pendingFocusGapStart` for the same pattern
  // applied to a gap's own trigger.
  const pendingSelectFocusRef = useRef<string | null>(null)
  const taskListRef = useRef<HTMLUListElement>(null)

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

  // Selecting a task and getting anything done to it are two different
  // actions, and only one of them ends the selection on its own. If the
  // selected task is finished (its own checkbox, independent of the title
  // button next to it) or removed entirely while its sheet is open, "where
  // does this fit" no longer means anything - clear it rather than leave a
  // sheet open on a task that no longer needs placing.
  useEffect(() => {
    if (selectedTaskId && !tasks.some(t => t.id === selectedTaskId && !t.done)) {
      setSelectedTaskId(null)
    }
  }, [tasks, selectedTaskId])

  useEffect(() => {
    if (pendingSelectFocusRef.current === null) return
    const id = pendingSelectFocusRef.current
    pendingSelectFocusRef.current = null
    const trigger = document.querySelector<HTMLButtonElement>(`[data-select-task="${id}"]`)
    if (trigger) trigger.focus()
    else taskListRef.current?.focus()
  })

  function toggleSelect(taskId: string) {
    if (selectedTaskId === taskId) {
      pendingSelectFocusRef.current = taskId
      setSelectedTaskId(null)
      return
    }
    setSelectedTaskId(taskId)
    // Opening the grid is a defensible side effect of selecting, not an
    // extra decision of its own: the offers sheet below already works with
    // the timeline collapsed, but the whole point of "open the calendar"
    // in the brief is seeing the offer as a place in the day, not just a
    // sentence about one. This flips the same app-wide setting the
    // disclosure button itself flips - see docs/TIMELINE.md section 5 - so
    // it behaves exactly like opening it by hand: it stays open afterward,
    // on this day and every one after, until the owner closes it again.
    // Only when the grid is not already visible, though - at a wide
    // viewport isTimelineVisible is already true regardless of the stored
    // setting (see docs/LAYOUT-WIDE.md section 5), and writing true here
    // anyway would silently clobber the phone's own choice the next time
    // this same install is opened narrow.
    if (!isTimelineVisible) actions.setTimelineExpanded(true)
  }

  function closeSelection() {
    pendingSelectFocusRef.current = selectedTaskId
    setSelectedTaskId(null)
  }

  function placeSelected(taskId: string, time: string) {
    const task = tasks.find(t => t.id === taskId)
    if (actions.placeFloat(date, taskId, time)) {
      setDragAnnouncement(task ? `${task.title} placed at ${time}.` : `Placed at ${time}.`)
    }
    // Placing always ends the selection, whether or not it actually moved
    // anything - a refused placement (a race with some other update) has
    // nothing left worth asking about either. See TaskGapOffers.tsx: one
    // tap places it, and there is no confirmation step in between.
    closeSelection()
  }

  const focusTask = focusTaskId && runningTask?.id === focusTaskId ? runningTask : undefined
  const actionsSheetTask = actionsSheetTaskId ? day?.tasks.find(t => t.id === actionsSheetTaskId) : undefined
  const selectedTask = selectedTaskId ? tasks.find(t => t.id === selectedTaskId) : undefined

  // docs/LAYOUT-WIDE.md section 5, build step 4. dayLayoutFocus only has a
  // visible effect once useIsWide() says there is more than one pane to
  // redistribute between - below the breakpoint both panes always render,
  // exactly as they do today, regardless of what this stored preference
  // says. showDayPane/showTaskPane are true at every narrow width for
  // that reason; only isWide narrows them, never the stored value alone.
  const dayLayoutFocus = data.settings.dayLayoutFocus
  const showDayPane = !isWide || dayLayoutFocus !== 'tasks'
  const showTaskPane = !isWide || dayLayoutFocus !== 'calendar'
  const dayViewClassName = ['day-view', isWide && dayLayoutFocus !== 'both' ? `focus-${dayLayoutFocus}` : '']
    .filter(Boolean)
    .join(' ')

  return (
    <section className={dayViewClassName} data-tray-zone>
      {/* The rail - docs/LAYOUT-WIDE.md section 5, build step 5. Mounted
          only when useIsWide() is true, regardless of dayLayoutFocus - the
          rail is not part of what that control redistributes, see its own
          comment below. First in the DOM (not just visually leftmost) so
          keyboard tab order follows the visual order: rail, then header,
          then whichever pane(s) are showing - see the wide-layout
          verification pass in docs/LAYOUT-WIDE.md section 6. */}
      {isWide && (
        <div className="rail">
          <MiniCalendar date={date} onDateChange={onDateChange} />
          <TemplateRail date={date} />
        </div>
      )}
      {/* Groups day-nav with the focus control below so both can share the
          grid's "header" area at the wide breakpoint - see styles.css.
          Not new chrome of its own: `display: contents` below the
          breakpoint, same technique as .day-pane/.task-pane, so day-nav's
          own position in the phone DOM is unaffected by this wrapper
          existing. */}
      <div className="day-header">
        <div className="day-nav">
          <button aria-label="Previous day" onClick={() => onDateChange(addDays(date, -1))}>
            &larr;
          </button>
          <div className="day-title">
            <h2>{isToday ? 'Today' : formatDayTitle(date)}</h2>
            {isToday && <span className="day-subtitle">{formatDayTitle(date)}</span>}
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

        {/* What is happening right now, in real text: the clock, the task
            running against it, and how much of it is left. This is the line
            that answers the question the app is opened to answer, so it is
            the one thing in the header that is not a control and not a
            number about the whole day. Rendered only on today, and only
            while something is actually running - a day with a genuine hole
            in it says nothing here rather than inventing a "nothing on"
            state, since the empty timeline beside it already says that
            better than a sentence would. */}
        {isToday && (
          <div className="day-now">
            <span className="day-now-clock">{formatClock(nowMinutes)}</span>
            {runningTask && (
              <>
                <span className="day-now-sep" aria-hidden="true" />
                <span className="day-now-task">{runningTask.title}</span>
                {runningLeft !== undefined && (
                  <span className="day-now-left">{formatDuration(runningLeft)} left</span>
                )}
              </>
            )}
          </div>
        )}

        {/* The day's progress, promoted out of the title block it used to
            sit inside as a small trailing fraction. It is the one number
            worth reading first thing on opening the app, and a bar says
            "most of the way there" faster than a fraction does - the
            fraction stays right beside it, since a bar alone cannot say
            *which* three of nine. Only ever rendered for a day that has a
            plan at all: formatDayScore returns null for an empty day rather
            than "0/0", so nothing here can imply a plan that was never made.
            The bar itself is aria-hidden, and the fraction keeps the same
            visible-digits/spoken-sentence pairing it always had - a screen
            reader gets "three of nine done", not a percentage and a
            slash. */}
        {formattedScore && (
          <div className="day-progress">
            <div className="day-progress-track" aria-hidden="true">
              <div className="day-progress-fill" style={{ width: `${progressPercent}%` }} />
            </div>
            <span className="day-score">
              <span aria-hidden="true">
                {formattedScore}
                {!isFullDay && <span className="day-score-note"> core</span>}
              </span>
              <span className="visually-hidden">{scoreLabel}</span>
            </span>
          </div>
        )}

        {/* The "switch fully" request - docs/LAYOUT-WIDE.md section 3.2.
            A width redistribution, not a navigation event: nothing about
            the underlying day changes, and the unmounted pane's own data
            is still computed from the same store regardless of which
            option is selected. Never rendered at all below the
            breakpoint - there is only ever one column there, so there is
            nothing for it to redistribute. Persisted the same way
            timelineExpanded is: one app-wide choice, not a per-day one,
            so it is never asked again. */}
        {isWide && (
          <div className="day-layout-focus segmented" role="group" aria-label="Day layout focus">
            <button
              type="button"
              className={dayLayoutFocus === 'both' ? 'active' : ''}
              aria-pressed={dayLayoutFocus === 'both'}
              onClick={() => actions.setDayLayoutFocus('both')}
            >
              Both
            </button>
            <button
              type="button"
              className={dayLayoutFocus === 'calendar' ? 'active' : ''}
              aria-pressed={dayLayoutFocus === 'calendar'}
              onClick={() => actions.setDayLayoutFocus('calendar')}
            >
              Calendar
            </button>
            <button
              type="button"
              className={dayLayoutFocus === 'tasks' ? 'active' : ''}
              aria-pressed={dayLayoutFocus === 'tasks'}
              onClick={() => actions.setDayLayoutFocus('tasks')}
            >
              Tasks
            </button>
          </div>
        )}
      </div>

      {/* docs/LAYOUT-WIDE.md section 5, build step 3: the capacity line,
          the if-then rule and the timeline grid group into one region - the
          "picture of the day" - so the wide layout can give it its own
          column. This div is not new chrome: below the breakpoint it is
          `display: contents` (see styles.css), so it adds no box, no
          spacing and no accessibility-tree node of its own - the JSX order
          inside it is exactly the order these elements already rendered in,
          so a phone's DOM is unaffected by this grouping existing at all.
          Below the breakpoint showDayPane is always true (see its own
          comment above); only step 4's Calendar/Tasks focus, at a wide
          viewport, ever unmounts this. */}
      {showDayPane && (
      <div className="day-pane">
        {/* Purely informational - no embedded action. Being over is stated
            as a fact; which float moves to tomorrow, if any, is decided on
            that float's own row below, not pre-selected here. See
            docs/TIMELINE.md section 8. */}
        {capacityLine && (
          <div className="capacity-line">
            <p>{capacityLine}</p>
          </div>
        )}

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
            TimelineGrid.tsx. Not rendered at all at the wide breakpoint -
            docs/LAYOUT-WIDE.md section 5: the grid has its own column there,
            so there is no fold left to protect and nothing this toggle would
            do. */}
        {capacity.anchorCount > 0 && !isWide && (
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

        {isTimelineVisible && (
          <TimelineGrid
            id={timelineGridId}
            tasks={day?.tasks ?? []}
            templateColor={template?.color}
            onPlaceFloat={(taskId, time) => actions.placeFloat(date, taskId, time)}
            onAnchorPointerDown={(taskId, e) => startDrag(taskId, e)}
            draggingTaskId={draggingTaskId}
            activeTaskId={runningTask?.id}
            isToday={isToday}
            isWide={isWide}
            dayType={day?.dayType}
            sleep={sleep}
          />
        )}

      </div>
      )}

      {/* Announces a drag-driven un-anchor, or a placement or removal made
          through the actions menu, to screen reader users - the same way
          TimelineGrid.tsx's own live region already covers the tap-a-gap
          path. A separate region because these fire from gestures
          TimelineGrid never sees: the drag can end outside the grid
          entirely, and the menu is not part of it at all. Deliberately
          outside both panes and always mounted, unlike them: an actions-
          menu placement can fire while dayLayoutFocus has unmounted
          .day-pane (focus 'tasks'), and this announcement still needs
          somewhere to land for a screen reader when that happens. Sitting
          here between the two panes in the JSX keeps the flattened phone
          DOM order exactly what it was before this region had its own
          top-level position. */}
      <p className="visually-hidden" aria-live="polite">{dragAnnouncement}</p>

      {/* The float tray - quick-add, the first-run/empty state, the task
          list, and the rollover button - grouped the same way and for the
          same reason as .day-pane above: `display: contents` below the
          breakpoint, a real grid column at it, no change to phone markup
          either way. Below the breakpoint showTaskPane is always true (see
          its own comment above); only step 4's Calendar/Tasks focus, at a
          wide viewport, ever unmounts this. */}
      {showTaskPane && (
      <div className="task-pane">
        <div className="quick-add-block">
          <input
            className="quick-add"
            placeholder="Add a task... try 14:00 Call mom"
            value={input}
            onChange={e => handleInputChange(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
          {/* Which colour the next task gets, chosen before typing rather than
              asked about afterward - six swatches is one glance and one tap,
              where a follow-up dialog would be a second decision at exactly
              the moment the thought is meant to be leaving your head. Each is
              a real toggle button carrying its own name, so the choice is
              reachable and readable without relying on the colour. */}
          <div className="category-picker" role="group" aria-label="Category for the next task">
            {CATEGORIES.map(c => (
              <button
                key={c.id}
                type="button"
                className={c.id === newCategory ? 'category-swatch selected' : 'category-swatch'}
                style={{ ['--cat' as string]: c.color } as React.CSSProperties}
                aria-pressed={c.id === newCategory}
                aria-label={c.label}
                title={c.label}
                onClick={() => setNewCategory(c.id)}
              />
            ))}
          </div>
        </div>

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

        <ul className="task-list" ref={taskListRef} tabIndex={-1}>
          {openTasks.map(task => (
            <TaskRow
              key={task.id}
              task={task}
              isFullDay={isFullDay}
              leaving={task.id === leavingId}
              active={task.id === runningTask?.id}
              minutesLeft={task.id === runningTask?.id ? runningLeft : undefined}
              onFocus={() => setFocusTaskId(task.id)}
              sizeEditingId={sizeEditingId}
              sizeDraft={sizeDraft}
              onStartSizeEdit={startSizeEdit}
              onSizeDraftChange={setSizeDraft}
              onCommitSizeEdit={commitSizeEdit}
              onCancelSizeEdit={cancelSizeEdit}
              onToggleDone={handleToggleDone}
              onOpenActions={() => setActionsSheetTaskId(task.id)}
              selected={selectedTaskId === task.id}
              onToggleSelect={() => toggleSelect(task.id)}
            />
          ))}
        </ul>

        {/* Everything already finished, folded away behind one line. This is
            the payoff for the checkbox interaction above rather than a
            filing cabinet: the open list only ever gets shorter as the day
            goes, so by evening the screen is nearly empty and the bar in
            the header is nearly full - which is the whole shape of the day
            in one glance, with no counting.

            A plain aria-expanded disclosure whose panel is collapsed in CSS
            (display: none, see styles.css) rather than unmounted. Unmounting
            is this app's usual choice for a disclosure, and it is the right
            one where the hidden thing is expensive or would be confusing to
            leave in the page. Neither applies here: these rows are already
            rendered work, and display: none removes them from the
            accessibility tree just as completely as unmounting would, while
            keeping the whole day's list in the DOM for anything - find on
            page, an export, a browser's own search - that reasonably expects
            a task not to disappear from the document just because it was
            finished. */}
        {doneTasks.length > 0 && (
          <div className={doneOpen ? 'done-section open' : 'done-section'}>
            <button
              type="button"
              className="done-toggle"
              aria-expanded={doneOpen}
              aria-controls={doneListId}
              onClick={() => setDoneOpen(open => !open)}
            >
              <span className="done-caret" aria-hidden="true" />
              Done ({doneTasks.length})
            </button>
            <ul className="task-list task-list-done" id={doneListId}>
              {doneTasks.map(task => (
                <TaskRow
                  key={task.id}
                  task={task}
                  isFullDay={isFullDay}
                  sizeEditingId={sizeEditingId}
                  sizeDraft={sizeDraft}
                  onStartSizeEdit={startSizeEdit}
                  onSizeDraftChange={setSizeDraft}
                  onCommitSizeEdit={commitSizeEdit}
                  onCancelSizeEdit={cancelSizeEdit}
                  onToggleDone={handleToggleDone}
                  onOpenActions={() => setActionsSheetTaskId(task.id)}
                  selected={selectedTaskId === task.id}
                  onToggleSelect={() => toggleSelect(task.id)}
                />
              ))}
            </ul>
          </div>
        )}

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
      </div>
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

      {/* Closes itself the moment the task it is counting stops being the
          running one - finished from inside the view, checked off in another
          tab, or simply overrun past its own end. A countdown left open on a
          task that is no longer happening is a lie about the day, and this is
          the one screen with nothing else on it to correct the impression. */}
      {focusTask && (
        <FocusView
          task={focusTask}
          onDone={() => {
            handleToggleDone(focusTask.id, focusTask.done)
            setFocusTaskId(null)
          }}
          onClose={() => setFocusTaskId(null)}
        />
      )}

      {selectedTask && (
        <TaskGapOffers
          task={selectedTask}
          tasks={day?.tasks ?? []}
          dayType={day?.dayType}
          sleep={sleep}
          onPlace={placeSelected}
          onClose={closeSelection}
        />
      )}
    </section>
  )
}
