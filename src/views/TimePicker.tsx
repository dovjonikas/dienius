import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { parseTimeInput, stepTime } from '../widgets/day-plan/capacity'

/** Every hour of the day, and every five minutes within one. */
const HOURS = Array.from({ length: 24 }, (_, h) => h)
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5)

const STEP_MINUTES = 5
const BIG_STEP_MINUTES = 60
const DEFAULT_TIME = '09:00'

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export interface TimePickerProps {
  /** Canonical committed value: '' for unset, or a valid "HH:MM". */
  value: string
  onChange: (next: string) => void
  ariaLabel: string
  placeholder?: string
  /** Refuses to commit an empty value - for a field that must always hold a time. */
  required?: boolean
}

/**
 * The one way a time is entered anywhere in this app.
 *
 * Type into it - "9:30", "0930", "14" all parse - or open two columns and
 * tap. Deliberately not `<input type="time">`: its picker cannot be styled to
 * match anything, it renders differently on every platform, and on iOS Safari
 * it opens a full wheel on focus, which is slower than typing "0930" on
 * exactly the device this app is mostly used from. A native control that
 * looks foreign and behaves inconsistently is not a shortcut, it is three
 * platforms' worth of design decisions imported into a screen that did not
 * ask for them.
 *
 * The minute column moves in fives because plans are made in fives. Anything
 * finer is still reachable by typing, which is the right split: the common
 * case is two taps, and the rare one is not blocked.
 */
export function TimePicker({ value, onChange, ariaLabel, placeholder = '09:00', required = false }: TimePickerProps) {
  const [draft, setDraft] = useState(value)
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  useEffect(() => {
    setDraft(value)
  }, [value])

  // Both columns open scrolled to what is already set. Twenty-four hours do
  // not fit in a panel that has to stay on screen, so without this the hour
  // column opens at midnight every time and the current value - the one thing
  // somebody opening the picker is looking for - is out of sight below the
  // fold. 'auto' rather than 'smooth': the panel has only just appeared, so
  // there is nothing for a scroll animation to explain.
  useEffect(() => {
    if (!open) return
    for (const column of panelRef.current?.querySelectorAll('.time-picker-column') ?? []) {
      const selected = column.querySelector('[aria-selected="true"]')
      if (selected) column.scrollTop = (selected as HTMLElement).offsetTop - column.clientHeight / 2 + 15
    }
  }, [open])

  // A click anywhere else closes the columns. Pointerdown rather than click,
  // so the panel is gone before whatever was clicked reacts - otherwise a tap
  // on a control behind it lands while the panel is still covering things.
  useEffect(() => {
    if (!open) return
    function onDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  function commit(text: string) {
    const trimmed = text.trim()
    if (trimmed === '') {
      if (required) setDraft(value)
      else onChange('')
      return
    }
    const parsed = parseTimeInput(trimmed)
    // Text that is not a time at all reverts rather than clearing: a stray
    // keystroke should never silently erase a value that was already there.
    if (parsed === undefined) setDraft(value)
    else onChange(parsed)
  }

  function step(deltaMinutes: number) {
    // The first press on an empty field lands on the seed itself rather than
    // one step past it. Somebody who reaches for the arrows on a blank field
    // is asking for a starting point, not for five minutes after one, and
    // 09:00 is a better guess than 09:05 for what they meant.
    const base = parseTimeInput(draft.trim())
    const next = base === undefined ? DEFAULT_TIME : stepTime(base, deltaMinutes)
    setDraft(next)
    onChange(next)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape' && open) {
      e.preventDefault()
      setOpen(false)
      return
    }
    // Enter commits. Without it a typed time only took on blur, so a field
    // filled in and then submitted with the keyboard - the fastest way to
    // build a template, and the way somebody actually does it - handed the
    // form an empty time and produced a block with no time on it at all.
    if (e.key === 'Enter') {
      commit(draft)
      setOpen(false)
      return
    }
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
    e.preventDefault()
    const size = e.shiftKey ? BIG_STEP_MINUTES : STEP_MINUTES
    step(e.key === 'ArrowUp' ? size : -size)
  }

  const current = parseTimeInput(value) ?? ''
  const [currentHour, currentMinute] = current ? current.split(':').map(Number) : [null, null]

  function pick(hour: number, minute: number) {
    const next = `${pad(hour)}:${pad(minute)}`
    setDraft(next)
    onChange(next)
  }

  return (
    <div className="time-picker" ref={rootRef}>
      <div className="time-picker-field">
        <input
          className="time-input"
          inputMode="numeric"
          aria-label={ariaLabel}
          placeholder={placeholder}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={e => commit(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          type="button"
          className="time-picker-toggle"
          aria-label={`${ariaLabel}: pick from a list`}
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen(o => !o)}
        >
          <span className="time-picker-caret" aria-hidden="true" />
        </button>
      </div>

      {open && (
        <div className="time-picker-panel" id={listId} ref={panelRef}>
          {/* Two columns rather than one long list of 288 times. An hour is
              picked from a glance at a familiar shape; a minute from five
              options. One flat list would be a scroll through a haystack. */}
          <div className="time-picker-column" role="listbox" aria-label="Hour">
            {HOURS.map(h => (
              <button
                key={h}
                type="button"
                role="option"
                aria-selected={currentHour === h}
                className={currentHour === h ? 'time-picker-option selected' : 'time-picker-option'}
                onClick={() => pick(h, currentMinute ?? 0)}
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
                aria-selected={currentMinute === m}
                className={currentMinute === m ? 'time-picker-option selected' : 'time-picker-option'}
                onClick={() => pick(currentHour ?? 9, m)}
              >
                {pad(m)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
