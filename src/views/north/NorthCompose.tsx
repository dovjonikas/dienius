import { useEffect, useRef, useState } from 'react'
import { actions, getData, useAppData } from '../../lib/store'
import { todayKey } from '../../lib/dates'
import { activeGoals, ageLabel, archivedGoals, type NorthDraft } from '../../lib/north'
import { MAX_ACTIVE_GOALS, MAX_DESERVE_LINES, type Goal } from '../../lib/types'

/** Where the cursor lands when Compose opens: on the picture, or on a new goal. */
export type ComposeFocus = 'picture' | 'goal'

export interface NorthComposeProps {
  focus: ComposeFocus
  /** Saved or cancelled - either way the window goes back to reading. */
  onDone: () => void
}

/** One goal as the form holds it. `id` absent is a goal being written now. */
interface GoalRow {
  /** React's key, because a new row has no id yet. */
  key: string
  id?: string
  title: string
  why: string
  identity: string
  /** One line per thing you do - the textarea's own text, split on save. */
  deserve: string
  /** Goes on Save, not before, so Cancel still means Cancel. */
  archive: boolean
}

function rowOf(goal: Goal): GoalRow {
  return {
    key: goal.id,
    id: goal.id,
    title: goal.title,
    why: goal.why ?? '',
    identity: goal.identity ?? '',
    deserve: (goal.deserve ?? []).join('\n'),
    archive: false,
  }
}

function blankRow(): GoalRow {
  return { key: crypto.randomUUID(), title: '', why: '', identity: '', deserve: '', archive: false }
}

/**
 * The North window with every layer editable at once: the picture, each
 * goal's four fields, what to archive, what to add. One Save, one commit.
 *
 * ## Why one form and not an Edit on every card
 *
 * Editing here is meant to be rare and whole - the shape of sitting down to
 * rewrite the page, not of fixing one word on a bad morning. One form for
 * everything gives it that shape: opening it is a decision, and a decision
 * is easier to notice yourself making than a tap. The whole draft is local
 * until Save, so Cancel and Escape drop all of it, and archiving is a flag
 * on the row until then for the same reason.
 *
 * ## What is immediate anyway
 *
 * The archived fold at the bottom acts at once: bringing a goal back or
 * deleting it for good are about goals outside the draft, and deferring
 * them would mean a Cancel that also un-deletes. A goal brought back joins
 * the draft as a row, so Save writes it like the rest.
 *
 * ## The two caps
 *
 * Four goals, and the form stops offering a fifth row - the same refusal
 * `MAX_ACTIVE_GOALS` makes in the store, made visible here with the reason.
 * Four deserve lines, and the field stops taking a fifth line rather than
 * trimming one on save: a line somebody wrote and then lost is the one
 * thing a form must never do to them.
 */
