import { useEffect, useRef } from 'react'
import type React from 'react'
import { useRestoreFocus } from '../../lib/useRestoreFocus'

const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

/**
 * The small panel that hangs off a header button.
 *
 * Three of them now - the clock, notes and the journal - where there was one
 * with four tabs in it. The shell is the part they genuinely share: a scrim
 * that closes on a press outside, a dialog that takes focus on open and
 * gives it back on close, Escape, and a Tab that cannot walk out of the
 * panel while it is up.
 *
 * Lifted out when the tabs came off rather than copied three times. Every
 * one of those behaviours is easy to leave out of the second and third copy
 * of a thing, and a panel somebody can Tab out of while it is still covering
 * the page is a panel that has quietly stopped being a dialog.
 */
export interface HeaderPopoverProps {
  /** What the panel is, for the dialog's own label. */
  label: string
  /** A class of its own beside `header-popover`, for the panel's own width and spacing. */
  className?: string
  onClose: () => void
  children: React.ReactNode
}

export function HeaderPopover({ label, className, onClose, children }: HeaderPopoverProps) {
  useRestoreFocus()
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    panelRef.current?.focus()
  }, [])

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
      return
    }
    if (e.key !== 'Tab') return
    const focusables = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    if (!focusables || focusables.length === 0) return
    const list = Array.from(focusables)
    const first = list[0]
    const last = list[list.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  return (
    <>
      <button type="button" className="clock-scrim" aria-hidden="true" tabIndex={-1} onClick={onClose} />
      <div
        className={className ? `clock-popover ${className}` : 'clock-popover'}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        ref={panelRef}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        {children}
      </div>
    </>
  )
}
