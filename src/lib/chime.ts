/**
 * The sound a timer makes, synthesised, in four shapes.
 *
 * ## Why four and not one
 *
 * The owner uses one timer for two jobs that want opposite sounds. Ten
 * minutes of meditation with the eyes shut needs something quiet enough not
 * to jolt, and a mark that it has *started*, because there is no way to check
 * from behind closed eyes. Something on the stove needs a sound that carries
 * into the next room. One tone cannot do both, and picking the middle serves
 * neither.
 *
 * ## Why one function and not four sounds
 *
 * Edworthy, Loxley and Dennis (1991) and Hellier, Edworthy and Dennis (1993)
 * measured what makes a sound feel urgent, and it came out as four things a
 * synthesiser already has knobs for: how high it is, how fast it repeats, how
 * loud it is, and how ragged its harmonics are. Calm and alarming are the
 * same function with different numbers, not two different sounds - so this is
 * one engine and a table of parameters, and the table is in `PROFILES` where
 * it can be read and changed.
 *
 * And the loudest one is a short melody rather than a beep, because McFarlane
 * and colleagues (PLOS ONE, 2020) found that harsh beeping leaves people
 * groggier than a melodic tone does. Loud is a parameter; harsh is a mistake.
 *
 * ## What never changes
 *
 * **Nothing is loaded.** No mp3, no asset, nothing to cache and nothing to be
 * missing offline. Every sound here is a handful of oscillators.
 *
 * **Nothing is ever cut.** Every tone's gain is ramped to silence before its
 * oscillator stops. A tone that ends at full amplitude clicks, and a click is
 * the one sound nobody wants out of a planner.
 *
 * **Nothing rings forever.** The alarm repeats until it is stopped or until a
 * minute has gone, whichever comes first. A sound with no end is a sound
 * somebody comes back to a meeting to find still going.
 *
 * **A failure is silent.** `AudioContext` is missing in some browsers and
 * refused in every one of them before the page has seen a gesture. The widget
 * and the notification are the signal that has to arrive; the sound is the
 * part that is allowed not to.
 */

import type { ChimeSettings } from './types'

/** What a timer sounds like when it finishes. */
export type ChimeProfile = 'off' | 'soft' | 'bell' | 'alarm'

export const CHIME_PROFILES: ChimeProfile[] = ['off', 'soft', 'bell', 'alarm']

export function isChimeProfile(x: unknown): x is ChimeProfile {
  return typeof x === 'string' && (CHIME_PROFILES as string[]).includes(x)
}

/**
 * What a timer rings with when nobody has said otherwise, and how loud.
 *
 * Soft, because the quiet one is the one that is wrong in the fewest places:
 * a sound too quiet for the kitchen is a missed pan, a sound too loud for a
 * meditation is a jolt, and only one of those two is fixed by walking over
 * to look at the screen.
 */
export const DEFAULT_CHIME_PROFILE: ChimeProfile = 'soft'
export const DEFAULT_CHIME_VOLUME = 0.5

/** A sound that has started. `stop` is safe to call twice, and after the end. */
export interface ChimeHandle {
  stop(): void
}

/** Returned when nothing is going to be heard, so a caller never has a null to check. */
const SILENT: ChimeHandle = { stop() {} }

/** One tone in a profile, in seconds from the start of its round. */
interface Tone {
  /** Hertz. */
  hz: number
  /** When it starts, from the top of the round. */
  at: number
  /** How long the gain takes to come up. A slow one does not startle. */
  attack: number
  /** How long from the peak down to silence. */
  release: number
  /** Peak gain before the volume setting multiplies it. */
  gain: number
}

interface Profile {
  tones: Tone[]
  /** Sine unless a profile has a reason - see `alarm`. */
  wave: OscillatorType
  /** Seconds between repeats, or undefined for a sound that plays once. */
  repeatEvery?: number
}

/**
 * How long a repeating sound may go on for. Twenty rounds of the alarm.
 *
 * A minute is long enough to walk back from another room and short enough
 * that a timer nobody was there for does not still be ringing at lunch.
 */
export const MAX_RINGING_S = 60

/**
 * The four shapes, as numbers.
 *
 * Written here as a table rather than as four functions because the whole
 * argument above is that they are one sound with four settings, and a table
 * is the only shape in which the differences can be read at a glance.
 *
 * The gains are deliberately far apart. Each is multiplied by the volume
 * setting, and the spread is what makes "soft at full volume" quieter than
 * "alarm at half" - which is the whole point of having profiles rather than
 * one sound and a slider.
 *
 * They are calibrated at the default half volume rather than at full, since
 * that is where most of them will ever be heard: soft lands a little under
 * the two-tone this app rang before any of this existed, bell a little over
 * it, and alarm at three times either.
 */
