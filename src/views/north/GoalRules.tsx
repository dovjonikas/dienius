import { useState } from 'react'
import { actions, useAppData } from '../../lib/store'
import { activeGoals, canAddRule, rulesForGoal, unfiledRules } from '../../lib/north'
import { MAX_RULES_PER_GOAL, type Goal, type IfThenEntry } from '../../lib/types'
import { RuleForm } from './RuleForm'
import { RuleText } from './NorthView'

/**
 * What pulls you off one goal, written where everything else about that goal
 * is written.
 *
 * These lived on the goal's own card until v2.19, with a heading over them,
 * an invitation under them when there were none, and Edit and Delete on each
 * one. That is a form, and the reading view stopped being one: North is a
 * page somebody wrote, not a record somebody filled in. So the whole block
 * moved here, into Compose, where a form is the right shape and the
 * instruction that used to sit on the card can sit beside the field it is
 * about instead.
 *
 * **It acts at once rather than on Save**, which is the same exception the
 * archived fold at the foot of this form already makes and for the same
 * reason: a rule is its own entity with its own id, not a field of the goal
 * draft, and deferring it would mean a Cancel that also had to un-write
 * sentences somebody had watched appear.
 *
 * Only on a goal that exists. A goal being written now has no id for a rule
 * to belong to, and inventing one before Save would leave a rule pointing at
 * a goal that Cancel threw away.
 */
export function GoalRules({ goalId, title }: { goalId: string; title: string }) {
  const data = useAppData()
  const rules = rulesForGoal(data.ifThens, goalId)
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const room = rules.length < MAX_RULES_PER_GOAL

  return (
    <div className="field north-compose-rules">
      <span className="field-label">What pulls me off this</span>

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
            actions.addIfThen({ ...draft, goalId })
            setAdding(false)
          }}
          onCancel={() => setAdding(false)}
        />
      ) : room ? (
        <button
          type="button"
          className="setting-quiet north-rule-add"
          aria-label={rules.length === 0 ? `What pulls me off "${title}"` : `Add another to "${title}"`}
          onClick={() => setAdding(true)}
        >
          {rules.length === 0 ? 'Write one down' : 'Add another'}
        </button>
      ) : (
        // The cap refuses rather than evicting, so it has to be visible -
        // MAX_RULES_PER_GOAL. A limit that quietly drops the newest entry is
        // a limit nobody can see and a rule somebody thinks they wrote.
        <p className="setting-state north-rule-full">{MAX_RULES_PER_GOAL} is the limit - delete one to make room.</p>
      )}

      {/* The instruction, beside the field it is about. It spent two versions
          on the goal's card, where it was two sentences of guidance printed
          four times on a window that is supposed to be somebody's own
          writing - and where the form it describes was one press away and
          says the same thing in its own placeholders. CONVENTIONS 23. */}
      <span className="north-compose-hint">
        Name one moment that takes you off this, and the one thing you do instead.
      </span>
    </div>
  )
}

/** One rule, and the two things that can be done to it. */
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
          {confirmDelete ? 'Delete?' : 'Delete'}
        </button>
      </div>
    </>
  )
}

/**
 * Rules that are not under any goal.
 *
 * Two ways to arrive here and both are live: a rule written before rules had
 * goals, and a rule whose goal was deleted - `deleteGoal` does not take its
 * rules with it, deliberately, because a sentence somebody wrote about
 * themselves should not go quietly with the goal it was filed under.
 *
 * It sits in Compose since v2.19 rather than on the reading page. Filing one
 * is a form - a row of goal buttons and a choice - and it is also *next to
 * the fold that deleted the goal*, which is where somebody who has just
 * orphaned three rules is standing. Nothing on the reading page acts, so
 * nothing on the reading page could have offered this.
 */
export function UnfiledRules({ goals, ifThens }: { goals: Goal[]; ifThens: IfThenEntry[] }) {
  // Every goal decides what counts as unfiled, and only the active ones are
  // offered to file under. Archiving a direction is not deciding the things
  // that pull you off it never happened, so its rules stay with it - and
  // asking this question with the archived ones left out would spill them
  // all into here the moment somebody archived anything.
  const rules = unfiledRules(ifThens, goals)
  const filable = activeGoals(goals)
  if (rules.length === 0) return null

  return (
    <section className="north-unfiled" aria-label="Rules with no goal">
      <h3>Not under a goal yet</h3>
      <p className="muted">
        These were written before rules belonged to anything, or the goal they were under is gone - put each one
        under what it protects, or leave it here.
      </p>
      <ul className="north-rules">
        {rules.map(rule => (
          <li key={rule.id} className="north-rule">
            <RuleText rule={rule} />
            <div className="north-rule-actions">
              {filable.length === 0 ? (
                <span className="muted">Write a goal first, then these can go under one.</span>
              ) : (
                filable.map(goal => (
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
