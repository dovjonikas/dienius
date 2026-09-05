import { useEffect, useRef, useState } from 'react'
import { useRestoreFocus } from '../../lib/useRestoreFocus'
import { formatDuration } from './capacity'
import { allRows, hasNothingForGap, visibleRows, type GapOffer } from './gapPlacement'

export interface GapPickerProps {
  /** The gap's own label, e.g. "1h30 free, 13:00 to 14:30" - also the dialog's accessible name. */
  gapLabel: string
  offer: GapOffer
  /** Called with the tapped float's task id. The caller places it and closes the sheet. */
  onPlace: (taskId: string) => void
  onClose: () => void
}

const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

/**
 * The sheet a tapped gap opens: docs/TIMELINE.md section 5, "tapping it
 * offers the floats that fit, and one tap places one." A small modal
 * dialog rather than an inline expansion, because the grid it opens from
 * scrolls in its own capped-height box (`.timeline-grid-scroll`) - content
 * expanding inline there would either get clipped or fight that scroll
 * container, and a bottom sheet is the one presentation that works the same
 * way at 375px regardless of where in the grid the tapped gap happens to
 * sit.
 *
 * Caps what it shows to `VISIBLE_ROW_LIMIT` rows before asking - see that
 * constant's own comment in gapPlacement.ts for why. "Show N more" reveals
 * the rest in place rather than a second screen, so the choice to see more
 * stays cheap and reversible.
 *
 * A plain, hand-rolled dialog: focus moves to the dialog itself on open
 * (there is no single obvious default control - a row, if any exist, is no
 * more "the" answer than Close is), Escape and the scrim close it, and Tab
 * is trapped to the sheet's own controls so a keyboard user cannot Tab out
 * into the grid or page behind it while it is open.
 */
export function GapPicker({ gapLabel, offer, onPlace, onClose }: GapPickerProps) {
  useRestoreFocus()
  const dialogRef = useRef<HTMLDivElement>(null)
  const [expanded, setExpanded] = useState(false)
  const empty = hasNothingForGap(offer)
  const rows = expanded ? allRows(offer) : visibleRows(offer)
  const hiddenCount = allRows(offer).length - rows.length

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
      {/* Pointer-only dismiss, deliberately outside the tab order - Escape
          and the explicit Close button already cover keyboard dismissal,
          and the scrim's only job is to feel like tapping "away" on a
          touchscreen. aria-hidden keeps it out of the accessibility tree
          entirely rather than announcing it as an unlabeled control. */}
      <button type="button" className="gap-picker-scrim" aria-hidden="true" tabIndex={-1} onClick={onClose} />
      <div
        className="gap-picker"
        role="dialog"
        aria-modal="true"
        aria-label={gapLabel}
        ref={dialogRef}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        <div className="gap-picker-header">
          <h3 className="gap-picker-title">{gapLabel}</h3>
          <button type="button" className="gap-picker-close" aria-label="Close" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="gap-picker-body">
          {empty ? (
            <p className="gap-picker-empty">Nothing fits here.</p>
          ) : (
            <>
              <ul className="gap-picker-list">
                {rows.map(row => {
                  const sizeLabel = row.minutes !== undefined ? formatDuration(row.minutes) : 'size unknown'
                  return (
                    <li key={row.id}>
                      <button
                        type="button"
                        className="gap-picker-row"
                        aria-label={`Place ${row.title}, ${sizeLabel}`}
                        onClick={() => onPlace(row.id)}
                      >
                        <span className="gap-picker-row-title">{row.title}</span>
                        <span className="gap-picker-row-size">{sizeLabel}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
              {!expanded && hiddenCount > 0 && (
                <button type="button" className="gap-picker-more" onClick={() => setExpanded(true)}>
                  {`Show ${hiddenCount} more`}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}

