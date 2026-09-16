import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { actions, useAppData } from '../../lib/store'
import { Explain } from '../Explain'
import { northLineKinds, parseNorth } from '../../lib/northSections'
import { NorthSection } from './NorthSection'
import { NorthGoals } from './NorthGoals'

/**
 * North: one page, in one column. The goal at the top as a quiet line, and
 * under it the person's own text.
 *
 * ## The text
 *
 * The person's own words, typed by them and suggested by nobody. Since
 * v2.24 it reads as an introduction, a set of headings each opening what it
 * holds, and a signature - lib/northSections.ts has the rule, NorthText the
 * page. See DECISIONS "North is a text" for where it came from.
 *
 * An empty North is one line and one button rather than a field waiting on
 * the page. Write, or Edit on a text that exists, opens one textarea with
 * the whole text in it, and nothing is written until Save; Cancel drops
 * what was typed. One door: the field Compose carried for the same text
 * until v2.22 was a second way to one thing.
 *
 * ## The goal
 *
 * A quiet line at the top, pressed to edit where it stands, with the rest of
 * a goal behind More - see NorthGoals. The four cards that stood under the
 * text and the Compose form that edited all of them at once are gone: the
 * page is the text, and a goal over it is a line.
 *
 * ## After sleep
 *
 * The introduction comes forward on its own once after sleep, in a window
 * over the day - see NorthWindow and northRead.ts. Until v2.24 the first open
 * of each calendar day opened this page instead, ending in Start the day;
 * the page is for reading the whole text and writing it now, and the app
 * opens on the day.
 *
 * ## What this screen refuses to do
 *
 * Everything ARCHITECTURE section 6 says, unchanged: no progress, no
 * percentage, no milestone, no target date, no streak, no checkbox, and no
 * count of anything that goes up.
 */
export function NorthView() {
  const data = useAppData()
  const [editing, setEditing] = useState(false)
  // Focus goes back to the button that opened the text's field when the
  // field closes: Edit, or Write where the text was emptied or never kept.
  // Only one of the two is ever drawn, so one ref serves both.
  const openerRef = useRef<HTMLButtonElement>(null)
  const wasEditing = useRef(false)
  useEffect(() => {
    if (!editing && wasEditing.current) openerRef.current?.focus()
    wasEditing.current = editing
  }, [editing])
  const text = data.picture?.text ?? ''

  return (
    <section className="north-view" aria-label="North">
      <header className="north-view-head">
        <h2>
          <Explain id="north">North</Explain>
        </h2>
        {/* No offer of a goal on an empty North: the empty page is one line
            and one button, and the button is Write. */}
        <NorthGoals offer={text !== ''} />
      </header>

      {editing ? (
        <NorthEditor text={text} onSaved={() => setEditing(false)} onCancel={() => setEditing(false)} />
      ) : text === '' ? (
        <NorthInvite openerRef={openerRef} onWrite={() => setEditing(true)} />
      ) : (
        <NorthText text={text} openerRef={openerRef} onEdit={() => setEditing(true)} />
      )}
    </section>
  )
}

/**
 * An empty North: one line saying what the page is for, and the one button
 * that starts it. Not a field waiting on the page - an empty box with an
 * edge is a form somebody is asked to fill, and a page nobody has written
 * yet is an invitation. The line says what the text is for and nothing
 * about what to put in it.
 */
function NorthInvite({
  onWrite,
  openerRef,
}: {
  onWrite: () => void
  openerRef: React.Ref<HTMLButtonElement>
}) {
  return (
    <div className="north-invite">
      <p className="north-invite-line">Write the words you want to start each day with.</p>
      <div className="north-actions">
        <button ref={openerRef} type="button" className="btn-primary" data-tour="picture-write" onClick={onWrite}>
          Write
        </button>
      </div>
    </div>
  )
}

/**
 * The text, read, as one column that reads like a page.
 *
 * The introduction first - the lines before the first heading, in the
 * text's own type, always shown, with no frame and nothing over them - then
 * the headings, one under another with air between, each holding what is
 * under it until it is asked for, and last the signature, whole, a little
 * larger and with more air over it, the way a letter ends. A text with no
 * heading is all introduction and reads whole, as it was written.
 * lib/northSections.ts has the rule; nothing here decides what a heading
 * or a signature is.
 *
 * What can be pressed stands in one row at the end, past the words rather
 * than over them: Edit. Nothing else on the page is a button except the
 * headings themselves.
 */
function NorthText({
  text,
  openerRef,
  onEdit,
}: {
  text: string
  openerRef: React.Ref<HTMLButtonElement>
  onEdit: () => void
}) {
  const { intro, sections, signature } = parseNorth(text)
  return (
    <div className="north-read">
      {intro.length > 0 && (
        <div className="north-intro">
          {intro.map((paragraph, i) => (
            <p key={i} className="north-paragraph">
              {paragraph}
            </p>
          ))}
        </div>
      )}
      {sections.length > 0 && (
        <div className="north-sections">
          {sections.map((section, i) => (
            <NorthSection key={i} heading={section.heading} paragraphs={section.paragraphs} />
          ))}
        </div>
      )}
      {signature.length > 0 && (
        <div className="north-signature">
          {signature.map((paragraph, i) => (
            <p key={i} className="north-paragraph">
              {paragraph}
            </p>
          ))}
        </div>
      )}
      <div className="north-actions">
        <button ref={openerRef} type="button" className="btn-secondary" onClick={onEdit}>
          Edit
        </button>
      </div>
    </div>
  )
}

