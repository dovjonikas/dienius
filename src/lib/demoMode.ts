/**
 * Whether this tab is running on sample data.
 *
 * Deliberately its own module with no imports at all, because almost
 * everything else has to ask it: storage picks a different key, snapshots stop
 * being written, sync stops running. A module that low in the graph cannot
 * afford to import anything that might one day import it back.
 *
 * The isolation is a separate storage key, not a flag inside the data. That is
 * the only version of this that is actually safe: a bug in demo mode cannot
 * touch a real plan, because a real plan is not in the file demo mode has open.
 */

/** Where the sample data lives. Never the same key as the real thing. */
export const DEMO_STORAGE_KEY = 'dienius:demo'

/**
 * Session storage, not local: closing the tab leaves demo mode, and a second
 * tab on the same browser can be looking at the real plan at the same time.
 * The URL parameter is what a link carries; this is what survives clicking
 * around inside the app once you are in.
 */
const SESSION_FLAG = 'dienius:demo-session'

let active = detect()

function detect(): boolean {
  try {
    if (typeof location !== 'undefined' && new URLSearchParams(location.search).get('demo') === '1') {
      sessionStorage.setItem(SESSION_FLAG, '1')
      return true
    }
    return sessionStorage.getItem(SESSION_FLAG) === '1'
  } catch {
    // A browser refusing session storage is a browser that gets one page of
    // demo and no memory of it. Better than refusing to load.
    return typeof location !== 'undefined' && new URLSearchParams(location.search).get('demo') === '1'
  }
}

export function isDemoMode(): boolean {
  return active
}

/** Turns demo mode on and reloads, so every module reads the demo key from scratch. */
export function enterDemoMode(): void {
  try {
    sessionStorage.setItem(SESSION_FLAG, '1')
  } catch {
    // Falls back to the URL parameter below, which works either way.
  }
  active = true
  if (typeof location !== 'undefined') location.href = withDemoParam(location.href)
}

/**
 * Leaves demo mode, throwing the sample data away.
 *
 * The data goes rather than being kept for next time. Sample data is a thing
 * you look at once; a half-finished demo week waiting behind a link a month
 * later is clutter nobody asked to keep, and this way there is exactly one
 * place demo data can ever be - deleted on the way out.
 */
export function exitDemoMode(): void {
  try {
    sessionStorage.removeItem(SESSION_FLAG)
    localStorage.removeItem(DEMO_STORAGE_KEY)
  } catch {
    // Nothing to do about it, and nothing downstream depends on it.
  }
  active = false
  if (typeof location !== 'undefined') location.href = withoutDemoParam(location.href)
}

/** Test seam. */
export function setDemoModeForTests(on: boolean): void {
  active = on
}

function withDemoParam(href: string): string {
  const url = new URL(href)
  url.searchParams.set('demo', '1')
  return url.toString()
}

function withoutDemoParam(href: string): string {
  const url = new URL(href)
  url.searchParams.delete('demo')
  return url.toString()
}
