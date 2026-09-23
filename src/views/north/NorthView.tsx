import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { actions, useAppData } from '../../lib/store'
import { Explain } from '../Explain'
import { northLineKinds, northPicture, northTagAt, parseNorth } from '../../lib/northSections'
import { NorthSection } from './NorthSection'
import { NorthReplace } from './NorthReplace'

/**
 * North: one page, on one screen - the person's own text, on cards.
 *
 * ## The text
 *
 * The person's own words, typed by them and suggested by nobody. Since
 * v2.24 it reads as an introduction, a set of headings each opening what it
 * holds, and a signature - lib/northSections.ts has the rule, NorthText the
 * page. See DECISIONS "North is a text" for where it came from.
 *
 * An empty North is one line and one button rather than a field waiting on
 * the page, framed like every other page with nothing in it yet: the page's
 * name as a page's title, Write at the right of it, the line under both.
 * Write, or Edit on a text that exists, opens one textarea with the whole
 * text in it, and nothing is written until Save; Cancel drops what was
 * typed. One door: the field Compose carried for the same text until v2.22
 * was a second way to one thing.
 *
 * ## No goals
 *
 * Goals stood over the text until v2.28 - a quiet line each, with a why, an
 * identity, two lists and rules behind More. They are retired: North is one
 * text, and what a goal said belongs in its picture, where a plan that still
 * had them finds their titles and whys - see DECISIONS "North is one text,
 * goals retired" and retireGoals in lib/north.ts.
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
  // A whole text put in the place of this one - see NorthReplace.
  const [replacing, setReplacing] = useState(false)
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
    // Framed like every other page until there are words to frame: the
    // name is a page's title then, and quieter than the words only once
    // they are here - see .north-view.is-empty.
    <section className={text === '' ? 'north-view is-empty' : 'north-view'} aria-label="North">
      <header className="north-view-head">
        {/* The page's action at the right of the page's name, where every
            page keeps it (docs/DESIGN.md, the frame): Edit on a text, Write
            on none. Write stood under the empty page's line until the owner
            went through the pages as somebody new to them and found it the
            one page whose button was somewhere else. The row keeps its
            height while the field is open, so going from reading to writing
            moves no line under it. */}
        <div className="north-view-title">
          <h2>
            <Explain id="north">North</Explain>
          </h2>
          {/* A text written somewhere else, put in the place of this one -
              see NorthReplace. Quiet, and only where there is a text to
              replace: with none, Write is the same press. */}
          {!editing && !replacing && text !== '' && (
            <button type="button" className="btn-quiet north-replace-open" onClick={() => setReplacing(true)}>
              Replace text
            </button>
          )}
          {!editing &&
            !replacing &&
            (text !== '' ? (
              <button
                ref={openerRef}
                type="button"
                className="btn-quiet"
                data-tour="picture-edit"
                onClick={() => setEditing(true)}
              >
                Edit
              </button>
            ) : (
              <button
                ref={openerRef}
                type="button"
                className="btn-primary"
                data-tour="picture-write"
                onClick={() => setEditing(true)}
              >
                Write
              </button>
            ))}
        </div>
      </header>

      {/* The page's body under its head - one look, rule 6: a long text
          scrolls inside it on a desktop, and the name and Edit stand still. */}
      <div className="page-body north-body">
        {editing ? (
          <NorthEditor text={text} onSaved={() => setEditing(false)} onCancel={() => setEditing(false)} />
        ) : replacing ? (
          <NorthReplace onDone={() => setReplacing(false)} onCancel={() => setReplacing(false)} />
        ) : text === '' ? (
          <NorthInvite />
        ) : (
          <NorthText text={text} />
        )}
      </div>
    </section>
  )
}

/**
 * An empty North: one line saying what the page is for, where the words will
 * begin - an empty state like every other page's, docs/DESIGN.md. The button
 * that starts it is the page's action, Write, at the right of the page's
 * name. Not a field waiting on the page - an empty box with an edge is a
 * form somebody is asked to fill, and a page nobody has written yet is an
 * invitation. The line says what the text is for and nothing about what to
 * put in it.
 */
function NorthInvite() {
  return (
    <div className="north-invite">
      <p className="north-invite-line">Write the words you want to start each day with.</p>
    </div>
  )
}

/**
 * The text, read, on one screen - the three parts of North, v2.28, and
 * nothing else.
 *
 * Everything is open: the page is where the text is read, and nothing on it
 * waits behind a press or a pointer. The picture first, on a plate across the
 * top - the lines before the first heading, a step larger than the lines on
 * the cards, in the text's own ink, every line and blank line as it was
 * typed. Then every heading on a card of its own, in a grid under the plate,
 * at the picture's step in the strong weight with its lines under it a step
 * smaller. Last the signature, on no card, after the widest gap on the page,
 * a step over the lines and in the quieter ink, the way a letter ends. The
 * cards, their small shadow and the page's width are the stylesheet's - see
 * DECISIONS "North is one text, goals retired". A text with no heading is all picture
 * and reads whole. lib/northSections.ts has the rules; nothing here decides
 * what a heading or a signature is, and a heading's [morning] or [evening] is
 * never drawn.
 *
 * Nothing in the words is a button. Edit stands at the right of the page's
 * name.
 */
