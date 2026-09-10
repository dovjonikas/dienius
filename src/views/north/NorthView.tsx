import { useEffect, useRef, useState } from 'react'
import { actions, useAppData } from '../../lib/store'
import { activeGoals, archivedGoals, rulesForGoal, unfiledRules } from '../../lib/north'
import { paletteColorName } from '../../lib/colors'
import { type Goal, type IfThenEntry } from '../../lib/types'
import { NorthCompose, type ComposeFocus } from './NorthCompose'
import { Explain } from '../Explain'

/**
 * North: the picture, the goals, what you do to deserve them, and what
 * pulls you off them. One window, read from the top as one piece of writing.
 *
 * ## The four layers
 *
 * 1. **The picture** - who you are becoming, in the first person, a few
 *    lines at most. The heading over everything else here.
 * 2. **The goals** - what, why, who it makes you. Four at most, an age each
 *    and nothing that measures anything.
 * 3. **What I do to deserve this** - under each goal, two to four concrete
 *    things done most days. The bridge between a direction and a Tuesday,
 *    and the one line the Monday card carries.
 * 4. **What pulls me off this** - the if-then rules under the goal they
 *    protect, exactly as v2.0 built them.
 *
 * ## Built once, left in peace
 *
 * Until v2.1 a goal was written in Settings, four taps from the day, on the
 * argument that something you can rewrite from the screen you look at every
 * morning is something you will rewrite on a bad morning. That argument was
 * right about the day view and wrong about this window: North is not a
 * screen anybody lands on by accident. It is the sixth icon and the `6`
 * key, and nothing on the day view edits it. So editing lives here, behind
 * one quiet Compose in the corner rather than an Add on every card, and it
 * edits every layer at once and saves in one press - the shape of sitting
 * down to rewrite the whole page, which is a thing done rarely, rather than
 * the shape of fixing one goal, which is a thing done on bad mornings. See
 * DECISIONS, "North is built once and left in peace".
 *
 * The only thing written *without* Compose is the first line of the picture,
 * because an empty window with a twelve-field form on it is a form, and the
 * whole of what this window should ask of somebody new is one sentence.
 *
 * ## What this screen refuses to do
 *
 * Everything ARCHITECTURE section 6 says, unchanged: no progress, no
 * percentage, no milestone, no target date, no streak, no checkbox, and no
 * count of anything that goes up. The deserve lines are a plain list with
 * nothing to tick, because a list that could be ticked would be a
 * scoreboard, and a scoreboard is exactly the thing this window is not.
 */
export function NorthView() {
  const data = useAppData()
  const goals = activeGoals(data.goals)
  const archived = archivedGoals(data.goals)
  const [composing, setComposing] = useState<ComposeFocus | null>(null)
  const composeRef = useRef<HTMLButtonElement>(null)
  const wasComposing = useRef(false)
  // Focus goes back to Compose when the form closes. The form itself cannot
  // hand it back the way a sheet does - the button is unmounted while the
  // form is open - so the window puts it there once the button is drawn.
  useEffect(() => {
    if (!composing && wasComposing.current) composeRef.current?.focus()
    wasComposing.current = composing !== null
  }, [composing])
  const picture = data.picture
  // Compose only once there is something to compose. On an empty window the
  // one control is the picture's own line, and a second control beside it
  // would be a second question.
  //
  // A rule with no goal counts, since v2.19: deleting the last goal leaves
  // its rules behind on purpose, they wait inside Compose now, and a window
  // that hid the only way in would have hidden them with it.
  const hasAnything =
    !!picture || goals.length > 0 || archived.length > 0 || unfiledRules(data.ifThens, data.goals).length > 0

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
            onClick={() => setComposing('picture')}
          >
            Compose
          </button>
        )}
      </header>

      {composing ? (
        <NorthCompose focus={composing} onDone={() => setComposing(null)} />
      ) : (
        <>
          {picture ? <ThePicture text={picture.text} /> : <PictureInvitation />}

          {goals.length === 0 && picture && <GoalOffer onWrite={() => setComposing('goal')} />}

          {goals.length > 0 && (
            <div className="north-goals">
              {goals.map(goal => (
                <GoalCard key={goal.id} goal={goal} rules={rulesForGoal(data.ifThens, goal.id)} />
              ))}
            </div>
          )}

        </>
      )}
    </section>
  )
}

