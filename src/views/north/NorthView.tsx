import { useState } from 'react'
import { actions, useAppData } from '../../lib/store'
import { todayKey } from '../../lib/dates'
import { activeGoals, ageLabel, archivedGoals, canAddRule, rulesForGoal, unfiledRules } from '../../lib/north'
import { paletteColorName } from '../../lib/colors'
import { MAX_RULES_PER_GOAL, type Goal, type IfThenEntry } from '../../lib/types'
import { RuleForm } from './RuleForm'
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
  const today = todayKey()
  const goals = activeGoals(data.goals)
  const archived = archivedGoals(data.goals)
  const unfiled = unfiledRules(data.ifThens, data.goals)
  const [composing, setComposing] = useState<ComposeFocus | null>(null)
  const picture = data.picture
  // Compose only once there is something to compose. On an empty window the
  // one control is the picture's own line, and a second control beside it
  // would be a second question.
  const hasAnything = !!picture || goals.length > 0 || archived.length > 0

  return (
    <section className="north-view" aria-label="North">
      <header className="north-view-head">
        <h2>
          <Explain id="north">North</Explain>
        </h2>
        {hasAnything && !composing && (
          <button
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
                <GoalCard key={goal.id} goal={goal} rules={rulesForGoal(data.ifThens, goal.id)} today={today} />
              ))}
            </div>
          )}

          {unfiled.length > 0 && <UnfiledRules rules={unfiled} goals={goals} ifThens={data.ifThens} />}
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
      <p className="north-layer-label">
        <Explain id="picture">The picture</Explain>
      </p>
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
        Who you are becoming: how you look, how you live, what you do in the morning. One line is enough to
        start.
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
  today: string
}

/**
 * One goal, calm, with its two lists under it.
 *
 * No edit control on the card: editing is Compose, at the top, and the
 * distance from a card to that one control is the whole of what keeps this
 * a page to read rather than a form to fill. The two headings are written in
 * the first person - "What I do to deserve this", "What pulls me off this" -
 * because everything under them is in the person's own voice, and a card
 * that switches to the app's voice halfway down reads like a form.
 */
