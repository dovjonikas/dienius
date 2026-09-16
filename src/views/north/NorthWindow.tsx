import { useEffect, useRef, useState } from 'react'
import { useAppData } from '../../lib/store'
import { parseNorth } from '../../lib/northSections'
import { arriveAtNorth, leaveNorth } from '../../lib/northRead'
import { isDemoMode } from '../../lib/demoMode'
import { useRestoreFocus } from '../../lib/useRestoreFocus'

/**
 * Whether the window after sleep is open, and the way to close it.
 *
 * The rule is northRead.ts's; this is only where the app tells it that it is
 * in view: once on opening, again whenever it comes back into view, and on a
 * slow tick while it stays there, so the last moment it was seen is always
 * current. A tick that comes back hours late - a laptop that slept with the
 * app on screen - is the gap arriving, and opens the window then. Leaving
 * view writes the moment the break starts from.
 */
export function useNorthAfterSleep(): { open: boolean; close: () => void } {
  const data = useAppData()
  const [open, setOpen] = useState(false)
  // Read by the listeners below, which belong to the first render: the text
  // and the switch are whatever they are when the app comes into view.
  const terms = useRef({ intro: false, enabled: true })
  terms.current = {
    intro: parseNorth(data.picture?.text ?? '').intro.length > 0,
    enabled: data.settings.north.windowAfterSleep !== false,
  }

  useEffect(() => {
    const demo = isDemoMode()
    // Leaving is only leaving from in view. A tab closed while it was already
    // out of view fires pagehide too, and writing the moment then would
    // start the break over from the closing instead of from when the app was
    // last looked at.
    let inView = false
    const arrive = () => {
      if (document.visibilityState === 'hidden') return
      inView = true
      if (arriveAtNorth(Date.now(), { ...terms.current, demo })) setOpen(true)
    }
    const leave = () => {
      if (!inView) return
      inView = false
      leaveNorth(Date.now(), demo)
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') leave()
      else arrive()
    }
    arrive()
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', leave)
    const tick = window.setInterval(arrive, 60_000)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', leave)
      window.clearInterval(tick)
    }
  }, [])

  return { open, close: () => setOpen(false) }
}

/**
 * North's introduction and signature, over the day, once after sleep.
 *
 * The introduction is the part of the text written to be read whole, and
 * the day never shows it; this is where it is read, at the one moment of
 * the day it is for. The headings stay on the day and on the page. The
 * signature closes it, the way it closes the page.
 *
 * One button, and Escape and a press outside do the same: it closes. No
 * timer, no tick, nothing that notices whether it was read - a window that
 * checked would be a window that had to be passed, and this is one that is
 * simply there when somebody arrives. The day is already under it.
 */
export function NorthWindow({ onClose }: { onClose: () => void }) {
  const data = useAppData()
  const { intro, signature } = parseNorth(data.picture?.text ?? '')
  // Focus comes to the window and goes back where it was when it closes -
  // CONVENTIONS section 6, a sheet hands focus back.
  useRestoreFocus()
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.focus()
  }, [])

  return (
    <div className="north-scrim" onClick={onClose}>
      <div
        ref={ref}
        className="north-window"
        role="dialog"
        aria-modal="true"
        aria-label="North"
        tabIndex={-1}
        data-keeps-keys=""
        onClick={e => e.stopPropagation()}
        onKeyDown={e => {
          if (e.key !== 'Escape') return
          e.stopPropagation()
          onClose()
        }}
      >
        <div className="north-window-intro">
          {intro.map((paragraph, i) => (
            <p key={i} className="north-paragraph">
              {paragraph}
            </p>
          ))}
        </div>
        {signature.length > 0 && (
          <div className="north-window-signature">
            {signature.map((paragraph, i) => (
              <p key={i} className="north-paragraph">
                {paragraph}
              </p>
            ))}
          </div>
        )}
        <div className="north-actions">
          <button type="button" className="btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
