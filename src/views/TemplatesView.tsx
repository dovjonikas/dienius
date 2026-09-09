import { useEffect, useMemo, useRef, useState } from 'react'
import { readLastDuration } from '../widgets/day-plan/quickAddPrefs'
import { categoryColor, defaultCategoryId, resolvedColor, type CategoryId } from '../lib/categories'
import { actions, useAppData } from '../lib/store'
import { PALETTE_COLORS } from '../lib/colors'
import { starterTemplateInput, type StarterTemplate } from '../lib/starterTemplates'
import type { Category, DayType, LibraryList, SleepProfile, Template } from '../lib/types'
import { formatDuration, parseMinutesInput, windowFor } from '../widgets/day-plan/capacity'
import { StarterOffers } from '../widgets/onboarding/StarterOffers'
import { TimePicker } from './TimePicker'
import { DurationControl } from './DurationControl'
import { TemplateTimeline } from './TemplateTimeline'
import { BlockNoteButton, BlockNotePanel } from './BlockNote'
import { bindingLine } from '../lib/library'
import { ReturnField } from './ReturnField'
import { canMarkKey } from './blockHighlights'
import { CategoryEdit, CategoryQuickAdd } from './CategoryQuickAdd'
import { LibraryBindingField } from './LibraryQuickAdd'
import { blocksAsTasks, type DrawableBlock } from './templateDay'
import { takenBlocks } from './takenHours'
import { Explain } from './Explain'
import { ColorSwatchPicker } from './ColorSwatchPicker'
import { WeekPreview, WeekTemplateEditor, type WeekDraft } from './WeekTemplateEditor'
import { useListReorder } from './useListReorder'
import { paletteColorName } from '../lib/colors'

// Kept as the same values PALETTE_COLORS has always had, so every template
// saved before this shared module existed still matches one of these. Not
// exported - the if-then board, the other feature that draws from this same
// palette, imports PALETTE_COLORS itself rather than this derived list, so
// nothing outside this file has ever needed it.
const TEMPLATE_COLORS = PALETTE_COLORS.map(c => c.value)

/** How many block titles a template card previews before it says "+n more". */
const PREVIEW_BLOCKS = 4

/**
 * The name this editor's own picture answers to while a time is being chosen
 * against it - see `lib/timeGhost.ts`. One editor, one timeline, one name;
 * the week editor has seven and keys them by weekday.
 */
const GHOST_KEY = 'template'

const DAY_TYPES: { value: DayType; label: string }[] = [
  { value: 'full', label: 'Full day' },
  { value: 'shift', label: 'Shift' },
  { value: 'night', label: 'Overnight' },
  { value: 'rest', label: 'Rest' },
]

/**
 * A draft block as the picture wants it.
 *
 * The editor keeps `time` and `minutes` as free-typed text and parses them
 * at save, so that a half-typed "9:" is not a block at nine - see
 * `DraftBlock`. The timeline draws what is typed so far, which means the
 * same parse, per keystroke, and a block with nothing readable in its time
 * simply floats rather than jumping to midnight.
 */
function drawable(block: DraftBlock): DrawableBlock {
  const minutes = parseMinutesInput(block.minutes)
  return {
    ...(block.id === undefined ? {} : { id: block.id }),
    title: block.title,
    ...(/^\d{1,2}:\d{2}$/.test(block.time.trim()) ? { time: block.time.trim() } : {}),
    ...(minutes === undefined ? {} : { minutes }),
    category: block.category,
    core: block.core,
  }
}

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
  /** Which of `AppData.categories` colours the task this block stamps. */
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
  /** What the block says when it lands on a day - see TemplateBlock.note. */
  note?: string
  /** Whether its note shows without a press - see TemplateBlock.noteExpanded. */
  noteExpanded?: boolean
  /** One of the day's three that matter - see TemplateBlock.highlight. */
  highlight?: boolean
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
  /** The category list, so the block row offers what this person actually uses. */
  categories: Category[]
  onSave: (draft: Draft) => void
  onCancel: () => void
}

