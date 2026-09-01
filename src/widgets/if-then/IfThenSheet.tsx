import { useEffect, useRef } from 'react'
import { IfThenBoard } from './IfThenBoard'

export interface IfThenSheetProps {
  onClose: () => void
}

const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

/**
 * The full if-then list, opened by tapping the one rule the day view
 * surfaces - docs/TIMELINE.md section 6: "tapping it opens the full list,
 * which is where editing lives." A bottom sheet rather than a page of its
 * own, the same presentation `GapPicker.tsx` already established for this
 * app's other tap-to-open-more interaction, and for the same reason: it
 * works the same way at 375px regardless of where on the page the tap
 * happened.
 *
 * A plain, hand-rolled dialog, mirroring `GapPicker.tsx` exactly: focus
 * moves to the dialog itself on open, Escape and the scrim close it, and
 * Tab is trapped to the sheet's own controls. `IfThenBoard`'s own form
 * already moves focus into its trigger field the moment it opens - that
 * behaviour is unchanged and unaffected by living inside this wrapper.
 */
export function IfThenSheet({ onClose }: IfThenSheetProps) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    dialogRef.current?.focus()
  }, [])

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
      return
    }
    if (e.key !== 'Tab') return
    const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
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
      <button type="button" className="if-then-sheet-scrim" aria-hidden="true" tabIndex={-1} onClick={onClose} />
      <div
        className="if-then-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="If-then rules"
        ref={dialogRef}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        <div className="if-then-sheet-header">
          <button type="button" className="if-then-sheet-close" aria-label="Close" onClick={onClose}>
            &times;
          </button>
        </div>
        <IfThenBoard />
      </div>
    </>
  )
}
