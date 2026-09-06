import { useEffect, useRef, useState } from 'react'
import { useRestoreFocus } from '../../lib/useRestoreFocus'
import { clockTools, elapsedMs, formatClockMs, useClockTools } from '../../lib/clockTools'
import { parseMinutesInput } from '../day-plan/capacity'
import { MinuteStepInput } from '../../views/MinuteStepInput'
import { actions, useAppData } from '../../lib/store'
import { scratchTitle, sortScratch } from '../../lib/scratch'

const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

/**
 * The four lengths worth one tap. Short enough to be a nudge, long enough to
 * be a block: five to get started, ten for a thing being avoided, fifteen for
 * a break, thirty for a stretch of real work. Anything else is typed.
 */
const PRESETS = [5, 10, 15, 30]

/** How many of the last notes the panel shows. Enough to recognise one, few enough not to be a list. */
const RECENT_NOTES = 3

export interface ClockPopoverProps {
  onClose: () => void
  /** Hands over to the full stream - see the Notes tab. */
  onOpenNotes: () => void
  /** Which tool the panel opens on. The quick-note key asks for 'notes'. */
  tab?: ClockTab
}

export type ClockTab = 'timer' | 'stopwatch' | 'notes'

/**
 * Timer and stopwatch, in one small panel hung off the header button.
 *
 * Tabs rather than three buttons in the header, because they are the same
 * kind of thing used at different moments and only one of them is ever
 * running for a given reason. Once a tool is started this panel has nothing
 * left to say - the floating widget takes over and this closes itself, so the
 * panel is only ever a way in, never a place to sit and watch.
 *
 * Notes is the third tab since v2.5. The clock button is the one control on
 * screen from every tab, which makes it the shortest path from a thought to
 * a line written down - and this is deliberately not a second Scratch: one
 * line, Enter, gone. The last three are there to recognise, not to work
 * through, and the way to the whole stream is a button that says so.
 */
