import { MAX_HIGHLIGHTS, type SleepProfile, type Task, type Template } from '../../lib/types'
import { actions } from '../../lib/store'
import { addDays, formatDayTitle, todayKey } from '../../lib/dates'
import { formatDuration, minutesUntilSleep, windowFor } from './capacity'
import { formatClock } from './timelineLayout'
import { formatDayScore, type DayScore } from './score'
import { NorthLine } from './NorthLine'
import type { ReplanMode } from '../../lib/replanState'

/**
 * The masthead: which day this is, what time it is, how it is going, and the
 * one line the whole app is for.
 *
 * Everything here is read rather than acted on, with two exceptions - the day
 * arrows and, at a wide viewport, the pane focus control. It is grouped as one
 * component for the same reason it is one grid area: at the wide breakpoint
 * this whole block shares the timeline's column heading, and below it flows as
 * a plain stack (`display: contents`, see styles.css), so a phone's DOM is
 * unaffected by the grouping existing at all.
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
  sleepProfiles: SleepProfile[]
  daySleepProfileId: string | undefined
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
  sleepProfiles,
  daySleepProfileId,
  isWide,
  dayLayoutFocus,
  onOpenNorth,
  replan,
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

  // Only on today, and only once bedtime is close enough to matter. Measured
  // against the same waking window the grid greys and the capacity line counts
  // against, so the three can never disagree about when the day ends.
  const untilSleep = isToday
    ? minutesUntilSleep(nowMinutes, windowFor(daySleepProfileId, { profiles: sleepProfiles }))
    : null
  const showSleep = untilSleep !== null && untilSleep <= SLEEP_NOTICE_MINUTES

  return (
    <div className="day-header">
      <div className="day-nav">
        <button aria-label="Previous day" onClick={() => onDateChange(addDays(date, -1))}>
          &larr;
        </button>
        <div className="day-title">
          <h2>{isToday ? 'Today' : formatDayTitle(date)}</h2>
          {isToday && <span className="day-subtitle">{formatDayTitle(date)}</span>}
          {template && (
            <span
              className="day-template"
              style={{ ['--chip' as string]: template.color } as React.CSSProperties}
            >
              <span className="template-chip-dot" aria-hidden="true" />
              {template.name}
            </span>
          )}
          {/* Under the title rather than beside the arrows: a fourth thing
              in the nav row would have to be as loud as the arrows, and
              this is a door for a bad moment, not a control for every one. */}
          {replan && (
            <div className="day-replan">
              {!replan.isToday ? (
                <button type="button" className="link-button" onClick={() => replan.onOpen('interrupt')}>
                  Something came up
                </button>
              ) : replan.away ? (
                <>
                  <span className="day-replan-away">Away since {replan.away}</span>
                  <button type="button" className="link-button" onClick={() => replan.onOpen('back')}>
                    I'm back
                  </button>
                </>
              ) : (
                <button type="button" className="link-button" onClick={() => replan.onOpen('menu')}>
                  Replan
                </button>
              )}
            </div>
          )}
        </div>
        <button aria-label="Next day" onClick={() => onDateChange(addDays(date, 1))}>
          &rarr;
        </button>
      </div>

      {/* Which hours this particular day is measured against. Hidden entirely
          while there is only one schedule, which is the case for nearly
          everybody and always the case on a fresh install - a picker with one
          option is a question with one answer. The day inherits its template's
          schedule until somebody overrides it here, and the override is stored
          on the day, so changing the template later does not silently rewrite
          days already lived. */}
      {sleepProfiles.length > 1 && (
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
      )}

      {/* What is happening right now, in real text: the clock, the task running
          against it, and how much of it is left. This is the line that answers
          the question the app is opened to answer, so it is the one thing in
          the header that is not a control and not a number about the whole day.
          Rendered only on today, and only while something is actually running -
          a day with a genuine hole in it says nothing here rather than
          inventing a "nothing on" state, since the empty timeline beside it
          already says that better than a sentence would. */}
      {isToday && (
        <div className="day-now">
          <span className="day-now-clock">{formatClock(nowMinutes)}</span>
          {showSleep && (
            <span
              className={untilSleep <= SLEEP_URGENT_MINUTES ? 'day-sleep is-soon' : 'day-sleep'}
              title="Time until your sleep window starts"
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
            runningTask && (
              <>
                <span className="day-now-sep" aria-hidden="true" />
                <span className="day-now-task">{runningTask.title}</span>
                {runningLeft !== undefined && (
                  <span className="day-now-left">{formatDuration(runningLeft)} left</span>
                )}
              </>
            )
          )}
        </div>
      )}

      {/* A day that is not today says which way it is, in one word, where the
          clock would be. Without it the header is identical to today's and the
          only thing distinguishing them is a date somebody has to read and
          compare. */}
      {!isToday && (
        <div className="day-now">
          <span className="day-when">{isPast ? 'Past' : 'Ahead'}</span>
        </div>
      )}

      {/* The one line the whole app is for - see NorthLine. Inside the header
          rather than above the day, so it reads as part of the masthead rather
          than as a notice about today, and so nothing below it moves when it
          opens. */}
      <NorthLine date={date} onOpenNorth={onOpenNorth} />

      {/* The day's progress, promoted out of the title block it used to sit
          inside as a small trailing fraction. It is the one number worth
          reading first thing on opening the app, and a bar says "most of the
          way there" faster than a fraction does - the fraction stays right
          beside it, since a bar alone cannot say *which* three of nine. Only
          ever rendered for a day that has a plan at all: formatDayScore returns
          null for an empty day rather than "0/0", so nothing here can imply a
          plan that was never made. The bar itself is aria-hidden, and the
          fraction keeps the same visible-digits/spoken-sentence pairing it
          always had - a screen reader gets "three of nine done", not a
          percentage and a slash. */}
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
          {/* Only once at least one exists. A cap stated on an empty day is a
              rule nobody asked about yet; stated the moment somebody uses one,
              it is the answer to "how many of these do I get". */}
          {keyCount > 0 && (
            <span className="day-key-count">
              {keyCount}/{MAX_HIGHLIGHTS} key
            </span>
          )}
        </div>
      )}

      {/* The "switch fully" request - docs/LAYOUT-WIDE.md section 3.2. A width
          redistribution, not a navigation event: nothing about the underlying
          day changes, and the unmounted pane's own data is still computed from
          the same store regardless of which option is selected. Never rendered
          at all below the breakpoint - there is only ever one column there, so
          there is nothing for it to redistribute. Persisted the same way
          timelineExpanded is: one app-wide choice, not a per-day one, so it is
          never asked again. */}
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
  )
}
