import { useEffect, useRef, useState } from 'react'
import { clockTools, elapsedMs, formatClockMs, useClockTools, type StopwatchState } from '../../lib/clockTools'
import { CHIME_PROFILES, DEFAULT_CHIME, playChime, ringAtStart, type ChimeHandle, type ChimeProfile } from '../../lib/chime'
import { startRinging, stopRinging } from '../../lib/ringing'
import { actions, useAppData } from '../../lib/store'
import { formatDuration, parseMinutesInput } from '../day-plan/capacity'
import { MinuteStepInput } from '../../views/MinuteStepInput'
import { HeaderPopover } from './HeaderPopover'
import { DEFAULT_TIMER_MINUTES, TIMER_PRESETS, readSoundOpen, readTimerLength, rememberSoundOpen, rememberTimerLength } from './timerPrefs'

/**
 * How loud, in words.
 *
 * A percentage tells nobody anything about a sound. What the folded line has
 * to answer is "will this be heard in the kitchen", and three words answer it
 * where "45%" does not.
 */
function loudness(volume: number): string {
  if (volume <= 0.34) return 'quiet'
  if (volume <= 0.67) return 'medium'
  return 'loud'
}

/** The folded line's whole sentence: what will ring, and how loudly. */
export function soundSummary(chime: { profile: ChimeProfile; volume: number }): string {
  // Off has no volume worth saying, because there is nothing for it to be
  // the volume of - CONVENTIONS 25.
  return chime.profile === 'off' ? 'Off' : `${SOUND_LABELS[chime.profile]}, ${loudness(chime.volume)}`
}

/** What each sound is called on its chip. Off first, because it is an answer. */
const SOUND_LABELS: Record<ChimeProfile, string> = {
  off: 'Off',
  soft: 'Soft',
  bell: 'Bell',
  alarm: 'Alarm',
}

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
  // The field opens holding an answer - CONVENTIONS 16 - so Start is never
  // a button that looks broken. The last length used on this device, or ten.
  const [custom, setCustom] = useState(() => String(readTimerLength()))
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
    // A new timer supersedes whatever the last one was still saying.
    stopRinging()
    rememberTimerLength(minutes)
    clockTools.startTimer(minutes * 60_000)
    // Rung from the press rather than from anything watching the timer,
    // because the press is the user gesture a browser needs before it will
    // open an AudioContext at all - see ringAtStart.
    startRinging(ringAtStart(data.settings.chime ?? DEFAULT_CHIME))
    // Asked for at the moment somebody first starts a timer, which is the one
    // moment the request explains itself - a permission prompt on page load
    // is a prompt about nothing, and gets denied on reflex.
    requestNotificationPermission()
    onClose()
  }

  /** What Start would use: the field, or the default if it has been emptied. */
  const chosen = parseMinutesInput(custom) ?? DEFAULT_TIMER_MINUTES

  function startCustom() {
    start(chosen > 0 ? chosen : DEFAULT_TIMER_MINUTES)
  }

  const stopwatch = tools.stopwatch
  const data = useAppData()

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
            {/* Four lengths and the field under them are one answer, not two.
                They could say different things before: the field started
                empty and a press here went straight past it to a running
                timer, so nothing on the panel ever showed what had been
                chosen. A chip sets the field and marks itself; Start is the
                one thing that starts.

                The cost is real and worth naming: a length that is not the
                one already showing is two presses now where it was one. The
                panel opens on the last length used on this device, so the
                ordinary case - the same ten minutes as yesterday - is still
                a single press of Start. */}
            <div className="clock-presets" role="group" aria-label="How long">
              {TIMER_PRESETS.map(m => (
                <button
                  key={m}
                  type="button"
                  className={chosen === m ? 'clock-preset is-on' : 'clock-preset'}
                  aria-pressed={chosen === m}
                  onClick={() => setCustom(String(m))}
                >
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
              {/* Never disabled. The field always holds an answer, so there is
                  no state in which this cannot start something - and a
                  disabled primary button is the app's own worst pattern:
                  the owner read a faded one as broken. */}
              <button type="button" className="primary" onClick={startCustom}>
                Start
              </button>
            </div>
            {tools.timer && (
              <p className="clock-note">A timer is already running. Starting another replaces it.</p>
            )}
            <SoundPicker />
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
            <RecordOffer stopwatch={stopwatch} />
          </div>
        )}
    </HeaderPopover>
  )
}

/**
 * The one line a stopped stopwatch offers, when it was measuring something.
 *
 * Every block in this app has had a planned length since v1.0 and not one has
 * ever had a real one, so "where the plan and the week disagreed" has had to
 * be read off *when* things happened rather than off how long they took. This
 * is the only thing in the app that writes one down.
 *
 * **It is an offer and never a question.** Nothing is asked twice, there is
 * no "are you sure", and walking away is a complete answer: closing the panel
 * without pressing it leaves the day exactly as it was, which is what the
 * stopwatch has always done. Reset without recording is still Reset.
 *
 * It only appears once the stopwatch is stopped, because a running one has no
 * number yet - it has a number that is still changing.
 */
