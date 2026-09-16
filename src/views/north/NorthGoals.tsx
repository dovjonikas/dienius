import { useEffect, useRef, useState } from 'react'
import { actions, useAppData } from '../../lib/store'
import { todayKey } from '../../lib/dates'
import { activeGoals, ageLabel, archivedGoals, canAddGoal, rulesForGoal } from '../../lib/north'
import { MAX_ACTIVE_GOALS, MAX_DESERVE_LINES, type Goal, type IfThenEntry } from '../../lib/types'
import { GoalRules, UnfiledRules } from './GoalRules'
import { Explain } from '../Explain'

/**
 * The goals, at the top of North: one quiet line each, edited in place.
 *
 * ## One line
 *
 * A goal on the page is its title and nothing else, in the page's quietest
 * type, under the page's name. The why, the who, the two lists and the rules
 * are the goal's own words too, and they are all still kept and still
 * written - behind More, in the goal's own editor - but the page is the text,
 * and a goal over it is a line that says where the days point rather than a
 * card to be read. The owner asked for exactly that after the v2.19 cards
 * and the v2.23 form: a quiet line, pressed to edit, a title enough to save.
 * The day's own goal line and the Monday card still read the rest.
 *
 * ## Edited where it stands
 *
 * A press on the line puts an editor in its place: the title in a box that
 * wraps, Save, Cancel and More. Enter keeps it and Escape leaves it as it
 * was. A title is a goal - the store has always saved one with nothing else
 * - and a goal that already carries more than a title opens with the rest
 * showing, since a field with words in it is never hidden. Focus goes into
 * the title when the editor opens and back to the line when it closes.
 *
 * ## The rarer things, at the end of More
 *
 * Archiving a goal, writing another, the archived goals and the rules that
 * belong to no goal are pressed a few times a year, so they wait at the end
 * of More rather than standing on the page. Archiving acts at once - there is
 * one goal in the editor, and Bring back in the archived fold is the way
 * back. Another goal keeps this one first and opens a fresh editor; four is
 * the most there can be, and at four the sentence saying so stands where the
 * button was.
 *
 * With no goal at all the line is an offer, Add a goal - but only once there
 * is a text: an empty North is one line and one button, and the button is
 * Write.
 */
export function NorthGoals({ offer }: { offer: boolean }) {
  const data = useAppData()
  const goals = activeGoals(data.goals)
  // The goal being written: its id, 'new' for one that does not exist yet, or nothing.
  const [open, setOpen] = useState<string | null>(null)
  // A new editor after Another goal, rather than the same one emptied.
  const [fresh, setFresh] = useState(0)
  const lines = useRef(new Map<string, HTMLButtonElement>())
  const offerRef = useRef<HTMLButtonElement>(null)
  // Where focus goes once the editor has closed and the lines are drawn again.
  const returnTo = useRef<string | null | undefined>(undefined)

  useEffect(() => {
    if (open !== null || returnTo.current === undefined) return
    const id = returnTo.current
    returnTo.current = undefined
    const target = (id && lines.current.get(id)) || offerRef.current || lines.current.values().next().value
    target?.focus()
  })

  function close(focusId: string | null) {
    returnTo.current = focusId
    setOpen(null)
  }

  function another() {
    setOpen('new')
    setFresh(n => n + 1)
  }

  return (
    <div className="north-goal-lines">
      {goals.map(goal =>
        open === goal.id ? (
          <GoalEditor key={goal.id} goal={goal} onClose={close} onAnother={another} />
        ) : (
          <button
            key={goal.id}
            ref={el => {
              if (el) lines.current.set(goal.id, el)
              else lines.current.delete(goal.id)
            }}
            type="button"
            className="north-goal-line"
            aria-label={`Edit "${goal.title}"`}
            onClick={() => setOpen(goal.id)}
          >
            {goal.title}
          </button>
        ),
      )}
      {open === 'new' ? (
        <GoalEditor key={`new-${fresh}`} onClose={close} onAnother={another} />
      ) : (
        goals.length === 0 &&
        offer && (
          <button
            ref={offerRef}
            type="button"
            className="north-goal-line is-offer"
            data-tour="goal-add"
            onClick={() => setOpen('new')}
          >
            Add a goal
          </button>
        )
      )}
    </div>
  )
}

