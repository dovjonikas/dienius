import { useSyncExternalStore } from 'react'

/**
 * A plan this browser held that could not be read, kept aside rather than
 * lost.
 *
 * Until the freeze, a stored plan that did not parse or did not pass the
 * guard opened as an empty app without a word, and the first thing saved
 * wrote the empty plan over it - the only copy of somebody's month gone
 * because a byte was wrong, and nothing on the screen to say so. Now
 * `loadData` keeps the text it could not read here, as it was, before
 * anything can be saved over it, and the app says so: one line at the top
 * (`UnreadableBanner`) and a row in Settings with the way to save it as a
 * file and to forget it. See DECISIONS "A plan that cannot be read is kept,
 * and said".
 *
 * One copy at a time. A second plan that cannot be read replaces a first
 * one kept, which nobody saved or forgot while a line over every page
 * asked them to.
 *
 * Where the copy cannot be written - storage full, which only a plan big
 * enough to fill half of it could cause - it stays where it is instead:
 * `holdsSaves` is true, `saveData` writes nothing over it, and the row says
 * why, until it has been forgotten.
 */
export const UNREADABLE_KEY = 'dienius:unreadable'

export interface UnreadablePlan {
  /** When it was found, as an ISO instant. */
  keptAt: string
  /** The text as this browser held it, byte for byte. */
  text: string
  /** It could not be kept aside, and is still under the plan's own key. */
  held?: boolean
}

let heldPlan: UnreadablePlan | null = null
let cachedRaw: string | null | undefined
let cached: UnreadablePlan | null = null
const listeners = new Set<() => void>()

function notify(): void {
  listeners.forEach(fn => fn())
}

function readKept(): UnreadablePlan | null {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(UNREADABLE_KEY)
  } catch {
    raw = null
  }
  // The same object while nothing changed, which useSyncExternalStore needs.
  if (raw === cachedRaw) return cached
  cachedRaw = raw
  cached = null
  if (raw !== null) {
    try {
      const kept: unknown = JSON.parse(raw)
      if (kept && typeof kept === 'object' && typeof (kept as UnreadablePlan).text === 'string' && typeof (kept as UnreadablePlan).keptAt === 'string') {
        cached = { keptAt: (kept as UnreadablePlan).keptAt, text: (kept as UnreadablePlan).text }
      }
    } catch {
      // A copy that is itself unreadable is no copy.
    }
  }
  return cached
}

/** Keeps a plan that could not be read. Called by `loadData`, for the plan's own key only. */
export function keepUnreadable(text: string): void {
  const kept = readKept()
  // The same plan found again on the next open: kept already, and its date
  // is the first time it was found.
  if (kept?.text === text) return
  const next: UnreadablePlan = { keptAt: new Date().toISOString(), text }
  try {
    localStorage.setItem(UNREADABLE_KEY, JSON.stringify(next))
    heldPlan = null
  } catch {
    heldPlan = { ...next, held: true }
  }
  notify()
}

/** The plan kept aside, or held where it is, or null when there is none. */
export function unreadablePlan(): UnreadablePlan | null {
  return heldPlan ?? readKept()
}

/** A plan that could not be read and could not be kept aside is still under the plan's key: nothing may be saved over it. */
export function holdsSaves(): boolean {
  return heldPlan !== null
}

/** Lets it go - the person's choice, after saving it as a file or deciding it is not worth it. */
export function forgetUnreadable(): void {
  heldPlan = null
  try {
    localStorage.removeItem(UNREADABLE_KEY)
  } catch {
    // Nothing that cannot be read can be left behind by this either.
  }
  notify()
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function useUnreadablePlan(): UnreadablePlan | null {
  return useSyncExternalStore(subscribe, unreadablePlan)
}

/** Test seam: forgets the held copy, which lives in the module rather than in storage. */
export function resetUnreadableForTests(): void {
  heldPlan = null
  cachedRaw = undefined
  cached = null
}