/**
 * The picture, read. Set like the preface of a book: larger, looser, and
 * with more air around it than anything under it, because it is the one
 * thing on the screen that is about the person rather than about a goal.
 * Line breaks are the person's own and are kept.
 */
function ThePicture({ text }: { text: string }) {
  return (
    <div className="north-picture">
      {/* No label over it since v2.18. A small-caps THE PICTURE above
          somebody's own sentences is the thing that made this window read
          as a template with the fields filled in - and the page is better
          for opening on the person's own words. The explanation for the
          word lives on the invitation, which is where somebody meets it
          for the first time and where Explain.test.tsx looks for it. */}
      <p className="north-picture-text">{text}</p>
    </div>
  )
}

/**
 * The one way in for somebody with no picture yet: a sentence and a line.
 *
 * One line, not a paragraph, and not the four goals' twelve fields. A
 * window with nothing on it has to ask exactly one thing, and "one line
 * about who you are becoming" is the one thing everything else here hangs
 * off. It can grow into six lines later, in Compose.
 *
 * This is also the top of the window for everybody who wrote goals before
 * the picture existed: the invitation sits above their goals until it is
 * answered once, and then it is gone.
 */
function PictureInvitation() {
  const [line, setLine] = useState('')
  const ready = line.trim().length > 0

  function keep() {
    if (!ready) return
    actions.setPicture(line)
  }

  return (
    <div className="north-invite">
      <p className="north-layer-label">
        <Explain id="picture">The picture</Explain>
      </p>
      <p className="north-invite-lead">
        Who you are becoming: how you look, how you live, what you do in the morning - one line is enough
        to start.
      </p>
      <input
        className="north-invite-line"
        aria-label="The picture"
        data-tour="picture-field"
        maxLength={240}
        placeholder="I wake before the house does."
        value={line}
        onChange={e => setLine(e.target.value)}
        onKeyDown={e => {
          if (e.key !== 'Enter') return
          e.preventDefault()
          keep()
        }}
      />
      <button type="button" className="btn-primary" data-tour="picture-keep" disabled={!ready} onClick={keep}>
        Keep it
      </button>
    </div>
  )
}

/** The one next thing once the picture exists and no goal does yet. */
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
 */
function GoalCard({ goal, rules }: GoalCardProps) {
  const deserve = goal.deserve ?? []
  // Never alone. A "does not" with no "does" beside it is the backfire
  // condition in Witte's model - threat with no efficacy - and unpaired is
  // also the case Oyserman's balance predicts the worse outcome for. See
  // docs/RESEARCH-NORTH.md sections 2 and 4.
  const avoid = deserve.length > 0 ? goal.avoid ?? [] : []

  return (
    <article className="north-goal">
      <h3 className="north-goal-title">{goal.title}</h3>
      {goal.why && <p className="north-goal-why">{goal.why}</p>}
      {/* A different kind of sentence from the two around it - not what this
          goal is or why, but who having it makes you - and what says so is
          the italic and the air on either side of it. */}
      {goal.identity && <p className="north-goal-identity">{goal.identity}</p>}

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
    </article>
  )
}

/** The sentence itself, shared by a filed rule and an unfiled one. */
export function RuleText({ rule }: { rule: IfThenEntry }) {
  return (
    <p className="north-rule-line" style={rule.color ? { borderLeftColor: rule.color } : undefined}>
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
      {rule.color && <span className="visually-hidden"> Tagged {paletteColorName(rule.color)}.</span>}
    </p>
  )
}
