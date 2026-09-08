import type { Task } from '../../lib/types'
import { categoryColor, categoryLabel } from '../../lib/categories'
import { useAppData } from '../../lib/store'
import { formatDuration, isAnchor, nextTask, timeToMinutes } from './capacity'
import type { Capacity } from './capacity'
import type { DayScore } from './score'
import { linkFor } from '../../lib/link'
import { LinkOut } from '../../views/LinkOut'

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
 * The rail's lower half: what is coming, and the shape of the day in four
 * figures.
 *
 * Every figure here is said here and nowhere else. That is the rule
 * CONVENTIONS section 23 was written for, and until v2.6 this card broke it
 * worse than anything else on the screen: it carried a ring with the day's
 * fraction in it and a Done row beside the ring, while the header two inches
 * above already had the bar and the same fraction - one number, three times.
 * The argument at the time was that a shape is read faster than digits. It
 * is, and the header's bar is that shape. The ring and the row are gone. How
 * far the day has come is the header's to say; how the day is made is this
 * card's.
 *
 * Four rows. Timed is what is on the clock. Deep work is how much of that is
 * the thing that matters - the one figure nothing else on the screen states.
 * Free is what is left of the waking window, and across how many gaps,
 * because eight ten-minute holes and one eighty-minute one are different
 * days with the same figure. Sleep is the one number that does not move with
 * the plan, said so a reader can see the day adds up, with the note that it
 * is not counted as free. Those two notes used to be a sentence of their own
 * under the header, on a desktop where every number in that sentence was
 * already in this card; the phone still has the sentence, because the phone
 * has no rail.
 *
 * A fifth row, Calendar, only on a day that has somebody else's events on
 * it: how long they take and how many there are, counted apart from Timed
 * because a meeting is not something you planned, and "Timed 6h" would be a
 * lie about a day spent in somebody else's calendar. Free counts them - see
 * the busy argument to computeCapacity - and this is where that is said.
 */
export function DayDigest({ tasks, capacity, score, sleepMinutes, nowMinutes, isToday }: DayDigestProps) {
  const upNext = isToday ? nextTask(tasks, nowMinutes) : undefined
  const { categories, library } = useAppData()
  const upNextColor = upNext ? categoryColor(upNext.category, categories) : undefined
  const upNextLink = upNext ? linkFor(upNext, library) : undefined
  const minutesAway = upNext ? timeToMinutes(upNext.time!) - nowMinutes : undefined

  // Only tasks in the Deep work category, timed or not. This is the one number
  // here that is not already on screen somewhere else, and it is the one people
  // actually want at the end of a day: not how busy it was, but how much of it
  // went to the thing that mattered. The row is named after the category it
  // sums, not "Focus" - Focus is the countdown session, and one word for one
  // thing.
  const deepWorkMinutes = tasks
    .filter(t => t.category === 'core' && t.minutes !== undefined)
    .reduce((sum, t) => sum + t.minutes!, 0)

  const anchored = tasks.filter(t => isAnchor(t) && !t.done).length

  // What is on the clock. A day whose only timed tasks have no size yet has
  // no honest figure, and says so with a dash rather than a zero.
  const timed = capacity.anchorCount === 0 ? 'none' : capacity.anchorsMinutes ? formatDuration(capacity.anchorsMinutes) : '-'
  const timedNote =
    capacity.unsizedAnchorCount > 0
      ? `${capacity.unsizedAnchorCount} with no length`
      : capacity.anchorsClippedByWindow
        ? "within today's window"
        : undefined

  // What the free figure cannot say on its own: across how many gaps it is
  // spread, and - when the untimed tasks need more than the day has left -
  // how far over, which used to be the capacity sentence's last line. A dash
  // with no reason is a dash somebody has to go and find the reason for.
  const gaps = capacity.gaps.length
  const gapWord = gaps === 1 ? 'gap' : 'gaps'
  const free = capacity.freeMinutes === null ? '-' : capacity.freeMinutes > 0 ? formatDuration(capacity.freeMinutes) : 'none'
  const freeNote =
    capacity.freeMinutes === null
      ? capacity.unsizedAnchorCount > 0
        ? 'a timed task has no size'
        : undefined
      : capacity.overMinutes !== null && capacity.overMinutes > 0
        ? `${gaps} ${gapWord} · ${formatDuration(capacity.overMinutes)} over`
        : gaps > 0
          ? `${gaps} ${gapWord}`
          : undefined

  return (
    <div className="day-digest">
      <h3 className="rail-heading">Up next</h3>
      {upNext ? (
        <div
          className="up-next"
          style={upNextColor ? ({ ['--cat' as string]: upNextColor } as React.CSSProperties) : undefined}
        >
          <span className="up-next-time">{upNext.time}</span>
          {/* The card the owner says they will use most: what is next, and
              one press to the thing itself. Its own address or the one on
              the library item it is bound to - the same order TaskRow uses.
              On the title's own line rather than under it: the card is a
              stack of three short lines and a fourth would make the door the
              tallest thing on it. */}
          <span className="up-next-line">
            <span className="up-next-title">{upNext.title}</span>
            {upNextLink && <LinkOut link={upNextLink} title={upNext.title} className="up-next-link" />}
          </span>
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
          <dl className="digest-figures">
            <div>
              <dt>Timed</dt>
              <dd>
                {timedNote && <span className="digest-note">{timedNote}</span>}
                {timed}
              </dd>
            </div>
            {capacity.externalMinutes > 0 && (
              <div>
                <dt>Calendar</dt>
                <dd>
                  <span className="digest-note">
                    {capacity.externalCount} {capacity.externalCount === 1 ? 'event' : 'events'}
                  </span>
                  {formatDuration(capacity.externalMinutes)}
                </dd>
              </div>
            )}
            <div>
              <dt>Deep work</dt>
              <dd>{deepWorkMinutes > 0 ? formatDuration(deepWorkMinutes) : 'none'}</dd>
            </div>
            <div>
              <dt>Free</dt>
              <dd>
                {freeNote && <span className="digest-note">{freeNote}</span>}
                {free}
              </dd>
            </div>
            <div>
              <dt>Sleep</dt>
              <dd>
                <span className="digest-note">not counted</span>
                {formatDuration(sleepMinutes)}
              </dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  )
}