// A standalone component, mounted only while a draft is open, so it can own
// its own transient state (the current draft, and the in-progress block-add
// fields) and lose all of it for free on unmount - no manual reset calls
// needed on save or cancel the way a single shared state tree would need.
function TemplateEditor({ initial, sleepProfiles, libraryLists, categories, onSave, onCancel }: TemplateEditorProps) {
  const [draft, setDraft] = useState<Draft>(initial)
  // Closed on every open, including on a template that already carries a
  // type: the value is on the line above it either way, and what is hidden
  // is the question, not the answer.
  const [typeOpen, setTypeOpen] = useState(false)
  // Which block has its note open, by position. Closed on a reorder and on a
  // removal rather than followed, because a panel that lands on a different
  // block than the one it was opened for is worse than one that shuts.
  const [noteOpen, setNoteOpen] = useState<number | null>(null)
  // Why a KEY press did nothing, said once and cleared by the next one. A
  // refusal with no reason is the app being obstinate.
  const [keyNote, setKeyNote] = useState<string | null>(null)
  const [blockTime, setBlockTime] = useState('')
  const [blockTitle, setBlockTitle] = useState('')
  const [blockCore, setBlockCore] = useState(false)
  const [blockUnbounded, setBlockUnbounded] = useState(false)
  // What the next block draws from, answered before it exists - the shape
  // the week editor has always had and this one did not, so a reading block
  // here meant adding it first and then finding its row again.
  const [blockLibraryListId, setBlockLibraryListId] = useState<string | undefined>(undefined)
  // Opens holding an answer, the rule every control in this app keeps
  // (CONVENTIONS section 16): the length quick-add last used. It opened
  // empty and read as the bare word "min". No length is one press away in
  // the control's panel.
  const [blockMinutes, setBlockMinutes] = useState(() => String(readLastDuration()))
  // Sticks between blocks on purpose: a template is usually built in runs of
  // the same kind of thing (three work blocks, then two meals), so carrying
  // the last choice forward is right far more often than resetting to the
  // default would be. The size sticks for the same reason; the time, the
  // title and the two marks clear on add.
  const [blockCategory, setBlockCategory] = useState<CategoryId>(() => defaultCategoryId(categories))
  const nameRef = useRef<HTMLInputElement>(null)
  const blockListRef = useRef<HTMLUListElement>(null)
  // The index doubles as the id here: a draft block has no id of its own, and
  // the list is short enough that its position is a stable identity for the
  // length of one drag.
  const blockReorder = useListReorder(blockListRef, (id, to) => moveBlock(Number(id), to))

  // What the time field's hour column paints. A template has no day behind
  // it, so its own blocks are the busy stretches - read through the same
  // conversion the picture above the list uses, so the hours the field calls
  // taken are exactly the ones the timeline draws.
  const taken = useMemo(() => takenBlocks(blocksAsTasks(draft.blocks.map(drawable)), categories), [draft.blocks, categories])
  const waking = windowFor(draft.sleepProfileId, { profiles: sleepProfiles })

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
          libraryListId: blockLibraryListId,
        },
      ],
    }))
    setBlockTime('')
    setBlockTitle('')
    setBlockCore(false)
    setBlockUnbounded(false)
    // The binding is not cleared, the way the time and the category are
    // not: somebody adding a reading block is usually adding two.
  }

  function removeBlock(index: number) {
    setNoteOpen(null)
    setDraft(d => ({ ...d, blocks: d.blocks.filter((_, i) => i !== index) }))
  }

  function toggleBlockCore(index: number) {
    setDraft(d => ({
      ...d,
      blocks: d.blocks.map((b, i) => (i === index ? { ...b, core: !b.core } : b)),
    }))
  }

  /**
   * KEY on a block, refused past three on the day and saying which three.
   * A day template is one day, so every block on it is on the same day.
   */
  function toggleBlockKey(index: number) {
    setDraft(d => {
      const block = d.blocks[index]
      const verdict = canMarkKey(
        d.blocks.map((b, i) => ({ id: String(i), title: b.title, time: b.time, highlight: b.highlight })),
        { id: String(index), title: block.title, time: block.time, highlight: block.highlight },
      )
      setKeyNote(verdict.message ?? null)
      if (!verdict.allowed) return d
      return { ...d, blocks: d.blocks.map((b, i) => (i === index ? { ...b, highlight: !b.highlight } : b)) }
    })
  }

  function setBlockNote(index: number, note: string) {
    setDraft(d => ({ ...d, blocks: d.blocks.map((b, i) => (i === index ? { ...b, note } : b)) }))
  }

  function setBlockExpanded(index: number, noteExpanded: boolean) {
    setDraft(d => ({ ...d, blocks: d.blocks.map((b, i) => (i === index ? { ...b, noteExpanded } : b)) }))
  }

  function setBlockLibrary(index: number, libraryListId: string | undefined) {
    setDraft(d => ({
      ...d,
      blocks: d.blocks.map((b, i) => (i === index ? { ...b, libraryListId } : b)),
    }))
  }

  /**
   * Moves a block to another position, clamped rather than refused.
   *
   * A drop past either end is somebody meaning "first" or "last", not a
   * mistake to reject - the same reading `moveLaterItem` already takes of
   * the same gesture.
   */
  function moveBlock(from: number, to: number) {
    setNoteOpen(null)
    setDraft(d => {
      const target = Math.max(0, Math.min(d.blocks.length - 1, to))
      if (from === target) return d
      const blocks = [...d.blocks]
      const [moved] = blocks.splice(from, 1)
      blocks.splice(target, 0, moved)
      return { ...d, blocks }
    })
  }

  function toggleBlockUnbounded(index: number) {
    setDraft(d => ({
      ...d,
      blocks: d.blocks.map((b, i) => (i === index ? { ...b, unbounded: !b.unbounded } : b)),
    }))
  }

  // The word on the summary line. A template saved before day types existed
  // has no type at all and is a full day everywhere else in the app, so it
  // says so here too rather than falling back to a blank line.
  const typeLabel = DAY_TYPES.find(t => t.value === draft.type)?.label ?? 'Full day'

  return (
    <div className="template-editor">
      {/* The name, and the colour as a bullet beside it. This opened with a
          row of eight 32px balls above the field: the largest and most
          saturated thing on a form about a day's worth of blocks, and seven of
          the eight were answers nobody had chosen. See ColorSwatchPicker. */}
      <div className="template-name-row">
        <input
          ref={nameRef}
          placeholder="Template name"
          value={draft.name}
          onChange={e => setDraft({ ...draft, name: e.target.value })}
        />
        <ColorSwatchPicker
          colors={TEMPLATE_COLORS}
          value={draft.color}
          label="Template colour"
          nameOf={paletteColorName}
          onChange={color => setDraft({ ...draft, color })}
        />
      </div>
      {/* The day type: one quiet line under the name, and the four values
          one press behind it.

          It used to open the form - a segmented control of four buttons
          above the timeline and the blocks, the largest question on a screen
          that exists to hold a day's worth of blocks, and the answer is Full
          day on all but a handful of templates anybody builds. The mechanism
          is untouched. All four values still exist, still save, still stamp,
          and still decide what `dayScore` counts; shift and night are still
          separate values for the reason types.ts gives. What changed is how
          much room a rare question takes before it is asked - CONVENTIONS
          section 25, a state has to earn its place, applied to a control.

          The value is always on screen, because the value is a fact about
          this template. Only the choosing is folded away. */}
      <div className="day-type">
        <button
          type="button"
          className="day-type-summary"
          aria-expanded={typeOpen}
          aria-controls="day-type-options"
          aria-label={`Day type: ${typeLabel}. Change`}
          onClick={() => setTypeOpen(open => !open)}
        >
          <span>{typeLabel}</span>
          <span className="day-type-change">change</span>
        </button>
        {typeOpen && (
          <div className="day-type-options" id="day-type-options">
            <div className="day-type-picker">
              <Explain id="day-type">
                <span className="muted">Day type</span>
              </Explain>
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
            {/* What the choice changes, in the words of the value selected -
                what counts toward the day, which is the whole of what a day
                type does. The four labels say what a day is called; this
                says what picking one does. */}
            <p className="muted day-type-note" aria-live="polite">
              <Explain id={`day-type-${draft.type}` as const} inline />
            </p>
            {/* And what it does not do. The window free time is measured
                against comes from the sleep schedule the template points at
                - see computeCapacity, which takes a profile id and no day
                type at all - so the question the four buttons raise is
                answered here rather than left to be guessed. Only where
                there is a second schedule to point at: with one, there is
                nothing this could change. */}
            {sleepProfiles.length > 1 && (
              <p className="muted day-type-note">
                Free time is measured against the sleep schedule, not against this.
              </p>
            )}
          </div>
        )}
      </div>
      {sleepProfiles.length > 1 && (
        <div className="day-type-picker">
          <Explain id="sleep-schedule">
            <span className="muted">Sleep schedule</span>
          </Explain>
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
      {/* The template as the day it makes, live - see TemplateTimeline. A
          list says what is on the day; only the picture says whether there
          is room for it, which is the question a template is about. */}
      <TemplateTimeline
        blocks={draft.blocks.map(drawable)}
        sleepProfileId={draft.sleepProfileId}
        color={draft.color}
        ghostKey={GHOST_KEY}
      />

      <ul className="block-list" ref={blockListRef}>
        {draft.blocks.map((b, i) => (
          <li
            key={i}
            className={[
              b.highlight ? 'is-key' : '',
              blockReorder.draggingId === String(i) ? 'is-dragging' : '',
              blockReorder.overIndex === i && blockReorder.draggingId !== null && blockReorder.draggingId !== String(i)
                ? 'is-over'
                : '',
            ]
              .filter(Boolean)
              .join(' ')}
            data-reorder-index={i}
            style={{ ['--cat' as string]: categoryColor(b.category, categories) } as React.CSSProperties}
          >
            <span className="block-cat-edge" aria-hidden="true" />
            {/* The order of a template's blocks is a list somebody builds top
                to bottom, and until v2.0 the only way to change one was to
                delete it and add it again in the right place. Dragged with a
                finger or a pointer, nudged a place at a time with the arrows -
                the same grip Later and the library lists already use. */}
            <button
              type="button"
              className="library-item-grip"
              aria-label={`Reorder ${b.title}, position ${i + 1} of ${draft.blocks.length}`}
              onPointerDown={e => blockReorder.start(String(i), i, e)}
              onKeyDown={e => {
                if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
                e.preventDefault()
                moveBlock(i, i + (e.key === 'ArrowUp' ? -1 : 1))
              }}
            >
              <span className="library-item-grip-dots" aria-hidden="true" />
            </button>
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
            {/* The day's three that matter, set here rather than every
                morning on the day itself. Not gated on draft.type: KEY is
                about which three things matter, which every kind of day
                has, while Core above is about what counts on a day type
                that does not score everything. */}
            <button
              type="button"
              aria-pressed={!!b.highlight}
              aria-label={b.highlight ? `${b.title} is a key task` : `Mark ${b.title} as a key task`}
              className={b.highlight ? 'core-toggle active' : 'core-toggle'}
              onClick={() => toggleBlockKey(i)}
            >
              Key
            </button>
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
                different lists.

                No label and no way to make a list, unlike the add row below
                and the week editor's open block - this is a row of seven
                controls per block on a list that can be nine blocks long, and
                a word plus a plus on every one of them is sixteen more things
                to read. The add row is where a list gets made; this is where
                one gets chosen, and by the time somebody is here there is
                something to choose. Still hidden while the library is empty,
                for the same reason: nothing to choose from and nowhere here
                to say so. */}
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
            <BlockNoteButton
              note={b.note}
              open={noteOpen === i}
              label={b.title}
              onToggle={() => setNoteOpen(open => (open === i ? null : i))}
            />
            <button className="block-remove" aria-label={`Remove ${b.title}`} onClick={() => removeBlock(i)}>
              &times;
            </button>
            {/* What the control above it will actually put on a day. A list is
                not a book, and the control names a list - so somebody binding
                one had to stamp a day to find out what they had done. The
                empty case is an answer rather than an error and says so; see
                bindingLine. */}
            {b.libraryListId && (
              <p className="block-binding">{bindingLine(libraryLists.find(l => l.id === b.libraryListId))}</p>
            )}
            {noteOpen === i && (
              <BlockNotePanel
                note={b.note}
                label={b.title}
                category={b.category}
                expanded={b.noteExpanded}
                onNote={next => setBlockNote(i, next)}
                onExpanded={next => setBlockExpanded(i, next)}
              />
            )}
          </li>
        ))}
      </ul>
      {keyNote && (
        <p className="template-key-note" role="status">
          {keyNote}
        </p>
      )}
      {/* Two levels, not one. This was a single row carrying a time, a title
          field, a duration, six category dots, Core, Ongoing and Add - eight
          controls competing with the one thing anybody actually types. The
          words are the top line now; everything that qualifies them is the
          second, where it can be ignored until it is wanted. */}
      <div className="block-add">
        <div className="block-add-line">
          <TimePicker
            value={blockTime}
            onChange={setBlockTime}
            placeholder="09:00"
            ariaLabel="Block time"
            taken={taken}
            wakingStart={waking.start}
            /* What is being built, drawn on the picture above while the time
               is chosen: its real place, its real length and whatever it runs
               into - see lib/timeGhost.ts. The length and the colour are the
               two the row beneath already holds, so the candidate is the
               block that would actually be added rather than a marker. */
            ghost={{ key: GHOST_KEY, minutes: parseMinutesInput(blockMinutes), color: categoryColor(blockCategory, categories) }}
          />
          <ReturnField>
            <input
              className="has-return"
              placeholder="What happens"
              aria-keyshortcuts="Enter"
              value={blockTitle}
              onChange={e => setBlockTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addBlock()}
            />
          </ReturnField>
          <DurationControl
            minutes={blockMinutes.trim() === '' ? undefined : Number(blockMinutes)}
            allowEmpty
            stepperLabel="How long, in minutes"
            onChange={minutes => setBlockMinutes(minutes === undefined ? '' : String(minutes))}
          />
        </div>
        <div className="block-add-marks">
        {/* The same swatches as quick-add on the day view, for the same
            reason - a template is where most tasks actually get their colour,
            since a stamped day arrives already sorted. */}
        <div className="category-picker" role="group" aria-label="Category for the new block">
          {categories.map(c => (
            <button
              key={c.id}
              type="button"
              className={c.id === blockCategory ? 'category-swatch selected' : 'category-swatch'}
              style={{ ['--cat' as string]: resolvedColor(c) } as React.CSSProperties}
              aria-pressed={c.id === blockCategory}
              aria-label={c.label}
              data-tip={c.label}
              onClick={() => setBlockCategory(c.id)}
            />
          ))}
          {/* Made here rather than four screens away - see
              CategoryQuickAdd.tsx. The pencil is only on the one that is
              chosen, which is the one anybody is about to want to fix. */}
          {blockCategory !== undefined && categories.some(c => c.id === blockCategory) && (
            <CategoryEdit
              category={categories.find(c => c.id === blockCategory)!}
              categories={categories}
            />
          )}
          <CategoryQuickAdd categories={categories} onMade={setBlockCategory} />
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
        {/* On the button rather than as a standing sentence under the form.
            The sentence was there, it read "Ongoing blocks never get pushed
            to tomorrow or need a decision", and it sat above a list of blocks
            two scroll-lengths from the toggle it described. */}
        <Explain id="ongoing">
          <button
            type="button"
            aria-pressed={blockUnbounded}
            aria-label={blockUnbounded ? 'New block is ongoing' : 'Mark new block as ongoing'}
            className={blockUnbounded ? 'core-toggle active' : 'core-toggle'}
            onClick={() => setBlockUnbounded(v => !v)}
          >
            Ongoing
          </button>
        </Explain>
        {/* And what it draws from, before it exists. The week editor has
            asked this on its add row since the feature shipped; this one
            only asked it afterwards, on the block row, so the answer came
            after the question was over. */}
        <LibraryBindingField
          id="block-add-library"
          lists={libraryLists}
          value={blockLibraryListId}
          onChange={setBlockLibraryListId}
        />
        {/* The button stays, and it is not a double of the mark in the title
            field: the mark is for the hand already on the keys, this is the
            answer for anybody who has never tried Return. What went with the
            mark is the tooltip that used to say the same sentence here, which
            needed a pointer resting on it to say anything at all -
            CONVENTIONS 23. */}
        <button className="btn-secondary" onClick={addBlock}>
          Add a block
        </button>
        </div>
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
  /**
   * The week draft, when one is open. Two states rather than one tagged
   * union: the two editors share a name, a colour and a block list and
   * nothing else, and pretending otherwise would mean every field in both
   * being optional in the other.
   */
  const [weekDraft, setWeekDraft] = useState<(WeekDraft & { id?: string }) | null>(null)
  /** Open while "New template" has been pressed and the kind is still open. */
  const [asking, setAsking] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  function startEdit(t: Template) {
    setConfirmDeleteId(null)
    setAsking(false)
    if (t.kind === 'week') {
      setWeekDraft({
        id: t.id,
        name: t.name,
        color: t.color,
        type: t.type ?? 'full',
        sleepProfileId: t.sleepProfileId,
        weekDays: t.weekDays ?? {},
        blocks: t.blocks,
      })
      return
    }
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
        category: b.category ?? defaultCategoryId(data.categories),
        core: b.core ?? false,
        unbounded: b.unbounded ?? false,
        minutes: b.minutes !== undefined ? String(b.minutes) : '',
        libraryListId: b.libraryListId,
        note: b.note,
        noteExpanded: b.noteExpanded,
        highlight: b.highlight,
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

  function saveWeek() {
    const next = weekDraft
    if (!next || !next.name.trim()) return
    const shared = {
      name: next.name.trim(),
      color: next.color,
      type: next.type,
      sleepProfileId: next.sleepProfileId,
      weekDays: Object.keys(next.weekDays).length > 0 ? next.weekDays : undefined,
    }
    const existing = next.id ? data.templates.find(x => x.id === next.id) : undefined
    if (existing) {
      actions.updateTemplate({ ...existing, ...shared, kind: 'week', blocks: next.blocks })
    } else {
      // addTemplate mints its own block ids, and the week editor has already
      // minted them - it has to, because a group is a set of ids and Add to
      // makes five blocks at once. Passing the blocks through updateTemplate
      // on a freshly made shell is what keeps both true.
      const made = actions.addTemplate({ ...shared, kind: 'week', blocks: [] })
      actions.updateTemplate({ ...made, ...shared, kind: 'week', blocks: next.blocks })
    }
    setWeekDraft(null)
  }

  /**
   * Turns a day template into a week, by putting its blocks on all seven and
   * grouping each one across them.
   *
   * The offer this answers is "start from a day template": most weeks are one
   * shape with three differences in it, and typing the shape seven times to
   * get at the differences is the work this feature exists to remove. It
   * copies rather than converting - the day template it started from is
   * untouched and still stampable - because a person trying this out should
   * not lose the thing that already worked.
   */
  function expandToWeek(from: Template) {
    setConfirmDeleteId(null)
    setDraft(null)
    setAsking(false)
    const blocks = from.blocks.flatMap(b => {
      const groupId = crypto.randomUUID()
      return [1, 2, 3, 4, 5, 6, 0].map(weekday => ({ ...b, id: crypto.randomUUID(), weekday, groupId }))
    })
    setWeekDraft({
      name: `${from.name} week`,
      color: from.color,
      type: from.type ?? 'full',
      sleepProfileId: from.sleepProfileId,
      weekDays: {},
      blocks,
    })
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
      // Blank is absent, so a note opened and left empty does not become a
      // field on every block it was opened on.
      note: b.note?.trim() || undefined,
      noteExpanded: b.noteExpanded || undefined,
      highlight: b.highlight || undefined,
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
        {!draft && !weekDraft && !asking && (
          <button
            className="primary"
            onClick={() => {
              setConfirmDeleteId(null)
              setAsking(true)
            }}
          >
            New template
          </button>
        )}
      </div>

      {/* The one question a new template asks, before anything else, because
          it is the only one that cannot be changed afterwards: a day and a
          week are the same entity but not the same editor, and switching
          halfway would mean throwing away either six columns or six days'
          worth of blocks. */}
      {asking && (
        <div className="template-kind">
          <p className="muted">One day, or a whole week?</p>
          <div className="template-kind-choices">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setAsking(false)
                setDraft(emptyDraft())
              }}
            >
              <strong>A day</strong>
              <Explain id="template-day" inline />
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setAsking(false)
                setWeekDraft({ name: '', color: TEMPLATE_COLORS[0], type: 'full', weekDays: {}, blocks: [] })
              }}
            >
              <strong>A week</strong>
              <Explain id="template-week" inline />
            </button>
          </div>
          {data.templates.some(x => x.kind !== 'week') && (
            <p className="muted template-kind-from">
              Or start a week from a day you already have:{' '}
              {data.templates
                .filter(x => x.kind !== 'week')
                .map(x => (
                  <button key={x.id} type="button" className="chip" onClick={() => expandToWeek(x)}>
                    {x.name}
                  </button>
                ))}
            </p>
          )}
          <button type="button" className="setting-quiet" onClick={() => setAsking(false)}>
            Cancel
          </button>
        </div>
      )}

      {weekDraft && (
        <WeekTemplateEditor
          key={weekDraft.id ?? 'new-week'}
          draft={weekDraft}
          onChange={next => setWeekDraft({ ...next, id: weekDraft.id })}
          onSave={saveWeek}
          onCancel={() => setWeekDraft(null)}
        />
      )}

      {draft && (
        <TemplateEditor
          sleepProfiles={data.settings.sleepProfiles}
          libraryLists={data.library}
          categories={data.categories}
          key={draft.id ?? 'new'}
          initial={draft}
          onSave={saveDraft}
          onCancel={() => setDraft(null)}
        />
      )}

      {!draft && !weekDraft && !asking && data.templates.length === 0 && (
        <div className="first-run">
          <p className="empty">
            No templates yet - start from one of these, or build your own with New template above.
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
              {/* A week's card says its shape instead of its first four
                  titles: three heavy days and a hollow Thursday is a fact you
                  can read from seven small bars and cannot read from
                  "Gym · Deep work · Lunch +20 more", which is what the same
                  preview would say about every week ever built. */}
              {t.kind === 'week' ? (
                <WeekPreview template={t} />
              ) : (
                <span className="template-preview">
                  {t.blocks.length === 0
                    ? 'Empty - nothing in it yet'
                    : t.blocks
                        .slice(0, PREVIEW_BLOCKS)
                        .map(b => b.title)
                        .join(' · ') + (t.blocks.length > PREVIEW_BLOCKS ? ` +${t.blocks.length - PREVIEW_BLOCKS} more` : '')}
                </span>
              )}
              <span className="template-meta">
                {t.kind === 'week' && 'A week · '}
                {t.blocks.length} {t.blocks.length === 1 ? 'block' : 'blocks'}
                {t.type && t.type !== 'full' && ` · ${DAY_TYPES.find(d => d.value === t.type)?.label ?? t.type}`}
                {t.sleepProfileId && data.settings.sleepProfiles.length > 1 &&
                  ` · ${data.settings.sleepProfiles.find(p => p.id === t.sleepProfileId)?.name ?? ''}`}
              </span>
            </div>
            <button className="btn-secondary" aria-label={`Edit ${t.name}`} onClick={() => startEdit(t)}>
              Edit
            </button>
            {/* Outlined from the start, filled once armed - the two states
                CONVENTIONS section 6 describes. It used to be a plain button
                until the first press, which made the control that destroys a
                template look exactly like the one beside it that opens it. */}
            <button
              aria-label={confirmDeleteId === t.id ? `Confirm delete ${t.name}` : `Delete ${t.name}`}
              className={confirmDeleteId === t.id ? 'btn-danger is-armed' : 'btn-danger'}
              onClick={() => handleDeleteClick(t)}
              onBlur={() => setConfirmDeleteId(prev => (prev === t.id ? null : prev))}
            >
              {confirmDeleteId === t.id ? 'Delete?' : 'Delete'}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