export function NorthCompose({ focus, onDone }: NorthComposeProps) {
  const data = useAppData()
  const today = todayKey()
  const archived = archivedGoals(data.goals)

  const [picture, setPicture] = useState(data.picture?.text ?? '')
  const [rows, setRows] = useState<GoalRow[]>(() => {
    const existing = activeGoals(data.goals).map(rowOf)
    // Always at least one row: a form with a picture and no goal on it would
    // have a Save with nothing under it, and the tour's "name it, then Save"
    // would point at a field that is not there.
    return existing.length === 0 || focus === 'goal' ? [...existing, blankRow()] : existing
  })
  const [showArchive, setShowArchive] = useState(false)
  const [focusKey, setFocusKey] = useState<string | null>(null)

  const pictureRef = useRef<HTMLTextAreaElement>(null)
  const titleRefs = useRef(new Map<string, HTMLInputElement>())

  // Focus lands in the form the moment it opens - on the picture from
  // Compose, on the new goal's name from Write one down - and on each row
  // Add another makes. Otherwise somebody on a keyboard has no way to know
  // a form appeared at all.
  useEffect(() => {
    if (focus === 'goal') {
      const last = rows[rows.length - 1]
      titleRefs.current.get(last.key)?.focus()
    } else {
      pictureRef.current?.focus()
    }
    // Only on mount: rows changing later is handled by focusKey below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!focusKey) return
    titleRefs.current.get(focusKey)?.focus()
    setFocusKey(null)
  }, [focusKey])

  // The picture's box grows with what is in it. A textarea with a fixed row
  // count either wastes half its height or scrolls inside itself the moment
  // a line wraps on a phone, and a paragraph somebody is rewriting should
  // never be partly hidden by its own box. jsdom has no layout and reports
  // no scroll height, which is why nothing is written when it says zero.
  useEffect(() => {
    const el = pictureRef.current
    if (!el || !el.scrollHeight) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [picture])

  const activeRows = rows.filter(r => !r.archive).length
  const full = activeRows >= MAX_ACTIVE_GOALS

  function update(key: string, patch: Partial<GoalRow>) {
    setRows(current => current.map(r => (r.key === key ? { ...r, ...patch } : r)))
  }

  function setDeserve(key: string, value: string) {
    // The field stops at four lines. A fifth Enter does nothing, and a paste
    // that would overflow is refused whole rather than cut - see the doc
    // comment above.
    if (value.split('\n').length > MAX_DESERVE_LINES) return
    update(key, { deserve: value })
  }

  function addRow() {
    const row = blankRow()
    setRows(current => [...current, row])
    setFocusKey(row.key)
  }

  function bringBack(goal: Goal) {
    actions.restoreGoal(goal.id)
    // The store refuses when it is full. The button is disabled before that,
    // so this is only ever the guard behind the guard - but a row for a goal
    // that is still archived would be a lie the next Save wrote down.
    const restored = getData().goals.find(g => g.id === goal.id)
    if (!restored || restored.archivedAt) return
    setRows(current => (current.some(r => r.id === goal.id) ? current : [...current, rowOf(restored)]))
  }

  function save() {
    const draft: NorthDraft = {
      picture,
      goals: rows.map(r => ({
        id: r.id,
        title: r.title,
        why: r.why,
        identity: r.identity,
        deserve: r.deserve.split('\n'),
        archive: r.archive,
      })),
    }
    actions.composeNorth(draft, today)
    onDone()
  }

  return (
    <div
      className="north-compose"
      onKeyDown={e => {
        if (e.key !== 'Escape') return
        // Stopped here, or one press would leave the form and whatever is
        // under it - the tour, say - together. CONVENTIONS section 13.
        e.stopPropagation()
        onDone()
      }}
    >
      <div className="north-compose-picture">
        <label className="field">
          <span className="north-layer-label">The picture</span>
          <textarea
            ref={pictureRef}
            rows={5}
            maxLength={700}
            value={picture}
            placeholder="I wake before the house does."
            onChange={e => setPicture(e.target.value)}
          />
        </label>
        <span className="north-compose-hint">
          First person, present tense, up to about six lines: how you look, how you live, what you do in the
          morning.
        </span>
      </div>

      {rows.map((row, index) =>
        row.archive ? (
          <p key={row.key} className="north-compose-archived">
            <strong>{row.title}</strong> will be archived when you save.{' '}
            <button type="button" className="setting-quiet" onClick={() => update(row.key, { archive: false })}>
              Undo
            </button>
          </p>
        ) : (
          <fieldset key={row.key} className="north-compose-goal">
            <legend className="visually-hidden">Goal {index + 1}</legend>
            <label className="field">
              <span className="field-label">What</span>
              <input
                ref={el => {
                  if (el) titleRefs.current.set(row.key, el)
                  else titleRefs.current.delete(row.key)
                }}
                value={row.title}
                maxLength={80}
                placeholder="Become the dad worth looking up to"
                onChange={e => update(row.key, { title: e.target.value })}
              />
            </label>
            <label className="field">
              <span className="field-label">Why it matters</span>
              <textarea
                rows={2}
                value={row.why}
                maxLength={280}
                placeholder="Because they will remember who I was, not what I got done."
                onChange={e => update(row.key, { why: e.target.value })}
              />
            </label>
            <label className="field">
              <span className="field-label">Who it makes you</span>
              {/* Two rows rather than one line: an identity sentence is
                  the longest of the four, and on a phone a single-line box
                  showed forty of its hundred and twenty characters. */}
              <textarea
                rows={2}
                value={row.identity}
                maxLength={120}
                placeholder="I am someone who shows up early."
                onChange={e => update(row.key, { identity: e.target.value })}
              />
            </label>
            <label className="field">
              <span className="field-label">What I do to deserve this</span>
              <textarea
                rows={3}
                value={row.deserve}
                maxLength={400}
                placeholder={'train four times a week\napply to three places a day'}
                onChange={e => setDeserve(row.key, e.target.value)}
              />
            </label>
            <span className="north-compose-hint">One line per thing you do, most days. Up to four.</span>
            <div className="north-compose-goal-foot">
              {row.id ? (
                <button
                  type="button"
                  /* Quiet, not red. Archiving carries no verdict - see
                     ARCHITECTURE section 6 - and a control in --danger says
                     one before anybody has pressed it. */
                  className="setting-quiet"
                  aria-label={`Archive "${row.title}"`}
                  onClick={() => update(row.key, { archive: true })}
                >
                  Archive
                </button>
              ) : (
                <button
                  type="button"
                  className="setting-quiet"
                  aria-label="Remove this goal"
                  onClick={() => setRows(current => current.filter(r => r.key !== row.key))}
                >
                  Remove
                </button>
              )}
            </div>
          </fieldset>
        ),
      )}

      {full ? (
        <p className="setting-state north-compose-full">{MAX_ACTIVE_GOALS} is the limit. Archive one to make room.</p>
      ) : (
        <button type="button" className="setting-quiet north-compose-add" onClick={addRow}>
          {activeRows === 0 ? 'Write one down' : 'Add another'}
        </button>
      )}

      {archived.length > 0 && (
        <div className="north-compose-archive">
          <button
            type="button"
            className="library-finished-toggle"
            aria-expanded={showArchive}
            onClick={() => setShowArchive(open => !open)}
          >
            Archived ({archived.length})
          </button>
          {showArchive && (
            <ul className="north-compose-archive-list">
              {archived.map(goal => (
                <li key={goal.id}>
                  <span className="north-compose-archive-title">{goal.title}</span>
                  <span className="north-goal-age">{ageLabel(goal, goal.archivedAt ?? today)}</span>
                  <span className="north-compose-archive-actions">
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={full || !activeGoalsRoom(data.goals)}
                      onClick={() => bringBack(goal)}
                    >
                      Bring back
                    </button>
                    <button type="button" className="setting-remove" onClick={() => actions.deleteGoal(goal.id)}>
                      Delete
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="north-compose-actions">
        <button type="button" className="btn-primary" data-tour="goal-save" onClick={save}>
          Save
        </button>
        <button type="button" className="btn-secondary" onClick={onDone}>
          Cancel
        </button>
      </div>
    </div>
  )
}

/** Whether the store itself has room - the draft may be fuller or emptier than it. */
function activeGoalsRoom(goals: Goal[]): boolean {
  return activeGoals(goals).length < MAX_ACTIVE_GOALS
}
