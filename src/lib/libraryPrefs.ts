const OPEN_KEY = 'dienius:library-open'

/**
 * Which lists are open, remembered between visits.
 *
 * A device fact, under its own key and so outside the backup and outside
 * sync - the same reasoning as the clock tools and the quick-add duration.
 * "Books is open and Watching is folded away" is about the screen somebody is
 * looking at, not about the plan: restoring a week-old snapshot has no
 * business folding a list, and a phone and a laptop are allowed to disagree.
 *
 * Remembered at all because the Library is the one screen in this app that is
 * genuinely long. Eight lists of a dozen items each, all open, is a page
 * nobody can find anything on; and re-folding six of them every single visit
 * is the papercut that makes people stop opening the tab.
 */
function read(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(OPEN_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {}
    const out: Record<string, boolean> = {}
    for (const [id, value] of Object.entries(parsed)) {
      if (typeof value === 'boolean') out[id] = value
    }
    return out
  } catch {
    return {}
  }
}

/**
 * Whether a list opens open.
 *
 * The default is the interesting half. A brand new list, and every list on a
 * device that has never been told otherwise, opens *open* - a folded list
 * nobody asked to fold reads as an empty app. It is only the folding that is
 * worth remembering.
 */
export function isListOpen(listId: string): boolean {
  return read()[listId] ?? true
}

export function rememberListOpen(listId: string, open: boolean): void {
  try {
    localStorage.setItem(OPEN_KEY, JSON.stringify({ ...read(), [listId]: open }))
  } catch {
    // Best effort: a device that cannot remember simply opens everything.
  }
}

// --- what each list was last counted in -----------------------------------------

const SHAPE_KEY = 'dienius:library-shape'

/**
 * The track the add line opens on, per list, remembered on this device.
 *
 * A Books list is counted in chapters, and the owner counts in pages: after
 * the first page-counted book the control opens on pages, because the
 * next one will be too. The same shape as the folded lists above - a device
 * habit, outside the backup and outside sync - and the same reasoning as
 * quick-add remembering a length.
 */
export function readLastTrack(listId: string): 'pages' | 'movie' | 'series' | undefined {
  try {
    const raw = localStorage.getItem(SHAPE_KEY)
    if (!raw) return undefined
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return undefined
    const value = (parsed as Record<string, unknown>)[listId]
    return value === 'pages' || value === 'movie' || value === 'series' ? value : undefined
  } catch {
    return undefined
  }
}

export function rememberLastTrack(listId: string, track: 'pages' | 'movie' | 'series' | undefined): void {
  try {
    const raw = localStorage.getItem(SHAPE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : {}
    const map = typeof parsed === 'object' && parsed !== null ? { ...(parsed as Record<string, unknown>) } : {}
    if (track === undefined) delete map[listId]
    else map[listId] = track
    localStorage.setItem(SHAPE_KEY, JSON.stringify(map))
  } catch {
    // A forgotten habit is one extra tap next time, not a lost plan.
  }
}
