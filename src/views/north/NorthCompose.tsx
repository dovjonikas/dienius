import { useEffect, useRef, useState } from 'react'
import { actions, getData, useAppData } from '../../lib/store'
import { todayKey } from '../../lib/dates'
import { activeGoals, ageLabel, archivedGoals, type NorthDraft } from '../../lib/north'
import { MAX_ACTIVE_GOALS, MAX_DESERVE_LINES, type Goal } from '../../lib/types'
import { GoalRules, UnfiledRules } from './GoalRules'
import { Explain } from '../Explain'

/**
 * A box that is the height of what is in it.
 *
 * The why and the identity are one sentence each nine times out of ten, and
 * a fixed two-row box spends a line of every card on the tenth. Growing from
 * one line costs nothing when the sentence is short and hides nothing when
 * it is long - which is the same argument the picture's own box has made
 * since v2.1, and this is that effect with a component around it so it can
 * be used inside a list where a hook cannot.
 *
 * jsdom has no layout and reports no scroll height, which is why nothing is
 * written when it says zero.
 */
function GrowingText({
  value,
  ref: outer,
  ...rest
}: { value: string; ref?: React.Ref<HTMLTextAreaElement> } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || !el.scrollHeight) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value])
  return (
    <textarea
      ref={el => {
        ref.current = el
        // React 19 hands a ref straight through as a prop, and this one has
        // to reach two places: the height effect above and whoever asked for
        // the node - the form keeps a map of title boxes to put the cursor
        // in one.
        if (typeof outer === 'function') outer(el)
        else if (outer) outer.current = el
      }}
      rows={1}
      value={value}
      {...rest}
    />
  )
}

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
  avoid: string
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
    avoid: (goal.avoid ?? []).join('\n'),
    archive: false,
  }
}

