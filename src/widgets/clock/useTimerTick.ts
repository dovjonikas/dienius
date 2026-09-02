import { useEffect, useState } from 'react'

const BASE_TITLE = 'Dienius'

/**
 * The clock everything visible counts against, kept honest across a tab
 * nobody is looking at.
 *
 * Three things are going on, and only the first is obvious:
 *
 * 1. **A tick.** Half a second while something is running, so a countdown
 *    reads smoothly. Nothing is accumulated - every reading is derived from
 *    `Date.now()` against a stored instant (see `clockTools`), so a tick that
 *    is skipped, late, or throttled to once a minute costs nothing but
 *    smoothness. That was already true; it is why this can be so casual.
 *
 * 2. **A deadline.** A background tab has its intervals clamped hard - a
 *    500ms interval can end up firing once a minute - so the tick alone
 *    cannot be trusted to notice a timer running out anywhere near on time.
 *    A single `setTimeout` scheduled for the exact remaining time is treated
 *    far more kindly by every engine, so the moment a timer is due, one fires
 *    and the alarm goes off then rather than up to a minute later.
 *
 * 3. **Coming back.** `visibilitychange` resyncs immediately, so a tab
 *    switched back to is right on the first frame instead of on the next
 *    tick - which, after a long spell in the background, could be a while.
 */
export function useTimerTick(running: boolean, deadlineMs: number | null): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [running])

  useEffect(() => {
    if (deadlineMs === null) return
    const wait = deadlineMs - Date.now()
    if (wait <= 0) {
      setNow(Date.now())
      return
    }
    // A few milliseconds past the deadline rather than exactly on it: a
    // timeout that fires a hair early would leave the remaining time at 1ms
    // and take another whole tick to notice.
    const id = setTimeout(() => setNow(Date.now()), wait + 20)
    return () => clearTimeout(id)
  }, [deadlineMs])

  useEffect(() => {
    function resync() {
      if (!document.hidden) setNow(Date.now())
    }
    document.addEventListener('visibilitychange', resync)
    window.addEventListener('focus', resync)
    return () => {
      document.removeEventListener('visibilitychange', resync)
      window.removeEventListener('focus', resync)
    }
  }, [])

  return now
}

/**
 * Puts the countdown in the tab title, and takes it back out.
 *
 * The one thing a browser will still show for a tab nobody is looking at.
 * Notifications need a permission that may never be granted and a sound
 * needs a tab that is allowed to make one; a title is neither, it is just
 * there, and on a laptop with a row of tabs it is often the only way the
 * timer is visible at all.
 *
 * Restores the plain title on unmount and whenever nothing is running, so a
 * finished timer does not leave a stale number in the tab for the rest of
 * the session.
 */
export function useTitleCountdown(text: string | null): void {
  useEffect(() => {
    document.title = text ? `${text} - ${BASE_TITLE}` : BASE_TITLE
    return () => {
      document.title = BASE_TITLE
    }
  }, [text])
}