function RecordOffer({ stopwatch }: { stopwatch: StopwatchState | null }) {
  const data = useAppData()
  const [recorded, setRecorded] = useState(false)

  const of = stopwatch?.of
  const task = of ? data.days[of.date]?.tasks.find(t => t.id === of.taskId) : undefined
  if (!stopwatch || !stopwatch.paused || !of || !task) return null

  const ms = elapsedMs(stopwatch, Date.now())
  const took = Math.max(0, Math.round(ms / 60_000))

  return (
    <p className="clock-record" role="status">
      <span className="clock-record-line">
        <strong>{task.title}</strong> took {formatDuration(took)}
        {/* The plan, beside what happened, and only when there is one to be
            beside it. A task nobody sized has nothing for this to disagree
            with. */}
        {task.minutes !== undefined && `. Planned ${formatDuration(task.minutes)}`}
      </span>
      {recorded ? (
        <span className="clock-record-done">Written down</span>
      ) : (
        <button
          type="button"
          className="btn-secondary clock-record-go"
          onClick={() => {
            actions.setTaskActualMinutes(of.date, of.taskId, ms)
            setRecorded(true)
          }}
        >
          Record
        </button>
      )}
    </p>
  )
}

/**
 * What the timer will sound like, chosen where the timer is started.
 *
 * In this panel and not in Settings, which is the rule v2.14 was about:
 * visibility lives where the action is. Somebody setting a ten minute timer
 * for a meditation and somebody setting one for a pan are the same person
 * two minutes apart, and the moment they need to change the sound is the
 * moment they are already here starting the timer.
 *
 * Four chips and a slider, and that is all of it. No library of sounds, no
 * per-preset override, no second screen: the four are one function with four
 * settings (see lib/chime.ts) and a fifth would be a fifth thing to choose
 * between rather than a fifth thing to hear.
 *
 * The slider and the try button both go when the answer is Off, because
 * neither of them controls anything then - CONVENTIONS 25, a state has to
 * earn its place.
 */
function SoundPicker() {
  const data = useAppData()
  const chime = data.settings.chime ?? DEFAULT_CHIME
  // The preview that is playing, so a second press stops it rather than
  // starting a second one on top of the first. A ref rather than state: what
  // is drawn does not depend on it, only what the next press does.
  const trying = useRef<ChimeHandle | null>(null)
  const [playing, setPlaying] = useState(false)
  // Remembered between openings, on this device only - see timerPrefs.
  const [open, setOpen] = useState(readSoundOpen)

  useEffect(() => () => trying.current?.stop(), [])

  function stopTrying() {
    trying.current?.stop()
    trying.current = null
    setPlaying(false)
  }

  function tryIt() {
    if (playing) return stopTrying()
    trying.current = playChime(chime.profile, chime.volume)
    setPlaying(true)
    // The alarm repeats for a minute and this is a preview, not an alarm: one
    // round is enough to know what it is. Everything else ends on its own
    // well before this and stopping a finished sound is a no-op.
    window.setTimeout(stopTrying, 4000)
  }

  return (
    <div className="clock-sound">
      {/* Folded, and folded by default. The panel exists to pick a number and
          press Start; the sound is answered once and then left alone for
          months, and a rare thing may not take more room than a frequent one
          - CONVENTIONS 25. The line says what is actually set, so folding it
          hides the controls and never the answer. */}
      <button
        type="button"
        className="clock-sound-head"
        aria-expanded={open}
        onClick={() => {
          const next = !open
          setOpen(next)
          rememberSoundOpen(next)
          if (!next) stopTrying()
        }}
      >
        <span className="clock-label">Sound</span>
        <span className="clock-sound-summary">{soundSummary(chime)}</span>
        <span className="clock-sound-caret" aria-hidden="true" />
      </button>

      {open && (
        <div className="clock-sound-body">
          {/* One segmented control, drawn exactly like the Timer and
              Stopwatch tabs above it. The app already has this pattern for
              "one of these, and only one" and a second kind of button for the
              same job was two answers to one question. */}
          <div className="segmented clock-sound-choice" role="group" aria-label="Sound">
            {CHIME_PROFILES.map(profile => (
              <button
                key={profile}
                type="button"
                className={chime.profile === profile ? 'active' : ''}
                aria-pressed={chime.profile === profile}
                onClick={() => {
                  stopTrying()
                  actions.setChime({ ...chime, profile })
                }}
              >
                {SOUND_LABELS[profile]}
              </button>
            ))}
          </div>

          {chime.profile !== 'off' && (
            <div className="clock-volume">
              <span className="clock-label">Volume</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={chime.volume}
                aria-label="How loud"
                onChange={e => actions.setChime({ ...chime, volume: Number(e.target.value) })}
              />
              {/* Out of the row of choices and onto this one, because it is a
                  thing you do rather than a thing you pick - and drawn hollow
                  for the same reason. Without it the choice is made deaf: a
                  name is not a sound, and the difference between Bell and
                  Alarm is the whole reason there are four.

                  One width for both words, so the row does not jump when the
                  label changes under the pointer - CONVENTIONS 24. */}
              <button type="button" className="clock-sound-try" onClick={tryIt}>
                {playing ? 'Stop' : 'Try'}
              </button>
            </div>
          )}

          {/* The one case that cannot check the screen: ten minutes of
              meditation with the eyes shut, where nothing says whether the
              timer took the press. No halfway bell to go with it - for a ten
              minute sitting that would answer a question nobody asked, and it
              is one more state. */}
          {chime.profile !== 'off' && (
            <label className="check-line clock-sound-start">
              <input
                type="checkbox"
                checked={chime.atStart}
                onChange={e => actions.setChime({ ...chime, atStart: e.target.checked })}
              />
              <span className="check" aria-hidden="true" />
              <span>Ring at the start too</span>
            </label>
          )}
        </div>
      )}
    </div>
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
