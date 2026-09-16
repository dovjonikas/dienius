import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { actions, useAppData } from '../../lib/store'
import { activeGoals, archivedGoals, rulesForGoal, unfiledRules } from '../../lib/north'
import { type Goal, type IfThenEntry } from '../../lib/types'
import { NorthCompose, type ComposeFocus } from './NorthCompose'
import { Explain } from '../Explain'
import { rememberNorthRead } from '../../lib/northRead'
import { isNorthHeading, parseNorth } from '../../lib/northSections'
import { todayKey } from '../../lib/dates'

/**
 * North: one text, read every morning, and under it the goals.
 *
 * ## The text
 *
 * The person's own words, typed by them and suggested by nobody. Since
 * v2.24 it reads as an introduction and a set of headings, each opening
 * what it holds - lib/northSections.ts has the rule, and NorthText the
 * page. See DECISIONS "North is a text" for where it came from.
 *
 * An empty North is one line and one button rather than a field waiting on
 * the page. Write, or Edit on a text that exists, opens one textarea with
 * the whole text in it, and nothing is written until Save; Cancel drops
 * what was typed. One door: the field Compose carried for the same text
 * until v2.22 was a second way to one thing.
 *
 * ## The morning
 *
 * The first open of the app on a new day opens here, and the page ends in
 * Start the day, which is the one way on to the day - see northRead.ts for
 * the rule and where it is kept. Any visit marks the day read.
 *
 * ## The goals, under it
 *
 * What, why, who it makes you; what you do to deserve it; what pulls you
 * off it. Four at most, an age each, and nothing that measures anything -
 * as v2.1 built them, edited behind one quiet Compose that saves in one
 * press. See DECISIONS, "North is built once and left in peace". Folded
 * under the text behind one quiet line: open where there are goals, since
 * they are the person's own words too, and closed to an offer where there
 * are none, so a text with nothing under it is a text with nothing under
 * it.
 *
 * ## What this screen refuses to do
 *
 * Everything ARCHITECTURE section 6 says, unchanged: no progress, no
 * percentage, no milestone, no target date, no streak, no checkbox, and no
 * count of anything that goes up.
 */
export interface NorthViewProps {
  /** This open of the app is the day's first look, and the page ends in the way on. */
  morning?: boolean
  /** Start the day: the one way on from the morning's page. */
  onStartDay?: () => void
}