/** Whether a goal carries anything past its title: a why, a who, a line either way, or a rule. */
function hasMore(goal: Goal, ifThens: IfThenEntry[]): boolean {
  return (
    !!goal.why ||
    !!goal.identity ||
    (goal.deserve?.length ?? 0) > 0 ||
    (goal.avoid?.length ?? 0) > 0 ||
    rulesForGoal(ifThens, goal.id).length > 0
  )
}

/**
 * One goal, written: its title where the line was, the rest behind More, and
 * Save, Cancel and More in one row. Nothing is written until Save or Enter,
 * except the rules, which are entities of their own and act at once - see
 * GoalRules.
 *
 * The examples in the empty boxes are one invented goal, told whole, so a
 * person meeting the form sees what kind of sentence each box wants. They
 * are nobody's.
 */
function GoalEditor({
  goal,
  onClose,
  onAnother,
}: {
  goal?: Goal
  /** Closed; focus goes back to the line for this id, or to the first line there is. */
  onClose: (focusId: string | null) => void
  onAnother: () => void
}) {
  const data = useAppData()
  const today = todayKey()
  const [title, setTitle] = useState(goal?.title ?? '')
  const [why, setWhy] = useState(goal?.why ?? '')
  const [identity, setIdentity] = useState(goal?.identity ?? '')
  const [deserve, setDeserve] = useState((goal?.deserve ?? []).join('\n'))
  const [avoid, setAvoid] = useState((goal?.avoid ?? []).join('\n'))
  const [more, setMore] = useState(() => (goal ? hasMore(goal, data.ifThens) : false))
  const [intoWhy, setIntoWhy] = useState(false)
  const titleRef = useRef<HTMLTextAreaElement>(null)
  const whyRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = titleRef.current
    if (!el) return
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
  }, [])

  // More puts the cursor in the first of what it opened, so a keyboard knows
  // something appeared.
  useEffect(() => {
    if (!intoWhy) return
    whyRef.current?.focus()
    setIntoWhy(false)
  }, [intoWhy])

  const ready = title.trim() !== ''
  // Another goal fits if keeping this one still leaves room for it.
  const room = activeGoals(data.goals).length + (goal ? 0 : 1) < MAX_ACTIVE_GOALS

  /** Keeps the goal and hands back its id, or nothing when there is no title to keep. */
  function keep(): string | null {
    if (!ready) return null
    const fields = { title, why, identity, deserve: deserve.split('\n'), avoid: avoid.split('\n') }
    if (goal) {
      actions.updateGoal(goal.id, fields)
      return goal.id
    }
    return actions.addGoal(fields, today)?.id ?? null
  }

  function save() {
    const id = keep()
    if (id) onClose(id)
  }

  /**
   * The two lists stop at four lines. A fifth Enter does nothing, and a paste
   * that would overflow is refused whole rather than cut: a line somebody
   * wrote and then lost is the one thing a form must never do to them.
   */
  function capped(set: (value: string) => void) {
    return (value: string) => {
      if (value.split('\n').length > MAX_DESERVE_LINES) return
      set(value)
    }
  }

  return (
    <div
      className="north-goal-editor"
      onKeyDown={e => {
        if (e.key !== 'Escape') return
        // Stopped here, or one press would leave the editor and whatever is
        // under it - the tour, say - together. CONVENTIONS section 13.
        e.stopPropagation()
        onClose(goal?.id ?? null)
      }}
    >
      {/* A box that wraps rather than a line that scrolls: eighty characters
          is wider than a phone, and an input cut the end of a long title
          off. Still one line of writing - a line break never reaches it, and
          Enter keeps the goal. */}
      <GrowingText
        ref={titleRef}
        className="north-goal-title-field"
        aria-label="Goal"
        data-tour="goal-field"
        value={title}
        maxLength={80}
        placeholder="Run a half marathon this spring"
        onChange={e => setTitle(e.target.value.replace(/\n/g, ' '))}
        onKeyDown={e => {
          if (e.key !== 'Enter') return
          e.preventDefault()
          save()
        }}
      />

      {more && (
        <div className="north-goal-more">
          <label className="field">
            <span className="field-label">Why it matters</span>
            <GrowingText
              ref={whyRef}
              value={why}
              maxLength={280}
              placeholder="Because I sleep better on the days I move"
              onChange={e => setWhy(e.target.value)}
            />
          </label>
          <label className="field">
            <span className="field-label">Who it makes you</span>
            <GrowingText
              value={identity}
              maxLength={120}
              placeholder="Someone who keeps the promises they make to themselves"
              onChange={e => setIdentity(e.target.value)}
            />
          </label>
          <label className="field">
            <span className="field-label">
              <Explain id="deserve">What I do to deserve this</Explain>
              {/* The cap, beside the label rather than on a line of its own. A
                  limit that refuses has to be visible - MAX_DESERVE_LINES. */}
              <span className="field-note">up to four</span>
            </span>
            <GrowingText
              /* Named again here because the label carries an Explain, whose
                 bubble is part of the label even while hidden. */
              aria-label="What I do to deserve this"
              className="north-goal-list-field"
              value={deserve}
              maxLength={400}
              placeholder={'run three times a week\nstretch before bed'}
              onChange={e => capped(setDeserve)(e.target.value)}
            />
          </label>
          {/* The other half of the same goal - docs/RESEARCH-NORTH.md. Asked
              second and never first: it is a contrast, and a contrast needs
              something to be against. */}
          <label className="field">
            <span className="field-label">What I don&apos;t do</span>
            <GrowingText
              className="north-goal-list-field"
              value={avoid}
              maxLength={400}
              placeholder={'skip two runs in a row\nstay up past midnight'}
              onChange={e => capped(setAvoid)(e.target.value)}
            />
          </label>
          {/* Only on a goal that exists: a goal being written now has no id
              for a rule to belong to. */}
          {goal && <GoalRules goalId={goal.id} title={goal.title} />}
        </div>
      )}

      <div className="north-actions">
        <button type="button" className="btn-primary" data-tour="goal-save" disabled={!ready} onClick={save}>
          Save
        </button>
        <button type="button" className="btn-secondary" onClick={() => onClose(goal?.id ?? null)}>
          Cancel
        </button>
        {!more && (
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setMore(true)
              setIntoWhy(true)
            }}
          >
            More
          </button>
        )}
      </div>

      {more && (
        <div className="north-goal-rare">
          <div className="north-actions">
            {goal && (
              <button
                type="button"
                /* Not red. Archiving carries no verdict - ARCHITECTURE section
                   6 - and a control in --danger says one before anybody has
                   pressed it. */
                className="btn-secondary"
                onClick={() => {
                  actions.archiveGoal(goal.id, today)
                  onClose(null)
                }}
              >
                Archive this goal
              </button>
            )}
            {room ? (
              <button
                type="button"
                className="btn-secondary"
                disabled={!ready}
                onClick={() => {
                  if (keep()) onAnother()
                }}
              >
                Add another goal
              </button>
            ) : (
              <p className="setting-state north-goal-full">{MAX_ACTIVE_GOALS} is the limit - archive one to make room.</p>
            )}
          </div>
          <ArchivedGoals />
          <UnfiledRules goals={data.goals} ifThens={data.ifThens} />
        </div>
      )}
    </div>
  )
}

