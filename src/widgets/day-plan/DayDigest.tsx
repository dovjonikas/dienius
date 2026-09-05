import type { Task } from '../../lib/types'
import { categoryColor, categoryLabel } from '../../lib/categories'
import { useAppData } from '../../lib/store'
import { formatDuration, isAnchor, nextTask, timeToMinutes } from './capacity'
import type { Capacity } from './capacity'
import type { DayScore } from './score'

/** Radius of the progress ring's circle, in the SVG's own coordinates. */
const RING_RADIUS = 26
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

export interface DayDigestProps {
  tasks: Task[]
  capacity: Capacity
  score: DayScore
  /** How long this day's sleep schedule sleeps for - see `sleepMinutes`. */
  sleepMinutes: number
  /** Minutes since midnight, ticking in `DayView`. Only meaningful on today. */
  nowMinutes: number
  /** Only today has a "next" - a day in the past or the future has no now to measure from. */
  isToday: boolean
}

/**
 * The rail's lower half: what is coming, and how the day is going.
 *
 * The rail used to end after the template chips, leaving a third of a wide
 * screen as dead space - and dead space in a layout is not neutral, it reads
 * as "this half was not finished." What belongs there is what a glance at the
 * side of the screen should answer while the middle is busy being a day: what
 * is next, and how far along am I.
 *
 * Deliberately four numbers and one shape, not a dashboard. Every figure here
 * is already stated somewhere else in the app - the ring is the header's own
 * fraction, the free time is the capacity line's - and repeating them is only
 * worth it because they are being repeated *small and together*, as a shape
 * you glance at rather than a sentence you read. See docs/RESEARCH-ADHD.md
 * section 7.
 *
 * Sleep is the fourth, and it earned the slot the other candidates did not.
 * Free time has always been measured inside the waking window, so sleep has
 * never been counted as free - but with three figures on screen and no fourth,
 * Free 12h30 sat next to nothing that explained the missing eight hours, and a
 * reader is entitled to assume a day adds up. Stating it makes the arithmetic
 * legible instead of leaving it to be trusted. It is also the one number here
 * that does not move with what you plan, which is exactly why it belongs last
 * and quiet.
 */
export function DayDigest({ tasks, capacity, score, sleepMinutes, nowMinutes, isToday }: DayDigestProps) {
  const upNext = isToday ? nextTask(tasks, nowMinutes) : undefined
  const categories = useAppData().categories
  const upNextColor = upNext ? categoryColor(upNext.category, categories) : undefined
  const minutesAway = upNext ? timeToMinutes(upNext.time!) - nowMinutes : undefined

  // Only tasks marked as Focus work, timed or not. This is the one number here
  // that is not already on screen somewhere else, and it is the one people
  // actually want at the end of a day: not how busy it was, but how much of it
  // went to the thing that mattered.
  const focusMinutes = tasks
    .filter(t => t.category === 'core' && t.minutes !== undefined)
    .reduce((sum, t) => sum + t.minutes!, 0)

  const fraction = score.planned && score.total > 0 ? score.done / score.total : 0
  const anchored = tasks.filter(t => isAnchor(t) && !t.done).length

  return (
    <div className="day-digest">
      <h3 className="rail-heading">Up next</h3>
      {upNext ? (
        <div
          className="up-next"
          style={upNextColor ? ({ ['--cat' as string]: upNextColor } as React.CSSProperties) : undefined}
        >
          <span className="up-next-time">{upNext.time}</span>
          <span className="up-next-title">{upNext.title}</span>
          <span className="up-next-meta">
            {categoryLabel(upNext.category, categories) ?? 'Scheduled'}
            {minutesAway !== undefined && minutesAway > 0 && ` · in ${formatDuration(minutesAway)}`}
          </span>
        </div>
      ) : (
        <p className="up-next-empty">
          {isToday
            ? anchored > 0
              ? 'Everything scheduled has started.'
              : 'Nothing else on the clock today.'
            : 'Only today has a next.'}
        </p>
      )}

      {score.planned && (
        <div className="digest-stats">
          {/* The same fraction the header states in digits, as a shape. Two
              readings of one number is not repetition here: the header answers
              "how many", this answers "how far", and only one of those can be
              taken in without counting.
              A shape and nothing else. It carried `Math.round(fraction * 100)`
              in its middle until v2.0 - a percentage with the sign taken off,
              which is not less of a percentage, and this app's day score does
              not do percentages (STATE section 2, and DECISIONS on why a
              number that goes up is a report card). It also said nothing the
              "Done 1 of 9" immediately beside it did not already say, in
              words, correctly. */}
          <div className="digest-ring" aria-hidden="true">
            <svg viewBox="0 0 64 64">
              <circle className="digest-ring-track" cx="32" cy="32" r={RING_RADIUS} />
              <circle
                className="digest-ring-fill"
                cx="32"
                cy="32"
                r={RING_RADIUS}
                transform="rotate(-90 32 32)"
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={RING_CIRCUMFERENCE * (1 - fraction)}
              />
            </svg>

          </div>
          <dl className="digest-figures">
            <div>
              <dt>Done</dt>
              <dd>
                {score.done} of {score.total}
              </dd>
            </div>
            <div>
              <dt>Focus</dt>
              <dd>{focusMinutes > 0 ? formatDuration(focusMinutes) : 'none'}</dd>
            </div>
            <div>
              <dt>Free</dt>
              {/* null, not zero, when there is nothing trustworthy to report -
                  no anchors at all, or one whose size is unknown. Said as a
                  dash rather than as a number this app would have had to
                  guess. See computeCapacity. */}
              <dd>{capacity.freeMinutes === null ? '-' : capacity.freeMinutes > 0 ? formatDuration(capacity.freeMinutes) : 'none'}</dd>
            </div>
            <div>
              <dt>Sleep</dt>
              <dd>{formatDuration(sleepMinutes)}</dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  )
}
