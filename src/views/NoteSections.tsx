import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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
 *
 * **An open intro is four lines and a way in.** A forty-line recipe with
 * "show this without opening it" set on it pushed the rest of the day off
 * the screen, which is a note deciding how much of the day you get to see.
 * Four lines, then Read, and the whole of it in the same reader the choices
 * open into - so a long note costs the card the same four lines whatever is
 * in it.
 */

/** How many headings fit on a card before the rest go behind a count. */
const SHOWN = 4

/**
 * How much of an open intro a card shows before it is cut.
 *
 * Counted in lines somebody typed rather than in lines the browser drew:
 * `NoteLines` draws one paragraph per typed line, so four here is four
 * paragraphs, and it is the same four on a phone as on a desktop. The one
 * thing it does not catch is a single typed line long enough to wrap past
 * four - which is a paragraph, and this does not cut paragraphs in half. The
 * rule that matters is the other way round and it holds either way: nothing
 * is hidden without a way to read it.
 */
const INTRO_LINES = 4

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

  const introLines = intro.split('\n')
  const introCut = showIntro && introLines.length > INTRO_LINES

  /**
   * What the reader can turn to, in the order it is drawn on the card.
   *
   * The intro is one of them only while it is showing here. Behind the mark
   * it has its own way in - the mark - and a tab for it in a reader opened
   * off a heading would be a second door to a room nobody asked about.
   */
  const pages: ReaderPage[] = showIntro
    ? [{ title: label, body: intro, isIntro: true }, ...sections.map(toPage)]
    : sections.map(toPage)
  const first = showIntro ? 1 : 0

  return (
    <div className={className ? `note-sections ${className}` : 'note-sections'}>
      {showIntro && (
        <>
          <NoteLines text={introCut ? introLines.slice(0, INTRO_LINES).join('\n') : intro} />
          {introCut && (
            <div className="note-intro-more">
              <button
                type="button"
                className="note-section-button is-read"
                aria-label={`Read the whole note on ${label}`}
                onClick={() => setReading(0)}
              >
                Read
              </button>
            </div>
          )}
        </>
      )}
      {sections.length > 0 && (
        <div className="note-section-row">
          {shown.map((section, i) => (
            <button
              key={i}
              type="button"
              className="note-section-button"
              aria-label={`${section.title}, on ${label}`}
              onClick={() => setReading(first + i)}
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
              onClick={() => setReading(first + SHOWN)}
            >
              +{hidden}
            </button>
          )}
        </div>
      )}
      {reading !== null && (
        <NoteReader
          pages={pages}
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
 * One page of a note, full size, with the others a press away.
 *
 * A page is a `## ` section, or the note's own opening where that is being
 * shown on the card - the opening is the reason this reader exists at all
 * for a note that has no headings in it.
 *
 * Read-only, deliberately. A note is edited where it is written - in the
 * block or the task - and an editable copy on the day would be a second
 * place the same text lives.
 */
function NoteReader({
  pages,
  at,
  label,
  onMove,
  onClose,
}: {
  pages: ReaderPage[]
  at: number
  label: string
  onMove: (index: number) => void
  onClose: () => void
}) {
  useRestoreFocus()
  const box = useRef<HTMLDivElement>(null)
  const section = pages[at]

  useEffect(() => {
    box.current?.focus()
  }, [])

  // Drawn in the window, not where it was written - the same move, and the
  // same reason, as the tooltip in TipLayer (CONVENTIONS 24). A scrim pinned
  // to the viewport is only pinned to it while no ancestor has claimed it,
  // and a task card sits inside two things that do: the task list is faded
  // top and bottom with a `mask-image`, which makes it a stacking context,
  // and the card's own arrival animation left an identity `transform` behind
  // it, which makes it a containing block. So this had been drawn inside a
  // 318px card in the scrolling column since v2.13, under the timeline,
  // with the comment on `.note-reader-scrim` saying it was over the day.
  // The fill mode is fixed as well - see `task-enter` in the stylesheet -
  // but a modal has no business depending on what its opener is painted in.
  return createPortal(
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
        // The opening has no heading of its own and borrows the name of what
        // it belongs to, so naming it "Lunch, on Lunch" would be that name
        // twice in one breath.
        aria-label={section.isIntro ? `The note on ${label}` : `${section.title}, on ${label}`}
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
        {pages.length > 1 && (
          <div className="note-reader-tabs" role="group" aria-label="The other sections">
            {pages.map((s, i) => (
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
    </div>,
    document.body,
  )
}

/**
 * One thing the reader can be turned to.
 *
 * `isIntro` is the whole of the difference: an opening has no heading of
 * its own, so it borrows the name of what it belongs to for the tab and the
 * title, and says so to anybody listening rather than repeating that name
 * twice in one breath.
 */
interface ReaderPage extends NoteSection {
  isIntro?: boolean
}

function toPage(section: NoteSection): ReaderPage {
  return section
}
