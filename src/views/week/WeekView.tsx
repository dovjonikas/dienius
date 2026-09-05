import { useEffect, useMemo, useRef, useState } from 'react'
import { actions, getData, useAppData } from '../../lib/store'
import { addDays, shortWeekday, todayKey, weekOf } from '../../lib/dates'
import { weekdayOf } from '../../lib/repeats'
import { dayStat } from '../../lib/dayStats'
import { columnFor } from '../../lib/stamping'
import { categoryColor } from '../../lib/categories'
import { formatDuration } from '../../widgets/day-plan/capacity'
import { currentMinutes, formatClock } from '../../widgets/day-plan/timelineLayout'
import { useIsWide } from '../../lib/viewport'
import { eventsOn, useCalendarCache } from '../../lib/calendars'
import { offerUndo } from '../../lib/undo'
import { TaskDetail } from '../../widgets/day-plan/TaskDetail'
import { computeWeekLayout, timeAtPercent, type WeekBlock } from './weekLayout'
import { WeekColumn } from './WeekColumn'
import { WeekAgenda } from './WeekAgenda'
import { SomedayStrip } from './SomedayStrip'

/**
 * The week, as seven columns of one shared timeline.
 *
 * This is the height the app was missing. Today answers "what am I doing now",
 * the month answers "how has this been going", and neither answers the
 * question somebody actually plans in: does this week hold together. That
 * needs the days side by side and to scale, because the answer is a shape -
 * three heavy days and a hollow Thursday - not a number.
 *
 * **Why a third mode in Calendar rather than a seventh tab.** The tab bar is
 * already six items and already scrolls sideways at 390px, so a seventh makes
 * the app's primary navigation worse for everybody in order to reach one view.
 * Month / Week / Year is also where anybody who has used a calendar will look
 * for it: the segmented control is the convention, and matching a convention
 * costs nothing where inventing one costs a discovery.
 *
 * **Zero scroll, structurally rather than by tuning.** The grid is a flex
 * child with `min-height: 0` and every block is a percentage of it - see
 * `weekLayout.ts`. There is no pixel budget to blow and no density to fit, so
 * the week fits 1920x1080 and 1366x768 for the same reason it fits anything
 * else: it takes the height it is given.
 */

/**
 * How many days a narrow screen shows at once.
 *
 * Three, not seven, and not a vertical list either. At 390px seven columns are
 * 47px each, which is not a block, it is a stripe - and a stripe with no name
 * on it says nothing the month grid does not already say better. A vertical
 * list would be worse: it is the Today view repeated, and the app already has
 * one of those. Three columns leave ~115px each, which is a real block with a
 * readable name, and adjacency is the whole point - "what does the next couple
 * of days look like" is the question a phone gets asked.
 */
export const NARROW_DAYS = 3

/**
 * The days a screen actually shows for a chosen date: the whole week when
 * wide, and on a phone the chosen day with one either side - yesterday, today,
 * tomorrow by default, which is the reading somebody opens their phone for.
 *
 * Exported because the calendar bar's title has to name the same days. A
 * heading that says "31 August - 6 September" above three columns of
 * Wednesday to Friday is a heading about a different picture.
 */
export function visibleWeekDays(date: string, isWide: boolean): string[] {
  return isWide ? weekOf(date) : [addDays(date, -1), date, addDays(date, 1)]
}

/** How far a finger has to travel before a swipe counts as one. */
const SWIPE_THRESHOLD_PX = 50

/** As on the day grid: enough to tell a drag from a tap that wobbled. */
const MIN_DRAG_DISTANCE_PX = 8

/** The two ways to read a week - see WeekAgenda for why there are two. */
export type WeekReading = 'grid' | 'agenda'

export interface WeekViewProps {
  /** The date the week is centred on. Opening a day hands this back up. */
  date: string
  onDateChange: (date: string) => void
  onOpenDay: (date: string) => void
  /**
   * Grid or agenda. Owned by the calendar bar, because the toggle for it sits
   * beside Month / Week / Year rather than inside the week - a second
   * segmented control one row down would be two controls saying "which view"
   * on the same screen.
   */
  reading?: WeekReading
}

