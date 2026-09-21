import { MAX_HIGHLIGHTS, type SleepProfile, type Task, type Template } from '../../lib/types'
import { actions } from '../../lib/store'
import { addDays, formatDayTitle, monthAndDay, todayKey, weekdayName } from '../../lib/dates'
import { formatDuration, wakingDayFor } from './capacity'
import { minutesUntilSleep } from '../../lib/wakingDay'
import { formatClock } from './timelineLayout'
import { formatDayScore, type DayScore } from './score'
import { NorthLine } from './NorthLine'
import { NorthDay } from './NorthDay'
import { Explain } from '../../views/Explain'
import type { ReplanMode } from '../../lib/replanState'

/**
 * The masthead: which day this is, what time it is, how it is going, and the
 * one line the whole app is for.
 *
 * Everything here is read rather than acted on, with three exceptions - the
 * doors for a broken day, the day arrows on a phone, and at a wide viewport
 * the pane focus control. It is one component with two arrangements: at the
 * wide breakpoint a masthead laid on the day's column and the task column,
 * and below it a plain stack (`display: contents`, see styles.css). The
 * parts are built once and placed twice.
 */

/**
 * How close bedtime has to be before the header mentions it at all. Four hours
 * is roughly when what is left of the evening starts being a real constraint
 * on what can still be started; before that it is a number about nothing, and
 * a number about nothing shown all day is noise that teaches people to stop
 * reading the header.
 */
const SLEEP_NOTICE_MINUTES = 4 * 60

/** Below this, the same number stops being information and starts being a nudge. */
const SLEEP_URGENT_MINUTES = 30

export interface DayHeaderProps {
  date: string
  onDateChange: (date: string) => void
  template: Template | undefined
  score: DayScore
  isFullDay: boolean
  keyCount: number
  nowMinutes: number
  runningTask: Task | undefined
  runningLeft: number | undefined
  /**
   * Whether the running task is one of this day's own blocks, drawn on its grid.
   * Last night's shift running after midnight is not, so the header says its
   * time left itself. Absent is true.
   */
  runningOnGrid?: boolean
  /**
   * The task a focus session is running on, when there is one on this day.
   * While it is the running task, the focus strip above the app already says
   * its name and its countdown, and the header says only the clock - the
   * same line twice, stacked, is CONVENTIONS section 23's whole subject.
   */
  focusedTaskId?: string
  sleepProfiles: SleepProfile[]
  daySleepProfileId: string | undefined
  /** The schedule tonight's sleep follows - the next date's; absent is the day's own. */
  tonightProfileId?: string
  isWide: boolean
  dayLayoutFocus: 'both' | 'calendar' | 'tasks'
  /** Passed straight to the North line - see NorthLine. */
  onOpenNorth: () => void
  /**
   * The way into replanning - see replan.ts. Today has the three doors,
   * behind Replan; while the person is away the header says so and offers
   * the way back instead. A day still ahead has the one door that applies to
   * it, Something came up, opened straight onto that day.
   */
  replan?: { away: string | undefined; isToday: boolean; onOpen: (mode: ReplanMode) => void }
  /** The day was declared a low one - see lowDay.ts. The door goes and a quiet mark takes its place. */
  lowDay?: boolean
}

