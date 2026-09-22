import type { AppData } from './types'
import { collectEntities } from './syncEntities'

/**
 * The instant a change is stamped with.
 *
 * Sync decides between two versions of a thing by which of them was changed
 * later, so a stamp is a claim about order - and a device's own clock is a
 * poor witness to the order of things on two devices. Five minutes slow,
 * and an edit made after reading the other device's version was stamped
 * before it, and lost to it on the next sync, on both devices
 * (docs/SYNC-AUDIT.md, path 6).
 *
 * Two corrections, both cheap:
 *
 * 1. **Never behind anything seen.** A stamp is at least a millisecond after
 *    the newest stamp this device has read, in its own plan or in the other
 *    device's - a hybrid logical clock. Whatever the wall clock says, a
 *    change made after seeing another is stamped after it.
 * 2. **GitHub's clock, where GitHub says what it reads.** Every write to the
 *    repo comes back with its commit's time, which is GitHub's; when this
 *    device's clock is more than a couple of seconds from it, the difference
 *    is added to every stamp after. Two devices minutes apart then stamp on
 *    one clock, and the first rule is left with milliseconds to settle.
 */

const OFFSET_KEY = 'dienius:clock-offset'

/**
 * A difference smaller than this is the request's own time in the air and
 * GitHub's second-wide stamp, not a clock that is wrong.
 */
const OFFSET_NOISE_MS = 2000

/**
 * A stamp further ahead of now than this is not taken as a floor. One device
 * with its date a year out must not drag every stamp after it a year out
 * too - which is what a floor that believed anything would do, for good.
 */
const FLOOR_AHEAD_MAX_MS = 24 * 60 * 60_000

let floor = 0
let offset = loadOffset()

function loadOffset(): number {
  try {
    const raw = Number(localStorage.getItem(OFFSET_KEY))
    return Number.isFinite(raw) ? raw : 0
  } catch {
    return 0
  }
}

function saveOffset(): void {
  try {
    if (offset === 0) localStorage.removeItem(OFFSET_KEY)
    else localStorage.setItem(OFFSET_KEY, String(offset))
  } catch {
    // A device that cannot keep it asks GitHub again on its next write.
  }
}

/** This device's best reading of the time: its clock, corrected by GitHub's. */
function wallNow(): number {
  return Date.now() + offset
}

/** The stamp for a change made now. Each call is after the one before it. */
export function stampNow(): string {
  const at = Math.max(wallNow(), floor + 1)
  floor = at
  return new Date(at).toISOString()
}

/** A stamp this device has read. Anything stamped here from now on is after it. */
export function sawStamp(stamp: string | undefined): void {
  if (!stamp) return
  const at = Date.parse(stamp)
  if (!Number.isFinite(at) || at <= floor) return
  if (at > wallNow() + FLOOR_AHEAD_MAX_MS) return
  floor = at
}

/** Every stamp in a plan, as read: on load, and on every plan that arrives. */
export function sawPlan(data: AppData): void {
  sawStamp(newestStamp(data) ?? undefined)
}

/** The latest instant anything in a plan was changed or deleted, or null for a plan never touched. */
export function newestStamp(data: AppData): string | null {
  let newest: string | null = null
  for (const entity of collectEntities(data).values()) {
    if (entity.updatedAt && (newest === null || entity.updatedAt > newest)) newest = entity.updatedAt
  }
  for (const at of Object.values(data.tombstones ?? {})) {
    if (newest === null || at > newest) newest = at
  }
  return newest
}

/**
 * What GitHub's clock read, from a commit it just made.
 *
 * `sentAt` and `receivedAt` are this device's clock either side of the
 * request; GitHub took its reading somewhere between, and the middle is the
 * best guess. Its time is to the second, so its middle is half a second on.
 */
export function sawServerTime(serverTime: string, sentAt: number, receivedAt: number): void {
  const server = Date.parse(serverTime)
  if (!Number.isFinite(server)) return
  const difference = server + 500 - (sentAt + receivedAt) / 2
  offset = Math.abs(difference) > OFFSET_NOISE_MS ? Math.round(difference) : 0
  saveOffset()
}

/** Test seam: no floor, and no difference from GitHub. */
export function resetClockForTests(): void {
  floor = 0
  offset = 0
  saveOffset()
}