function blankRow(): GoalRow {
  return { key: crypto.randomUUID(), title: '', why: '', identity: '', deserve: '', avoid: '', archive: false }
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
  const titleRefs = useRef(new Map<string, HTMLTextAreaElement>())

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

  /** The same four, for the same reason - see cleanAvoid. */
  function setAvoid(key: string, value: string) {
    if (value.split('\n').length > MAX_DESERVE_LINES) return
    update(key, { avoid: value })
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
        avoid: r.avoid.split('\n'),
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
          First person, present tense: how you look, how you live, what you do in the morning.
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
            {/* Two halves, side by side on anything wider than a phone: what
                the goal is on the left, what it costs on the right. Four
                goals of six stacked fields is two and a half screens of
                form; four goals of two columns of three is one, and the
                thing being edited fits a screen when it is read. */}
            <div className="north-compose-half">
            <label className="field">
              <span className="field-label">What</span>
              {/* A box that wraps rather than a line that scrolls.
                  A title takes eighty characters and eighty characters of
                  this type is 640 pixels; no card on this form is that wide
                  and an input does not wrap, so a long title used to sit
                  inside its own box with its end cut off. The measuring pass
                  found it the first time it was ever pointed at this screen -
                  "Leave the house before nine on a Saturday", 31px past its
                  own edge - and it had been true at every width since the
                  form existed. It is still one line of writing: Enter does
                  nothing here, the way it does nothing in an input. */}
              <GrowingText
                /* Named here as well as by the label wrapping it. React puts a
                   controlled textarea's value in the element as text, so the
                   label around one reads "What" plus whatever has been typed
                   into it - which is invisible on screen and is the name
                   anything walking the page by label sees. The three other
                   boxes on this card have always had it and it never showed,
                   because nothing asked them for an exact name; this one is
                   asked for one by the week rehearsal, which is how it came
                   out. */
                aria-label="What"
                ref={el => {
                  if (el) titleRefs.current.set(row.key, el)
                  else titleRefs.current.delete(row.key)
                }}
                value={row.title}
                maxLength={80}
                placeholder="Become the dad worth looking up to"
                onChange={e => update(row.key, { title: e.target.value.replace(/\n/g, ' ') })}
                onKeyDown={e => {
                  if (e.key === 'Enter') e.preventDefault()
                }}
              />
            </label>
            <label className="field">
              <span className="field-label">Why it matters</span>
              <GrowingText
                value={row.why}
                maxLength={280}
                placeholder="Because they will remember who I was, not what I got done."
                onChange={e => update(row.key, { why: e.target.value })}
              />
            </label>
            <label className="field">
              <span className="field-label">Who it makes you</span>
              {/* It grows rather than standing at two rows. An identity
                  sentence is the longest of the four and a phone showed forty
                  of its hundred and twenty characters in a single line - so
                  the box takes the room the sentence needs and none of the
                  room it does not, which is what puts four of these cards on
                  one screen. */}
              <GrowingText
                value={row.identity}
                maxLength={120}
                placeholder="I am someone who shows up early."
                onChange={e => update(row.key, { identity: e.target.value })}
              />
            </label>
            </div>

            <div className="north-compose-half">
            <label className="field">
              {/* The word is explained here since v2.19. It hung off the
                  heading on the goal's own card, and that heading is gone -
                  the reading page says what somebody wrote and nothing
                  else. This is where the term is met now, which is where an
                  explanation belongs. */}
              <span className="field-label">
                <Explain id="deserve">What I do to deserve this</Explain>
                {/* The cap, in the label's own column rather than on a line
                    of its own under the box. A limit that refuses has to be
                    visible - MAX_DESERVE_LINES - and this is visible without
                    costing a row on every card. */}
                <span className="field-note">up to four</span>
              </span>
              <GrowingText
                /* Said again here because the label now carries an Explain, and
                   the bubble inside it is part of the label element even
                   while it is hidden - so the box would otherwise be named
                   the word plus the whole sentence about the word. */
                aria-label="What I do to deserve this"
                className="north-compose-lines"
                value={row.deserve}
                maxLength={400}
                placeholder={'train four times a week\napply to three places a day'}
                onChange={e => setDeserve(row.key, e.target.value)}
              />
            </label>
            {/* The other half of the same goal - docs/RESEARCH-NORTH.md.
                Asked second and never first: it is a contrast, and a contrast
                needs something to be against. First person like everything
                else on this page: what the research rules out is the second
                person, "you went quiet again", which is a scoreboard with one
                entry, and "I don't go quiet for a day" is not that. */}
            <label className="field">
              <span className="field-label">What I don&apos;t do</span>
              <GrowingText
                className="north-compose-lines"
                value={row.avoid}
                maxLength={400}
                placeholder={'make a face at bad news\ngo quiet for a day'}
                onChange={e => setAvoid(row.key, e.target.value)}
              />
            </label>
            {/* Only on a goal that exists - see GoalRules. A row being written
                now has no id for a rule to belong to. */}
            {row.id && <GoalRules goalId={row.id} title={row.title} />}
            </div>

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

      <UnfiledRules goals={data.goals} ifThens={data.ifThens} />

      {/* One row at the foot rather than three. The way to a fifth goal - or
          the sentence saying there is not one - used to have a line of its
          own above the buttons, and on a form built to fit a screen a line
          that holds one control is a line spent on nothing. */}
      <div className="north-compose-actions">
        <button type="button" className="btn-primary" data-tour="goal-save" onClick={save}>
          Save
        </button>
        <button type="button" className="btn-secondary" onClick={onDone}>
          Cancel
        </button>
        {full ? (
          <p className="setting-state north-compose-full">
            {MAX_ACTIVE_GOALS} is the limit - archive one to make room.
          </p>
        ) : (
          <button type="button" className="setting-quiet north-compose-add" onClick={addRow}>
            {activeRows === 0 ? 'Write one down' : 'Add another'}
          </button>
        )}
      </div>
    </div>
  )
}

/** Whether the store itself has room - the draft may be fuller or emptier than it. */
function activeGoalsRoom(goals: Goal[]): boolean {
  return activeGoals(goals).length < MAX_ACTIVE_GOALS
}