export function DayHeader({
  date,
  onDateChange,
  template,
  score,
  isFullDay,
  keyCount,
  nowMinutes,
  runningTask,
  runningLeft,
  runningOnGrid = true,
  focusedTaskId,
  sleepProfiles,
  daySleepProfileId,
  tonightProfileId,
  isWide,
  dayLayoutFocus,
  onOpenNorth,
  replan,
  lowDay,
}: DayHeaderProps) {
  const isToday = date === todayKey()
  const isPast = date < todayKey()
  const formattedScore = formatDayScore(score)
  const scoreLabel = score.planned
    ? isFullDay
      ? `${score.done} of ${score.total} done`
      : `${score.done} of ${score.total} core tasks done`
    : undefined
  const progressPercent = score.planned && score.total > 0 ? (score.done / score.total) * 100 : 0

  // Everything planned is finished. Worth saying up here, because by then the
  // task column is showing the cleared state and the timeline is fully drained
  // - and without a word in the header the day reads as empty rather than as
  // finished, which is the one distinction the whole app turns on.
  const dayCleared = score.planned && score.done === score.total

  // The strip is saying it. While a focus session runs on the running task,
  // the bar at the top of the app carries the title and the countdown with
  // the session's own controls, and this line keeps the clock alone.
  const stripSaysIt = runningTask !== undefined && focusedTaskId === runningTask.id
  // On a wide screen the grid stands beside the header, and its running
  // block says when it ends (see nowHint), so the header names the task
  // without its time left - once, CONVENTIONS 23. The Tasks focus puts the
  // grid away, and on a phone it is a scroll or a press away, so there the
  // header says it.
  const gridSaysLeft = isWide && dayLayoutFocus !== 'tasks' && runningOnGrid

  // Only on today, and only once bedtime is close enough to matter. Measured
  // against the same waking day the grid greys and the capacity line counts
  // against, so the three can never disagree about when the day ends - to
  // tonight's bedtime, past midnight where that is, in real minutes.
  const untilSleep = isToday
    ? minutesUntilSleep(date, nowMinutes, wakingDayFor(daySleepProfileId, { profiles: sleepProfiles, tonightProfileId }))
    : null
  const showSleep = untilSleep !== null && untilSleep <= SLEEP_NOTICE_MINUTES

  // The day's name over its date - "Today" and the whole date, or the weekday
  // and the rest of it on any other day. Together they always print the same
  // date, at every width.
  const title = (
    <div className="day-title-text">
      <h2>{isToday ? 'Today' : weekdayName(date)}</h2>
      <span className="day-subtitle">{isToday ? formatDayTitle(date) : monthAndDay(date)}</span>
    </div>
  )

  // What is happening right now, in real text: the clock, the task running
  // against it, and how much of it is left. The line that answers the
  // question the app is opened to answer. A day with a genuine hole in it
  // says nothing after the clock rather than inventing a "nothing on" state -
  // the empty timeline beside it says that better. A day that is not today
  // says which way it is, in one word, where the clock would be: without it
  // the header is identical to today's but for a date somebody has to read.
  const now = isToday ? (
    <div className="day-now">
      <span className="day-now-clock">{formatClock(nowMinutes)}</span>
      {showSleep && (
        <span
          className={untilSleep <= SLEEP_URGENT_MINUTES ? 'day-sleep is-soon' : 'day-sleep'}
          data-tip="Time until sleep"
        >
          Sleep in {formatDuration(untilSleep)}
        </span>
      )}
      {dayCleared ? (
        <>
          <span className="day-now-sep" aria-hidden="true" />
          <span className="day-now-done">Day cleared</span>
        </>
      ) : (
        runningTask &&
        !stripSaysIt && (
          <>
            <span className="day-now-sep" aria-hidden="true" />
            <span className="day-now-task">{runningTask.title}</span>
            {runningLeft !== undefined && !gridSaysLeft && (
              <span className="day-now-left">{formatDuration(runningLeft)} left</span>
            )}
          </>
        )
      )}
    </div>
  ) : (
    <div className="day-now">
      <span className="day-when">{isPast ? 'Past' : 'Ahead'}</span>
    </div>
  )

  // What the day came from.
  const chip = template && (
    <span className="day-template" style={{ ['--chip' as string]: template.color } as React.CSSProperties}>
      {/* A kind of day as its letter, where the dot stands - the roster
          draws a date by its letter, and the day it makes says the same. */}
      {template.dayKind ? (
        <span className="kind-mark" aria-hidden="true">
          {template.dayKind.letter}
        </span>
      ) : (
        <span className="template-chip-dot" aria-hidden="true" />
      )}
      {template.name}
    </span>
  )

  // The doors for when the day breaks. Buttons of the controls' own height
  // and ground rather than underlined words, and none of the accent: a door
  // for a bad moment, not the thing the screen is for.
  const doors = (replan || lowDay) && (
    <div className="day-doors">
      {replan &&
        (!replan.isToday ? (
          <button type="button" className="day-replan-button" onClick={() => replan.onOpen('interrupt')}>
            Something came up
          </button>
        ) : replan.away ? (
          <>
            <span className="day-replan-away">Away since {replan.away}</span>
            <button type="button" className="day-replan-button" onClick={() => replan.onOpen('back')}>
              Back
            </button>
          </>
        ) : (
          <button type="button" className="day-replan-button" onClick={() => replan.onOpen('menu')}>
            Replan
          </button>
        ))}
      {/* The other door for a day that is not going to be a full one - the
          40% doctrine as one press, see lowDay.ts. Only on today, and only
          until it is taken: after that the day carries the mark instead,
          quiet, in the register of the template chip. */}
      {replan && replan.isToday && !replan.away && !lowDay && (
        <Explain id="low-day">
          <button type="button" className="day-replan-button" onClick={() => replan.onOpen('low')}>
            Low day
          </button>
        </Explain>
      )}
      {lowDay && <span className="day-low">Low day</span>}
    </div>
  )

  // Which hours this particular day is measured against. Hidden entirely
  // while there is only one schedule, which is the case for nearly everybody
  // and always the case on a fresh install - a picker with one option is a
  // question with one answer. The day inherits its template's schedule until
  // somebody overrides it here, and the override is stored on the day, so
  // changing the template later does not silently rewrite days already lived.
  const schedule = sleepProfiles.length > 1 && (
    <label className="day-schedule">
      <span className="visually-hidden">Sleep schedule for this day</span>
      <select
        className="setting-select"
        value={daySleepProfileId ?? sleepProfiles[0].id}
        onChange={e => actions.setDaySleepProfile(date, e.target.value)}
      >
        {sleepProfiles.map(p => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </label>
  )

  // The day's progress: a bar, and the plain fraction beside it, because a
  // bar alone cannot say *which* three of nine. Only for a day that has a
  // plan at all - formatDayScore returns null for an empty day rather than
  // "0/0", so nothing here implies a plan that was never made. The bar is
  // aria-hidden; a screen reader gets "three of nine done", not a percentage
  // and a slash.
  const progress = formattedScore && (
    <div className="day-progress">
      <div className="day-progress-track" aria-hidden="true">
        <div className="day-progress-fill" style={{ width: `${progressPercent}%` }} />
      </div>
      <span className="day-score">
        <span aria-hidden="true">
          {formattedScore}
          {!isFullDay && <span className="day-score-note"> core</span>}
          {/* Only once at least one exists. A cap stated on an empty day is
              a rule nobody asked about yet; stated the moment somebody uses
              one, it is the answer to "how many of these do I get". Inside
              the fraction's own phrase rather than a second number in its
              own box: "6/11" and "1/3 key" side by side read as two scores,
              and the second was never a score. */}
          {keyCount > 0 && (
            <span className="day-key-count">
              {' '}
              · {keyCount} of {MAX_HIGHLIGHTS} key
            </span>
          )}
        </span>
        <span className="visually-hidden">
          {scoreLabel}
          {keyCount > 0 && `, ${keyCount} of ${MAX_HIGHLIGHTS} key tasks marked`}
        </span>
      </span>
    </div>
  )

  if (!isWide) {
    // The phone: a stack. The arrows bracket the day's name, because there is
    // no month on this screen to move the day with; the chip and the doors
    // are a row under it, then the clock and the day's progress, North's line
    // for the day with its signature, and North's headings folded to one
    // word under it, opening on a press. The left and right arrow keys move a
    // day at any width, and T comes back to today.
    return (
      <div className="day-header">
        <div className="day-nav">
          <button aria-label="Previous day" onClick={() => onDateChange(addDays(date, -1))}>
            &larr;
          </button>
          <div className="day-title">{title}</div>
          <button aria-label="Next day" onClick={() => onDateChange(addDays(date, 1))}>
            &rarr;
          </button>
        </div>
        {(chip || doors) && (
          <div className="day-tools">
            {chip}
            {doors}
          </div>
        )}
        {schedule}
        {now}
        {progress}
        {/* The one line the whole app is for - see NorthLine. */}
        <NorthLine date={date} onOpenNorth={onOpenNorth} />
        <NorthDay date={date} folded />
      </div>
    )
  }

  // The wide masthead: two rows laid on the day's column and the task
  // column - see .day-header in styles.css. Over the day, its name, its date
  // and the time on one line, and under them North's line; over the
  // tasks, what the day came from and its doors, and under them how far the
  // day has come and which panes are showing. There are no arrows at this
  // width: the month in the rail is the way to another day.
  return (
    <div className="day-header">
      <div className="day-masthead-day">
        {title}
        {now}
      </div>
      {(chip || schedule || doors) && (
        <div className="day-tools">
          {chip}
          {schedule}
          {doors}
        </div>
      )}
      <NorthLine date={date} onOpenNorth={onOpenNorth} />
      <div className="day-masthead-status">
        {progress}
        {/* The "switch fully" request - docs/LAYOUT-WIDE.md section 3.2. A
            width redistribution, not a navigation event: nothing about the
            underlying day changes. Persisted the same way timelineExpanded
            is: one app-wide choice, not a per-day one, so it is never asked
            again. */}
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
      </div>
    </div>
  )
}
