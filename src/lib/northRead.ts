/**
 * When North's introduction comes forward on its own: once after sleep.
 *
 * ## After sleep, read from the gap
 *
 * The owner's rule, v2.24: the introduction and the signature open in a
 * window over the day the first time the app is in view after at least five
 * hours out of view, and never twice in twelve hours. Until then the first
 * open of each calendar day opened the North page instead, which is the
 * wrong clock for a person whose sleep is not at night: after a night shift
 * slept through to three in the afternoon the day has been "today" since
 * midnight, and the morning never came. A gap does not care what the hour
 * is. Five hours is longer than a nap and shorter than a night; twelve is
 * what keeps it from ever opening in the middle of a waking day, even one
 * with a long afternoon away in it.
 *
 * The sleep schedules in Settings were the other way to know, and are not
 * used: they say when somebody means to sleep, not when they did, and the
 * nights this is for are exactly the ones that did not go to schedule.
 *
 * ## Out of view, not closed
 *
 * A tab left open overnight is not the app being used overnight, so what
 * counts is the app being in view: the last moment is written when it
 * leaves view and while it stays in view, and the break is measured from
 * there. A laptop that sleeps with the app on screen comes back to a timer
 * that fires late, and the gap that shows is the sleep.
 *
 * ## A device fact
 *
 * Two moments under keys of their own, outside the plan and outside sync,
 * the same reasoning as the library's open lists and the rail's pin: seeing
 * it on the phone at seven does not mean the computer has shown it at nine,
 * and written to the plan it would be a commit on every open in a synced
 * repo. Never in the demo, which writes nothing here either: a stranger
 * opening the sample fortnight should meet the day.
 */

const SEEN_KEY = 'dienius:north-seen'
const SHOWN_KEY = 'dienius:north-window'
/**
 * The last waking: the moment the app came into view after a break long
 * enough to be sleep. Written whether or not the window shows - the day's
 * line reads it for its morning (lib/northLine.ts), and a North with no
 * introduction, or the window switched off, still has mornings.
 */
const WOKE_KEY = 'dienius:north-woke'
/** Where the page opening kept the day North was read, until v2.24. */
const OLD_READ_KEY = 'dienius:north-read'

/** Said on the window when a waking has just been written, so the day's line can turn to its morning at once. */
export const NORTH_WOKE_EVENT = 'dienius:north-woke'

/** Out of view this long is sleep rather than a break. */
export const NORTH_BREAK_MS = 5 * 60 * 60 * 1000
/** And the window is never shown again sooner than this. */
export const NORTH_WINDOW_SPACING_MS = 12 * 60 * 60 * 1000

/** What the device remembers, as epoch milliseconds. */
export interface NorthWindowMemory {
  /** The last moment the app was in view on this device. */
  seenAt: number | null
  /** The last moment the window was shown on this device. */
  shownAt: number | null
}

export interface NorthWindowTerms {
  /** Whether the text has an introduction to show. */
  intro: boolean
  /** The switch under Nudges. */
  enabled: boolean
  /** The sample fortnight is open. */
  demo: boolean
}

/**
 * Whether the app coming into view at `now` shows the window. Pure, so the
 * rule is tested as arithmetic.
 *
 * A device the app has never been seen on has no break to measure and shows
 * nothing: the moment is written on that first arrival, so the first real
 * sleep after it is the first window - rather than a window in the middle of
 * the afternoon the update happened to land in.
 */
export function northWindowDue(memory: NorthWindowMemory, now: number, terms: NorthWindowTerms): boolean {
  if (terms.demo || !terms.enabled || !terms.intro) return false
  if (memory.seenAt === null) return false
  if (now - memory.seenAt < NORTH_BREAK_MS) return false
  if (memory.shownAt !== null && now - memory.shownAt < NORTH_WINDOW_SPACING_MS) return false
  return true
}

/**
 * Whether the app coming into view at `now` is a waking: the break since it
 * was last in view is sleep. The same break the window reads, and nothing
 * else of its terms - a waking is a waking with the window off.
 */
export function isWaking(memory: NorthWindowMemory, now: number): boolean {
  return memory.seenAt !== null && now - memory.seenAt >= NORTH_BREAK_MS
}

/** The last waking this device has seen, as epoch milliseconds, or none. */
export function northWokeAt(): number | null {
  return readMoment(WOKE_KEY)
}

/**
 * The app is in view at `now`: on opening, on coming back into view, and on
 * every tick while it stays there. Decides whether the window is due, and
 * remembers the moment - the showing, when it is, and the waking, when this
 * is one.
 */
export function arriveAtNorth(now: number, terms: NorthWindowTerms): boolean {
  if (terms.demo) return false
  const memory = read()
  const due = northWindowDue(memory, now, terms)
  const woke = isWaking(memory, now)
  write(SEEN_KEY, now)
  if (due) write(SHOWN_KEY, now)
  if (woke) {
    write(WOKE_KEY, now)
    try {
      window.dispatchEvent(new Event(NORTH_WOKE_EVENT))
    } catch {
      // Nothing listening is nothing lost: the line reads the moment on its next tick.
    }
  }
  try {
    localStorage.removeItem(OLD_READ_KEY)
  } catch {
    // A key left behind is harmless.
  }
  return due
}

/** The app is leaving view at `now`: the break, if there is one, starts here. */
export function leaveNorth(now: number, demo = false): void {
  if (demo) return
  write(SEEN_KEY, now)
}

function read(): NorthWindowMemory {
  return { seenAt: readMoment(SEEN_KEY), shownAt: readMoment(SHOWN_KEY) }
}

function readMoment(key: string): number | null {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return null
    const value = Number(raw)
    return Number.isFinite(value) ? value : null
  } catch {
    return null
  }
}

function write(key: string, moment: number): void {
  try {
    localStorage.setItem(key, String(moment))
  } catch {
    // Nothing to do: a device that cannot remember sees no window, which is
    // the quiet side to fail on.
  }
}