export function WeekView({ date, onDateChange, onOpenDay, reading = 'grid' }: WeekViewProps) {
  const data = useAppData()
  const isWide = useIsWide()
  const today = todayKey()
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null)
  const [detailDate, setDetailDate] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const [nowMinutes, setNowMinutes] = useState(() => currentMinutes())

  const dragRef = useRef<{ taskId: string; from: string; x: number; y: number } | null>(null)
  const swipeRef = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const timer = setInterval(() => setNowMinutes(currentMinutes()), 30_000)
    return () => clearInterval(timer)
  }, [])

  const visible = useMemo(() => visibleWeekDays(date, isWide), [isWide, date])

  const templateProfile = useMemo(() => {
    return (day: string) => {
      const id = data.days[day]?.templateId
      const template = id ? data.templates.find(t => t.id === id) : undefined
      // Through columnFor - a week template answers per weekday. See DayView.
      return template ? columnFor(template, day).sleepProfileId : undefined
    }
  }, [data.days, data.templates])

  const calendarCache = useCalendarCache()

  const layout = useMemo(
    () => computeWeekLayout(visible, data.days, { profiles: data.settings.sleepProfiles }, templateProfile),
    [visible, data.days, data.settings.sleepProfiles, templateProfile],
  )

  const detailTask = detailDate && detailTaskId
    ? data.days[detailDate]?.tasks.find(t => t.id === detailTaskId)
    : undefined

  // --- moving a block between days ---------------------------------------

  function beginDrag(block: WeekBlock, e: React.PointerEvent) {
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    dragRef.current = { taskId: block.task.id, from: block.date, x: e.clientX, y: e.clientY }
    setDraggingId(block.task.id)
  }

  useEffect(() => {
    function end(e: PointerEvent) {
      const drag = dragRef.current
      dragRef.current = null
      setDraggingId(null)
      if (!drag) return

      const moved = Math.hypot(e.clientX - drag.x, e.clientY - drag.y) >= MIN_DRAG_DISTANCE_PX
      if (!moved) {
        // A tap, not a drag. Opening the detail here rather than on the block's
        // own onClick keeps the two gestures from both firing on one press.
        setDetailDate(drag.from)
        setDetailTaskId(drag.taskId)
        return
      }

      const column = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-week-date]')
      const to = column?.dataset.weekDate
      if (!to || to === drag.from) return

      const task = getDataTask(drag.from, drag.taskId)
      if (actions.moveTaskToDay(drag.from, to, drag.taskId)) {
        const title = task?.title ?? 'Task'
        setAnnouncement(`${title} moved to ${shortWeekday(to)}.`)
        offerUndo(`${title} moved to ${shortWeekday(to)}`, () => actions.moveTaskToDay(to, drag.from, drag.taskId))
      } else {
        // The only way this refuses is a day that already has the same task -
        // see moveTaskToDay. Saying so beats a drag that silently snaps back.
        setAnnouncement(`${shortWeekday(to)} already has that one.`)
      }
    }
    function cancel() {
      dragRef.current = null
      setDraggingId(null)
    }
    document.addEventListener('pointerup', end)
    document.addEventListener('pointercancel', cancel)
    return () => {
      document.removeEventListener('pointerup', end)
      document.removeEventListener('pointercancel', cancel)
    }
  }, [])

  // Read from the store rather than from `data`: the document listener above
  // is subscribed once, so its closure holds the first render's snapshot for
  // the life of the view.
  function getDataTask(day: string, taskId: string) {
    return getData().days[day]?.tasks.find(t => t.id === taskId)
  }

  // --- clicking an empty column ------------------------------------------

  function addAt(day: string, percent: number) {
    const time = timeAtPercent(percent, layout.window)
    actions.addTask(day, 'New task', time)
    // getData, not `data`: `data` is this render's snapshot and the task was
    // added a line ago, so the snapshot does not have it. Reading the store
    // directly is what every handler in the app does for the same reason.
    const added = getData().days[day]?.tasks.at(-1)
    // Straight into the detail sheet, where the title field is focused: a task
    // called "New task" is not the point of the gesture, it is the placeholder
    // the gesture leaves behind while you type the real one.
    setDetailDate(day)
    setDetailTaskId(added?.id ?? null)
    setAnnouncement(`New task added to ${shortWeekday(day)} at ${time}.`)
  }

  // --- stamping ----------------------------------------------------------

  function stampDay(day: string, templateId: string) {
    actions.stamp({ [day]: templateId })
  }

  // --- swiping on a phone -------------------------------------------------

  function onGridPointerDown(e: React.PointerEvent) {
    if (isWide) return
    swipeRef.current = { x: e.clientX, y: e.clientY }
  }

  function onGridPointerUp(e: React.PointerEvent) {
    const start = swipeRef.current
    swipeRef.current = null
    if (isWide || !start || dragRef.current) return
    const dx = e.clientX - start.x
    // Mostly horizontal, or it was a scroll attempt rather than a swipe.
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX || Math.abs(dx) < Math.abs(e.clientY - start.y)) return
    onDateChange(addDays(date, dx < 0 ? NARROW_DAYS : -NARROW_DAYS))
  }

  if (reading === 'agenda') {
    return (
      <div className="week is-agenda">
        <WeekAgenda
          dates={visible}
          onOpenDay={onOpenDay}
          onOpenTask={(day, taskId) => {
            setDetailDate(day)
            setDetailTaskId(taskId)
          }}
        />
        <SomedayStrip onScheduled={setAnnouncement} />
        <p className="visually-hidden" aria-live="polite">{announcement}</p>
        {detailTask && detailDate && (
          <TaskDetail
            task={detailTask}
            tasks={data.days[detailDate]?.tasks ?? []}
            date={detailDate}
            library={data.library}
            onClose={() => {
              setDetailTaskId(null)
              setDetailDate(null)
            }}
          />
        )}
      </div>
    )
  }

  return (
    <div className="week" onPointerDown={onGridPointerDown} onPointerUp={onGridPointerUp}>
      {/* The arrows, the title, Today and Stamp week live in the calendar bar
          above - one row with the mode toggle rather than a second row of
          their own. On a phone that second row was a fifth of the grid. */}
      <div className="week-grid">
        {/* One axis for seven columns - see sharedWindow. Hours only, because
            a label on every block is what turns a week into a wall of text;
            the block says what, the axis says when. */}
        <div className="week-axis" aria-hidden="true">
          {layout.hours.map(minutes => (
            <span
              key={minutes}
              className="week-hour"
              style={{ top: `${((minutes - layout.window.start) / (layout.window.end - layout.window.start)) * 100}%` }}
            >
              {formatClock(minutes)}
            </span>
          ))}
        </div>

        {layout.days.map((day, i) => (
          <WeekColumn
            key={day.date}
            day={day}
            index={i}
            isToday={day.date === today}
            isPast={day.date < today}
            nowMinutes={nowMinutes}
            window={layout.window}
            templates={data.templates}
            categories={data.categories}
            template={data.templates.find(t => t.id === data.days[day.date]?.templateId)}
            stat={day.date <= today ? dayStat(data.days[day.date]) : undefined}
            events={eventsOn(day.date, data.settings.calendars, calendarCache)}
            draggingId={draggingId}
            weekdayTemplateId={data.settings.weekdayTemplates[weekdayOf(day.date)]}
            replanned={!!data.days[day.date]?.replannedOn}
            onBlockPointerDown={beginDrag}
            onEmptyClick={percent => addAt(day.date, percent)}
            onStamp={templateId => stampDay(day.date, templateId)}
            onOpenDay={() => onOpenDay(day.date)}
          />
        ))}
      </div>

      {/* What you have without a day, under what you have with one. Drag one
          onto a column and it is planned - see SomedayStrip. */}
      <SomedayStrip onScheduled={setAnnouncement} />

      <p className="visually-hidden" aria-live="polite">{announcement}</p>

      {detailTask && detailDate && (
        <TaskDetail
          task={detailTask}
          tasks={data.days[detailDate]?.tasks ?? []}
          date={detailDate}
          library={data.library}
          onClose={() => {
            setDetailTaskId(null)
            setDetailDate(null)
          }}
        />
      )}
    </div>
  )
}

/** Exported for the column footer, which says the same thing about a past day. */
export function footerLine(stat: ReturnType<typeof dayStat> | undefined, taskCount: number, focusMinutes: number): string {
  if (stat && stat.rate !== null) {
    return `${stat.done}/${stat.total} done`
  }
  if (taskCount === 0) return 'nothing yet'
  const focus = focusMinutes > 0 ? ` - ${formatDuration(focusMinutes)}` : ''
  return `${taskCount} ${taskCount === 1 ? 'task' : 'tasks'}${focus}`
}

export { categoryColor }