function GoalCard({ goal, rules, today }: GoalCardProps) {
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const room = rules.length < MAX_RULES_PER_GOAL
  const deserve = goal.deserve ?? []

  return (
    <article className="north-goal">
      <h3 className="north-goal-title">{goal.title}</h3>
      {goal.why && <p className="north-goal-why">{goal.why}</p>}
      {goal.identity && <p className="north-goal-identity">{goal.identity}</p>}
      {/* A fact, not a measurement - see goalAge. It cannot be lost and it
          does not move faster on a good week. */}
      <p className="north-goal-age">{ageLabel(goal, today)}</p>

      <h4 className="north-layer-label north-goal-deserve-head">
        <Explain id="deserve">What I do to deserve this</Explain>
      </h4>
      {deserve.length > 0 ? (
        // A plain list. No marker, no box, nothing to tick: the moment one
        // of these could be checked off it would be a scoreboard, and the
        // heading would stop being true.
        <ul className="north-deserve">
          {deserve.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      ) : (
        <p className="north-goal-deserve-empty">
          Two to four things you do most days for this. They are written in Compose.
        </p>
      )}

      <h4 className="north-layer-label north-goal-rules-head">What pulls me off this</h4>

      {rules.length === 0 && !adding && (
        <p className="empty north-goal-rules-empty">
          Name one moment that takes you off this, and the one thing you do instead.
        </p>
      )}

      {rules.length > 0 && (
        <ul className="north-rules">
          {rules.map(rule => (
            <li key={rule.id} className="north-rule">
              {editingId === rule.id ? (
                <RuleForm
                  draft={{ trigger: rule.trigger, action: rule.action, color: rule.color }}
                  onSave={draft => {
                    actions.updateIfThen({ ...rule, ...draft })
                    setEditingId(null)
                  }}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <RuleLine rule={rule} onEdit={() => setEditingId(rule.id)} />
              )}
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <RuleForm
          onSave={draft => {
            actions.addIfThen({ ...draft, goalId: goal.id })
            setAdding(false)
          }}
          onCancel={() => setAdding(false)}
        />
      ) : room ? (
        <button type="button" className="setting-quiet north-rule-add" onClick={() => setAdding(true)}>
          {rules.length === 0 ? 'Write one down' : 'Add another'}
        </button>
      ) : (
        // The cap refuses rather than evicting, so it has to be visible -
        // MAX_RULES_PER_GOAL. A limit that quietly drops the newest entry is
        // a limit nobody can see and a rule somebody thinks they wrote.
        <p className="setting-state north-rule-full">
          {MAX_RULES_PER_GOAL} is the limit here. Delete one to make room.
        </p>
      )}
    </article>
  )
}

/**
 * One rule, as one sentence.
 *
 * "If X, then Y" on one line rather than two stacked halves. Under a goal
 * there are at most five of these and they are read the way somebody reads
 * their own handwriting: whole. The arrow is decoration and carries a real
 * "then" beside it for anything reading the text rather than looking at it.
 */
function RuleLine({ rule, onEdit }: { rule: IfThenEntry; onEdit: () => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <>
      <RuleText rule={rule} />
      <div className="north-rule-actions">
        <button type="button" className="setting-quiet" aria-label={`Edit "${rule.trigger}"`} onClick={onEdit}>
          Edit
        </button>
        <button
          type="button"
          className={confirmDelete ? 'btn-danger is-armed' : 'btn-danger'}
          aria-label={confirmDelete ? `Confirm delete "${rule.trigger}"` : `Delete "${rule.trigger}"`}
          onClick={() => {
            if (confirmDelete) actions.deleteIfThen(rule.id)
            else setConfirmDelete(true)
          }}
          onBlur={() => setConfirmDelete(false)}
        >
          {confirmDelete ? 'Confirm?' : 'Delete'}
        </button>
      </div>
    </>
  )
}

/** The sentence itself, shared by a filed rule and an unfiled one. */
export function RuleText({ rule }: { rule: IfThenEntry }) {
  return (
    <p className="north-rule-line" style={rule.color ? { borderLeftColor: rule.color } : undefined}>
      <span className="north-rule-prefix">If</span>{' '}
      {rule.trigger}
      <span className="north-rule-arrow" aria-hidden="true">
        {'→'}
      </span>
      {/* The action is bare text rather than a span of its own. An inline
          span whose text wraps reports one bounding box spanning both lines,
          which encloses everything before it on the first - and the measuring
          pass in scripts/audit.js reads that as two pieces of text painted
          over each other. It found sixteen of them here, all the same shape
          and none of them real, which is a measuring tool doing exactly its
          job: the geometry genuinely was overlapping, it just did not matter.
          One fewer wrapper and the rects are honest again. */}
      <span className="visually-hidden">, then </span>
      {rule.action}
      {rule.color && <span className="visually-hidden"> Tagged {paletteColorName(rule.color)}.</span>}
    </p>
  )
}

/**
 * Rules that are not under any goal.
 *
 * This is the whole migration for every rule written before rules had goals,
 * and it is a question rather than a guess. Nothing on load tries to work out
 * which goal a sentence belongs under; the rules simply appear here, readable
 * and intact, each with the active goals offered beside it. A rule can also
 * stay here indefinitely, which is deliberate - noticing what pulls you off
 * course is worth writing down before you know what it pulls you off.
 *
 * The same group catches a rule whose goal was deleted. A dangling id
 * degrades, and degrading here means the rule comes back to this list rather
 * than disappearing with the goal.
 */
function UnfiledRules({ rules, goals, ifThens }: { rules: IfThenEntry[]; goals: Goal[]; ifThens: IfThenEntry[] }) {
  return (
    <section className="north-unfiled" aria-label="Rules with no goal">
      <h3>Not under a goal yet</h3>
      <p className="muted">
        These were written before rules belonged to anything. Put each one under what it protects, or leave
        it here.
      </p>
      <ul className="north-rules">
        {rules.map(rule => (
          <li key={rule.id} className="north-rule">
            <RuleText rule={rule} />
            <div className="north-rule-actions">
              {goals.length === 0 ? (
                <span className="muted">Write a goal first, then these can go under one.</span>
              ) : (
                goals.map(goal => (
                  <button
                    key={goal.id}
                    type="button"
                    className="btn-secondary"
                    // A full goal refuses, so the button says so before it is
                    // pressed rather than doing nothing when it is.
                    disabled={!canAddRule(ifThens, goal.id)}
                    onClick={() => actions.assignIfThenGoal(rule.id, goal.id)}
                  >
                    {goal.title}
                  </button>
                ))
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
