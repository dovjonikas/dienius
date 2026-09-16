import { useEffect, useRef, useState } from 'react'
import { actions, useAppData } from '../../lib/store'
import { activeGoals, archivedGoals, rulesForGoal, unfiledRules } from '../../lib/north'
import { type Goal, type IfThenEntry } from '../../lib/types'
import { NorthCompose, type ComposeFocus } from './NorthCompose'
import { Explain } from '../Explain'
import { rememberNorthRead } from '../../lib/northRead'
import { todayKey } from '../../lib/dates'

/**
 * North: one text, read every morning, and under it the goals.
 *
 * ## The text
 *
 * Since v2.22 the page opens on the person's own words - a dozen or so
 * short lines in blocks, a blank line between blocks, and nothing the app
 * adds to them: no heading over them, no fields, no structure. It is what
 * the owner asked for in one sentence: a text they see every morning that
 * they wrote themselves. It starts empty and the app suggests none of it;
 * the placeholder says where to write and nothing else. See DECISIONS
 * "North is a text".
 *
 * Written in a plain textarea on this page, saved on its own half a second
 * after the last keystroke and on the way out. One door: the field Compose
 * carried for the same text until v2.22 was a second way to one thing, and
 * two ways to one thing is one too many.
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
  // none. Opened again by the first Done on a new text, so the one next
  // thing is in view once, and by Compose closing, so a goal just written
  // is not written into a fold.
  const [goalsOpen, setGoalsOpen] = useState(() => activeGoals(data.goals).length > 0)
  // Any look at the page is the day's look.
  useEffect(() => {
    rememberNorthRead(todayKey())
  }, [])
  // Open on the editor when there is no text yet. Decided once, at mount:
  // the first save of a new text must not flip the page to reading under
  // the hand still typing it, which is what deriving this from the text
  // alone did.
  const [editing, setEditing] = useState(() => (data.picture?.text ?? '') === '')
  const composeRef = useRef<HTMLButtonElement>(null)
  const wasComposing = useRef(false)
  // Focus goes back to Compose when the form closes. The form itself cannot
  // hand it back the way a sheet does - the button is unmounted while the
  // form is open - so the window puts it there once the button is drawn.
  useEffect(() => {
    if (!composing && wasComposing.current) composeRef.current?.focus()
    wasComposing.current = composing !== null
  }, [composing])
  const text = data.picture?.text ?? ''
  // And the editor whenever the text is gone - emptied here, or erased on
  // another device - since there is nothing to read.
  const writing = editing || text === ''
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
            Compose
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
          {writing ? (
            <NorthEditor
              text={text}
              onDone={() => {
                setEditing(false)
                if (goals.length === 0) setGoalsOpen(true)
              }}
            />
          ) : (
            <NorthText text={text} onEdit={() => setEditing(true)} morning={morning} onStartDay={onStartDay} />
          )}

          {/* Under the editor the goals stand as they are, with nothing to
              open: the page is the editor and they are what was there. */}
          {writing ? (
            goals.length > 0 && (
              <div className="north-goals">
                {goals.map(goal => (
                  <GoalCard key={goal.id} goal={goal} rules={rulesForGoal(data.ifThens, goal.id)} />
                ))}
              </div>
            )
          ) : (
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
          )}
        </>
      )}
    </section>
  )
}

/**
 * The text, read. The largest type on the screen, a loose line, the
 * person's own line breaks kept, and nothing over it or around it - no
 * label, no frame. A blank line in the text is a gap between blocks, and
 * the gap is the one thing the page draws that the person did not type;
 * two blank lines are still one gap. Under it, one quiet Edit - and in the
 * morning, Start the day, at the end rather than the top, so the way on is
 * past the words.
 */
function NorthText({
  text,
  onEdit,
  morning,
  onStartDay,
}: {
  text: string
  onEdit: () => void
  morning: boolean
  onStartDay?: () => void
}) {
  const blocks = text.split(/\n[ \t]*\n+/)
  return (
    <div className="north-picture">
      <div className="north-text">
        {blocks.map((block, i) => (
          <p key={i} className="north-block">
            {block}
          </p>
        ))}
      </div>
      {morning && onStartDay && (
        <button type="button" className="btn-primary north-start" onClick={onStartDay}>
          Start the day
        </button>
      )}
      <p className="north-text-actions">
        <button type="button" className="north-compose-open" onClick={onEdit}>
          Edit
        </button>
      </p>
    </div>
  )
}

/** Half a second after the last keystroke, the text is written. */
export const NORTH_SAVE_AFTER_MS = 500

/**
 * The text, written. A textarea and a Done, and nothing else on the page
 * while it is open.
 *
 * Saved on its own: half a second after the last keystroke, and whatever is
 * still pending on the way out - Done, or a press on the rail. Nothing typed
 * is ever lost to a press somewhere else, and Done is only ever the way back
 * to reading. What is typed is kept as typed; the store trims the two ends
 * of the whole text and nothing inside it.
 *
 * It grows with the text - a row per line, eight at least - rather than
 * measuring itself: jsdom has no layout, and a row count is the same answer
 * on every screen. The placeholder says where to write and suggests nothing,
 * because the app writes none of this.
 */
function NorthEditor({ text, onDone }: { text: string; onDone: () => void }) {
  const [draft, setDraft] = useState(text)
  const [saved, setSaved] = useState(false)
  const ref = useRef<HTMLTextAreaElement>(null)
  const pending = useRef<{ timer: ReturnType<typeof setTimeout>; draft: string } | null>(null)

  useEffect(() => {
    ref.current?.focus()
  }, [])

  useEffect(() => {
    if (draft === text) return
    const timer = setTimeout(() => {
      pending.current = null
      actions.setPicture(draft)
      setSaved(true)
    }, NORTH_SAVE_AFTER_MS)
    pending.current = { timer, draft }
    return () => clearTimeout(timer)
  }, [draft, text])

  // Whatever is still pending is written now: on Done, before the page
  // decides what to show, and on the way out for a press on the rail.
  function flush() {
    const p = pending.current
    if (!p) return
    clearTimeout(p.timer)
    pending.current = null
    actions.setPicture(p.draft)
  }
  useEffect(() => flush, [])

  return (
    <div className="north-editor">
      <textarea
        ref={ref}
        className="north-editor-text"
        aria-label="North"
        data-tour="picture-field"
        placeholder="Write here."
        rows={Math.max(8, draft.split('\n').length + 1)}
        maxLength={20000}
        value={draft}
        onChange={e => {
          setDraft(e.target.value)
          setSaved(false)
        }}
      />
      <div className="north-editor-foot">
        <span className="north-saved" role="status">
          {saved ? 'Saved' : ''}
        </span>
        {/* Disabled while there is nothing written: Done on an empty page
            has nothing to be done with, and the tour reads a disabled
            target as not yet there, so its card asks for a line first. */}
        <button
          type="button"
          className="btn-primary"
          data-tour="picture-keep"
          disabled={draft.trim() === ''}
          onClick={() => {
            flush()
            onDone()
          }}
        >
          Done
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
