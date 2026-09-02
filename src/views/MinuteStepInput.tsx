import { useEffect, useState, type KeyboardEvent } from 'react'
import { parseMinutesInput } from '../widgets/day-plan/capacity'

/** One press moves five minutes - the same granularity a dragged block snaps to. */
const STEP = 5
/** Held with Shift, a press moves a quarter of an hour. */
const BIG_STEP = 15
/** What the first press on an empty field seeds, matching the placeholder. */
const DEFAULT_MINUTES = 15

const MIN_MINUTES = 1
const MAX_MINUTES = 24 * 60

export interface MinuteStepInputProps {
  /** Canonical committed value: '' for unset, or a plain minute count as a string. */
  value: string
  onChange: (next: string) => void
  placeholder?: string
  ariaLabel: string
}

/**
 * A number-of-minutes field with the same shape and the same manners as
 * `TimeStepInput`: type into it freely, or step it with the arrow keys and
 * the two buttons beside it, and it only ever commits a value it has
 * normalised. It exists so that nowhere in this app is a duration entered
 * through a bare `<input type="number">`, whose spinner cannot be styled to
 * match anything and whose touch behaviour is a lottery.
 *
 * Kept separate from `TimeStepInput` rather than folded into it as a mode.
 * That component's whole behaviour is about clock times - wrapping past
 * midnight, parsing "0930", seeding 09:00 - and none of it means anything for
 * a length. Two small components that each do one thing are easier to trust
 * than one with a flag that changes half of what it does.
 */
export function MinuteStepInput({ value, onChange, placeholder = 'min', ariaLabel }: MinuteStepInputProps) {
  // The text actually in the box, which is allowed to be mid-typing and
  // therefore invalid. `value` is the committed truth; this is the draft.
  const [draft, setDraft] = useState(value)

  useEffect(() => {
    setDraft(value)
  }, [value])

  function clamp(minutes: number): number {
    return Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, minutes))
  }

  function commit(text: string) {
    const trimmed = text.trim()
    if (trimmed === '') {
      onChange('')
      return
    }
    const parsed = parseMinutesInput(trimmed)
    // Text that is not a number at all reverts rather than clearing: a stray
    // keystroke should never silently erase a value that was already there.
    if (parsed === undefined) {
      setDraft(value)
      return
    }
    onChange(String(clamp(parsed)))
  }

  function step(delta: number) {
    const base = parseMinutesInput(draft.trim()) ?? DEFAULT_MINUTES - delta
    const next = String(clamp(base + delta))
    setDraft(next)
    onChange(next)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
    e.preventDefault()
    const size = e.shiftKey ? BIG_STEP : STEP
    step(e.key === 'ArrowUp' ? size : -size)
  }

  return (
    <div className="time-stepper">
      <input
        className="time-input minutes-input"
        inputMode="numeric"
        aria-label={ariaLabel}
        placeholder={placeholder}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={e => commit(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <div className="time-stepper-buttons">
        <button type="button" className="time-step" aria-label={`${ariaLabel} up`} onClick={() => step(STEP)} />
        <button type="button" className="time-step is-down" aria-label={`${ariaLabel} down`} onClick={() => step(-STEP)} />
      </div>
    </div>
  )
}
