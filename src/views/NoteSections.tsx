import { useEffect, useRef, useState } from 'react'
import { parseNote, sectionLabel, type NoteSection } from '../lib/note'
import { useRestoreFocus } from '../lib/useRestoreFocus'
import { NoteLines } from './NoteLines'

/**
 * A note's choices, as buttons, and the one that is open.
 *
 * A block that carries three recipes is three choices. Showing all three at
 * once is the thing this replaces - one long note nobody scrolls - and
 * hiding them behind the note mark is barely better, because then the card
 * cannot say there are three. So the headings are on the card and the text
 * is one press away.
 *
 * A note with no `## ` line has no choices in it and behaves exactly as it
 * did: the intro is the note, behind the mark unless the block says to show
 * it. See `lib/note.ts` for the one rule this reads.
 */

/** How many headings fit on a card before the rest go behind a count. */
const SHOWN = 4

export function NoteSections({
  note,
  /** Whether the intro shows without a press - see `Task.noteExpanded`. */
  expanded = false,
  /** Whether the mark beside the title has been pressed. */
  open = false,
  /** What this note belongs to, for anybody listening rather than looking. */
  label,
  className,
}: {
  note: string | undefined
  expanded?: boolean
  open?: boolean
  label: string
  className?: string
}) {
  const [reading, setReading] = useState<number | null>(null)
  const { intro, sections } = parseNote(note)
  const showIntro = intro !== '' && (expanded || open)

  if (!showIntro && sections.length === 0) return null

  const shown = sections.length > SHOWN ? sections.slice(0, SHOWN) : sections
  const hidden = sections.length - shown.length

  return (
    <div className={className ? `note-sections ${className}` : 'note-sections'}>
      {showIntro && <NoteLines text={intro} />}
      {sections.length > 0 && (
        <div className="note-section-row">
          {shown.map((section, i) => (
            <button
              key={i}
              type="button"
              className="note-section-button"
              aria-label={`${section.title}, on ${label}`}
              onClick={() => setReading(i)}
            >
              {sectionLabel(section.title)}
            </button>
          ))}
          {hidden > 0 && (
            <button
              type="button"
              className="note-section-button is-more"
              aria-label={`${hidden} more on ${label}`}
              // Opens on the first of the ones it stands for, with the list
              // beside it - so the count is a way in rather than a dead end.
              onClick={() => setReading(SHOWN)}
            >
              +{hidden}
            </button>
          )}
        </div>
      )}
      {reading !== null && (
        <NoteReader
          sections={sections}
          at={reading}
          label={label}
          onMove={setReading}
          onClose={() => setReading(null)}
        />
      )}
    </div>
  )
}

/**
 * One section, full size, with the others a press away.
 *
 * Read-only, deliberately. A note is edited where it is written - in the
 * block or the task - and an editable copy on the day would be a second
 * place the same text lives.
 */
function NoteReader({
  sections,
  at,
  label,
  onMove,
  onClose,
}: {
  sections: NoteSection[]
  at: number
  label: string
  onMove: (index: number) => void
  onClose: () => void
}) {
  useRestoreFocus()
  const box = useRef<HTMLDivElement>(null)
  const section = sections[at]

  useEffect(() => {
    box.current?.focus()
  }, [])

  return (
    <div
      className="note-reader-scrim"
      // A press on the ground behind it, which is one of the three ways out.
      onClick={e => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="note-reader"
        role="dialog"
        aria-modal="true"
        aria-label={`${section.title}, on ${label}`}
        ref={box}
        tabIndex={-1}
        data-keeps-keys=""
        onKeyDown={e => {
          if (e.key === 'Escape') {
            e.stopPropagation()
            onClose()
            return
          }
          // Held here rather than left to the browser: a modal that lets Tab
          // walk out of it is a modal in name only.
          if (e.key !== 'Tab') return
          const focusable = box.current?.querySelectorAll<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])')
          if (!focusable || focusable.length === 0) return
          const first = focusable[0]
          const last = focusable[focusable.length - 1]
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault()
            last.focus()
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault()
            first.focus()
          }
        }}
      >
        <div className="note-reader-head">
          <h2 className="note-reader-title">{section.title}</h2>
          <button type="button" className="task-detail-close" aria-label="Close" onClick={onClose}>
            &times;
          </button>
        </div>

        {/* Every other choice, so reading a second one is a press rather than
            closing this and finding the card again. */}
        {sections.length > 1 && (
          <div className="note-reader-tabs" role="group" aria-label="The other sections">
            {sections.map((s, i) => (
              <button
                key={i}
                type="button"
                className={i === at ? 'note-reader-tab is-on' : 'note-reader-tab'}
                aria-pressed={i === at}
                onClick={() => onMove(i)}
              >
                {sectionLabel(s.title)}
              </button>
            ))}
          </div>
        )}

        <div className="note-reader-body">
          {section.body === '' ? <p className="muted">Nothing written under this one.</p> : <NoteLines text={section.body} />}
        </div>
      </div>
    </div>
  )
}