const PROFILES: Record<Exclude<ChimeProfile, 'off'>, Profile> = {
  /**
   * The two-tone this app has always had, quieter. A fifth apart, the second
   * arriving before the first has finished, so it reads as one gesture rather
   * than as two beeps.
   */
  soft: {
    wave: 'sine',
    tones: [
      { hz: 880, at: 0, attack: 0.02, release: 0.2, gain: 0.18 },
      { hz: 1320, at: 0.18, attack: 0.02, release: 0.2, gain: 0.18 },
    ],
  },

  /**
   * One low bell, left to die away over four seconds, with a quiet octave
   * above it for the shimmer a struck bell has. The attack is four times
   * slower than the soft chime's: a sound that arrives rather than one that
   * starts, which is the difference between ending a meditation and
   * interrupting one.
   */
  bell: {
    wave: 'sine',
    tones: [
      { hz: 440, at: 0, attack: 0.08, release: 4, gain: 0.22 },
      { hz: 880, at: 0.01, attack: 0.09, release: 3.2, gain: 0.08 },
    ],
  },

  /**
   * Three rising tones, half a second in all, every three seconds. Rising
   * rather than flat, because a shape is what makes a sound a signal instead
   * of a noise; a melody rather than a beep, for the reason in the module
   * comment above.
   *
   * A triangle wave rather than a sine, and it is the one place this file
   * uses one. A sine puts all of its energy at a single frequency, which is
   * the quietest a waveform can be for a given peak - exactly the wrong
   * property for a sound that has to cross a room out of a laptop's own
   * speakers. A triangle's harmonics fall away as the square of their number,
   * so it carries much further while still being a soft-edged tone rather
   * than the ragged buzz that makes a sound harsh.
   *
   * The three tones sit at 659, 880 and 1175 Hz - two rising fourths, ending
   * in the band a small speaker is loudest in and an ear is most sensitive
   * to.
   */
  alarm: {
    wave: 'triangle',
    tones: [
      { hz: 659, at: 0, attack: 0.01, release: 0.12, gain: 0.64 },
      { hz: 880, at: 0.14, attack: 0.01, release: 0.12, gain: 0.64 },
      { hz: 1175, at: 0.28, attack: 0.01, release: 0.22, gain: 0.72 },
    ],
    repeatEvery: 3,
  },
}

/** The numbers, for anything that wants to describe or render them - see docs/audio. */
export function chimeProfile(profile: Exclude<ChimeProfile, 'off'>): Profile {
  return PROFILES[profile]
}

/**
 * Whether the page has had a user gesture yet.
 *
 * A browser refuses to start an `AudioContext` before one and says so on the
 * console - which is exactly what a timer that ran out while the app was
 * closed did on the next open: it rang before anybody had touched anything,
 * no sound came, and a warning did. The widget and the notification carry
 * that case. Browsers without `userActivation` answer yes and behave as they
 * always did.
 */
export function hasSeenAGesture(): boolean {
  const activation = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation
  return !activation || activation.hasBeenActive
}

function audioContext(): AudioContext | null {
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  return Ctor ? new Ctor() : null
}

/**
 * An exponential ramp cannot reach zero and cannot start from it, so silence
 * is this rather than 0. Low enough to be inaudible at any volume this app
 * uses, high enough that the ramp is legal.
 */
const SILENCE = 0.0001

/**
 * Starts a sound and hands back the way to stop it.
 *
 * `volume` is 0 to 1 and multiplies whatever the profile asks for, on one
 * gain node the whole sound passes through - so stopping is one ramp on that
 * node rather than a ramp per tone, and no tone is ever cut.
 */
