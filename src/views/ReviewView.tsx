import { useMemo, useState } from 'react'
import { useAppData } from '../lib/store'
import { addDays, todayKey } from '../lib/dates'
import { activeGoals, ageLabel } from '../lib/north'
import { formatDuration } from '../widgets/day-plan/capacity'
import {
  KEY_TASKS_PER_DAY,
  doneRate,
  endOfMonth,
  periodStats,
  startOfMonth,
  startOfWeek,
  type DayStat,
} from '../lib/review'

type Range = 'week' | 'month'

const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

/**
 * The Review tab: what the last week or month actually looked like.
 *
 * Every figure here is computed from the days themselves - see `review.ts`.
 * Nothing is recorded as it happens, so there is nothing that can drift from
 * the plan it describes, and a week from before this tab existed reports
 * exactly as well as one from after it.
 *
 * The line this screen walks: a tracker that shows you your own week is
 * useful; a tracker that turns the week into a target is the thing this app
 * has refused to be since its first commit. So there are no goals here, no
 * percentages presented as scores, nothing red, and nothing that says a week
 * was bad. The bars are the shape of what happened. The streak is the one
 * borderline figure, and it lives here rather than on the day view for
 * exactly that reason - see `highlightStreak`.
 */
export function ReviewView({ onOpenDay }: { onOpenDay?: (date: string) => void }) {
  const data = useAppData()
  const [range, setRange] = useState<Range>('week')
  const [anchor, setAnchor] = useState(() => todayKey())

  const { from, to } = useMemo(
    () =>
      range === 'week'
        ? { from: startOfWeek(anchor), to: addDays(startOfWeek(anchor), 6) }
        : { from: startOfMonth(anchor), to: endOfMonth(anchor) },
    [range, anchor],
  )

  const stats = useMemo(() => periodStats(data, from, to), [data, from, to])
  const step = range === 'week' ? 7 : 31
  const isCurrent = todayKey() >= from && todayKey() <= to

  const peak = Math.max(1, ...stats.days.map(d => d.total))
  const peakFocus = Math.max(1, ...stats.days.map(d => d.focusMinutes))
  const rate = doneRate(stats)

  return (
    <section className="review">
      <div className="review-header">
        <h2>Review</h2>
        <div className="segmented" role="group" aria-label="How much to look at">
          <button
            type="button"
            className={range === 'week' ? 'active' : ''}
            aria-pressed={range === 'week'}
            onClick={() => setRange('week')}
          >
            Week
          </button>
          <button
            type="button"
            className={range === 'month' ? 'active' : ''}
            aria-pressed={range === 'month'}
            onClick={() => setRange('month')}
          >
            Month
          </button>
        </div>
      </div>

      <div className="review-nav">
        <button
          type="button"
          aria-label={range === 'week' ? 'The week before' : 'The month before'}
          onClick={() => setAnchor(a => addDays(range === 'week' ? startOfWeek(a) : startOfMonth(a), -1))}
        >
          &larr;
        </button>
        <span className="review-range">{formatRange(from, to, range)}</span>
        <button
          type="button"
          aria-label={range === 'week' ? 'The week after' : 'The month after'}
          disabled={isCurrent}
          onClick={() => setAnchor(a => addDays(a, step))}
        >
          &rarr;
        </button>
      </div>

      {stats.plannedDays === 0 ? (
        // A quiet empty state, not a prompt. Nothing was planned; that is a
        // fact about a week, not a failing to be corrected.
        <p className="review-empty">
          Nothing was planned {range === 'week' ? 'this week' : 'this month'}. There is nothing to look back
          at yet, which is fine - this fills itself in as days get used.
        </p>
      ) : (
        <>
          <dl className="review-figures">
            <Figure label="Done" value={`${stats.done} of ${stats.total}`} note={rate !== null ? `${Math.round(rate * 100)}%` : undefined} />
            <Figure label="Deep work" value={stats.focusMinutes > 0 ? formatDuration(stats.focusMinutes) : 'none'} />
            <Figure
              label="Key tasks"
              value={stats.highlights > 0 ? `${stats.highlightsDone} of ${stats.highlights}` : 'none set'}
              note={stats.highlights > 0 ? `up to ${KEY_TASKS_PER_DAY} a day` : undefined}
            />
            <Figure
              label="Streak"
              value={stats.streak === 0 ? 'none' : `${stats.streak} ${stats.streak === 1 ? 'day' : 'days'}`}
              note={stats.streak > 0 ? 'with a key task done' : undefined}
            />
          </dl>

          <Chart
            title="Done each day"
            days={stats.days}
            peak={peak}
            valueOf={d => d.done}
            capOf={d => d.total}
            label={d => `${d.done} of ${d.total} done`}
            peakLabel={`${peak} ${peak === 1 ? 'task' : 'tasks'}`}
            onOpenDay={onOpenDay}
          />

          <Chart
            title="Deep work each day"
            days={stats.days}
            peak={peakFocus}
            valueOf={d => d.focusMinutes}
            label={d => (d.focusMinutes > 0 ? formatDuration(d.focusMinutes) : 'none')}
            peakLabel={formatDuration(peakFocus)}
            onOpenDay={onOpenDay}
          />

          <NorthSection />

          {stats.library.length > 0 && (
            <div className="review-block">
              <h3>Read and watched</h3>
              <ul className="review-library">
                {stats.library.map(({ list, units }) => (
                  <li key={list.id}>
                    <span className="review-library-name">{list.name}</span>
                    <span className="review-library-units">
                      {units} {units === 1 ? list.unit : `${list.unit}s`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  )
}

/**
 * The goals, at the bottom of a review, with their ages and nothing else.
 *
 * The one place in this app where looking back at a week and looking at a
 * direction sit on the same screen - and the whole discipline of it is that
 * the direction gets no number the week can move. An age cannot be earned or
 * lost; it is a fact about how long something has been true.
 */
function NorthSection() {
  const data = useAppData()
  const today = todayKey()
  const goals = activeGoals(data.goals)
  if (goals.length === 0) return null

  return (
    <div className="review-block">
      <h3>North</h3>
      <ul className="review-north">
        {goals.map(goal => (
          <li key={goal.id}>
            <span className="review-north-title">{goal.title}</span>
            <span className="review-north-age">{ageLabel(goal, today)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Figure({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>
        {value}
        {note && <span className="review-figure-note"> {note}</span>}
      </dd>
    </div>
  )
}

interface ChartProps {
  title: string
  days: DayStat[]
  peak: number
  valueOf: (day: DayStat) => number
  /** The full height of the bar, when there is a planned total behind it. */
  capOf?: (day: DayStat) => number
  label: (day: DayStat) => string
  /** What the tallest bar is worth, in words. Without it the bars have no scale. */
  peakLabel: string
  onOpenDay?: (date: string) => void
}

/**
 * A column per day, drawn as divs rather than as a chart.
 *
 * No SVG and no library: the whole thing is a row of boxes with a height, and
 * the moment it becomes a chart it acquires axes, gridlines, a legend and a
 * tooltip - four things nobody asked for on a screen whose entire job is
 * "which days were heavy". A bar and its date is the whole story.
 *
 * Each column is a button, because the obvious thing to want after looking at
 * a bad Tuesday is to open Tuesday.
 */
function Chart({ title, days, peak, valueOf, capOf, label, peakLabel, onOpenDay }: ChartProps) {
  return (
    <div className="review-block">
      <div className="review-block-head">
        <h3>{title}</h3>
        {/* Bars drawn against the week's own peak have no scale at all
            without this: three bars at full height mean ninety minutes or
            nine hours and the picture is identical. One number fixes it,
            where an axis would add four. */}
        <span className="review-peak">tallest: {peakLabel}</span>
      </div>
      <div className="review-chart">
        {days.map(day => {
          const value = valueOf(day)
          const cap = capOf?.(day) ?? value
          return (
            <button
              key={day.date}
              type="button"
              className="review-bar"
              aria-label={`${day.date}: ${label(day)}`}
              /* The one thing on this chart that is not a number. A week of
                 bars says how the days went; one of them saying "walked home
                 the long way" says what a Tuesday was. */
              title={day.bestMoment ? `${label(day)} - ${day.bestMoment}` : undefined}
              disabled={!onOpenDay}
              onClick={() => onOpenDay?.(day.date)}
            >
              <span className="review-bar-track" aria-hidden="true">
                {/* A day with nothing on it draws a hairline rather than
                    nothing, so an empty column reads as zero rather than as
                    a column that failed to render. */}
                {cap === 0 && <span className="review-bar-zero" />}
                {/* The planned total sits behind the done count, so a day
                    where two of nine got done reads differently from one
                    where two of two did - the same distinction the day
                    header's own bar makes. */}
                <span className="review-bar-planned" style={{ height: `${(cap / peak) * 100}%` }} />
                <span className="review-bar-done" style={{ height: `${(value / peak) * 100}%` }} />
              </span>
              <span className="review-bar-day" aria-hidden="true">
                {WEEKDAY_LETTERS[day.weekday]}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function formatRange(from: string, to: string, range: Range): string {
  const start = new Date(`${from}T00:00:00`)
  const end = new Date(`${to}T00:00:00`)
  if (range === 'month') {
    return start.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  }
  const sameMonth = from.slice(0, 7) === to.slice(0, 7)
  const startText = start.toLocaleDateString(undefined, { day: 'numeric', month: sameMonth ? undefined : 'short' })
  const endText = end.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
  return `${startText} - ${endText}`
}
