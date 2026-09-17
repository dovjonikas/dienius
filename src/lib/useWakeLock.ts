import { useEffect } from 'react'

/** The one part of a wake lock this app holds on to: letting it go. */
interface WakeLockSentinelLike {
  release(): Promise<void>
}

/** A navigator that may have the Screen Wake Lock API. */
type NavigatorWithWakeLock = Navigator & {
  wakeLock?: { request(type: 'screen'): Promise<WakeLockSentinelLike> }
}

/**
 * Keeps the screen from dimming while `active` - Cook, since v2.27, where a
 * recipe is read at arm's length with wet hands.
 *
 * Through the Screen Wake Lock API where the browser has it. Where it does
 * not, or where it refuses - a battery saver, a page out of view - nothing
 * is said and nothing breaks: the screen dims the way it always did. A lock
 * is let go by the browser whenever the page leaves view, so it is asked for
 * again each time the page comes back, and every lock this handed out is
 * released when `active` ends.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active) return
    const wakeLock = (navigator as NavigatorWithWakeLock).wakeLock
    if (!wakeLock) return

    const held: WakeLockSentinelLike[] = []
    let ended = false

    const release = (lock: WakeLockSentinelLike) => {
      lock.release().catch(() => {})
    }

    const ask = () => {
      wakeLock
        .request('screen')
        .then(lock => {
          if (ended) release(lock)
          else held.push(lock)
        })
        .catch(() => {})
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') ask()
    }

    ask()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      ended = true
      document.removeEventListener('visibilitychange', onVisibility)
      for (const lock of held) release(lock)
    }
  }, [active])
}
