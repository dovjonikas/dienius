/**
 * Whether this tab is running the tour in a sandbox.
 *
 * The same shape as demoMode.ts, for the same reason: a module with no
 * imports at all, because storage, sync and snapshots all have to ask it and
 * none of them may be imported back.
 *
 * A first-time person takes the tour on their real, empty plan, and what they
 * make during it is theirs to keep. Somebody replaying it from Settings has a
 * plan already, and a tour that stamps a starter template onto their Tuesday
 * is not a tour, it is damage. So a replay runs under its own storage key, an
 * empty app with the person's theme, and the key is thrown away on the way
 * out whatever they built in it.
 */

export const TOUR_STORAGE_KEY = 'dienius:tour'

/** Session-scoped, so closing the tab leaves the sandbox - see demoMode.ts. */
const SESSION_FLAG = 'dienius:tour-session'

let active = detect()

function detect(): boolean {
  try {
    if (typeof location !== 'undefined' && new URLSearchParams(location.search).get('tour') === '1') {
      sessionStorage.setItem(SESSION_FLAG, '1')
      return true
    }
    return sessionStorage.getItem(SESSION_FLAG) === '1'
  } catch {
    return typeof location !== 'undefined' && new URLSearchParams(location.search).get('tour') === '1'
  }
}

export function isTourSandbox(): boolean {
  return active
}

/** Turns the sandbox on and reloads, so every module reads the sandbox key from scratch. */
export function enterTourSandbox(): void {
  try {
    sessionStorage.setItem(SESSION_FLAG, '1')
    // A replay starts from the beginning even if the last one was left half
    // way; the sandbox is fresh, so the progress in it has to be too.
    localStorage.removeItem(TOUR_STORAGE_KEY)
    // The step counter too - see tourState.ts - or a replay abandoned at
    // step six last month would open an empty sandbox pointing at step six.
    localStorage.removeItem('dienius:tour-progress')
    // Replayed from inside demo mode, the sandbox would otherwise open under
    // a demo banner promising the wrong thing. The demo's own flag is named
    // here rather than imported, because this module imports nothing - see
    // the top of the file - and the two modes cannot be on at once.
    sessionStorage.removeItem('dienius:demo-session')
  } catch {
    // The URL parameter below carries the flag either way.
  }
  active = true
  if (typeof location !== 'undefined') location.href = withParam(location.href, true)
}

/** Leaves the sandbox and deletes it. Always - nothing made in it was ever meant to stay. */
export function exitTourSandbox(): void {
  try {
    sessionStorage.removeItem(SESSION_FLAG)
    localStorage.removeItem(TOUR_STORAGE_KEY)
  } catch {
    // Nothing downstream depends on it.
  }
  active = false
  if (typeof location !== 'undefined') location.href = withParam(location.href, false)
}

/** Test seam. */
export function setTourSandboxForTests(on: boolean): void {
  active = on
}

function withParam(href: string, on: boolean): string {
  const url = new URL(href)
  if (on) {
    url.searchParams.set('tour', '1')
    url.searchParams.delete('demo')
  } else {
    url.searchParams.delete('tour')
  }
  return url.toString()
}
