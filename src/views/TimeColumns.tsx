import { useEffect, useRef } from 'react'

/** Every hour of the day, and every five minutes within one. */
const HOURS = Array.from({ length: 24 }, (_, h) => h)
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5)

/** What an hour picked on its own means, and what a minute picked first hangs off. */
const DEFAULT_HOUR = 9

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export interface TimeColumnsProps {
  /** The committed value, or '' for nothing chosen yet. */
  value: string
  onPick: (time: string) => void
  id?: string
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
 */
export function TimeColumns({ value, onPick, id }: TimeColumnsProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [hour, minute] = value ? value.split(':').map(Number) : [null, null]

  // Both columns open scrolled to what is already set. Twenty-four hours do
  // not fit in a panel that has to stay on screen, so without this the hour
  // column opens at midnight every time and the current value - the one thing
  // somebody opening this is looking for - is out of sight below the fold.
  // 'auto' rather than 'smooth': the panel has only just appeared, so there is
  // nothing for a scroll animation to explain.
  useEffect(() => {
    for (const column of ref.current?.querySelectorAll('.time-picker-column') ?? []) {
      const selected = column.querySelector('[aria-selected="true"]')
      if (selected) column.scrollTop = (selected as HTMLElement).offsetTop - column.clientHeight / 2 + 15
    }
    // Once, on open: re-running this on every pick would drag the column back
    // under the finger that just chose from it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="time-picker-panel" id={id} ref={ref}>
      <div className="time-picker-column" role="listbox" aria-label="Hour">
        {HOURS.map(h => (
          <button
            key={h}
            type="button"
            role="option"
            aria-selected={hour === h}
            className={hour === h ? 'time-picker-option selected' : 'time-picker-option'}
            onClick={() => onPick(`${pad(h)}:${pad(minute ?? 0)}`)}
          >
            {pad(h)}
          </button>
        ))}
      </div>
      <div className="time-picker-column" role="listbox" aria-label="Minute">
        {MINUTES.map(m => (
          <button
            key={m}
            type="button"
            role="option"
            aria-selected={minute === m}
            className={minute === m ? 'time-picker-option selected' : 'time-picker-option'}
            onClick={() => onPick(`${pad(hour ?? DEFAULT_HOUR)}:${pad(m)}`)}
          >
            {pad(m)}
          </button>
        ))}
      </div>
    </div>
  )
}
