import { useEffect, useState } from 'react'
import { clockTools, elapsedMs, formatClockMs, useClockTools } from '../../lib/clockTools'
import { parseMinutesInput } from '../day-plan/capacity'
import { MinuteStepInput } from '../../views/MinuteStepInput'
import { HeaderPopover } from './HeaderPopover'

/**
 * The four lengths worth one tap. Short enough to be a nudge, long enough to
 * be a block: five to get started, ten for a thing being avoided, fifteen for
 * a break, thirty for a stretch of real work. Anything else is typed.
 */
const PRESETS = [5, 10, 15, 30]

export interface ClockPopoverProps {
  onClose: () => void
  /** Which tool the panel opens on. */
  tab?: ClockTab
}

export type ClockTab = 'timer' | 'stopwatch'

/**
 * Timer and stopwatch, in one small panel hung off the header button.
 *
 * Tabs rather than three buttons in the header, because they are the same
 * kind of thing used at different moments and only one of them is ever
 * running for a given reason. Once a tool is started this panel has nothing
 * left to say - the floating widget takes over and this closes itself, so the
 * panel is only ever a way in, never a place to sit and watch.
 *
 * Notes and Journal were the third and fourth tabs of this panel for one
 * version, on the reasoning that the clock button is the one control on
 * screen from every tab. The reasoning held; the shape did not. A timer and
 * a stopwatch are the same kind of thing at different moments, which is
 * what tabs are for - a note and a journal entry are not that, and neither
 * of them is a clock, so reaching a line somebody wanted to write meant
 * pressing a picture of a clock and reading four labels to find the one
 * that was not about time. They have their own buttons beside this one now,
 * and this panel is two tools again.
 */
export function ClockPopover({ onClose, tab: openOn }: ClockPopoverProps) {
  const tools = useClockTools()
  const [tab, setTab] = useState<ClockTab>(openOn ?? (tools.stopwatch && !tools.timer ? 'stopwatch' : 'timer'))
  const [custom, setCustom] = useState('')
  const [now, setNow] = useState(() => Date.now())

  // Only ticks while the stopwatch tab is showing something running - the
  // panel is not where either tool is meant to be watched, and a timer that
  // is going has already replaced this with the widget.
  useEffect(() => {
    if (tab !== 'stopwatch' || !tools.stopwatch || tools.stopwatch.paused) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [tab, tools.stopwatch])

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
    <HeaderPopover label="Timer and stopwatch" onClose={onClose}>
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
    </HeaderPopover>
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