/** How the drawing under the field marks each kind of line. */
const LINE_CLASS = {
  heading: 'north-editor-line is-heading',
  mark: 'north-editor-line is-mark',
  text: 'north-editor-line',
} as const

/**
 * The empty field's example: the shape of a North, in words that say what
 * goes where. The page's own tests read it by the page's own rule, so it
 * always shows every part the page reads.
 */
const NORTH_EXAMPLE = [
  'A line or two about who you are.',
  '',
  'AT WORK',
  'How you want to work.',
  '',
  'WITH PEOPLE',
  'How you want to be with others.',
  '',
  '---',
  'The line you end on.',
].join('\n')

/**
 * The text, written: one textarea holding all of it, Save and Cancel under
 * it, and nothing written until Save.
 *
 * ## No formatting but capitals
 *
 * There is no toolbar and no rich text. A line in capitals is a heading and
 * a line of --- starts the signature, which is said once, in the grey line
 * above the field, and shown while it is typed: every line the page will
 * read as a heading, and the mark, is drawn heavier as soon as it is one -
 * by northLineKinds, the page's own rule, so capitals after the mark are
 * not. That is the one help the field gives.
 *
 * The empty field shows an example of the shape, not of the words: an
 * introduction, two headings with a line each, and a signature, in sentences
 * that say what goes where. It is nobody's text.
 *
 * A textarea cannot draw one line heavier than another, so the field draws
 * nothing itself. Its own text is transparent and a drawing of the same
 * text sits exactly under it, line for line, in the same type, the same
 * padding and the same wrapping - the caret, the selection and the typing
 * are the field's, and the ink is the drawing's. Heavier is a stroke round
 * the letters rather than a bolder face: a bolder face is wider, and one
 * wider line would put every caret after it in the wrong place.
 *
 * The field never scrolls inside itself. It stands over the drawing and is
 * exactly as tall, so the page scrolls instead; a field that scrolled on its
 * own would slide its text away from the drawing under it. The drawing ends
 * in one line more than the text has, so the caret on a new last line is
 * always inside the box and the browser never has a reason to scroll it.
 *
 * ## When it is written
 *
 * On Save, as typed - the store trims the two ends of the whole text and
 * nothing inside it, and emptying the text and saving removes it. Cancel
 * drops what was typed. Leaving the page with the field open keeps what is
 * in it, because nothing typed should be lost to a press somewhere else;
 * Cancel is the one way to drop words. Save waits for a first line on a
 * North that has no text yet, which is also how the tour knows to ask for
 * one.
 *
 * There is no cap on its length and none on its headings: as many as the
 * text has.
 */
function NorthEditor({
  text,
  onSaved,
  onCancel,
}: {
  text: string
  onSaved: () => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState(text)
  const ref = useRef<HTMLTextAreaElement>(null)
  const ruleId = useId()
  // What unmounting has to know, read from refs: the cleanup below belongs
  // to the first render, and a render's own state is a keystroke behind.
  const latest = useRef({ draft: text, text, settled: false })
  latest.current.text = text

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
  }, [])

  useEffect(
    () => () => {
      const { draft: last, text: kept, settled } = latest.current
      if (!settled && last !== kept) actions.setPicture(last)
    },
    [],
  )

  // The page scrolls, never the field - see above.
  useLayoutEffect(() => {
    if (ref.current) ref.current.scrollTop = 0
  }, [draft])

  const kinds = northLineKinds(draft)

  function save() {
    latest.current.settled = true
    actions.setPicture(draft)
    onSaved()
  }

  function cancel() {
    latest.current.settled = true
    onCancel()
  }

  return (
    <div className="north-editor">
      <p id={ruleId} className="north-editor-rule">
        A line in capitals becomes a heading. A line with --- starts the signature.
      </p>
      <div className="north-editor-field">
        <div className="north-editor-mirror" aria-hidden="true">
          {/* An empty field is as tall as its example, which the field draws
              itself: the drawing holds the example unseen so that none of it
              is cut off. */}
          {draft === '' ? (
            <span className="north-editor-example">{NORTH_EXAMPLE}</span>
          ) : (
            draft.split('\n').map((line, i) => (
              <span key={i}>
                {i > 0 && '\n'}
                <span className={LINE_CLASS[kinds[i]]}>{line}</span>
              </span>
            ))
          )}
          {/* One line more than the text has - see above. */}
          {'\n​'}
        </div>
        <textarea
          ref={ref}
          className="north-editor-text"
          aria-label="North"
          aria-describedby={ruleId}
          data-tour="picture-field"
          placeholder={NORTH_EXAMPLE}
          value={draft}
          onChange={e => {
            setDraft(e.target.value)
            latest.current.draft = e.target.value
          }}
          onScroll={e => {
            e.currentTarget.scrollTop = 0
          }}
        />
      </div>
      <div className="north-actions">
        {/* Waits for a first line on a North with no text yet: there is
            nothing to save, and the tour reads a disabled target as not yet
            there, so its card asks for the line first. */}
        <button
          type="button"
          className="btn-primary"
          data-tour="picture-keep"
          disabled={draft.trim() === '' && text === ''}
          onClick={save}
        >
          Save
        </button>
        <button type="button" className="btn-secondary" onClick={cancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}
