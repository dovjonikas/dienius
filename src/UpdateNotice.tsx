import { useEffect, useState } from 'react'
import { onUpdateReady } from './pwa'

/**
 * A quiet, non-blocking notice that a new build has taken over in the
 * background and is ready to show. It never reloads on its own - "Reload"
 * is the one action available here, so the reload always happens because
 * someone chose it, never while they are mid-keystroke or looking at an
 * open sheet. Ignoring it is a valid outcome: nothing else changes, it
 * does not return, blink, or time out, and it never blocks the day view
 * underneath it.
 *
 * `role="status"` (an implicit polite, atomic live region) rather than
 * `role="alert"`: this is routine information, not something urgent
 * enough to interrupt whatever a screen reader is already announcing, and
 * the notice never receives focus on its own - a person reaches its
 * button by choice, on their own next tab press, not because the app
 * pulled focus there.
 */
export function UpdateNotice() {
  const [ready, setReady] = useState(false)

  useEffect(() => onUpdateReady(() => setReady(true)), [])

  if (!ready) return null

  return (
    <div className="update-notice" role="status">
      <p>An update is ready.</p>
      <button type="button" onClick={() => window.location.reload()}>
        Reload
      </button>
    </div>
  )
}