function NorthText({ text }: { text: string }) {
  const { sections, signature } = parseNorth(text)
  const picture = northPicture(text)
  return (
    <div className="north-read" data-tour="north-text">
      {picture !== '' && (
        <div className="north-intro">
          <p className="north-picture">{picture}</p>
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
    </div>
  )
}

/** How the drawing under the field marks each kind of line. */
const LINE_CLASS = {
  heading: 'north-editor-line is-heading',
  mark: 'north-editor-line is-mark',
  text: 'north-editor-line',
} as const

/** The signature's lines, after the mark: drawn a little quieter. */
const SIGNATURE_LINE_CLASS = 'north-editor-line is-signature'

/** What the empty field asks. One question, and nobody's words. */
const NORTH_PLACEHOLDER = 'Write who you are.'

/**
 * The text, written: a page rather than a form. One textarea holding all
 * of it, no edge and no ground, the words at the size and the leading the
 * page reads them at and standing where the page puts them, so going from
 * reading to writing moves nothing. The rule is one quiet line under it;
 * Cancel and Save stand at the right, Save last.
 *
 * ## No formatting but capitals
 *
 * There is no toolbar and no rich text. A line in capitals is a heading and
 * a line of --- starts the signature, which is said once, in the grey line
 * under the field, and shown while it is typed: every line the page will
 * read as a heading is drawn heavier as soon as it is one, a [morning] or
 * [evening] at its end in the quiet ink and the plain weight, since this
 * field is the one place a tag is ever seen, the mark is drawn as a thin rule
 * across the page, and the signature's lines after it a little quieter - by
 * northLineKinds, the page's own rule, so capitals after the mark are not a
 * heading.
 *
 * A textarea cannot draw one line differently from another, so the field
 * draws nothing itself. Its own text is transparent and a drawing of the
 * same text sits exactly under it, line for line, in the same type, the
 * same padding and the same wrapping - the caret, the selection, the typing,
 * undo, copy and paste and a phone's keyboard are the field's, and the ink
 * is the drawing's. So nothing the drawing does may move a letter: a heading
 * is heavier by a stroke round its letters rather than a bolder face, which
 * would be wider, and the rule a mark becomes is drawn behind its three
 * hyphens in the height of their own line. The more room over a heading and
 * the wider tracking the brief asked for are the reading page's: a line in
 * a textarea cannot have either without every caret after it landing in the
 * wrong place, which is the one thing a writing surface must never do. See
 * DECISIONS.
 *
 * The field never scrolls inside itself. It stands over the drawing and is
 * exactly as tall, so the page scrolls instead; a field that scrolled on its
 * own would slide its text away from the drawing under it. The drawing ends
 * in one line more than the text has, so the caret on a new last line is
 * always inside the box and the browser never has a reason to scroll it.
 *
 * ## When it is written
 *
 * On Save, or Ctrl or Cmd with Enter, as typed - the store trims the two
 * ends of the whole text and nothing inside it, and emptying the text and
 * saving removes it. Cancel, or Escape, drops what was typed. Leaving the
 * page with the field open keeps what is in it, because nothing typed should
 * be lost to a press somewhere else. Save waits, quiet, until there is
 * something different to save - the shape a button has when it cannot be
 * pressed yet, in its place, so it never looks broken and nothing moves
 * when it wakes; with nothing changed the two keys simply close the field. On a North with
 * no text yet it also waits for a first line, which is how the tour knows
 * to ask for one.
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
  const markAt = kinds.indexOf('mark')
  const changed = draft !== text
  const nothingToSave = !changed || (draft.trim() === '' && text === '')

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
      <div className="north-editor-field">
        <div className="north-editor-mirror" aria-hidden="true">
          {draft.split('\n').map((line, i) => {
            const tagAt = kinds[i] === 'heading' ? northTagAt(line) : -1
            return (
              <span key={i}>
                {i > 0 && '\n'}
                <span className={markAt >= 0 && i > markAt ? SIGNATURE_LINE_CLASS : LINE_CLASS[kinds[i]]}>
                  {tagAt < 0 ? (
                    line
                  ) : (
                    <>
                      {line.slice(0, tagAt)}
                      <span className="north-editor-tag">{line.slice(tagAt)}</span>
                    </>
                  )}
                </span>
              </span>
            )
          })}
          {/* One line more than the text has - see above. */}
          {'\n\u200b'}
        </div>
        <textarea
          ref={ref}
          className="north-editor-text"
          aria-label="North"
          aria-describedby={ruleId}
          data-tour="picture-field"
          placeholder={NORTH_PLACEHOLDER}
          value={draft}
          onChange={e => {
            setDraft(e.target.value)
            latest.current.draft = e.target.value
          }}
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault()
              if (!nothingToSave) save()
              else if (!changed) cancel()
              return
            }
            if (e.key === 'Escape') {
              // Stopped here, or one press would close the field and whatever
              // is under it together - CONVENTIONS section 13.
              e.preventDefault()
              e.stopPropagation()
              cancel()
            }
          }}
          onScroll={e => {
            e.currentTarget.scrollTop = 0
          }}
        />
      </div>
      <p id={ruleId} className="north-editor-rule">
        Capital lines become headings. A line of --- starts your signature.
      </p>
      <div className="north-actions">
        <button type="button" className="btn-quiet" onClick={cancel}>
          Cancel
        </button>
        {/* Quiet until there is something to save - see above. The tour
            reads a disabled target as not yet there, so its card asks for
            the first line before it points here. */}
        <button
          type="button"
          className="btn-primary north-save"
          data-tour="picture-keep"
          disabled={nothingToSave}
          onClick={save}
        >
          Save
        </button>
      </div>
    </div>
  )
}
