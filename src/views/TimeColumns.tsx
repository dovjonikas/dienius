import { useCallback, useEffect, useMemo, useRef } from 'react'
import { clearTimeGhost, showTimeGhost } from '../lib/timeGhost'
import { timeToMinutes } from '../widgets/day-plan/capacity'
import { hourCover, openingHour, pad, type HourCover, type TakenBlock } from './takenHours'

/** Every hour of the day, and every five minutes within one. */
const HOURS = Array.from({ length: 24 }, (_, h) => h)
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5)

/** What an hour picked on its own means, and what a minute picked first hangs off. */
const DEFAULT_HOUR = 9

/**
 * One array, so a caller that has no day behind it does not hand the memo
 * below a new empty one on every render.
 */
const NOTHING_TAKEN: TakenBlock[] = []

export interface TimeColumnsProps {
  /** The committed value, or '' for nothing chosen yet. */
  value: string
  onPick: (time: string) => void
  id?: string
  /**
   * What the day - or the template - already has on it, so an hour that is
   * spoken for says so before it is picked rather than after.
   *
   * Handed in rather than read from the store here: the same two columns are
   * the template editors' time field, where the busy stretches are the
   * template's own blocks and there is no day at all, and Settings' sleep
   * window, where there is nothing to be busy against. A caller with no day
   * passes nothing and gets the plain columns this control has always been.
   */
  taken?: TakenBlock[]
  /**
   * When the day wakes, in minutes from midnight - where the hour column opens
   * on a day with nothing on it yet. Absent means midnight, which is where a
   * field with no day behind it has always opened.
   */
  wakingStart?: number
  /**
   * Where a candidate time is drawn while it is being chosen, and what it
   * would look like there - see `lib/timeGhost.ts`.
   *
   * `key` names the timeline that draws it: the day view passes its date, the
   * template editors their own. Absent draws nothing anywhere, which is right
   * for the two fields with no timeline behind them - Settings' sleep window
   * and the library's own time.
   */
  ghost?: { key: string; minutes?: number; color?: string }
}

/**
 * Two columns of times, hours and fives.
 *
 * Two rather than one long list of 288: an hour is picked from a glance at a
 * familiar shape, a minute from five options, and one flat list would be a
 * scroll through a haystack. The minute column moves in fives because plans
 * are made in fives; anything finer is still reachable wherever a time can
 * also be typed, which is the right split - the common case is two taps and
 * the rare one is not blocked.
 *
 * Its own component because two places open it now: the time field in the
 * template editor and Settings (`TimePicker`), and the quiet clock button
 * beside quick-add on the day view. One implementation, so the hours are in
 * the same order and the fives are the same fives in both.
 *
 * **The hour column opens at the day, and says which hours are gone.** Both
 * come from the owner, who found it very awkward to change the time by
 * scrolling: it opened at midnight however late you get up, and it said
 * nothing at all about which hours were already spoken for, so a time was
 * chosen and the clash discovered afterwards. The arithmetic for both is in
 * `takenHours.ts` - this only draws it.
 */
