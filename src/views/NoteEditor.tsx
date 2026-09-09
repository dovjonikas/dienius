import { useLayoutEffect, useRef } from 'react'
import { insertSectionHeading, parseNote } from '../lib/note'
import { NoteSections } from './NoteSections'

/**
 * The one box a note is typed into, and the three things it says about
 * itself.
 *
 * `lib/note.ts` has read `## ` as a heading since v2.13 and the card has
 * drawn those headings as choices for just as long - but the editor was an
 * empty textarea with a sentence in it about words, so the owner used the
 * app for a week without knowing the rule was there. A feature nothing on
 * the screen mentions does not exist. Nothing here is new behaviour: this is
 * the editor saying what the parser already does.
 *
 * Three ways it says it, in the order somebody meets them:
 *
 * 1. **The placeholder is an example, not an instruction.** A recipe with a
 *    second one under a `## ` line. A person copying the shape of what is in
 *    front of them learns the rule without reading a sentence about it, and
 *    the rule is one line long, so an example is enough to carry all of it.
 * 2. **One quiet line under the box**, because an example alone leaves the
 *    reader guessing at which part of it mattered. No button opening it, no
 *    tooltip: a rule that has to be hunted for is a rule nobody has.
 * 3. **The choices, live, under that.** The same buttons that will be on the
 *    card, drawn from what is in the box as it is typed. Nothing to show
 *    means nothing is drawn - a preview of an ordinary note would be a row
 *    of nothing sitting under every note in the app.
 *
 * And a button that writes the heading, for the hand that now knows the rule
 * and does not want to reach for the hash key twice.
 */

export function NoteEditor({
  value,
  label,
  ariaLabel,
  placeholder = PLACEHOLDER,
  className,
  onChange,
  onBlur,
}: {
  value: string
  /** What the note belongs to, for the choices' own names. */
  label: string
  ariaLabel: string
  placeholder?: string
  className?: string
  onChange: (next: string) => void
  onBlur?: () => void
}) {
  const box = useRef<HTMLTextAreaElement>(null)
  // Where the caret has to be once the new text has been rendered. Set by
  // the button and consumed by the effect below, because the value comes
  // back through a prop and there is no text to put a caret into until it
  // has.
  const caret = useRef<number | null>(null)
  // Where the caret was when the box last had it. Tabbing to the button is
  // how somebody with no mouse reaches it, and that press takes the focus -
  // so without this the heading would land at the end of the note rather
  // than where the person was standing in it.
  const left = useRef<number | null>(null)
  const { sections } = parseNote(value)

  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    // Measured rather than counted: a wrapped line is two lines on a phone
    // and one on a desktop, and rows= cannot know which. Reset first, or
    // scrollHeight only ever reports the height it was last given.
    el.style.height = 'auto'
    // jsdom has no layout and reports nothing, which would collapse the box
    // to zero in every test that renders one.
    if (el.scrollHeight > 0) el.style.height = `${el.scrollHeight}px`
    if (caret.current !== null) {
      el.focus()
      el.setSelectionRange(caret.current, caret.current)
      caret.current = null
    }
  }, [value])

  function addChoice() {
    const el = box.current
    // A caret only counts while the box has it. An untouched textarea reports
    // zero, so a press before anybody had clicked into the box put the
    // heading above everything already written - which reads as the button
    // having reordered the note.
    const placed = el !== null && document.activeElement === el
    const at = placed ? (el.selectionStart ?? value.length) : (left.current ?? value.length)
    const next = insertSectionHeading(value, at)
    // Nothing to write means nothing comes back through the prop and the
    // effect below never runs, so the focus this owes is handed over here.
    if (next.text === value) {
      el?.focus()
      el?.setSelectionRange(next.caret, next.caret)
      return
    }
    caret.current = next.caret
    onChange(next.text)
  }

  return (
    <div className={className ? `note-editor ${className}` : 'note-editor'}>
      <textarea
        ref={box}
        className="note-editor-text"
        value={value}
        aria-label={ariaLabel}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        onBlur={e => {
          left.current = e.target.selectionStart
          onBlur?.()
        }}
      />
      {/* The rule and the button that writes it, on one line: the sentence
          says what `## ` does and the button beside it is the same thing
          without the typing, so neither has to explain the other. */}
      <div className="note-editor-rule">
        <p className="note-editor-hint">A line that starts with ## becomes a choice on the card.</p>
        <button
          type="button"
          className="btn-secondary note-editor-choice"
          aria-label={`Start a choice in the ${label} note`}
          // The caret is the whole input to this, and a press that moves
          // focus loses it. Held here rather than read back afterwards,
          // because a browser is not required to keep a selection across a
          // blur and two of them do not.
          onMouseDown={e => e.preventDefault()}
          onClick={addChoice}
        >
          + Choice
        </button>
      </div>
      {/* What the card will show, from what is in the box. Read-only in the
          sense that matters - it writes nothing back - but a real one: these
          are the card's own buttons and they open the card's own reader, so
          a heading can be proofread where it was typed. */}
      {sections.length > 0 && <NoteSections note={value} label={label} className="note-editor-preview" />}
    </div>
  )
}

/**
 * The example every note editor opens on.
 *
 * A meal, because that is the case the sections were built for - the owner's
 * lunch block carrying three recipes - and two of them, because one would
 * not show what the `## ` line is separating. Nothing here is anybody's real
 * food: `scripts/no-personal-data.mjs` reads this file like every other.
 */
const PLACEHOLDER = `Omelette in a tortilla
4 eggs, a tortilla, cheese

## Curd with berries
200 g curd, a handful of berries`