/**
 * Goals put away, behind a fold: brought back while there is room, or
 * deleted for good. Both act at once. The age a goal was carried is said
 * here and nowhere on the page - it is a record being read, not a number
 * the page lives on.
 */
function ArchivedGoals() {
  const data = useAppData()
  const archived = archivedGoals(data.goals)
  // The fold is its own component so that it goes, open or closed, with the
  // last archived goal, and a goal archived later finds it closed again.
  if (archived.length === 0) return null
  return <ArchivedFold archived={archived} full={!canAddGoal(data.goals)} />
}

function ArchivedFold({ archived, full }: { archived: Goal[]; full: boolean }) {
  const today = todayKey()
  const [open, setOpen] = useState(false)

  return (
    <div className="north-goal-archive">
      <button
        type="button"
        className="library-finished-toggle"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      >
        Archived ({archived.length})
      </button>
      {open && (
        <ul className="north-goal-archive-list">
          {archived.map(goal => (
            <li key={goal.id}>
              <span className="north-goal-archive-title">{goal.title}</span>
              <span className="north-goal-age">{ageLabel(goal, goal.archivedAt ?? today)}</span>
              <span className="north-goal-archive-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={full}
                  onClick={() => actions.restoreGoal(goal.id)}
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
  )
}

/**
 * A box that is the height of what is in it.
 *
 * A sentence is one line nine times out of ten, and a fixed box spends a line
 * on the tenth. Growing from one line costs nothing when the sentence is
 * short and hides nothing when it is long. jsdom has no layout and reports no
 * scroll height, which is why nothing is written when it says zero.
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
        // the node.
        if (typeof outer === 'function') outer(el)
        else if (outer) outer.current = el
      }}
      rows={1}
      value={value}
      {...rest}
    />
  )
}
