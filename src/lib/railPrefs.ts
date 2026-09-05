const PIN_KEY = 'dienius:rail-pinned'

/**
 * Whether the navigation rail is pinned open.
 *
 * A device fact, under its own key and so outside the backup and outside
 * sync - the same reasoning as the folded library lists and the quick-add
 * duration. How wide the navigation is is about the screen somebody is
 * looking at, not about the plan: a laptop at 1366 and a monitor at 2560
 * want different answers, and restoring a week-old snapshot has no business
 * changing either of them.
 *
 * The default is closed. A rail that opens open takes 152px from the content
 * on every screen for a set of labels somebody learns in a day - and it can
 * still be read at any moment by putting the pointer on it, which is what
 * makes closed the honest default rather than a stingy one.
 */
export function readRailPinned(): boolean {
  try {
    return localStorage.getItem(PIN_KEY) === '1'
  } catch {
    // A browser with site data blocked. The rail still works; it simply
    // forgets, which is the correct behaviour for a preference nothing
    // depends on.
    return false
  }
}

export function writeRailPinned(pinned: boolean): void {
  try {
    if (pinned) localStorage.setItem(PIN_KEY, '1')
    else localStorage.removeItem(PIN_KEY)
  } catch {
    // Ignored for the same reason.
  }
}
