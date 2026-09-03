import { useEffect, useMemo, useRef, useState } from 'react'
import { actions, getData, useAppData } from '../../lib/store'
import { addDays, shortWeekday, todayKey, weekOf } from '../../lib/dates'
import { weekdayOf } from '../../lib/repeats'
import { dayStat } from '../../lib/dayStats'
import { categoryColor } from '../../lib/categories'
import { formatDuration } from '../../widgets/day-plan/capacity'
import { currentMinutes, formatClock } from '../../widgets/day-plan/timelineLayout'
import { useIsWide } from '../../lib/viewport'
import { eventsOn, useCalendarCache } from '../../lib/calendars'
import { offerUndo } from '../../lib/undo'
import { TaskDetail } from '../../widgets/day-plan/TaskDetail'
import { computeWeekLayout, timeAtPercent, type WeekBlock } from './weekLayout'
import { WeekColumn } from './WeekColumn'

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
const NARROW_DAYS = 3

/** How far a finger has to travel before a swipe counts as one. */
const SWIPE_THRESHOLD_PX = 50

/** As on the day grid: enough to tell a drag from a tap that wobbled. */
const MIN_DRAG_DISTANCE_PX = 8

export interface WeekViewProps {
  /** The date the week is centred on. Opening a day hands this back up. */
  date: string
  onDateChange: (date: string) => void
  onOpenDay: (date: string) => void
}

export function WeekView({ date, onDateChange, onOpenDay }: WeekViewProps) {
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

  const fullWeek = useMemo(() => weekOf(date), [date])
  // On a narrow screen the window is anchored so that the chosen day is the
  // middle one - yesterday, today, tomorrow by default, which is the reading
  // somebody opens their phone for.
  const visible = useMemo(
    () => (isWide ? fullWeek : [addDays(date, -1), date, addDays(date, 1)]),
    [isWide, fullWeek, date],
  )

  const templateProfile = useMemo(() => {
    return (day: string) => {
      const id = data.days[day]?.templateId
      return id ? data.templates.find(t => t.id === id)?.sleepProfileId : undefined
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

  /**
   * The whole week from the weekday mapping, in one press.
   *
   * Only days the mapping actually names, and only days that have no template
   * yet: stamping over a week somebody has already arranged by hand is not a
   * convenience, it is a loss, and this button is deliberately the one-press
   * kind that has to be safe to press by accident.
   */
  function stampWeek() {
    const mapping = data.settings.weekdayTemplates
    const stamps: Record<string, string> = {}
    for (const day of fullWeek) {
      const templateId = mapping[weekdayOf(day)]
      if (templateId && !data.days[day]?.templateId) stamps[day] = templateId
    }
    const count = Object.keys(stamps).length
    if (count === 0) {
      setAnnouncement('Every day this week already has a template.')
      return
    }
    actions.stamp(stamps)
    setAnnouncement(`${count} ${count === 1 ? 'day' : 'days'} stamped from your weekday plan.`)
  }

  const mappedDays = fullWeek.filter(d => data.settings.weekdayTemplates[weekdayOf(d)]).length
  const unstampedMapped = fullWeek.filter(
    d => data.settings.weekdayTemplates[weekdayOf(d)] && !data.days[d]?.templateId,
  ).length

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

  return (
    <div className="week" onPointerDown={onGridPointerDown} onPointerUp={onGridPointerUp}>
      <div className="week-bar">
        <div className="week-nav">
          <button
            type="button"
            aria-label={isWide ? 'Previous week' : 'Earlier days'}
            onClick={() => onDateChange(addDays(date, isWide ? -7 : -NARROW_DAYS))}
          >
            &larr;
          </button>
          <button type="button" className="btn-secondary week-today" onClick={() => onDateChange(today)}>
            Today
          </button>
          <button
            type="button"
            aria-label={isWide ? 'Next week' : 'Later days'}
            onClick={() => onDateChange(addDays(date, isWide ? 7 : NARROW_DAYS))}
          >
            &rarr;
          </button>
        </div>

        {/* Only where there is a mapping to apply. A button that explains it
            cannot do anything is worse than a button that is not there. */}
        {mappedDays > 0 && (
          <button
            type="button"
            className="btn-secondary week-stamp-all"
            onClick={stampWeek}
            disabled={unstampedMapped === 0}
            title={
              unstampedMapped === 0
                ? 'Every day this week already has a template'
                : 'Stamp the days your weekday plan names, leaving anything you have already arranged alone'
            }
          >
            Stamp week
          </button>
        )}
      </div>

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
            template={data.templates.find(t => t.id === data.days[day.date]?.templateId)}
            stat={day.date <= today ? dayStat(data.days[day.date]) : undefined}
            events={eventsOn(day.date, data.settings.calendars, calendarCache)}
            draggingId={draggingId}
            weekdayTemplateId={data.settings.weekdayTemplates[weekdayOf(day.date)]}
            onBlockPointerDown={beginDrag}
            onEmptyClick={percent => addAt(day.date, percent)}
            onStamp={templateId => stampDay(day.date, templateId)}
            onOpenDay={() => onOpenDay(day.date)}
          />
        ))}
      </div>

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
