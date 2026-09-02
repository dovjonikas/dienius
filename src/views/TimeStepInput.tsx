import { useEffect, useId, useState, type KeyboardEvent } from 'react'
import { parseTimeInput, stepTime } from '../widgets/day-plan/capacity'

interface TimeStepInputProps {
  /** Canonical committed value: '' for a float, or a valid "HH:MM". Never
   * anything else - this component is the one place that guarantees that. */
  value: string
  /** Called only with '' or an already-normalised "HH:MM" - never with
   * whatever a person is still in the middle of typing. */
  onChange: (next: string) => void
  placeholder?: string
  /** Accessible name for the text field itself. The two step buttons build
   * their own names off this, so a form with more than one of these fields
   * (there is only one today, but nothing here assumes that stays true)
   * still gets distinct button names. */
  ariaLabel: string
}

/**
 * The base arrow-key/step-button increment, in minutes. Fifteen matches how
 * this app's own templates are actually built - blocks land on the hour or
 * the quarter, never the minute - so a press always lands somewhere worth
 * landing on. Five would be finer but take three presses to cover the same
 * quarter-hour a real plan is built from; fifteen is the smallest step that
 * still moves in one press to the next number a person would have typed.
 */
const STEP_MINUTES = 15

/**
 * The larger jump held with Shift, for closing an hour-plus gap without
 * counting individual presses. An hour is the obvious choice precisely
 * because it needs no explaining - it is the one modifier-step convention
 * a keyboard user already carries in from a native `<input type="range">`
 * or an OS spinner, so this earns its place without adding anything new to
 * remember. It is keyboard-only: the on-screen buttons below always move by
 * `STEP_MINUTES`, since a touch screen has no modifier key to hold, and a
 * secondary accelerator for an already-secondary control was not worth a
 * long-press gesture of its own.
 */
const BIG_STEP_MINUTES = 60

/**
 * What the first arrow press or step-button tap seeds an empty field with,
 * turning a float into an anchor. Matches the field's own placeholder
 * rather than midnight or the current clock time, so the very first press
 * lands on the same value already shown as an example, not on an hour that
 * has nothing to do with what the person is planning.
 */
const DEFAULT_TIME = '09:00'

/**
 * A time field that can be typed into exactly like free text - "0930",
 * "9:30", "14:00" all work, parsed and normalised by `parseTimeInput` - or
 * stepped with the arrow keys (or the two buttons beside it) without
 * typing at all. Deliberately not a native `<input type="time">`: that
 * would give arrow-stepping for free, but its picker UI cannot be
 * restyled consistently across this app's eleven themes, and on iOS
 * Safari it opens a full wheel picker on focus, which is slower for quick
 * entry than typing "0930" directly - worse than what this replaces, on
 * the exact device this field is mostly used from.
 *
 * An invalid value never reaches `onChange`. While the field is focused,
 * whatever a person types is shown as-is - there is no reformatting mid-
 * keystroke, no red border, no error text, because someone still typing
 * "09" on the way to "0930" is not wrong yet. Only on blur, or on Enter, is
 * the text actually resolved: a value that parses is normalised and
 * committed, an empty value commits as a float, and anything else - text
 * that never became a real time - is quietly discarded, and the field
 * reverts to whatever was last valid. There is nothing to acknowledge and
 * nothing to dismiss.
 */
export function TimeStepInput({ value, onChange, placeholder, ariaLabel }: TimeStepInputProps) {
  const [text, setText] = useState(value)
  const [announcement, setAnnouncement] = useState('')
  const descriptionId = useId()

  // Keeps the field in sync with a value changed from outside - a draft
  // reset when switching which template is being edited, say - without
  // touching it while a person is mid-keystroke: `value` only ever changes
  // here as a result of this component's own onChange call, or from that
  // kind of external reset, never on every character typed.
  useEffect(() => {
    setText(value)
  }, [value])

  function commit(raw: string): void {
    const trimmed = raw.trim()
    if (trimmed === '') {
      setText('')
      onChange('')
      return
    }
    const parsed = parseTimeInput(trimmed)
    if (parsed) {
      setText(parsed)
      onChange(parsed)
    } else {
      // Not a real time, and not empty either: put back whatever was last
      // valid, silently. This is a revert, not a rejection that needs to
      // be explained - the same calm handling the rest of the app already
      // gives a bad size or a bad backup file.
      setText(value)
    }
  }

  function step(deltaMinutes: number): void {
    // Steps from whatever the person has typed so far, if it already
    // resolves to a real time, so an arrow press right after typing
    // "09:30" moves from 09:30 rather than silently discarding it in
    // favour of whatever was last committed. Falls back to the last
    // committed value, and only then to DEFAULT_TIME, for an empty field.
    const base = parseTimeInput(text) ?? (value || undefined)
    const next = base ? stepTime(base, deltaMinutes) : DEFAULT_TIME
    setText(next)
    onChange(next)
    setAnnouncement(`Time set to ${next}`)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      const magnitude = e.shiftKey ? BIG_STEP_MINUTES : STEP_MINUTES
      step(e.key === 'ArrowUp' ? magnitude : -magnitude)
    } else if (e.key === 'Enter') {
      commit(text)
    }
  }

  return (
    <span className="time-stepper">
      <input
        type="text"
        inputMode="numeric"
        className="time-input"
        aria-label={ariaLabel}
        aria-describedby={descriptionId}
        placeholder={placeholder}
        value={text}
        onChange={e => setText(e.target.value)}
        onBlur={e => commit(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <span className="time-stepper-buttons">
        <button
          type="button"
          className="time-step"
          aria-label={`${ariaLabel}: move 15 minutes later`}
          onClick={() => step(STEP_MINUTES)}
         />
        <button
          type="button"
          className="time-step is-down"
          aria-label={`${ariaLabel}: move 15 minutes earlier`}
          onClick={() => step(-STEP_MINUTES)}
         />
      </span>
      <span id={descriptionId} className="visually-hidden">
        Type a time, or use the up and down arrow keys, or the buttons beside this field, to move it
        by 15 minutes. Hold Shift with an arrow key to move by an hour. Leave this blank for no set
        time.
      </span>
      <span aria-live="polite" className="visually-hidden">
        {announcement}
      </span>
    </span>
  )
}