export function playChime(profile: ChimeProfile, volume: number): ChimeHandle {
  if (profile === 'off') return SILENT
  const level = Math.min(1, Math.max(0, volume))
  if (level === 0) return SILENT
  try {
    if (!hasSeenAGesture()) return SILENT
    const ctx = audioContext()
    if (!ctx) return SILENT

    const spec = PROFILES[profile]
    const master = ctx.createGain()
    master.gain.value = level
    master.connect(ctx.destination)

    const start = ctx.currentTime
    const rounds = spec.repeatEvery ? Math.ceil(MAX_RINGING_S / spec.repeatEvery) : 1
    const oscillators: OscillatorNode[] = []
    let last = start

    // Every round is scheduled up front, on the audio clock rather than on a
    // chain of timeouts. A background tab is allowed to clamp a timeout to
    // once a minute, which would turn a three second repeat into whatever the
    // browser felt like - and a tab nobody is looking at is exactly the tab an
    // alarm is for.
    for (let round = 0; round < rounds; round += 1) {
      const top = start + round * (spec.repeatEvery ?? 0)
      for (const tone of spec.tones) {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = spec.wave
        osc.frequency.value = tone.hz
        const at = top + tone.at
        gain.gain.setValueAtTime(SILENCE, at)
        gain.gain.exponentialRampToValueAtTime(tone.gain, at + tone.attack)
        gain.gain.exponentialRampToValueAtTime(SILENCE, at + tone.attack + tone.release)
        osc.connect(gain).connect(master)
        osc.start(at)
        const ends = at + tone.attack + tone.release + 0.02
        osc.stop(ends)
        oscillators.push(osc)
        if (ends > last) last = ends
      }
    }

    let stopped = false
    const close = () => {
      if (stopped) return
      stopped = true
      try {
        // The master ramps to silence over fifty milliseconds and everything
        // is stopped after it, so a sound cut off mid-tone fades rather than
        // clicking - the same rule as the tones' own releases.
        const at = ctx.currentTime
        master.gain.cancelScheduledValues(at)
        master.gain.setValueAtTime(Math.max(SILENCE, master.gain.value), at)
        master.gain.exponentialRampToValueAtTime(SILENCE, at + 0.05)
        for (const osc of oscillators) osc.stop(at + 0.06)
      } catch {
        // A node already stopped throws on some engines. Closing below is
        // what actually ends it.
      }
      setTimeout(() => void ctx.close?.(), 200)
    }

    // The context is closed on its own once the last tone has died, so a
    // sound nobody stops does not leave an audio graph open for the session.
    setTimeout(close, Math.max(0, (last - start) * 1000) + 100)

    return { stop: close }
  } catch {
    // See the module comment: a missing sound is not a failure worth saying
    // anything about.
    return SILENT
  }
}

/**
 * The stored answers, read back with every wrong value replaced rather than
 * refused.
 *
 * Deliberately different from how `validate` treats `density` or
 * `textScale`, which refuse a whole payload when they are malformed. That
 * rule is right for the plan: a file with a nonsense field in it is a file
 * somebody edited by hand, and opening the rest of it on trust is how a
 * planner quietly loses a day. This is not the plan. It is how loud a timer
 * is, and refusing to open a year of somebody's days because their volume
 * says "banana" is the wrong trade in both directions.
 *
 * So every field is clamped or defaulted here, and a payload carrying
 * rubbish loads and simply rings the way it always did.
 */
export function readChimeSettings(x: unknown): ChimeSettings {
  const s = typeof x === 'object' && x !== null ? (x as Record<string, unknown>) : {}
  const volume = typeof s.volume === 'number' && Number.isFinite(s.volume) ? Math.min(1, Math.max(0, s.volume)) : DEFAULT_CHIME_VOLUME
  return {
    profile: isChimeProfile(s.profile) ? s.profile : DEFAULT_CHIME_PROFILE,
    volume,
    atStart: s.atStart === true,
  }
}

/** What a payload with nothing stored gets, and what `defaultData` starts on. */
export const DEFAULT_CHIME: ChimeSettings = {
  profile: DEFAULT_CHIME_PROFILE,
  volume: DEFAULT_CHIME_VOLUME,
  atStart: false,
}

/**
 * What the start bell rings with, given what the end will ring with.
 *
 * An alarm at the start is nonsense. The alarm exists to be heard from
 * another room and to keep going until somebody comes back; at the moment
 * somebody has just pressed Start it is being played to the person who
 * pressed it, who is looking at the screen. So the alarm's start is the bell,
 * and every other profile starts as itself - including off, which starts as
 * nothing.
 */
export function startChimeProfile(profile: ChimeProfile): ChimeProfile {
  return profile === 'alarm' ? 'bell' : profile
}

/**
 * Rings once for a timer that has just been started, when that is switched on.
 *
 * Called from the press rather than from a watcher, and that is not only
 * tidiness: a browser will refuse an `AudioContext` that was not opened
 * under a user gesture, and the press is the gesture. A watcher noticing a
 * new timer after a reload would be exactly the case that gets refused, and
 * would ring again for a timer started five minutes ago.
 *
 * It exists for the case that cannot look at the screen: ten minutes of
 * meditation with the eyes shut, where there is no way to tell whether the
 * timer took the press.
 */
export function ringAtStart(settings: ChimeSettings): void {
  if (!settings.atStart) return
  playChime(startChimeProfile(settings.profile), settings.volume)
}
