import { useEffect, useRef, useState } from 'react'
import { clockTools, elapsedMs, formatClockMs, useClockTools } from '../../lib/clockTools'
import { parseMinutesInput } from '../day-plan/capacity'
import { MinuteStepInput } from '../../views/MinuteStepInput'

const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

/**
 * The four lengths worth one tap. Short enough to be a nudge, long enough to
 * be a block: five to get started, ten for a thing being avoided, fifteen for
 * a break, thirty for a stretch of real work. Anything else is typed.
 */
const PRESETS = [5, 10, 15, 30]

export interface ClockPopoverProps {
  onClose: () => void
}

/**
 * Timer and stopwatch, in one small panel hung off the header button.
 *
 * Two tabs rather than two buttons in the header, because they are the same
 * kind of thing used at different moments and only one of them is ever
 * running for a given reason. Once either is started this panel has nothing
 * left to say - the floating widget takes over and this closes itself, so the
 * panel is only ever a way in, never a place to sit and watch.
 */
export function ClockPopover({ onClose }: ClockPopoverProps) {
  const tools = useClockTools()
  const panelRef = useRef<HTMLDivElement>(null)
  const [tab, setTab] = useState<'timer' | 'stopwatch'>(tools.stopwatch && !tools.timer ? 'stopwatch' : 'timer')
  const [custom, setCustom] = useState('')
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
        </div>

        {tab === 'timer' ? (
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
