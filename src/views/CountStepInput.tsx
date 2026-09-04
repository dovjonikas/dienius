import { useEffect, useRef, useState, type KeyboardEvent } from 'react'

/**
 * A count with arrows: a plain whole number, typed or stepped, and held
 * arrows that speed up. For the things counted in ones - chapters, seasons,
 * episodes - where one press per unit is the natural gesture and a long
 * press is the natural way to get to twenty. Empty is an answer when the
 * caller says so: a book whose length is not known has no total, and
 * inventing one would be worse than leaving it blank.
 *
 * Kept apart from `MinuteStepInput`, which clamps to a day, parses "1h30"
 * and steps by five - none of which means anything for a count.
 */

const MAX_COUNT = 100_000
/** How long an arrow is held before it starts repeating, and how fast it then goes. */
const HOLD_DELAY_MS = 400
const HOLD_START_MS = 120
const HOLD_FASTEST_MS = 40

export interface CountStepInputProps {
  /** '' for no count, else a whole number as a string. */
  value: string
  onChange: (next: string) => void
  ariaLabel: string
  placeholder?: string
  /** The lowest the arrows go. A total cannot be zero; a season number cannot be zero either. */
  min?: number
  /** Whether the down arrow past `min` clears the field. */
  allowEmpty?: boolean
}

export function CountStepInput({ value, onChange, ariaLabel, placeholder = '', min = 1, allowEmpty = true }: CountStepInputProps) {
  const [draft, setDraft] = useState(value)
  const hold = useRef<{ timer: ReturnType<typeof setTimeout> | null; delta: number; interval: number }>({ timer: null, delta: 0, interval: HOLD_START_MS })
  // The latest committed value, for a held arrow that outlives the render it started in.
  const latest = useRef(value)
  latest.current = value

  useEffect(() => {
    setDraft(value)
  }, [value])

  useEffect(() => () => stopHold(), [])

  function commit(text: string) {
    const trimmed = text.trim()
    if (trimmed === '') {
      if (allowEmpty) onChange('')
      else setDraft(value)
      return
    }
    const parsed = Number(trimmed)
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > MAX_COUNT) {
      setDraft(value)
      return
    }
    onChange(String(Math.max(min, parsed)))
  }

  function step(delta: number) {
    const current = latest.current === '' ? undefined : Number(latest.current)
    let next: number | undefined
    if (current === undefined) next = delta > 0 ? min : undefined
    else next = current + delta
    if (next !== undefined && next < min) next = allowEmpty ? undefined : min
    if (next !== undefined && next > MAX_COUNT) next = MAX_COUNT
    const text = next === undefined ? '' : String(next)
    latest.current = text
    setDraft(text)
    onChange(text)
  }

  function startHold(delta: number) {
    stopHold()
    step(delta)
    hold.current.delta = delta
    hold.current.interval = HOLD_START_MS
    hold.current.timer = setTimeout(repeat, HOLD_DELAY_MS)
  }

  function repeat() {
    step(hold.current.delta)
    // Faster the longer it is held, down to a floor a screen can still show.
    hold.current.interval = Math.max(HOLD_FASTEST_MS, hold.current.interval - 10)
    hold.current.timer = setTimeout(repeat, hold.current.interval)
  }

  function stopHold() {
    if (hold.current.timer) clearTimeout(hold.current.timer)
    hold.current.timer = null
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
    e.preventDefault()
    step(e.key === 'ArrowUp' ? (e.shiftKey ? 10 : 1) : e.shiftKey ? -10 : -1)
  }

  return (
    <div className="time-stepper count-stepper">
      <input
        className="time-input minutes-input count-input"
        inputMode="numeric"
        aria-label={ariaLabel}
        placeholder={placeholder}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => commit(draft)}
        onKeyDown={handleKeyDown}
      />
      <div className="time-stepper-buttons">
        <button
          type="button"
          className="time-step"
          aria-label={`${ariaLabel} up`}
          onPointerDown={e => {
            e.preventDefault()
            startHold(1)
          }}
          onPointerUp={stopHold}
          onPointerLeave={stopHold}
          onPointerCancel={stopHold}
          onKeyDown={e => e.key === 'Enter' && step(1)}
        />
        <button
          type="button"
          className="time-step is-down"
          aria-label={`${ariaLabel} down`}
          onPointerDown={e => {
            e.preventDefault()
            startHold(-1)
          }}
          onPointerUp={stopHold}
          onPointerLeave={stopHold}
          onPointerCancel={stopHold}
          onKeyDown={e => e.key === 'Enter' && step(-1)}
        />
      </div>
    </div>
  )
}
