import { useEffect, useId, useState } from 'react'
import { actions, useAppData } from '../../lib/store'
import { todayKey } from '../../lib/dates'
import { sortTasks } from './sort'
import { dayScore } from './score'
import {
  activeTask as findActiveTask,
  computeCapacity,
  formatCapacityLine,
  formatDuration,
  minutesLeft,
  sleepMinutes,
  sleepProfileWindow,
} from './capacity'
import { currentMinutes } from './timelineLayout'
import { TimelineGrid } from './TimelineGrid'
import { TaskActionsSheet } from './TaskActionsSheet'
import { TaskContextMenu } from './TaskContextMenu'
import { TaskDetail } from './TaskDetail'
import { YesterdayBanner } from './YesterdayBanner'
import { NorthCard } from './NorthCard'
import { offerUndo } from '../../lib/undo'
import { TaskGapOffers } from './TaskGapOffers'
import { useIsWide } from '../../lib/viewport'
import { busyIntervals, eventsOn, useCalendarCache } from '../../lib/calendars'
import { MiniCalendar } from './MiniCalendar'
import { TemplateRail } from './TemplateRail'
import { DayDigest } from './DayDigest'
import { DayHeader } from './DayHeader'
import { TaskPane } from './TaskPane'
import { useDayDrag } from './useDayDrag'
import { useDoneAnimation } from './useDoneAnimation'
import { useTaskSelection } from './useTaskSelection'

export interface DayViewProps {
  date: string
  onDateChange: (date: string) => void
}

/**
 * One day: the rail beside it, the header above it, the picture of it, and the
 * list of what is on it.
 *
 * What is left in this file is the day itself - which day, what it is made of,
 * and how its parts are laid out next to each other. The three things it used
 * to also be are now their own modules: the header (DayHeader), the task
 * column with everything it owns (TaskPane), and the pointer machinery for
 * dragging a block around the grid (useDayDrag). Nothing about behaviour
 * changed in that move; the tests that covered it before cover it unchanged.
 */

/**
 * How often the header's clock and the "what is happening now" mark are
 * recomputed. Half a minute rather than a full one so the minute shown is never
 * more than thirty seconds behind the real one - a planner has no reason to
 * animate every second (see the same reasoning on the grid's own indicator in
 * docs/RESEARCH-TIMELINE-UI.md section 5 point 7), but a clock that can sit a
 * whole minute wrong is a clock nobody trusts. One state update on a timer, and
 * only ever on a day that is actually today.
 */
const NOW_TICK_MS = 30_000

