/**
 * The two things the timer panel remembers about itself between openings.
 *
 * Their own local keys, deliberately outside the backup and outside sync -
 * the same reasoning as the clock tools, quick-add's remembered duration and
 * the yesterday dismissal, listed in `docs/ARCHITECTURE.md` section 2. These
 * are a device's habits, not a plan: restoring a snapshot from last Tuesday
 * has nothing to say about how long the last timer was, and a phone and a
 * laptop are allowed to disagree about whether a panel section is folded.
 *
 * The sound *settings* are the opposite of this and live in `AppData` - see
 * `Settings.chime`. The line between the two is whether a backup should carry
 * it: "I always want the quiet bell" yes, "the section was open last time" no.
 */

const LENGTH_KEY = 'dienius:timer-length'
const SOUND_OPEN_KEY = 'dienius:timer-sound-open'

/**
 * What the minutes field opens holding on a fresh install.
 *
 * Ten rather than five or twenty-five. Five is a nudge and twenty-five is
 * somebody else's method; ten is the length of the thing this timer is most
 * often set for - a stretch, a sitting, something on the hob - and it is
 * short enough that being wrong about it costs one press of an arrow.
 *
 * CONVENTIONS 16: the control opens holding an answer, so the panel is
 * always one press from a running timer.
 */
export const DEFAULT_TIMER_MINUTES = 10

/** The lengths worth one press, and the ones the field is checked against. */
export const TIMER_PRESETS = [5, 10, 15, 30] as const

const MAX_TIMER_MINUTES = 24 * 60

/** The length the panel opens on: the last one used here, or ten. */
export function readTimerLength(): number {
  try {
    const raw = localStorage.getItem(LENGTH_KEY)
    if (raw === null) return DEFAULT_TIMER_MINUTES
    const minutes = Number(raw)
    // Anything a hand-edited key could hold falls back rather than putting a
    // nonsense number in front of somebody - the same rule readLastDuration
    // follows next door.
    if (!Number.isInteger(minutes) || minutes <= 0 || minutes > MAX_TIMER_MINUTES) return DEFAULT_TIMER_MINUTES
    return minutes
  } catch {
    return DEFAULT_TIMER_MINUTES
  }
}

export function rememberTimerLength(minutes: number): void {
  try {
    localStorage.setItem(LENGTH_KEY, String(minutes))
  } catch {
    // A device with storage refused still runs; it just opens on ten.
  }
}

/**
 * Whether the sound section is unfolded.
 *
 * Folded by default, and that is the whole point of folding it: the panel
 * exists to pick a number and press Start, and the sound is answered once and
 * then left alone for months. A rare thing may not take more room than a
 * frequent one - CONVENTIONS 25.
 */
export function readSoundOpen(): boolean {
  try {
    return localStorage.getItem(SOUND_OPEN_KEY) === '1'
  } catch {
    return false
  }
}

export function rememberSoundOpen(open: boolean): void {
  try {
    localStorage.setItem(SOUND_OPEN_KEY, open ? '1' : '0')
  } catch {
    // See above.
  }
}
