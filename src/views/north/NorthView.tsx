import { useState } from 'react'
import { actions, useAppData } from '../../lib/store'
import { todayKey } from '../../lib/dates'
import { activeGoals, ageLabel, canAddRule, rulesForGoal, unfiledRules } from '../../lib/north'
import { paletteColorName } from '../../lib/colors'
import { MAX_RULES_PER_GOAL, type Goal, type IfThenEntry } from '../../lib/types'
import { RuleForm } from './RuleForm'
import { Explain } from '../Explain'

export interface NorthViewProps {
  /** Goals are written in Settings and nowhere else - see the doc comment below. */
  onOpenSettings: () => void
}

/**
 * North: the few things the days are for, and what pulls you off them.
 *
 * ## Why this is a window and not a settings page
 *
 * Goals lived in Settings and appeared as one quiet line under the day's
 * title. Rules lived in a different part of Settings, in a flat list, and
 * were surfaced one at a time onto the day view by day type and time of day.
 * Neither half was read. The rules were the worse of the two: a list of
 * chores somebody had set themselves, filed under a heading nobody opens,
 * shown at a moment they had nothing to do with.
 *
 * The fix is not to surface a rule harder. It is to put every rule under the
 * goal it protects, so that reading one is reading why it exists. A rule with
 * no goal is noise; under a goal it is armour.
 *
 * ## What this screen refuses to do
 *
 * Everything ARCHITECTURE section 6 says, unchanged and not up for
 * negotiation here: no progress, no percentage, no milestone, no target
 * date, no streak, no checkbox, and no count of anything that goes up. A
 * rule has nothing to tick and never says how often it fired. The one number
 * on the screen is a goal's age, which cannot be earned or lost.
 *
 * Writing and editing a *goal* is still in Settings, deliberately four taps
 * from the day: something you can rewrite from the screen you look at every
 * morning is something you will rewrite on a bad morning. Rules are not
 * goals, and they are written here, because noticing what pulls you off
 * course happens the moment it pulls you off course.
 */
export function NorthView({ onOpenSettings }: NorthViewProps) {
  const data = useAppData()
  const today = todayKey()
  const goals = activeGoals(data.goals)
  const unfiled = unfiledRules(data.ifThens, data.goals)

  return (
    <section className="north-view" aria-label="North">
      <header className="north-view-head">
        <h2>
          North
          <Explain id="north" />
        </h2>
        <p className="north-view-lead">
          The few things the days are for, and the moments that pull you off them.
        </p>
      </header>

      {goals.length === 0 ? (
        <div className="empty north-view-empty">
          <p>Nothing here yet. A goal is what you are doing, why it matters, and who it makes you.</p>
          <button type="button" className="btn-primary" onClick={onOpenSettings}>
            Write one down
          </button>
        </div>
      ) : (
        <div className="north-goals">
          {goals.map(goal => (
            <GoalCard key={goal.id} goal={goal} rules={rulesForGoal(data.ifThens, goal.id)} today={today} />
          ))}
        </div>
      )}

      {unfiled.length > 0 && <UnfiledRules rules={unfiled} goals={goals} ifThens={data.ifThens} />}

      {goals.length > 0 && (
        <p className="north-view-foot muted">
          Goals are written in Settings, on purpose - away from the screen you look at on a bad morning.{' '}
          <button type="button" className="setting-quiet" onClick={onOpenSettings}>
            Edit goals
          </button>
        </p>
      )}
    </section>
  )
}

interface GoalCardProps {
  goal: Goal
  rules: IfThenEntry[]
  today: string
}

/**
 * One goal, calm, with its rules under it.
 *
 * The three fields are the three the goal already carries and there is
 * nothing else on the card. No edit button: editing a goal is in Settings
 * and the distance is the point. The heading over the rules is written in
 * the first person - "What pulls me off this" - because everything under it
 * is in the person's own voice, and a card that switches to the app's voice
 * halfway down reads like a form.
 */
function GoalCard({ goal, rules, today }: GoalCardProps) {
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const room = rules.length < MAX_RULES_PER_GOAL

  return (
    <article className="north-goal">
      <h3 className="north-goal-title">{goal.title}</h3>
      {goal.why && <p className="north-goal-why">{goal.why}</p>}
      {goal.identity && <p className="north-goal-identity">{goal.identity}</p>}
      {/* A fact, not a measurement - see goalAge. It cannot be lost and it
          does not move faster on a good week. */}
      <p className="north-goal-age">{ageLabel(goal, today)}</p>

      <h4 className="north-goal-rules-head">What pulls me off this</h4>

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
        <button type="button" className="btn-secondary north-rule-add" onClick={() => setAdding(true)}>
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