export function NorthView({ morning = false, onStartDay }: NorthViewProps) {
  const data = useAppData()
  const goals = activeGoals(data.goals)
  const archived = archivedGoals(data.goals)
  const [composing, setComposing] = useState<ComposeFocus | null>(null)
  // Open where there are goals to read; closed to the offer where there are
  // none. Opened again by the first Save on a new text, so the one next
  // thing is in view once, and by Compose closing, so a goal just written
  // is not written into a fold.
  const [goalsOpen, setGoalsOpen] = useState(() => activeGoals(data.goals).length > 0)
  // Any look at the page is the day's look.
  useEffect(() => {
    rememberNorthRead(todayKey())
  }, [])
  const [editing, setEditing] = useState(false)
  const composeRef = useRef<HTMLButtonElement>(null)
  const wasComposing = useRef(false)
  // Focus goes back to Compose when the form closes. The form itself cannot
  // hand it back the way a sheet does - the button is unmounted while the
  // form is open - so the window puts it there once the button is drawn.
  useEffect(() => {
    if (!composing && wasComposing.current) composeRef.current?.focus()
    wasComposing.current = composing !== null
  }, [composing])
  // And back to the button that opened the text's field when the field
  // closes: Edit, or Write where the text was emptied or never kept. Only
  // one of the two is ever drawn, so one ref serves both.
  const openerRef = useRef<HTMLButtonElement>(null)
  const wasEditing = useRef(false)
  useEffect(() => {
    if (!editing && wasEditing.current) openerRef.current?.focus()
    wasEditing.current = editing
  }, [editing])
  const text = data.picture?.text ?? ''
  // Compose only once there is something to compose. A rule with no goal
  // counts, since v2.19: deleting the last goal leaves its rules behind on
  // purpose, they wait inside Compose now, and a window that hid the only
  // way in would have hidden them with it.
  const hasAnything = goals.length > 0 || archived.length > 0 || unfiledRules(data.ifThens, data.goals).length > 0

  return (
    <section className="north-view" aria-label="North">
      <header className="north-view-head">
        <h2>
          <Explain id="north">North</Explain>
        </h2>
        {hasAnything && !composing && (
          <button
            ref={composeRef}
            type="button"
            className="north-compose-open"
            data-tour="north-compose"
            onClick={() => setComposing('goals')}
          >
            Edit goals
          </button>
        )}
      </header>

      {composing ? (
        <NorthCompose
          focus={composing}
          onDone={() => {
            setComposing(null)
            setGoalsOpen(true)
          }}
        />
      ) : (
        <>
          {editing ? (
            <NorthEditor
              text={text}
              onSaved={kept => {
                setEditing(false)
                if (kept && goals.length === 0) setGoalsOpen(true)
              }}
              onCancel={() => setEditing(false)}
            />
          ) : text === '' ? (
            <NorthInvite openerRef={openerRef} onWrite={() => setEditing(true)} />
          ) : (
            <NorthText
              text={text}
              openerRef={openerRef}
              onEdit={() => setEditing(true)}
              morning={morning}
              onStartDay={onStartDay}
            />
          )}

          {/* Under the field the goals stand as they are, with nothing to
              open: the page is the field and they are what was there. An
              empty North with no goal either is the one line and the one
              button, and nothing under them. */}
          {editing ? (
            goals.length > 0 && (
              <div className="north-goals">
                {goals.map(goal => (
                  <GoalCard key={goal.id} goal={goal} rules={rulesForGoal(data.ifThens, goal.id)} />
                ))}
              </div>
            )
          ) : (
            (text !== '' || goals.length > 0) && (
              <div className="north-goals-fold">
                <button
                  type="button"
                  className="north-fold-toggle"
                  aria-expanded={goalsOpen}
                  onClick={() => setGoalsOpen(open => !open)}
                >
                  {/* No count on the line. Nothing on this page counts anything
                      - ARCHITECTURE section 6 - and a number beside the word
                      would be the first. */}
                  <span className="north-fold-caret" aria-hidden="true" />
                  Goals
                </button>
                {goalsOpen && goals.length === 0 && <GoalOffer onWrite={() => setComposing('goal')} />}
                {goalsOpen && goals.length > 0 && (
                  <div className="north-goals">
                    {goals.map(goal => (
                      <GoalCard key={goal.id} goal={goal} rules={rulesForGoal(data.ifThens, goal.id)} />
                    ))}
                  </div>
                )}
              </div>
            )
          )}
        </>
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
 * text's own type, always shown, with no frame and nothing over them - and
 * then the headings, one under another with air between, each holding what
 * is under it until it is asked for. A text with no heading is all
 * introduction and reads whole, as it was written. lib/northSections.ts has
 * the rule; nothing here decides what a heading is.
 *
 * What can be pressed stands in one row at the end: Edit, and in the
 * morning Start the day beside it, past the words rather than over them, so
 * the way on is the far side of reading. Nothing else on the page is a
 * button except the headings themselves.
 */
function NorthText({
  text,
  openerRef,
  onEdit,
  morning,
  onStartDay,
}: {
  text: string
  openerRef: React.Ref<HTMLButtonElement>
  onEdit: () => void
  morning: boolean
  onStartDay?: () => void
}) {
  const { intro, sections } = parseNorth(text)
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
      <div className="north-actions">
        {morning && onStartDay && (
          <button type="button" className="btn-primary" onClick={onStartDay}>
            Start the day
          </button>
        )}
        <button ref={openerRef} type="button" className="btn-secondary" onClick={onEdit}>
          Edit
        </button>
      </div>
    </div>
  )
}

/**
 * One heading and everything it holds.
 *
 * At rest only the heading shows. What is under it comes when asked, in two
 * ways, and the state here is the same for both:
 *
 * - **A pointer resting on the heading** lays the words out under it, over
 *   the page, and everything after the heading steps back to nothing while
 *   they are read. Nothing is moved to make the room - CONVENTIONS 24 - so
 *   the words unfold where the next headings were and fold away when the
 *   pointer leaves, and the next heading is under the pointer the moment it
 *   moves down to it. That is the stylesheet's, on a pointer that can rest.
 * - **A press** opens the words in the page, on any device, and a second
 *   press closes them. On a phone it is the only way, and on a desktop it is
 *   how words longer than a glance stay open to be read. A press may move
 *   the page where a pointer may not.
 *
 * A keyboard reaches the heading, which shows its words the way a resting
 * pointer does, and opens it the way a press does; Escape closes it.
 *
 * A press that closes a heading leaves the pointer on it, and the hover would
 * lay the same words straight back over the page - the press would seem to
 * have done nothing. So a closed heading is quiet until the pointer or the
 * focus leaves it, and only a heading that is neither open nor quiet offers
 * its words to the hover (`can-preview`).
 *
 * A heading with nothing under it is a heading and not a control: there is
 * nothing to open, so nothing offers to.
 */
function NorthSection({ heading, paragraphs }: { heading: string; paragraphs: string[] }) {
  const [open, setOpen] = useState(false)
  const [quiet, setQuiet] = useState(false)
  const id = useId()
  if (paragraphs.length === 0) {
    return (
      <section className="north-section is-bare">
        <h3 className="north-heading">{heading}</h3>
      </section>
    )
  }
  const className = open ? 'north-section is-open' : quiet ? 'north-section' : 'north-section can-preview'
  return (
    <section
      className={className}
      onPointerLeave={() => setQuiet(false)}
      onKeyDown={e => {
        if (e.key === 'Escape' && open) {
          e.stopPropagation()
          setOpen(false)
        }
      }}
    >
      <h3 className="north-heading">
        <button
          type="button"
          className="north-heading-toggle"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => {
            if (open) setQuiet(true)
            setOpen(!open)
          }}
          onBlur={() => setQuiet(false)}
        >
          {heading}
        </button>
      </h3>
      <div id={id} className="north-section-body">
        <div className="north-section-text">
          {paragraphs.map((paragraph, i) => (
            <p key={i} className="north-paragraph">
              {paragraph}
            </p>
          ))}
        </div>
      </div>
    </section>
  )
}

/**
 * The text, written: one textarea holding all of it, Save and Cancel under
 * it, and nothing written until Save.
 *
 * ## No formatting but capitals
 *
 * There is no toolbar and no rich text. A line in capitals is a heading,
 * which is said once, in the grey line above the field, and shown while it
 * is typed: every line the page will read as a heading is drawn heavier as
 * soon as it is one. That is the one help the field gives.
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
  /** Saved; `kept` is false when the save emptied the text. */
  onSaved: (kept: boolean) => void
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

  function save() {
    latest.current.settled = true
    actions.setPicture(draft)
    onSaved(draft.trim() !== '')
  }

  function cancel() {
    latest.current.settled = true
    onCancel()
  }

  return (
    <div className="north-editor">
      <p id={ruleId} className="north-editor-rule">
        A line in capitals becomes a heading
      </p>
      <div className="north-editor-field">
        <div className="north-editor-mirror" aria-hidden="true">
          {draft.split('\n').map((line, i) => (
            <span key={i}>
              {i > 0 && '\n'}
              <span className={isNorthHeading(line) ? 'north-editor-line is-heading' : 'north-editor-line'}>
                {line}
              </span>
            </span>
          ))}
          {/* One line more than the text has - see above. */}
          {'\n​'}
        </div>
        <textarea
          ref={ref}
          className="north-editor-text"
          aria-label="North"
          aria-describedby={ruleId}
          data-tour="picture-field"
          placeholder="Write here."
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

/** The one next thing once the text exists and no goal does yet. */
function GoalOffer({ onWrite }: { onWrite: () => void }) {
  return (
    <div className="north-offer">
      <p>A goal is what you are doing, why it matters, who it makes you, and what you do to deserve it.</p>
      <button type="button" className="btn-primary" data-tour="goal-add" onClick={onWrite}>
        Write one down
      </button>
    </div>
  )
}

interface GoalCardProps {
  goal: Goal
  rules: IfThenEntry[]
}

/**
 * One goal, as somebody wrote it.
 *
 * ## No labels, since v2.19
 *
 * This card carried four of them - "What I do", "What I don't do", "What
 * pulls me off this", and a count of days - and every one was a word naming
 * a box rather than a word anybody had written. The owner's reading of the
 * result was the brief for this wave: *"this feels very much like Notion,
 * where I would just get a notepad and write it down instead"*. A page that
 * announces its own fields is a record somebody filled in; the four things
 * here are a title, a sentence, a sentence in a different voice, and a few
 * lines of what that costs, and typography can say which is which.
 *
 * The one word the app still supplies is **never**, in front of each away
 * line, and it is doing the opposite job from a label. A label sits above
 * content and names it; this sits inside the sentence and completes it -
 * somebody typed "go quiet for a day" into a field called what I don't do,
 * and "never go quiet for a day" is that sentence, whole, in their own
 * voice. Without it the away lines read as more things to do, which is the
 * one misreading docs/RESEARCH-NORTH.md says must not be possible.
 *
 * ## Nothing here acts
 *
 * No edit control, no add, no tick, no confirm. Every one of those is in
 * Compose - see GoalRules - and the distance from this page to that one
 * control is the whole of what keeps this a page to read. An empty part of a
 * goal draws nothing at all: a goal with no lines under it is a goal with no
 * lines under it, not a goal with an invitation where its lines should be.
 *
 * ## Three sentences at rest, the whole goal on a pointer
 *
 * Four goals with everything on them is about forty lines of text, and the
 * owner's word for the result was a pile. What a person opens this window
 * for is the top of each goal - what it is, why it matters, who having it
 * makes them - and what is under that is the operational half: the things
 * done most days, the things never done, and the moments that pull them off
 * it. So the operational half folds away and comes back when the pointer
 * rests on the goal, or when a keyboard reaches it.
 *
 * It unfolds *downward over the page* rather than pushing anything: the
 * folded half is absolutely placed against the card's own bottom edge, on
 * the card's own surface, so the card appears to grow and nothing beneath it
 * moves by a pixel. CONVENTIONS 24 is about layout shifting under a pointer,
 * and a layer arriving over the top is not that.
 *
 * Where there is no pointer to rest - a phone - it does not fold at all and
 * the whole goal is on the page, which is the right answer on a screen that
 * shows one goal at a time anyway.
 */
function GoalCard({ goal, rules }: GoalCardProps) {
  const deserve = goal.deserve ?? []
  // Never alone. A "does not" with no "does" beside it is the backfire
  // condition in Witte's model - threat with no efficacy - and unpaired is
  // also the case Oyserman's balance predicts the worse outcome for. See
  // docs/RESEARCH-NORTH.md sections 2 and 4.
  const avoid = deserve.length > 0 ? goal.avoid ?? [] : []

  return (
    // Focusable so a keyboard can open what a pointer opens. It is a reading
    // surface and not a control - nothing on it can be pressed - so it takes
    // no role and makes no promise; the tab stop exists only because the
    // alternative is half of this page being unreachable without a mouse.
    <article className="north-goal" tabIndex={0}>
      <h3 className="north-goal-title">{goal.title}</h3>
      {goal.why && <p className="north-goal-why">{goal.why}</p>}
      {/* A different kind of sentence from the two around it - not what this
          goal is or why, but who having it makes you - and what says so is
          the italic and the air on either side of it. */}
      {goal.identity && <p className="north-goal-identity">{goal.identity}</p>}

      <div className="north-goal-more">
      {deserve.length > 0 && (
        // A plain list. No marker, no box, nothing to tick: the moment one of
        // these could be checked off, this page would be a scoreboard.
        <ul className="north-deserve">
          {deserve.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
          {avoid.map((line, i) => (
            <li key={`avoid-${i}`} className="north-avoid">never {line}</li>
          ))}
        </ul>
      )}

      {/* What pulls me off this, with no heading over it. It is a different
          kind of line from the ones above - a moment and an answer rather
          than a habit - and the space and the quieter ink are what say so.
          Written in Compose; nothing here opens anything. */}
      {rules.length > 0 && (
        <ul className="north-rules">
          {rules.map(rule => (
            <li key={rule.id} className="north-rule">
              <RuleText rule={rule} />
            </li>
          ))}
        </ul>
      )}
      </div>
    </article>
  )
}

/** The sentence itself, shared by a filed rule and an unfiled one. */
export function RuleText({ rule }: { rule: IfThenEntry }) {
  return (
    <p className="north-rule-line">
      <span className="north-rule-prefix">If</span> {rule.trigger}
      {/* The word rather than the arrow it stood for. An arrow between two
          halves of a sentence is a diagram; "If X, then Y" is the sentence,
          and this page is made of sentences now. The hidden copy that used to
          say it for a screen reader goes with it - once and only once. */}
      <span className="north-rule-then"> then </span>
      {/* The action is bare text rather than a span of its own. An inline
          span whose text wraps reports one bounding box spanning both lines,
          which encloses everything before it on the first - and the measuring
          pass in scripts/audit.js reads that as two pieces of text painted
          over each other. It found sixteen of them here, all the same shape
          and none of them real, which is a measuring tool doing exactly its
          job: the geometry genuinely was overlapping, it just did not matter.
          One fewer wrapper and the rects are honest again. */}
      {rule.action}
    </p>
  )
}
