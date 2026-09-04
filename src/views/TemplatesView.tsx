import { useEffect, useRef, useState } from 'react'
import { CATEGORIES, DEFAULT_CATEGORY, categoryColor, type CategoryId } from '../lib/categories'
import { actions, useAppData } from '../lib/store'
import { PALETTE_COLORS } from '../lib/colors'
import { starterTemplateInput, type StarterTemplate } from '../lib/starterTemplates'
import type { DayType, LibraryList, SleepProfile, Template } from '../lib/types'
import { formatDuration, parseMinutesInput } from '../widgets/day-plan/capacity'
import { StarterOffers } from '../widgets/onboarding/StarterOffers'
import { TimePicker } from './TimePicker'
import { DurationControl } from './DurationControl'

// Kept as the same values PALETTE_COLORS has always had, so every template
// saved before this shared module existed still matches one of these. Not
// exported - the if-then board, the other feature that draws from this same
// palette, imports PALETTE_COLORS itself rather than this derived list, so
// nothing outside this file has ever needed it.
const TEMPLATE_COLORS = PALETTE_COLORS.map(c => c.value)

/** How many block titles a template card previews before it says "+n more". */
const PREVIEW_BLOCKS = 4

const DAY_TYPES: { value: DayType; label: string }[] = [
  { value: 'full', label: 'Full day' },
  { value: 'shift', label: 'Shift' },
  { value: 'night', label: 'Overnight' },
  { value: 'rest', label: 'Rest' },
]

interface DraftBlock {
  /**
   * Present only for a block carried in from the template being edited.
   * Absent for a block added during the current editing session, so save()
   * knows to mint a fresh id for it rather than reuse one that was never
   * assigned. Nothing reads TemplateBlock.id today, but a future block-
   * level feature would otherwise see every id change on every edit.
   */
  id?: string
  time: string
  title: string
  /** Which of `CATEGORIES` colours the task this block stamps - see `categories.ts`. */
  category: CategoryId
  core: boolean
  /**
   * Whether this block produces a standing task - one that should skip
   * the push bound from the day it is stamped, rather than earning that
   * exemption the hard way once it happens to reach `MAX_PUSHES` pushes.
   * Unlike `core`, this has nothing to do with day type: a standing task
   * is just as real on a full day as on a shift day, so the toggle for it
   * is not gated on `draft.type` the way core's own toggle is below.
   */
  unbounded: boolean
  /**
   * Kept as free-typed text, like `time`, and parsed only at save time -
   * see `parseMinutesInput` in `capacity.ts`. This is the one place a size
   * is normally set at all: stamping copies it onto every task the block
   * produces, so sizing happens once per template rather than once per
   * day. See docs/TIMELINE.md section 4.
   */
  minutes: string
  /**
   * Which library list this block draws its subject from - see
   * `TemplateBlock.libraryListId`. A block bound to Books stamps a task
   * named after the next unfinished book, rather than the word "Reading".
   */
  libraryListId?: string
}

interface Draft {
  id?: string
  name: string
  color: string
  type: DayType
  /** Which sleep schedule days built from this template are measured against.
   *  Undefined means the first one, which is what nearly every template wants
   *  and the only thing that exists until somebody adds a second. */
  sleepProfileId?: string
  blocks: DraftBlock[]
}

const emptyDraft = (): Draft => ({ name: '', color: TEMPLATE_COLORS[0], type: 'full', blocks: [] })

interface TemplateEditorProps {
  initial: Draft
  /** Every schedule Settings currently holds. One is the normal case; the
   *  picker below appears only once there are two, so a person who never set
   *  up a second never sees the concept at all. */
  sleepProfiles: SleepProfile[]
  /** Every library list, for the per-block binding. Empty hides the control. */
  libraryLists: LibraryList[]
  onSave: (draft: Draft) => void
  onCancel: () => void
}

