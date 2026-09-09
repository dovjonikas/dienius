import { useEffect, useRef } from 'react'
import { useTimerTick, useTitleCountdown } from './useTimerTick'
import { DEFAULT_CHIME_PROFILE, DEFAULT_CHIME_VOLUME, playChime } from '../../lib/chime'
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
  const tools = useClockTools()  // Which run has already chimed. Held per mount rather than in storage: the
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

  // While the widget sits in a bottom corner the content gives it the room -
  // see body.has-floating-clock-bottom in the stylesheet. A class on body
  // because the shell is not this widget's to render, and only for the
  // bottom corners: at the top it covers the header's empty right-hand end.
  const atBottom = !!(timer || stopwatch) && tools.corner.startsWith('bottom')
  useEffect(() => {
    document.body.classList.toggle('has-floating-clock-bottom', atBottom)
    return () => document.body.classList.remove('has-floating-clock-bottom')
  }, [atBottom])

  useEffect(() => {
    if (!timer || !isUp) return
    if (chimedRef.current === timer.startedAt) return
    chimedRef.current = timer.startedAt
    // Only the tab that actually watched it run out makes a noise. A reload
    // finds `rungOut` already set and shows the finished state silently,
    // rather than alarming about something that happened an hour ago.
    if (!timer.rungOut) {
      // The profile and the volume are a setting from the next stage; until
      // then this is the sound the app has always made, through the one
      // engine that now makes all of them - see lib/chime.ts.
      playChime(DEFAULT_CHIME_PROFILE, DEFAULT_CHIME_VOLUME)
      notify('Timer finished')
    }
    clockTools.markRungOut()
  }, [timer, isUp])

  // Nothing starts a timer from a step any more - steps were folded into
  // the note in v2.13 - so a timer is a timer and says only how long is
  // left. TimerStep stays on the type for a session started before the
  // update, which simply resolves to no title.
  const stepTitle = undefined

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
        data-tip="Move to the next corner"
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
        {stepTitle && <span className="floating-clock-for">{stepTitle}</span>}
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
