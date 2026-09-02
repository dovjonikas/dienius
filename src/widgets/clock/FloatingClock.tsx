import { useEffect, useRef } from 'react'
import { useTimerTick, useTitleCountdown } from './useTimerTick'
import {
  clockTools,
  elapsedMs,
  formatAgo,
  formatClockMs,
  remainingMs,
  useClockTools,
  type ClockTools,
} from '../../lib/clockTools'

const RING_RADIUS = 20
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

/**
 * A short, quiet two-tone chime, synthesised rather than loaded.
 *
 * No audio file: this app ships no assets it does not need, works offline by
 * design, and a bundled sound would be one more thing to cache and one more
 * thing to get wrong. Two sine tones a fifth apart, each about a fifth of a
 * second, with their gain ramped down to silence rather than cut - an
 * abruptly-ended tone clicks, and a click is exactly the sound nobody wants
 * from a planner.
 *
 * Everything is wrapped: AudioContext does not exist everywhere, and a
 * browser that has not seen a user gesture yet will refuse to start one.
 * Failing silently is correct - the widget and the notification are the real
 * signal, and the sound is the part that is allowed not to arrive.
 */
function playChime(): void {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return
    const ctx = new Ctor()
    const now = ctx.currentTime
    for (const [index, frequency] of [880, 1320].entries()) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = frequency
      const at = now + index * 0.18
      gain.gain.setValueAtTime(0.0001, at)
      gain.gain.exponentialRampToValueAtTime(0.12, at + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.22)
      osc.connect(gain).connect(ctx.destination)
      osc.start(at)
      osc.stop(at + 0.24)
    }
    setTimeout(() => void ctx.close(), 900)
  } catch {
    // See above - a missing chime is not a failure worth surfacing.
  }
}

function notify(body: string): void {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    new Notification('Dienius', { body, tag: 'dienius-timer' })
  } catch {
    // Some browsers throw here on a page that is not fully qualified to
    // notify. The widget is already saying the same thing on screen.
  }
}

const CORNERS: ClockTools['corner'][] = ['bottom-right', 'bottom-left', 'top-left', 'top-right']

/**
 * The running timer or stopwatch, in a corner, on every tab.
 *
 * Mounted at the app root rather than inside the day view, because a timer
 * started while planning has to survive walking over to Calendar or Settings -
 * that is most of the point of it being floating rather than being a panel.
 *
 * It shows one tool at a time, and the timer wins when both are going: a
 * countdown has a deadline and a stopwatch does not, so only one of them is
 * ever information you might be late against.
 */
export function FloatingClock() {
  const tools = useClockTools()
  // Which run has already chimed. Held per mount rather than in storage: the
  // stored `rungOut` flag is what stops a reload from re-alarming, and this
  // only stops the same tab from alarming twice on consecutive ticks.
  const chimedRef = useRef<number | null>(null)

  const timer = tools.timer
  const stopwatch = tools.stopwatch
  const running = (timer && !timer.paused) || (stopwatch && !stopwatch.paused)

  // The instant this timer is due, in wall-clock terms, so the tick below
  // can schedule a single timeout for it rather than trusting an interval a
  // background tab is allowed to clamp to once a minute. Null for a paused
  // timer (it has no deadline until it is started again) and for a stopwatch
  // (which has none at all).
  const deadline = timer && !timer.paused ? timer.startedAt + (timer.durationMs - timer.elapsedBeforeMs) : null
  const now = useTimerTick(!!running, deadline)

  const left = timer ? remainingMs(timer, now) : 0
  const isUp = !!timer && left <= 0

  // The countdown in the tab title - the one thing a browser will still show
  // for a tab nobody is looking at, needing neither a permission nor a sound.
  useTitleCountdown(timer ? (isUp ? 'Time up' : formatClockMs(left)) : null)

  useEffect(() => {
    if (!timer || !isUp) return
    if (chimedRef.current === timer.startedAt) return
    chimedRef.current = timer.startedAt
    // Only the tab that actually watched it run out makes a noise. A reload
    // finds `rungOut` already set and shows the finished state silently,
    // rather than alarming about something that happened an hour ago.
    if (!timer.rungOut) {
      playChime()
      notify('Timer finished')
    }
    clockTools.markRungOut()
  }, [timer, isUp])

  if (!timer && !stopwatch) return null

  function cycleCorner() {
    const index = CORNERS.indexOf(tools.corner)
    clockTools.setCorner(CORNERS[(index + 1) % CORNERS.length])
  }

  const showing: 'timer' | 'stopwatch' = timer ? 'timer' : 'stopwatch'
  const fraction = timer ? Math.min(1, Math.max(0, elapsedMs(timer, now) / timer.durationMs)) : 0
  const reading = timer
    ? isUp
      ? formatAgo(-left)
      : formatClockMs(left)
    : formatClockMs(stopwatch ? elapsedMs(stopwatch, now) : 0)

  const classNames = ['floating-clock', `at-${tools.corner}`]
  if (isUp) classNames.push('is-up')

  return (
    <div className={classNames.join(' ')} role="status" aria-label={showing === 'timer' ? 'Timer' : 'Stopwatch'}>
      {/* Moving it is a button rather than a drag: a drag has to be told apart
          from a scroll, has to work with a finger and a mouse, and has to
          decide what happens when it is dropped between two corners. One tap
          that walks it round the four corners does the same job - getting it
          off whatever it is covering - with none of that, and works
          identically on both. */}
      <button
        type="button"
        className="floating-clock-move"
        aria-label="Move to the next corner"
        title="Move to the next corner"
        onClick={cycleCorner}
      >
        <span className="floating-clock-grip" aria-hidden="true" />
      </button>

      <div className="floating-clock-ring" aria-hidden="true">
        <svg viewBox="0 0 48 48">
          <circle className="floating-clock-track" cx="24" cy="24" r={RING_RADIUS} />
          {showing === 'timer' && (
            <circle
              className="floating-clock-fill"
              cx="24"
              cy="24"
              r={RING_RADIUS}
              transform="rotate(-90 24 24)"
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={RING_CIRCUMFERENCE * (1 - fraction)}
            />
          )}
        </svg>
      </div>

      <div className="floating-clock-body">
        <span className="floating-clock-label">
          {showing === 'timer' ? (isUp ? 'Timer finished' : 'Timer') : 'Stopwatch'}
        </span>
        <span className="floating-clock-reading">{reading}</span>
      </div>

      <div className="floating-clock-actions">
        {showing === 'timer' && !isUp && (
          <button type="button" onClick={() => (timer!.paused ? clockTools.resumeTimer() : clockTools.pauseTimer())}>
            {timer!.paused ? 'Resume' : 'Pause'}
          </button>
        )}
        {showing === 'stopwatch' && (
          <button
            type="button"
            onClick={() => (stopwatch!.paused ? clockTools.resumeStopwatch() : clockTools.pauseStopwatch())}
          >
            {stopwatch!.paused ? 'Resume' : 'Pause'}
          </button>
        )}
        <button
          type="button"
          className={isUp ? 'primary' : ''}
          onClick={() => (showing === 'timer' ? clockTools.acknowledgeTimer() : clockTools.resetStopwatch())}
        >
          {isUp ? 'Done' : showing === 'timer' ? 'Cancel' : 'Reset'}
        </button>
      </div>
    </div>
  )
}
