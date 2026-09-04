import { useRef, useState } from 'react'
import { MinuteStepInput } from './MinuteStepInput'
import { useClickAway } from '../lib/useClickAway'
import { durationToText } from '../widgets/day-plan/parse'
import { formatDuration } from '../widgets/day-plan/capacity'

/**
 * The one duration control: a button that already holds an answer, and a
 * panel of chips for the lengths things usually are, with a stepper for
 * everything else.
 *
 * Grown out of quick-add, where it was the right half of CONVENTIONS
 * section 16 - the control opens holding an answer, so a title and Enter
 * is a sized task - and moved here so the template editor, the task detail
 * sheet and the library's add-to-template form ask for a length the same
 * way. A bare number box in any of those was the person doing arithmetic
 * the app could have offered: "1h30" is a chip, not something to type.
 *
 * Chips first, the stepper under them: the six lengths cover most of what
 * a day is made of, and the stepper is for the seventh. Both go through
 * the same `onChange`, so a caller cannot tell which was used and need not.
 */

/** The lengths offered as chips wherever a length is asked for. */
export const DURATION_CHIPS = [15, 30, 45, 60, 90, 120] as const

export interface DurationControlProps {
  /** The length in force, or undefined for "unsized" where that is allowed. */
  minutes: number | undefined
  onChange: (minutes: number | undefined) => void
  /** Which chips to offer. Quick-add offers four, everything else six. */
  choices?: readonly number[]
  /** Whether "no length" is an answer. A task may be unsized; a nudge interval may not. */
  allowEmpty?: boolean
  /** What the stepper inside the panel is called. */
  stepperLabel?: string
  /** A data-tour marker for the wrapper, when the tour points at this control. */
  tour?: string
  /** Extra class on the wrapper, for the row that hosts it. */
  className?: string
}

export function DurationControl({
  minutes,
  onChange,
  choices = DURATION_CHIPS,
  allowEmpty = false,
  stepperLabel = 'How long, in minutes',
  tour,
  className,
}: DurationControlProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useClickAway(ref, open, () => setOpen(false))

  const label = minutes === undefined ? 'No length set. Choose how long.' : `${formatDuration(minutes)} long. Change how long.`

  return (
    <div className={className ? `duration-control ${className}` : 'duration-control'} ref={ref} data-tour={tour}>
      <button
        type="button"
        className={minutes === undefined ? 'duration-control-value is-empty' : 'duration-control-value'}
        aria-expanded={open}
        aria-label={label}
        title={minutes === undefined ? 'No length set' : `${formatDuration(minutes)} long`}
        onClick={() => setOpen(o => !o)}
      >
        {minutes === undefined ? 'min' : durationToText(minutes)}
      </button>
      {open && (
        <div className="duration-control-panel">
          <div className="duration-control-chips" role="group" aria-label="How long">
            {choices.map(choice => (
              <button
                key={choice}
                type="button"
                className={minutes === choice ? 'is-on' : ''}
                aria-pressed={minutes === choice}
                onClick={() => {
                  onChange(choice)
                  setOpen(false)
                }}
              >
                {durationToText(choice)}
              </button>
            ))}
            {allowEmpty && (
              <button
                type="button"
                className={minutes === undefined ? 'is-on' : ''}
                aria-pressed={minutes === undefined}
                onClick={() => {
                  onChange(undefined)
                  setOpen(false)
                }}
              >
                No length
              </button>
            )}
          </div>
          {/* Anything the chips do not cover, without leaving the row: the
              same stepper Settings uses, so a duration is entered one way in
              this app and not two. */}
          <MinuteStepInput
            value={minutes === undefined ? '' : String(minutes)}
            onChange={next => {
              if (next === '') {
                if (allowEmpty) onChange(undefined)
                return
              }
              const parsed = Number(next)
              if (Number.isInteger(parsed) && parsed > 0) onChange(parsed)
            }}
            ariaLabel={stepperLabel}
          />
        </div>
      )}
    </div>
  )
}

/**
 * A row of the same chips with nothing to open - for a sheet that has the
 * room, where a panel would be a tap for nothing. Pressing the chip in
 * force again does nothing rather than clearing, because clearing a size
 * is a decision and a second tap is usually a bounce.
 */
export function DurationChips({
  minutes,
  onChange,
  choices = DURATION_CHIPS,
  label = 'How long',
}: {
  minutes: number | undefined
  onChange: (minutes: number) => void
  choices?: readonly number[]
  label?: string
}) {
  return (
    <div className="duration-chips" role="group" aria-label={label}>
      {choices.map(choice => (
        <button
          key={choice}
          type="button"
          className={minutes === choice ? 'is-on' : ''}
          aria-pressed={minutes === choice}
          onClick={() => onChange(choice)}
        >
          {durationToText(choice)}
        </button>
      ))}
    </div>
  )
}
