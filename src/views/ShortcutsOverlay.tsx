import { useEffect, useRef } from 'react'
import { useRestoreFocus } from '../lib/useRestoreFocus'
import { SHORTCUTS } from '../lib/shortcuts'

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

/**
 * The shortcut card, opened with "?".
 *
 * Every shortcut in this app is listed here and nowhere else - there is no
 * second copy in a tooltip or a settings page to fall out of step, because
 * this renders straight from the same `SHORTCUTS` array the handler reads.
 * A shortcut added without a description simply cannot exist.
 */
export interface ShortcutsOverlayProps {
  onClose: () => void
  /**
   * Start the tour from here. This card is where somebody goes when they are
   * already lost, which makes it the one place in the app where offering a
   * two-minute walkthrough is a help rather than an interruption.
   */
  onStartTour: () => void
}

export function ShortcutsOverlay({ onClose, onStartTour }: ShortcutsOverlayProps) {
  useRestoreFocus()
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    panelRef.current?.focus()
  }, [])

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onClose()
      return
    }
    if (e.key !== 'Tab') return
    const focusable = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  return (
    <div className="shortcuts-scrim" onClick={onClose}>
      <div
        className="shortcuts"
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        tabIndex={-1}
        ref={panelRef}
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="shortcuts-head">
          <h2>Keyboard</h2>
          <button type="button" className="task-detail-close" aria-label="Close shortcuts" onClick={onClose}>
            &times;
          </button>
        </div>
        <dl className="shortcuts-list">
          {SHORTCUTS.map(s => (
            <div key={s.key}>
              <dt>
                <kbd>{s.label}</kbd>
              </dt>
              <dd>{s.description}</dd>
            </div>
          ))}
        </dl>
        <p className="shortcuts-note">
          Single keys, so none of them fire while you are typing in a box - except Escape, which is usually
          how you leave the box.
        </p>
        <p className="shortcuts-tour">
          <button type="button" className="btn-secondary" onClick={onStartTour}>
            Take the tour
          </button>
          <span className="muted">Two minutes, nine real actions, on your own day.</span>
        </p>
      </div>
    </div>
  )
}
