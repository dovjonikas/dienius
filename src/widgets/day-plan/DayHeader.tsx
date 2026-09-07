import { MAX_HIGHLIGHTS, type SleepProfile, type Task, type Template } from '../../lib/types'
import { actions } from '../../lib/store'
import { addDays, formatDayTitle, todayKey } from '../../lib/dates'
import { formatDuration, minutesUntilSleep, windowFor } from './capacity'
import { formatClock } from './timelineLayout'
import { formatDayScore, type DayScore } from './score'
import { NorthLine } from './NorthLine'
import { Explain } from '../../views/Explain'
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
  /**
   * The task a focus session is running on, when there is one on this day.
   * While it is the running task, the focus strip above the app already says
   * its name and its countdown, and the header says only the clock - the
   * same line twice, stacked, is CONVENTIONS section 23's whole subject.
   */
  focusedTaskId?: string
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
  focusedTaskId,
  sleepProfiles,
  daySleepProfileId,
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

  // Only on today, and only once bedtime is close enough to matter. Measured
  // against the same waking window the grid greys and the capacity line counts
  // against, so the three can never disagree about when the day ends.
  const untilSleep = isToday
    ? minutesUntilSleep(nowMinutes, windowFor(daySleepProfileId, { profiles: sleepProfiles }))
    : null
  const showSleep = untilSleep !== null && untilSleep <= SLEEP_NOTICE_MINUTES

  return (
    <div className="day-header">
      {/* The arrows bracket the day's name and nothing else. They used to
          bracket the template chip and the Replan link as well, so the
          right arrow sat half a screen from the left one with a pill and a
          word between them, and the row read as five things at one weight.
          Which day is one group; what to do about it is the next.

          They are on the wide header too, at every width, since v2.7. They
          came off it in v2.6 because they overflowed - a long day pushed
          the right one out where it should not be, and the month in the
          rail looked like answer enough. The owner's rule is the other way
          round: the answer to a control that overflows is to make overflow
          impossible, not to remove the control. So the title sits in a box
          of one fixed width, measured by the longest day the app can print
          (the ghost under it, below), the row is one flex item that cannot
          wrap, and the arrows are the same 44px squares here as on a
          phone. The left and right arrow keys still move a day on the day
          view, and T comes back to today. */}
      <div className="day-nav">
        <button aria-label="Previous day" onClick={() => onDateChange(addDays(date, -1))}>
          &larr;
        </button>
        <div className="day-title">
          <div className="day-title-text">
            <h2>{isToday ? 'Today' : formatDayTitle(date)}</h2>
            {isToday && <span className="day-subtitle">{formatDayTitle(date)}</span>}
          </div>
          {/* The longest day the format prints, in the heading's own type
              and hidden, stacked under the real title so the box holds one
              width on every day - see .day-title in styles.css. Only in the
              flow at the wide breakpoint; a phone keeps its shrinking
              title. dates.test.ts pins the string, so a change to the
              format shows up there before it shows up as a wrapped
              header. */}
          <span className="day-title-measure" aria-hidden="true">
            Wednesday, September 30
          </span>
        </div>
        <button aria-label="Next day" onClick={() => onDateChange(addDays(date, 1))}>
          &rarr;
        </button>
      </div>

      {/* What the day came from, and the door for when it breaks. The door
          is a button of the arrows' own height and shape rather than an
          underlined word: it is in the arrows' row, and a control in a row
          of controls drawn as running text was the thing that read as an
          afterthought. Still one door, still quiet - the same surface as the
          arrows, none of the accent. */}
      {(template || replan || lowDay) && (
        <div className="day-tools">
          {template && (
            <span
              className="day-template"
              style={{ ['--chip' as string]: template.color } as React.CSSProperties}
            >
              <span className="template-chip-dot" aria-hidden="true" />
              {template.name}
            </span>
          )}
          {replan &&
            (!replan.isToday ? (
              <button type="button" className="day-replan-button" onClick={() => replan.onOpen('interrupt')}>
                Something came up
              </button>
            ) : replan.away ? (
              <>
                <span className="day-replan-away">Away since {replan.away}</span>
                <button type="button" className="day-replan-button" onClick={() => replan.onOpen('back')}>
                  I'm back
                </button>
              </>
            ) : (
              <button type="button" className="day-replan-button" onClick={() => replan.onOpen('menu')}>
                Replan
              </button>
            ))}
          {/* The other door for a day that is not going to be a full one -
              the 40% doctrine as one press, see lowDay.ts. Only on today,
              and only until it is taken: after that the day carries the
              mark instead, quiet, in the register of the template chip. */}
          {replan && replan.isToday && !replan.away && !lowDay && (
            <Explain id="low-day">
              <button type="button" className="day-replan-button" onClick={() => replan.onOpen('low')}>
                Low day
              </button>
            </Explain>
          )}
          {lowDay && <span className="day-low">Low day</span>}
        </div>
      )}

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
      {/* The clock and the day's progress are one group, the status: what
          minute it is, what is running, and how far the day has come. One
          group so the header is three things - the day, its status, the
          view - at three weights, rather than a row of parts with the same
          gap between each; and the one that gives when the row is short,
          so the running task's title ellipsises before the view toggle is
          pushed to a second line. Below the wide breakpoint it is no box at
          all (display: contents), and the clock and the bar stack as they
          always did. */}
      {/* The right zone: the status and the view toggle, one flex item so
          that when the row is too short for both zones this one goes down
          a line whole and stays on the right, rather than the toggle alone
          dropping to the left under the day's name. No box below the wide
          breakpoint. */}
      <div className="day-header-right">
      <div className="day-status">
      {isToday && (
        <div className="day-now">
          <span className="day-now-clock">{formatClock(nowMinutes)}</span>
          {showSleep && (
            <span
              className={untilSleep <= SLEEP_URGENT_MINUTES ? 'day-sleep is-soon' : 'day-sleep'}
              data-tip="Time until your sleep window starts"
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
              {/* Only once at least one exists. A cap stated on an empty day
                  is a rule nobody asked about yet; stated the moment somebody
                  uses one, it is the answer to "how many of these do I get".
                  Inside the fraction's own phrase rather than a second number
                  in its own box: "6/11" and "1/3 key" side by side read as
                  two scores, and the second was never a score - it is how
                  many of the three a day allows have been marked. */}
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
      )}
      </div>


      

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

      {/* The one line the whole app is for - see NorthLine. Inside the header
          rather than above the day, so it reads as part of the masthead rather
          than as a notice about today, and so nothing below it moves when it
          opens. */}
      <NorthLine date={date} onOpenNorth={onOpenNorth} />
    </div>
  )
}
