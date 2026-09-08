import { Fragment, useEffect, useMemo, useState } from 'react'
import { useAppData } from '../lib/store'
import { addDays, formatWeekTitle, todayKey } from '../lib/dates'
import { CopyJournalButton } from './CopyJournalButton'
import { activeGoals, ageLabel } from '../lib/north'
import { copyText } from '../lib/journal'
import { planReading, readingGroups, readingLine, readingMarkdown, type BlockReading } from '../lib/planReading'
import { formatDuration } from '../widgets/day-plan/capacity'
import {
  KEY_TASKS_PER_DAY,
  datesBetween,
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
 * was bad. The bars are the shape of what happened. There was a streak here
 * until v2.7, kept off the day view and worded as a description rather than
 * a score, but a counter that resets to zero is a rule however it is worded,
 * and a missed day does not damage a habit - docs/RESEARCH-ADHD.md section 8.
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
  const dates = useMemo(() => datesBetween(from, to), [from, to])
  const today = todayKey()
  const readings = useMemo(() => planReading(data, dates, today), [data, dates, today])
  const step = range === 'week' ? 7 : 31
  const isCurrent = today >= from && today <= to

  const peak = Math.max(1, ...stats.days.map(d => d.total))
  const peakFocus = Math.max(1, ...stats.days.map(d => d.focusMinutes))

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
        {/* The week's heading is the week view's own, so the two screens name
            a week the same way; the month is the month's name. formatRange
            used to spell the week from the machine's locale, which on a
            Lithuanian desktop read "07 - 09-13" - the critique pass of v2.6
            found it under the arrows. */}
        <span className="review-range">{range === 'week' ? formatWeekTitle(dates) : formatRange(from, to, range)}</span>
        <button
          type="button"
          aria-label={range === 'week' ? 'The week after' : 'The month after'}
          disabled={isCurrent}
          onClick={() => setAnchor(a => addDays(a, step))}
        >
          &rarr;
        </button>
      </div>

      {/* The one thing here that is not a figure: the journal for the stretch
          being looked at, as text, for somewhere else. Under the arrows so a
          phone's row of them keeps its width. */}
      <div className="review-tools">
        <CopyJournalButton
          dates={dates}
          title={range === 'week' ? formatWeekTitle(dates) : formatRange(from, to, range)}
          label={range === 'week' ? 'Copy week journal' : 'Copy month journal'}
        />
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
            {/* The count alone. It carried its own percentage beside it until
                v2.6 - "2 of 11 18%" - which is the same number said twice on
                one line, and the second time as the percentage this app
                declines to put beside a score. CONVENTIONS section 23. */}
            <Figure label="Done" value={`${stats.done} of ${stats.total}`} />
            <Figure label="Deep work" value={stats.focusMinutes > 0 ? formatDuration(stats.focusMinutes) : 'none'} />
            <Figure
              label="Key tasks"
              value={stats.highlights > 0 ? `${stats.highlightsDone} of ${stats.highlights}` : 'none set'}
              note={stats.highlights > 0 ? `up to ${KEY_TASKS_PER_DAY} a day` : undefined}
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

          {/* Where the plan and the week disagreed: a reading, not a game.
              One line of counts per template block, over the week's past
              days, with the largest disagreement first, and a Copy for the
              clipboard - because the next brief comes out of these lines
              rather than out of a feeling. Only on a week, which is the
              stretch a plan is made for, and only when there is something
              to read; a heading over nothing would be a prompt. */}
          {range === 'week' && readings.length > 0 && (
            <ReadingSection readings={readings} title={formatWeekTitle(dates)} />
          )}

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

/**
 * The reading's block: the lines by template, and the one control on it.
 *
 * A template's name is drawn over its lines only when the week used more
 * than one; over a single template it would say what the rail already said
 * every day. Each line is split at its dash into the block's name and the
 * counts, so the eye finds the block and a reader still hears one sentence.
 *
 * Copy is CopyJournalButton's shape without its greyed state - the block is
 * not drawn at all when there is nothing to copy - and its name is the one
 * word, so it does not read as a second journal button.
 */
function ReadingSection({ readings, title }: { readings: BlockReading[]; title: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const groups = readingGroups(readings)

  useEffect(() => {
    if (state === 'idle') return
    const timer = setTimeout(() => setState('idle'), 2000)
    return () => clearTimeout(timer)
  }, [state])

  async function copy() {
    const ok = await copyText(readingMarkdown(readings, title))
    setState(ok ? 'copied' : 'failed')
  }

  return (
    <div className="review-block review-reading">
      <div className="review-block-head">
        <h3>Where the plan and the week disagreed</h3>
        <span className="copy-journal">
          <button type="button" className="link-button" data-tip="As markdown, to paste anywhere" onClick={copy}>
            {state === 'copied' ? 'Copied' : state === 'failed' ? 'Could not copy' : 'Copy'}
          </button>
          {/* A status rather than an aria-live attribute, for the reason
              CopyJournalButton gives: the page has live regions of its own
              ahead of this one. */}
          <span className="visually-hidden" role="status">
            {state === 'copied' ? 'The reading copied as text.' : state === 'failed' ? 'The clipboard could not be written.' : ''}
          </span>
        </span>
      </div>
      {groups.map(group => (
        <Fragment key={group.templateId}>
          {groups.length > 1 && <h4 className="review-reading-template">{group.templateName}</h4>}
          <ul className="review-reading-list">
            {group.readings.map(reading => {
              const line = readingLine(reading)
              const cut = line.indexOf(' - ')
              return (
                <li key={reading.blockId}>
                  <span className="review-reading-block">{line.slice(0, cut)}</span>
                  <span className="review-reading-facts">{line.slice(cut)}</span>
                </li>
              )
            })}
          </ul>
        </Fragment>
      ))}
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
              data-tip={day.journal?.trim() ? `${label(day)} - ${day.journal.split(String.fromCharCode(10))[0]}` : undefined}
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

/**
 * The month's name for the heading and the copy button; a week is named by
 * `formatWeekTitle`, the way the week view names it. In the app's own
 * locale, like every other date this app prints - left to the machine's it
 * spelled a week as "07 - 09-13" on a Lithuanian desktop.
 */
function formatRange(from: string, to: string, range: Range): string {
  const start = new Date(`${from}T00:00:00`)
  const end = new Date(`${to}T00:00:00`)
  if (range === 'month') {
    return start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }
  const sameMonth = from.slice(0, 7) === to.slice(0, 7)
  const startText = start.toLocaleDateString('en-US', { day: 'numeric', month: sameMonth ? undefined : 'short' })
  const endText = end.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
  return `${startText} - ${endText}`
}