export function TimeColumns({ value, onPick, id, taken = NOTHING_TAKEN, wakingStart = 0, ghost }: TimeColumnsProps) {
  const hoursRef = useRef<HTMLDivElement>(null)
  const minutesRef = useRef<HTMLDivElement>(null)
  const [hour, minute] = value ? value.split(':').map(Number) : [null, null]

  const cover = useMemo(() => hourCover(taken), [taken])
  const opening = openingHour(value, taken, wakingStart)

  // Both columns open scrolled to what is already set. Twenty-four hours do
  // not fit in a panel that has to stay on screen, so without this the hour
  // column opens at midnight every time and the current value - the one thing
  // somebody opening this is looking for - is out of sight below the fold.
  // 'auto' rather than 'smooth': the panel has only just appeared, so there is
  // nothing for a scroll animation to explain.
  useEffect(() => {
    const hours = hoursRef.current
    if (hours) {
      const selected = hours.querySelector('[aria-selected="true"]')
      // A value already set is a place you are moving *from*, so it opens with
      // its neighbours either side of it. An opening hour worked out from the
      // day is a place you are moving *forward* from, so it goes to the top
      // and the rest of the day follows it - the owner's "start from there, so
      // there is nothing to scroll past".
      if (selected) hours.scrollTop = centreOn(selected as HTMLElement, hours)
      else {
        const start = hours.children[opening] as HTMLElement | undefined
        if (start) hours.scrollTop = offsetWithin(start, hours)
      }
    }
    const minutes = minutesRef.current
    const chosen = minutes?.querySelector('[aria-selected="true"]')
    // Nothing is invented for the minute column: with no value it stays where
    // it is. An opening hour is an answer about the day; an opening minute
    // would be a claim about a minute nobody has said anything about.
    if (minutes && chosen) minutes.scrollTop = centreOn(chosen as HTMLElement, minutes)
    // Once, on open: re-running this on every pick would drag the column back
    // under the finger that just chose from it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // The candidate, drawn on the timeline this picker belongs to for as long
  // as the panel is open. The value the field holds is shown the moment it
  // opens, because that is a real answer already; an empty field shows
  // nothing until a pointer or the keyboard reaches an option, because the
  // hour the column happens to open on is not a choice anybody has made.
  const ghostKey = ghost?.key
  const ghostMinutes = ghost?.minutes
  const ghostColor = ghost?.color
  const publish = useCallback(
    (time: string | null) => {
      if (ghostKey === undefined) return
      if (time === null) return clearTimeGhost(ghostKey)
      const start = timeToMinutes(time)
      const next = { key: ghostKey, start } as { key: string; start: number; minutes?: number; color?: string }
      if (ghostMinutes !== undefined) next.minutes = ghostMinutes
      if (ghostColor !== undefined) next.color = ghostColor
      showTimeGhost(next)
    },
    [ghostKey, ghostMinutes, ghostColor],
  )

  useEffect(() => {
    publish(value === '' ? null : value)
    // Cleared on close rather than on every value change: the picker is the
    // only thing that put one up, so it is the only thing that takes it down.
    return () => {
      if (ghostKey !== undefined) clearTimeGhost(ghostKey)
    }
  }, [publish, value, ghostKey])

  return (
    <div
      className="time-picker-panel"
      id={id}
      // Back to what the field holds when the pointer leaves the options: a
      // ghost left standing on the last hour the pointer crossed would be a
      // claim about a time nobody is choosing any more.
      onPointerLeave={() => publish(value === '' ? null : value)}
    >
      <div className="time-picker-column" role="listbox" aria-label="Hour" ref={hoursRef}>
        {HOURS.map(h => (
          <button
            key={h}
            type="button"
            role="option"
            aria-selected={hour === h}
            /* An hour that is gone says so in words as well as in colour, and
               nothing here is ever disabled: overlapping is still allowed, it
               is only visible now. */
            aria-label={cover[h].saying}
            className={optionClass(hour === h, cover[h])}
            onPointerEnter={() => publish(`${pad(h)}:${pad(minute ?? 0)}`)}
            onFocus={() => publish(`${pad(h)}:${pad(minute ?? 0)}`)}
            onClick={() => onPick(`${pad(h)}:${pad(minute ?? 0)}`)}
          >
            {pad(h)}
          </button>
        ))}
      </div>
      <div className="time-picker-column" role="listbox" aria-label="Minute" ref={minutesRef}>
        {MINUTES.map(m => (
          <button
            key={m}
            type="button"
            role="option"
            aria-selected={minute === m}
            className={minute === m ? 'time-picker-option selected' : 'time-picker-option'}
            onPointerEnter={() => publish(`${pad(hour ?? DEFAULT_HOUR)}:${pad(m)}`)}
            onFocus={() => publish(`${pad(hour ?? DEFAULT_HOUR)}:${pad(m)}`)}
            onClick={() => onPick(`${pad(hour ?? DEFAULT_HOUR)}:${pad(m)}`)}
          >
            {pad(m)}
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * Where an option sits inside its own column.
 *
 * Measured rather than read off `offsetTop`, which is relative to the nearest
 * *positioned* ancestor and not to the scroller: the column is static, so
 * every option's offsetTop was really an offset from the whole control, and
 * the column opened a little under where it meant to. Nothing in jsdom could
 * see that either.
 */
function offsetWithin(option: HTMLElement, column: HTMLElement): number {
  return option.getBoundingClientRect().top - column.getBoundingClientRect().top + column.scrollTop
}

/** Half a row past the middle, so the option sits on the centre line rather than under it. */
function centreOn(option: HTMLElement, column: HTMLElement): number {
  return offsetWithin(option, column) - column.clientHeight / 2 + option.offsetHeight / 2
}

function optionClass(selected: boolean, cover: HourCover): string {
  const classes = ['time-picker-option']
  if (selected) classes.push('selected')
  if (cover.minutes > 0) classes.push('is-taken')
  return classes.join(' ')
}

/* The wash and the bar that used to be here are gone - see lib/timeGhost.ts
   for why. An hour is a box of sixty minutes and a block from 09:05 to 10:05
   painted nine and ten identically, so a column that looked precise was
   rounding in both directions; and the same fact was drawn twice, once
   properly in the timeline and once approximately here. What is left is one
   2px rule down the edge of an hour that has something on it, in the border's
   own grey, which answers "is this empty" and nothing else. How much, and
   what, is the timeline's answer, at the minute, on the day's own scale. */