export function ClockPopover({ onClose, onOpenNotes, tab: openOn }: ClockPopoverProps) {
  useRestoreFocus()
  const tools = useClockTools()
  const data = useAppData()
  const panelRef = useRef<HTMLDivElement>(null)
  const [tab, setTab] = useState<ClockTab>(openOn ?? (tools.stopwatch && !tools.timer ? 'stopwatch' : 'timer'))
  const [custom, setCustom] = useState('')
  const [note, setNote] = useState('')
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    panelRef.current?.focus()
  }, [])

  // Only ticks while the stopwatch tab is showing something running - the
  // panel is not where either tool is meant to be watched, and a timer that
  // is going has already replaced this with the widget.
  useEffect(() => {
    if (tab !== 'stopwatch' || !tools.stopwatch || tools.stopwatch.paused) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [tab, tools.stopwatch])

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
      return
    }
    if (e.key !== 'Tab') return
    const focusables = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    if (!focusables || focusables.length === 0) return
    const list = Array.from(focusables)
    const first = list[0]
    const last = list[list.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  // One line, kept, and the panel is gone. Not the draft-per-keystroke the
  // Scratch overlay does: that exists because the overlay is a place to sit
  // and this is a door somebody is already halfway through.
  const recent = sortScratch(data.scratch).slice(0, RECENT_NOTES)

  function keepNote() {
    const text = note.trim()
    if (!text) return
    actions.addScratch(text)
    setNote('')
    onClose()
  }

  function start(minutes: number) {
    clockTools.startTimer(minutes * 60_000)
    // Asked for at the moment somebody first starts a timer, which is the one
    // moment the request explains itself - a permission prompt on page load
    // is a prompt about nothing, and gets denied on reflex.
    requestNotificationPermission()
    onClose()
  }

  function startCustom() {
    const minutes = parseMinutesInput(custom)
    if (minutes === undefined || minutes <= 0) return
    start(minutes)
  }

  const stopwatch = tools.stopwatch

  return (
    <>
      <button type="button" className="clock-scrim" aria-hidden="true" tabIndex={-1} onClick={onClose} />
      <div
        className="clock-popover"
        role="dialog"
        aria-modal="true"
        aria-label="Timer and stopwatch"
        ref={panelRef}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        <div className="segmented clock-tabs" role="group" aria-label="Tool">
          <button
            type="button"
            className={tab === 'timer' ? 'active' : ''}
            aria-pressed={tab === 'timer'}
            onClick={() => setTab('timer')}
          >
            Timer
          </button>
          <button
            type="button"
            className={tab === 'stopwatch' ? 'active' : ''}
            aria-pressed={tab === 'stopwatch'}
            onClick={() => setTab('stopwatch')}
          >
            Stopwatch
          </button>
          <button
            type="button"
            className={tab === 'notes' ? 'active' : ''}
            aria-pressed={tab === 'notes'}
            onClick={() => setTab('notes')}
          >
            Notes
          </button>
        </div>

        {tab === 'notes' ? (
          <div className="clock-panel clock-notes">
            <textarea
              className="clock-note-input"
              aria-label="A quick note"
              placeholder="One line. Enter keeps it."
              rows={2}
              value={note}
              onChange={e => setNote(e.target.value)}
              onKeyDown={e => {
                if (e.key !== 'Enter' || e.shiftKey) return
                e.preventDefault()
                keepNote()
              }}
            />
            {recent.length === 0 ? (
              <p className="clock-note">Nothing written down yet.</p>
            ) : (
              <ul className="clock-note-list">
                {recent.map(n => (
                  <li key={n.id}>{scratchTitle(n.text, 60)}</li>
                ))}
              </ul>
            )}
            <button
              type="button"
              className="clock-note-open"
              onClick={() => {
                onOpenNotes()
                onClose()
              }}
            >
              Open notes
            </button>
          </div>
        ) : tab === 'timer' ? (
          <div className="clock-panel">
            <div className="clock-presets">
              {PRESETS.map(m => (
                <button key={m} type="button" className="clock-preset" onClick={() => start(m)}>
                  {m} min
                </button>
              ))}
            </div>
            <div className="clock-custom">
              <MinuteStepInput
                value={custom}
                onChange={setCustom}
                ariaLabel="Custom timer length in minutes"
              />
              <button
                type="button"
                className="primary"
                disabled={parseMinutesInput(custom) === undefined}
                onClick={startCustom}
              >
                Start
              </button>
            </div>
            {tools.timer && (
              <p className="clock-note">A timer is already running. Starting another replaces it.</p>
            )}
          </div>
        ) : (
          <div className="clock-panel">
            <p className="clock-reading">{formatClockMs(stopwatch ? elapsedMs(stopwatch, now) : 0)}</p>
            <div className="clock-actions">
              {!stopwatch && (
                <button
                  type="button"
                  className="primary"
                  onClick={() => {
                    clockTools.startStopwatch()
                    onClose()
                  }}
                >
                  Start
                </button>
              )}
              {stopwatch && !stopwatch.paused && (
                <button type="button" onClick={() => clockTools.pauseStopwatch()}>Pause</button>
              )}
              {stopwatch?.paused && (
                <button type="button" className="primary" onClick={() => clockTools.resumeStopwatch()}>Resume</button>
              )}
              {stopwatch && <button type="button" onClick={() => clockTools.resetStopwatch()}>Reset</button>}
            </div>
          </div>
        )}
      </div>
    </>
  )
}

/**
 * Asks once, and never blocks anything on the answer. A denied or dismissed
 * prompt is a completely normal outcome: the floating widget and the sound
 * are the primary signal, and the notification is what reaches somebody who
 * has switched to another tab. Wrapped because Notification does not exist in
 * every browser this app runs in, and calling it must never throw into a
 * click handler.
 */
export function requestNotificationPermission(): void {
  try {
    if (typeof Notification === 'undefined') return
    if (Notification.permission === 'default') void Notification.requestPermission()
  } catch {
    // Nothing to do - see above.
  }
}