// A standalone component, mounted only while a draft is open, so it can own
// its own transient state (the current draft, and the in-progress block-add
// fields) and lose all of it for free on unmount - no manual reset calls
// needed on save or cancel the way a single shared state tree would need.
function TemplateEditor({ initial, sleepProfiles, libraryLists, onSave, onCancel }: TemplateEditorProps) {
  const [draft, setDraft] = useState<Draft>(initial)
  const [blockTime, setBlockTime] = useState('')
  const [blockTitle, setBlockTitle] = useState('')
  const [blockCore, setBlockCore] = useState(false)
  const [blockUnbounded, setBlockUnbounded] = useState(false)
  const [blockMinutes, setBlockMinutes] = useState('')
  // Sticks between blocks on purpose: a template is usually built in runs of
  // the same kind of thing (three work blocks, then two meals), so carrying
  // the last choice forward is right far more often than resetting to the
  // default would be. Every other field of the block-add row clears on add.
  const [blockCategory, setBlockCategory] = useState<CategoryId>(DEFAULT_CATEGORY)
  const nameRef = useRef<HTMLInputElement>(null)

  // Moves focus into the name field the moment the form appears, for both a
  // brand new template and an in-place edit - the same pattern the if-then
  // board's form already follows: without it, a keyboard or screen reader
  // user has no way to know the form opened at all.
  useEffect(() => {
    nameRef.current?.focus()
  }, [])

  function addBlock() {
    if (!blockTitle.trim()) return
    setDraft(d => ({
      ...d,
      blocks: [
        ...d.blocks,
        {
          time: blockTime.trim(),
          title: blockTitle.trim(),
          category: blockCategory,
          core: blockCore,
          unbounded: blockUnbounded,
          minutes: blockMinutes.trim(),
        },
      ],
    }))
    setBlockTime('')
    setBlockTitle('')
    setBlockCore(false)
    setBlockUnbounded(false)
    setBlockMinutes('')
  }

  function removeBlock(index: number) {
    setDraft(d => ({ ...d, blocks: d.blocks.filter((_, i) => i !== index) }))
  }

  function toggleBlockCore(index: number) {
    setDraft(d => ({
      ...d,
      blocks: d.blocks.map((b, i) => (i === index ? { ...b, core: !b.core } : b)),
    }))
  }

  function setBlockLibrary(index: number, libraryListId: string | undefined) {
    setDraft(d => ({
      ...d,
      blocks: d.blocks.map((b, i) => (i === index ? { ...b, libraryListId } : b)),
    }))
  }

  function toggleBlockUnbounded(index: number) {
    setDraft(d => ({
      ...d,
      blocks: d.blocks.map((b, i) => (i === index ? { ...b, unbounded: !b.unbounded } : b)),
    }))
  }

  return (
    <div className="template-editor">
      <input
        ref={nameRef}
        placeholder="Template name"
        value={draft.name}
        onChange={e => setDraft({ ...draft, name: e.target.value })}
      />
      <div className="color-palette">
        {TEMPLATE_COLORS.map(color => (
          <button
            key={color}
            aria-label={`Color ${color}`}
            aria-pressed={draft.color === color}
            className={draft.color === color ? 'swatch selected' : 'swatch'}
            style={{ background: color }}
            onClick={() => setDraft({ ...draft, color })}
          />
        ))}
      </div>
      <div className="day-type-picker">
        <span className="muted">Day type</span>
        <div className="segmented" role="group" aria-label="Day type">
          {DAY_TYPES.map(opt => (
            <button
              key={opt.value}
              type="button"
              className={draft.type === opt.value ? 'active' : ''}
              aria-pressed={draft.type === opt.value}
              onClick={() => setDraft({ ...draft, type: opt.value })}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      {draft.type !== 'full' && (
        <p className="muted">Only blocks marked core count toward the score on this day type.</p>
      )}
      {sleepProfiles.length > 1 && (
        <div className="day-type-picker">
          <span className="muted">Sleep schedule</span>
          <select
            className="setting-select"
            aria-label="Sleep schedule"
            value={draft.sleepProfileId ?? sleepProfiles[0].id}
            onChange={e => setDraft({ ...draft, sleepProfileId: e.target.value })}
          >
            {sleepProfiles.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <p className="muted">Ongoing blocks never get pushed to tomorrow or need a decision.</p>
      <ul className="block-list">
        {draft.blocks.map((b, i) => (
          <li key={i} style={{ ['--cat' as string]: categoryColor(b.category) } as React.CSSProperties}>
            <span className="block-cat-edge" aria-hidden="true" />
            <span className="task-time">{b.time || '--:--'}</span>
            <span className="block-title">{b.title}</span>
            {parseMinutesInput(b.minutes) !== undefined && (
              <span className="task-size">{formatDuration(parseMinutesInput(b.minutes)!)}</span>
            )}
            {draft.type !== 'full' && (
              <button
                type="button"
                aria-pressed={b.core}
                aria-label={b.core ? `${b.title} is core` : `Mark ${b.title} as core`}
                className={b.core ? 'core-toggle active' : 'core-toggle'}
                onClick={() => toggleBlockCore(i)}
              >
                Core
              </button>
            )}
            {/* Not gated on draft.type, unlike Core above - a standing
                task is just as real on a full day as on a shift day. */}
            <button
              type="button"
              aria-pressed={b.unbounded}
              aria-label={b.unbounded ? `${b.title} is ongoing` : `Mark ${b.title} as ongoing`}
              className={b.unbounded ? 'core-toggle active' : 'core-toggle'}
              onClick={() => toggleBlockUnbounded(i)}
            >
              Ongoing
            </button>
            {/* The binding, per block rather than per template: one day has
                a reading block and a language block, and they draw from
                different lists. Hidden entirely while the library is empty,
                so a template editor stays a template editor for the many
                people who never build a list. */}
            {libraryLists.length > 0 && (
              <select
                className="block-library"
                aria-label={`What ${b.title} draws from`}
                value={b.libraryListId ?? ''}
                onChange={e => setBlockLibrary(i, e.target.value || undefined)}
              >
                <option value="">Nothing</option>
                {libraryLists.map(list => (
                  <option key={list.id} value={list.id}>
                    From {list.name}
                  </option>
                ))}
              </select>
            )}
            <button aria-label={`Remove ${b.title}`} onClick={() => removeBlock(i)}>
              &times;
            </button>
          </li>
        ))}
      </ul>
      <div className="block-add">
        <TimePicker value={blockTime} onChange={setBlockTime} placeholder="09:00" ariaLabel="Block time" />
        <input
          placeholder="What happens"
          value={blockTitle}
          onChange={e => setBlockTitle(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addBlock()}
        />
        <DurationControl
          minutes={blockMinutes.trim() === '' ? undefined : Number(blockMinutes)}
          allowEmpty
          stepperLabel="Size in minutes"
          onChange={minutes => setBlockMinutes(minutes === undefined ? '' : String(minutes))}
        />
        {/* Same six swatches as quick-add on the day view, for the same
            reason - a template is where most tasks actually get their colour,
            since a stamped day arrives already sorted. */}
        <div className="category-picker" role="group" aria-label="Category for the new block">
          {CATEGORIES.map(c => (
            <button
              key={c.id}
              type="button"
              className={c.id === blockCategory ? 'category-swatch selected' : 'category-swatch'}
              style={{ ['--cat' as string]: c.color } as React.CSSProperties}
              aria-pressed={c.id === blockCategory}
              aria-label={c.label}
              title={c.label}
              onClick={() => setBlockCategory(c.id)}
            />
          ))}
        </div>
        {draft.type !== 'full' && (
          <button
            type="button"
            aria-pressed={blockCore}
            aria-label={blockCore ? 'New block is core' : 'Mark new block as core'}
            className={blockCore ? 'core-toggle active' : 'core-toggle'}
            onClick={() => setBlockCore(v => !v)}
          >
            Core
          </button>
        )}
        <button
          type="button"
          aria-pressed={blockUnbounded}
          aria-label={blockUnbounded ? 'New block is ongoing' : 'Mark new block as ongoing'}
          className={blockUnbounded ? 'core-toggle active' : 'core-toggle'}
          onClick={() => setBlockUnbounded(v => !v)}
        >
          Ongoing
        </button>
        <button className="btn-secondary" onClick={addBlock}>Add block</button>
      </div>
      <div className="row">
        <button className="primary" disabled={!draft.name.trim()} onClick={() => onSave(draft)}>
          Save template
        </button>
        <button className="btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}

export function TemplatesView() {
  const data = useAppData()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  function startEdit(t: Template) {
    setConfirmDeleteId(null)
    setDraft({
      id: t.id,
      name: t.name,
      color: t.color,
      type: t.type ?? 'full',
      sleepProfileId: t.sleepProfileId,
      blocks: t.blocks.map(b => ({
        id: b.id,
        time: b.time ?? '',
        title: b.title,
        category: b.category ?? DEFAULT_CATEGORY,
        core: b.core ?? false,
        unbounded: b.unbounded ?? false,
        minutes: b.minutes !== undefined ? String(b.minutes) : '',
        libraryListId: b.libraryListId,
      })),
    })
  }

  function handleDeleteClick(t: Template) {
    if (confirmDeleteId === t.id) {
      actions.deleteTemplate(t.id)
      setConfirmDeleteId(null)
    } else {
      setConfirmDeleteId(t.id)
    }
  }

  function useStarter(starter: StarterTemplate) {
    // Unlike the day view's own handler, this only ever creates the
    // template - there is no single date in view here to stamp it onto.
    // Stamping happens afterward through the calendar's own stamp bar, the
    // same as it would for a template built by hand.
    actions.addTemplate(starterTemplateInput(starter))
  }

  function saveDraft(next: Draft) {
    if (!next.name.trim()) return
    const blocks = next.blocks.map(b => ({
      time: b.time || undefined,
      title: b.title,
      category: b.category,
      core: b.core || undefined,
      unbounded: b.unbounded || undefined,
      minutes: parseMinutesInput(b.minutes),
      libraryListId: b.libraryListId,
    }))
    if (next.id) {
      const existing = data.templates.find(t => t.id === next.id)
      if (existing) {
        actions.updateTemplate({
          ...existing,
          name: next.name.trim(),
          color: next.color,
          type: next.type,
          sleepProfileId: next.sleepProfileId,
          // A block carried over from the template being edited keeps its
          // id; a block added during this session gets a fresh one. Losing
          // ids on every save is harmless today - nothing reads them yet -
          // but it would silently break any future feature keyed on them.
          blocks: next.blocks.map((b, i) => ({ ...blocks[i], id: b.id ?? crypto.randomUUID() })),
        })
      }
    } else {
      actions.addTemplate({
        name: next.name.trim(),
        color: next.color,
        type: next.type,
        sleepProfileId: next.sleepProfileId,
        blocks,
      })
    }
    setDraft(null)
  }

  return (
    <section className="templates">
      <div className="templates-header">
        <h2>Templates</h2>
        {!draft && (
          <button
            className="primary"
            onClick={() => {
              setConfirmDeleteId(null)
              setDraft(emptyDraft())
            }}
          >
            New template
          </button>
        )}
      </div>

      {draft && (
        <TemplateEditor
          sleepProfiles={data.settings.sleepProfiles}
          libraryLists={data.library}
          key={draft.id ?? 'new'}
          initial={draft}
          onSave={saveDraft}
          onCancel={() => setDraft(null)}
        />
      )}

      {!draft && data.templates.length === 0 && (
        <div className="first-run">
          <p className="empty">
            No templates yet. Start from one of these, or build your own with New template above.
          </p>
          <StarterOffers onUse={useStarter} />
        </div>
      )}

      <ul className="template-list">
        {data.templates.map(t => (
          <li key={t.id} className="template-card">
            <span className="dot" style={{ background: t.color }} />
            <div className="template-info">
              <strong>{t.name}</strong>
              {/* "4 blocks" is the least informative summary a template could
                  give: the whole question somebody has in front of this list
                  is which template this is, and the answer is what is in it.
                  The first few titles, in order, with the day type when it is
                  not an ordinary one - which is what they would have opened
                  the editor to find out. */}
              <span className="template-preview">
                {t.blocks.length === 0
                  ? 'Empty - nothing in it yet'
                  : t.blocks
                      .slice(0, PREVIEW_BLOCKS)
                      .map(b => b.title)
                      .join(' · ') + (t.blocks.length > PREVIEW_BLOCKS ? ` +${t.blocks.length - PREVIEW_BLOCKS} more` : '')}
              </span>
              <span className="template-meta">
                {t.blocks.length} {t.blocks.length === 1 ? 'block' : 'blocks'}
                {t.type && t.type !== 'full' && ` · ${DAY_TYPES.find(d => d.value === t.type)?.label ?? t.type}`}
                {t.sleepProfileId && data.settings.sleepProfiles.length > 1 &&
                  ` · ${data.settings.sleepProfiles.find(p => p.id === t.sleepProfileId)?.name ?? ''}`}
              </span>
            </div>
            <button aria-label={`Edit ${t.name}`} onClick={() => startEdit(t)}>Edit</button>
            <button
              aria-label={confirmDeleteId === t.id ? `Confirm delete ${t.name}` : `Delete ${t.name}`}
              className={confirmDeleteId === t.id ? 'danger' : ''}
              onClick={() => handleDeleteClick(t)}
              onBlur={() => setConfirmDeleteId(prev => (prev === t.id ? null : prev))}
            >
              {confirmDeleteId === t.id ? 'Confirm?' : 'Delete'}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
