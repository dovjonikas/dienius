import { useState } from 'react'
import { actions, useAppData } from '../lib/store'
import { todayKey } from '../lib/dates'
import { activeGoals, ageLabel, archivedGoals, canAddGoal } from '../lib/north'
import { MAX_ACTIVE_GOALS, type Goal } from '../lib/types'

/**
 * Where goals are written, and deliberately not where they are used.
 *
 * Editing lives here, four taps from the day, because a goal is not a thing
 * to adjust. Something you can rewrite from the screen you look at every
 * morning is something you will rewrite on a bad morning, and a goal rewritten
 * on bad mornings is not a goal, it is a mood. The distance is the point.
 *
 * There is no reordering and no priority. Four directions do not rank.
 */
export function NorthSettings() {
  const data = useAppData()
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showArchive, setShowArchive] = useState(false)

  const active = activeGoals(data.goals)
  const archived = archivedGoals(data.goals)
  const today = todayKey()

  return (
    <div className="settings-group" id="settings-north">
      <h3>North</h3>

      <div className="setting-block">
        <div className="setting-label">
          <span className="setting-name">The few things the days are for</span>
          <span className="setting-desc">
            Up to {MAX_ACTIVE_GOALS}. One of them appears under the day's title, quietly, rotating. They have
            no progress, no deadline and nothing to tick - showing how far along you are is what makes people
            ease off, and there is nothing here to ease off from.
          </span>
        </div>

        {active.length > 0 && (
          <ul className="goal-list">
            {active.map(goal =>
              editingId === goal.id ? (
                <li key={goal.id} className="goal-row is-editing">
                  <GoalForm
                    goal={goal}
                    onSave={patch => {
                      actions.updateGoal(goal.id, patch)
                      setEditingId(null)
                    }}
                    onCancel={() => setEditingId(null)}
                  />
                </li>
              ) : (
                <li key={goal.id} className="goal-row">
                  <div className="goal-text">
                    <span className="goal-title">{goal.title}</span>
                    {goal.why && <span className="goal-why">{goal.why}</span>}
                    {goal.identity && <span className="goal-identity">{goal.identity}</span>}
                    {/* A fact, not a measurement. It cannot be lost and it does
                        not move faster on a good week - see goalAge. */}
                    <span className="goal-age">{ageLabel(goal, today)}</span>
                  </div>
                  <div className="goal-actions">
                    <button type="button" className="btn-secondary" onClick={() => setEditingId(goal.id)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      /* Quiet, not red. Archiving a goal carries no verdict -
                         "achieved" and "abandoned" is exactly the scoring
                         North refuses to do, ARCHITECTURE section 6 - and a
                         control in --danger says one of the two before
                         anybody has pressed it. --danger stays for Delete,
                         further down, which does destroy something. */
                      className="setting-quiet"
                      onClick={() => actions.archiveGoal(goal.id, today)}
                    >
                      Archive
                    </button>
                  </div>
                </li>
              ),
            )}
          </ul>
        )}

        {adding ? (
          <div className="goal-row is-editing">
            <GoalForm
              onSave={patch => {
                actions.addGoal({ title: patch.title ?? '', why: patch.why, identity: patch.identity }, today)
                setAdding(false)
              }}
              onCancel={() => setAdding(false)}
            />
          </div>
        ) : (
          <div className="goal-add">
            <button
              type="button"
              className="btn-secondary"
              data-tour="goal-add"
              disabled={!canAddGoal(data.goals)}
              onClick={() => setAdding(true)}
            >
              {active.length === 0 ? 'Write one down' : 'Add another'}
            </button>
            {!canAddGoal(data.goals) && (
              <span className="setting-state">
                {MAX_ACTIVE_GOALS} is the limit. Archive one to make room.
              </span>
            )}
          </div>
        )}
      </div>

      {archived.length > 0 && (
        <div className="setting-block">
          <button
            type="button"
            className="library-finished-toggle"
            aria-expanded={showArchive}
            onClick={() => setShowArchive(open => !open)}
          >
            Archived ({archived.length})
          </button>
          {showArchive && (
            <ul className="goal-list is-archived">
              {archived.map(goal => (
                <li key={goal.id} className="goal-row">
                  <div className="goal-text">
                    <span className="goal-title">{goal.title}</span>
                    <span className="goal-age">{ageLabel(goal, goal.archivedAt ?? today)}</span>
                  </div>
                  <div className="goal-actions">
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={!canAddGoal(data.goals)}
                      onClick={() => actions.restoreGoal(goal.id)}
                    >
                      Bring back
                    </button>
                    <button type="button" className="setting-remove" onClick={() => actions.deleteGoal(goal.id)}>
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="setting-row">
        <div className="setting-label">
          <span className="setting-name">Bring one forward after a slow day</span>
          <span className="setting-desc">
            A card the next morning with the goal and its reason in full. Never a count of what was missed -
            it is a reminder of why, not a report on yesterday.
          </span>
        </div>
        <div className="setting-control">
          <button
            type="button"
            role="switch"
            className="switch"
            aria-checked={data.settings.north.afterASlowDay}
            aria-label="Bring one forward after a slow day"
            onClick={() =>
              actions.setNorthSettings({
                ...data.settings.north,
                afterASlowDay: !data.settings.north.afterASlowDay,
              })
            }
          >
            <span className="switch-thumb" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="setting-row">
        <div className="setting-label">
          <span className="setting-name">And on a Monday</span>
          <span className="setting-desc">The same card, softer, on the first open of the week.</span>
        </div>
        <div className="setting-control">
          <button
            type="button"
            role="switch"
            className="switch"
            aria-checked={data.settings.north.onMonday}
            aria-label="And on a Monday"
            onClick={() =>
              actions.setNorthSettings({ ...data.settings.north, onMonday: !data.settings.north.onMonday })
            }
          >
            <span className="switch-thumb" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  )
}

interface GoalFormProps {
  goal?: Goal
  onSave: (patch: { title?: string; why?: string; identity?: string }) => void
  onCancel: () => void
}

/**
 * Three fields, and only the first is required.
 *
 * The placeholders are doing real work here. "Why" and "identity" are hard
 * questions asked cold, and an empty box with a grey label produces an empty
 * box; an example of the shape of an answer produces an answer. They are
 * written in the first person because that is the voice the field wants back.
 */
function GoalForm({ goal, onSave, onCancel }: GoalFormProps) {
  const [title, setTitle] = useState(goal?.title ?? '')
  const [why, setWhy] = useState(goal?.why ?? '')
  const [identity, setIdentity] = useState(goal?.identity ?? '')

  return (
    <div className="goal-form">
      <label className="field">
        <span className="field-label">What</span>
        <input
          autoFocus
          value={title}
          maxLength={80}
          placeholder="Become the dad worth looking up to"
          onChange={e => setTitle(e.target.value)}
        />
      </label>
      <label className="field">
        <span className="field-label">Why it matters</span>
        <textarea
          rows={2}
          value={why}
          maxLength={280}
          placeholder="Because they will remember who I was, not what I got done."
          onChange={e => setWhy(e.target.value)}
        />
      </label>
      <label className="field">
        <span className="field-label">Who it makes you</span>
        <input
          value={identity}
          maxLength={120}
          placeholder="I am someone who shows up before he feels like it."
          onChange={e => setIdentity(e.target.value)}
        />
      </label>
      <div className="goal-form-actions">
        <button
          type="button"
          className="btn-primary"
          data-tour="goal-save"
          disabled={!title.trim()}
          onClick={() => onSave({ title, why, identity })}
        >
          {goal ? 'Save' : 'Write it down'}
        </button>
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}