export function DayView({ date, onDateChange }: DayViewProps) {
  const data = useAppData()
  const [actionsSheetTaskId, setActionsSheetTaskId] = useState<string | null>(null)
  // Everything about one task that the row deliberately does not show - see
  // TaskDetail.tsx. Reached three ways, all of them deliberate: the actions
  // menu, a double click, and the pointer's own context menu.
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{ taskId: string; x: number; y: number } | null>(null)

  const day = data.days[date]
  const tasks = sortTasks(day?.tasks ?? [])
  const template = day?.templateId ? data.templates.find(t => t.id === day.templateId) : undefined
  const isToday = date === todayKey()
  const [nowMinutes, setNowMinutes] = useState(() => currentMinutes())
  useEffect(() => {
    if (!isToday) return
    const timer = setInterval(() => setNowMinutes(currentMinutes()), NOW_TICK_MS)
    return () => clearInterval(timer)
  }, [isToday])

  const isFullDay = (day?.dayType ?? 'full') === 'full'
  const score = dayScore(day?.tasks ?? [], day?.dayType)

  // Worked out once here and handed to both the grid and the task list, so a
  // block and its card can never disagree about which task is current. Only
  // ever on today: "now" has no honest position on a day in the past or the
  // future - the same rule the grid's own time indicator already follows.
  const runningTask = isToday ? findActiveTask(day?.tasks ?? [], nowMinutes) : undefined
  const runningLeft = runningTask ? minutesLeft(runningTask, nowMinutes) : undefined

  // Which schedule this day is measured against: its own if it has one, else
  // whatever its template chose, else the default.
  const daySleepProfileId = day?.sleepProfileId ?? template?.sleepProfileId
  const sleepProfiles = data.settings.sleepProfiles
  const sleep = { profiles: sleepProfiles }
  // Somebody else's calendar, as a layer and as time already spoken for -
  // see calendars.ts. Both come from the same list, so the blocks drawn on the
  // grid and the hours subtracted from the free figure can never disagree.
  const calendarCache = useCalendarCache()
  const events = eventsOn(date, data.settings.calendars, calendarCache)
  const busy = busyIntervals(date, data.settings.calendars, calendarCache)
  const capacity = computeCapacity(day?.tasks ?? [], daySleepProfileId, sleep, busy)
  const capacityLine = formatCapacityLine(capacity)
  const timelineExpanded = data.settings.timelineExpanded
  // docs/LAYOUT-WIDE.md section 5, build step 2: at the wide breakpoint the
  // grid mounts unconditionally, bypassing the phone's own disclosure. This is
  // a live device fact (useIsWide), never written to settings, so it cannot
  // itself change what timelineExpanded stores; resizing back below the
  // breakpoint restores whatever the phone's own choice already was.
  const isWide = useIsWide()
  const isTimelineVisible = timelineExpanded || isWide
  const timelineGridId = useId()

  const drag = useDayDrag(date, day)
  const { leavingId, toggleDone } = useDoneAnimation(date)
  const selection = useTaskSelection(date, tasks, isTimelineVisible, drag.announce)

  // Everything a day gets on its own - the template its weekday maps to, the
  // instances its repeating tasks owe it - applied once, here, because this is
  // the moment a day is genuinely opened. Runs on every date change and is a
  // no-op for a day that has already been through it, so moving back and forth
  // through the week costs one store read per step.
  useEffect(() => {
    actions.ensureDay(date)
  }, [date])

  /**
   * Deleting a task, with the day it was on kept for five seconds.
   *
   * The whole day rather than the one task, because a task does not exist apart
   * from its position in a list, and because deleting a repeat instance also
   * writes a skip onto the day - putting the task back without the skip would
   * restore it and immediately re-delete it on the next open. Restoring the day
   * restores both, exactly.
   */
  function deleteWithUndo(taskId: string) {
    const task = day?.tasks.find(t => t.id === taskId)
    const before = day
    actions.deleteTask(date, taskId)
    if (!task || !before) return
    offerUndo(`${task.title} deleted`, () => actions.replaceDay(date, before))
  }

  const actionsSheetTask = actionsSheetTaskId ? day?.tasks.find(t => t.id === actionsSheetTaskId) : undefined
  const detailTask = detailTaskId ? day?.tasks.find(t => t.id === detailTaskId) : undefined
  const contextTask = contextMenu ? day?.tasks.find(t => t.id === contextMenu.taskId) : undefined
  const selectedTask = selection.selectedTaskId ? tasks.find(t => t.id === selection.selectedTaskId) : undefined

  // docs/LAYOUT-WIDE.md section 5, build step 4. dayLayoutFocus only has a
  // visible effect once useIsWide() says there is more than one pane to
  // redistribute between - below the breakpoint both panes always render,
  // exactly as they do today, regardless of what this stored preference says.
  // showDayPane/showTaskPane are true at every narrow width for that reason;
  // only isWide narrows them, never the stored value alone.
  const dayLayoutFocus = data.settings.dayLayoutFocus
  const showDayPane = !isWide || dayLayoutFocus !== 'tasks'
  const showTaskPane = !isWide || dayLayoutFocus !== 'calendar'
  // Which of the three kinds of day this is. A day in the past is a record and
  // a day in the future is a plan, and neither should read like today: the past
  // has nothing left to hurry, and the future has no "now" to be late against.
  // Only a class each, so the difference is entirely in tone - every control
  // still works, because a day you cannot edit is a day you cannot fix.
  const isPast = date < todayKey()
  const isFuture = date > todayKey()
  const dayViewClassName = [
    'day-view',
    isWide && dayLayoutFocus !== 'both' ? `focus-${dayLayoutFocus}` : '',
    isPast ? 'day-past' : '',
    isFuture ? 'day-future' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const keyCount = (day?.tasks ?? []).filter(t => t.highlight).length
  const sleepHours = sleepProfileWindow(daySleepProfileId, sleep)
  const asleepMinutes = sleepMinutes(sleepHours)

  return (
    <section className={dayViewClassName}>
      {/* The rail - docs/LAYOUT-WIDE.md section 5, build step 5. Mounted only
          when useIsWide() is true, regardless of dayLayoutFocus - the rail is
          not part of what that control redistributes. First in the DOM (not
          just visually leftmost) so keyboard tab order follows the visual
          order: rail, then header, then whichever pane(s) are showing - see the
          wide-layout verification pass in docs/LAYOUT-WIDE.md section 6. */}
      {isWide && (
        <div className="rail">
          <MiniCalendar date={date} onDateChange={onDateChange} />
          <TemplateRail date={date} />
          {/* What is coming and how the day is going - see DayDigest.tsx. Last
              in the rail, under the two things that navigate, because it is the
              one part of this column you read rather than act on. */}
          <DayDigest
            tasks={day?.tasks ?? []}
            capacity={capacity}
            score={score}
            sleepMinutes={asleepMinutes}
            nowMinutes={nowMinutes}
            isToday={isToday}
          />
        </div>
      )}

      <DayHeader
        date={date}
        onDateChange={onDateChange}
        template={template}
        score={score}
        isFullDay={isFullDay}
        keyCount={keyCount}
        nowMinutes={nowMinutes}
        runningTask={runningTask}
        runningLeft={runningLeft}
        sleepProfiles={sleepProfiles}
        daySleepProfileId={daySleepProfileId}
        isWide={isWide}
        dayLayoutFocus={dayLayoutFocus}
      />

      {/* Above the yesterday banner on purpose: one of these is about why, the
          other about what is left, and on a morning that shows both, why comes
          first. See NorthCard. */}
      {isToday && <NorthCard />}

      {/* What yesterday left, stated once and acted on in one tap - never moved
          forward on its own. See YesterdayBanner. */}
      <YesterdayBanner date={date} />

      {/* docs/LAYOUT-WIDE.md section 5, build step 3: the capacity line and the
          timeline grid group into one region - the "picture of the day" - so
          the wide layout can give it its own column. This div is not new
          chrome: below the breakpoint it is `display: contents` (see
          styles.css), so it adds no box, no spacing and no accessibility-tree
          node of its own. Below the breakpoint showDayPane is always true; only
          step 4's Calendar/Tasks focus, at a wide viewport, ever unmounts
          this. */}
      {showDayPane && (
        <div className="day-pane">
          {/* Purely informational - no embedded action. Being over is stated as
              a fact; which float moves to tomorrow, if any, is decided on that
              float's own row below, not pre-selected here. See
              docs/TIMELINE.md section 8. */}
          {capacityLine && (
            <div className="capacity-line">
              <p>{capacityLine}</p>
              {/* Its own line, in its own weight. Deliberately not a sentence
                  inside the one above: that sentence is the arithmetic of the
                  waking day, and sleep is the boundary that arithmetic runs
                  inside. Reading them as one paragraph would invite adding them
                  together, which is exactly the sum that does not mean
                  anything. */}
              <p className="capacity-sleep">
                Sleep {sleepHours.start}-{sleepHours.end} - {formatDuration(asleepMinutes)}, not free time.
              </p>
            </div>
          )}

          {/* The grid's own disclosure, collapsed by default - see
              docs/RESEARCH-ADHD.md section 7 and docs/TIMELINE.md section 5. A
              sibling of the capacity line rather than nested inside it: that
              line only ever states the arithmetic, with no action of its own
              embedded in it, and this toggle is a separate control. A proper
              disclosure, not a CSS-hidden panel: the region it names is only in
              the DOM while open, so a screen reader never lands on a picture it
              cannot currently see. Only shown when there is actually something
              to show - a day with no anchors has no grid to draw either way.
              Not rendered at all at the wide breakpoint - docs/LAYOUT-WIDE.md
              section 5: the grid has its own column there, so there is no fold
              left to protect and nothing this toggle would do. */}
          {capacity.anchorCount + capacity.externalCount > 0 && !isWide && (
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
              onAnchorPointerDown={drag.startDrag}
              onAnchorResizePointerDown={drag.startResize}
              onGeometry={drag.onGeometry}
              draggingTaskId={drag.draggingTaskId}
              activeTaskId={runningTask?.id}
              isToday={isToday}
              isWide={isWide}
              sleepProfileId={daySleepProfileId}
              events={events}
              onOpenTaskDetails={setDetailTaskId}
              onTaskContextMenu={(taskId, x, y) => setContextMenu({ taskId, x, y })}
              sleep={sleep}
            />
          )}
        </div>
      )}

      {/* Announces a drag-driven un-anchor, or a placement or removal made
          through the actions menu, to screen reader users - the same way
          TimelineGrid.tsx's own live region already covers the tap-a-gap path.
          A separate region because these fire from gestures TimelineGrid never
          sees: the drag can end outside the grid entirely, and the menu is not
          part of it at all. Deliberately outside both panes and always mounted,
          unlike them: an actions-menu placement can fire while dayLayoutFocus
          has unmounted .day-pane (focus 'tasks'), and this announcement still
          needs somewhere to land for a screen reader when that happens. Sitting
          here between the two panes in the JSX keeps the flattened phone DOM
          order exactly what it was before this region had its own top-level
          position. */}
      <p className="visually-hidden" aria-live="polite">{drag.announcement}</p>

      {/* The float tray - quick-add, the first-run/empty state, the task list,
          and the rollover button - grouped the same way and for the same reason
          as .day-pane above: `display: contents` below the breakpoint, a real
          grid column at it, no change to phone markup either way. Below the
          breakpoint showTaskPane is always true; only step 4's Calendar/Tasks
          focus, at a wide viewport, ever unmounts this. */}
      {showTaskPane && (
        <TaskPane
          date={date}
          tasks={tasks}
          leavingId={leavingId}
          isFullDay={isFullDay}
          library={data.library}
          runningTaskId={runningTask?.id}
          runningLeft={runningLeft}
          selectedTaskId={selection.selectedTaskId}
          taskListRef={selection.taskListRef}
          onToggleSelect={selection.toggleSelect}
          onToggleDone={toggleDone}
          onOpenActions={setActionsSheetTaskId}
          onOpenDetails={setDetailTaskId}
          onContextMenu={(taskId, x, y) => setContextMenu({ taskId, x, y })}
        />
      )}

      {actionsSheetTask && (
        <TaskActionsSheet
          task={actionsSheetTask}
          tasks={day?.tasks ?? []}
          onPlace={(taskId, time) => {
            if (actions.placeFloat(date, taskId, time)) {
              drag.announce(`${actionsSheetTask.title} placed at ${time}.`)
            }
          }}
          onUnanchor={taskId => {
            if (actions.unanchorTask(date, taskId)) {
              drag.announce(`${actionsSheetTask.title} no longer has a set time.`)
            }
          }}
          onPush={taskId => actions.pushTask(date, taskId)}
          onSetOngoing={(taskId, ongoing) => actions.setTaskUnbounded(date, taskId, ongoing)}
          onDelete={taskId => deleteWithUndo(taskId)}
          onOpenDetails={() => setDetailTaskId(actionsSheetTask.id)}
          onClose={() => setActionsSheetTaskId(null)}
        />
      )}

      {detailTask && (
        <TaskDetail
          task={detailTask}
          tasks={day?.tasks ?? []}
          date={date}
          library={data.library}
          onClose={() => setDetailTaskId(null)}
        />
      )}

      {contextTask && contextMenu && (
        <TaskContextMenu
          task={contextTask}
          x={contextMenu.x}
          y={contextMenu.y}
          highlightCount={keyCount}
          onDetails={() => setDetailTaskId(contextTask.id)}
          onToggleDone={() => toggleDone(contextTask.id, contextTask.done)}
          onToggleHighlight={() => actions.toggleTaskHighlight(date, contextTask.id)}
          onPush={() => actions.pushTask(date, contextTask.id)}
          onDelete={() => deleteWithUndo(contextTask.id)}
          onClose={() => setContextMenu(null)}
        />
      )}

      {selectedTask && (
        <TaskGapOffers
          task={selectedTask}
          tasks={day?.tasks ?? []}
          sleepProfileId={daySleepProfileId}
          sleep={sleep}
          onPlace={selection.placeSelected}
          onClose={selection.closeSelection}
        />
      )}
    </section>
  )
}
