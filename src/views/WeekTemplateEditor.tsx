import { useEffect, useMemo, useRef, useState } from 'react'
import { PALETTE_COLORS, paletteColorName } from '../lib/colors'
import { categoryColor, resolvedColor } from '../lib/categories'
import { useAppData } from '../lib/store'
import { formatDuration, parseMinutesInput, windowFor } from '../widgets/day-plan/capacity'
import { readLastDuration } from '../widgets/day-plan/quickAddPrefs'
import type { CategoryId } from '../lib/categories'
import type { DayType, Template, TemplateBlock, WeekDayOverride } from '../lib/types'
import { ColorSwatchPicker } from './ColorSwatchPicker'
import { DurationControl } from './DurationControl'
import { Explain } from './Explain'
import { TemplateTimeline } from './TemplateTimeline'
import { blocksAsTasks } from './templateDay'
import { takenBlocks } from './takenHours'
import { TimePicker } from './TimePicker'
import { BlockNoteButton, BlockNotePanel } from './BlockNote'
import { canMarkKey } from './blockHighlights'
import { CategoryEdit, CategoryQuickAdd } from './CategoryQuickAdd'

const TEMPLATE_COLORS = PALETTE_COLORS.map(c => c.value)

/**
 * The week, Monday first, in the numbering `Date.getDay()` uses.
 *
 * The array is the reading order and the numbers are the storage order, and
 * they deliberately differ: 0 is Sunday because that is what the platform
 * says, and Sunday is last because that is what a week looks like. Every
 * other weekday map in this app - `WeekdayMap`, `Template.weekDays`,
 * `TemplateBlock.weekday` - keys by the number, so nothing has to translate.
 */
const WEEK: { day: number; label: string; short: string }[] = [
  { day: 1, label: 'Monday', short: 'Mon' },
  { day: 2, label: 'Tuesday', short: 'Tue' },
  { day: 3, label: 'Wednesday', short: 'Wed' },
  { day: 4, label: 'Thursday', short: 'Thu' },
  { day: 5, label: 'Friday', short: 'Fri' },
  { day: 6, label: 'Saturday', short: 'Sat' },
  { day: 0, label: 'Sunday', short: 'Sun' },
]

const WEEKDAYS = [1, 2, 3, 4, 5]
const WEEKEND = [6, 0]
const ALL = WEEK.map(w => w.day)

const DAY_TYPES: { value: DayType; label: string }[] = [
  { value: 'full', label: 'Full day' },
  { value: 'shift', label: 'Shift' },
  { value: 'night', label: 'Overnight' },
  { value: 'rest', label: 'Rest' },
]

/** The word a column's day type shows when it is not being chosen. Absent
 *  means the column takes the week's own type, which is what the option in
 *  the select says too - the same words in both places. */
function typeLabel(type: DayType | undefined): string {
  return DAY_TYPES.find(t => t.value === type)?.label ?? 'Week default'
}

/**
 * The name one column answers to while a time is being chosen against it -
 * see `lib/timeGhost.ts`. Per weekday rather than per editor, so the
 * candidate is drawn on the day it would land on and on no other.
 */
export function ghostKeyFor(day: number): string {
  return `template:${day}`
}

/** Which days one press puts a block on. */
export type AddScope = 'day' | 'weekdays' | 'weekend' | 'all'

/**
 * The three named answers, kept as presets over the switches rather than as
 * the only answers available.
 *
 * They were the whole control until v2.12, and the argument for stopping
 * there is in DECISIONS: three names plus one picked day is four things to
 * understand, and a chip for every combination is thirty-one. What that
 * argument missed is that the days themselves are seven things, not
 * thirty-one, and they say every combination there is.
 */
export const PRESETS: { key: string; label: string; days: number[] }[] = [
  { key: 'weekdays', label: 'Weekdays', days: WEEKDAYS },
  { key: 'weekend', label: 'Weekend', days: WEEKEND },
  { key: 'all', label: 'All days', days: ALL },
]

/**
 * What one press will do, in words: the days by name while they can be read
 * at a glance, and a count once they cannot.
 *
 * Four is the line because "Adds to Mon, Tue, Wed, Thu" is already longer
 * than the row of switches above it, and past that the number is the thing
 * somebody actually wants to know.
 */
export function addsToLine(days: number[]): string {
  if (days.length === 0) return 'No days chosen - nothing to add to.'
  if (days.length === 7) return 'Adds to every day'
  const inWeekOrder = WEEK.filter(w => days.includes(w.day))
  if (inWeekOrder.length <= 4) return `Adds to ${inWeekOrder.map(w => w.short).join(', ')}`
  return `Adds to ${inWeekOrder.length} days`
}

export function daysFor(scope: AddScope, activeDay: number): number[] {
  if (scope === 'weekdays') return WEEKDAYS
  if (scope === 'weekend') return WEEKEND
  if (scope === 'all') return ALL
  return [activeDay]
}

export interface WeekDraft {
  name: string
  color: string
  type: DayType
  sleepProfileId?: string
  weekDays: Partial<Record<number, WeekDayOverride>>
  blocks: TemplateBlock[]
}

export interface WeekTemplateEditorProps {
  draft: WeekDraft
  onChange: (draft: WeekDraft) => void
  onSave: () => void
  onCancel: () => void
}

/**
 * Seven columns, one template.
 *
 * ## Why a week is a template rather than seven of them
 *
 * A week is the unit people actually plan in, and it was the one thing this
 * app could not hold. Building "my week" meant seven day templates, seven
 * entries in the weekday map, and seven places to edit when the gym rotation
 * changed - which is six more than anybody keeps up with. What that produced
 * in practice was one template called "Workday" stamped onto five different
 * days, and a Wednesday that was quietly wrong.
 *
 * ## The three things that make it not a chore
 *
 * - **"Add to".** Most of a week is the same on several days. One press puts
 *   a block on this day, the weekdays, the weekend, or all seven, and the
 *   blocks it makes share a `groupId` - so the next edit can ask "this day,
 *   or everywhere?" the way a repeating task already does.
 * - **Copy to.** The other half of the same idea, for a column somebody has
 *   already built: Monday, as it stands, onto Tuesday through Friday.
 * - **Drag.** A block on the wrong day is one gesture from the right one.
 *
 * ## And the question it asks once
 *
 * The scope of an edit is a standing choice above the columns, not a dialog
 * per press. A confirmation that appears every single time you touch a
 * grouped block is a confirmation people learn to dismiss without reading -
 * the same reasoning, and deliberately the same words, as the repeat scope in
 * the task detail sheet.
 */
export function WeekTemplateEditor({ draft, onChange, onSave, onCancel }: WeekTemplateEditorProps) {
  const data = useAppData()
  const nameRef = useRef<HTMLInputElement>(null)
  const [activeDay, setActiveDay] = useState(() => new Date().getDay())
  // Which days one press puts a block on. Seven switches rather than a
  // named scope, and it survives the add: the owner builds a rotation by
  // setting Mon and Thu once and typing three blocks, not by re-answering
  // the question for each of them. It starts on the column being worked in,
  // which is what the old default meant.
  const [addDays, setAddDays] = useState<number[]>(() => [new Date().getDay()])
  const [editScope, setEditScope] = useState<'one' | 'group'>('group')
  const [copyFrom, setCopyFrom] = useState<number | null>(null)
  // Which column has its day type open, if any. One at a time, and closed
  // on open: the seven column feet carried seven select boxes for a question
  // most weeks never answer, and the word each of them was showing was
  // "Week default". The value still shows; the choosing is a press away.
  const [typeOpenDay, setTypeOpenDay] = useState<number | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  // Which block has its note open. One at a time, and the panel is drawn
  // under all seven columns rather than inside one of them: a column is a
  // seventh of the width and a recipe is not.
  const [noteBlockId, setNoteBlockId] = useState<string | null>(null)
  // Why a KEY press did nothing. One line, cleared by the next press.
  const [keyNote, setKeyNote] = useState<string | null>(null)

  const [blockTime, setBlockTime] = useState('')
  const [blockTitle, setBlockTitle] = useState('')
  // Opens holding an answer, the rule every control in this app keeps
  // (CONVENTIONS section 16): the length quick-add last used, which is the
  // length this person's blocks tend to be. It opened empty and read as
  // the bare word "min", which the owner took for a field that had lost
  // its number. No size is still one press away in the control's panel.
  const [blockMinutes, setBlockMinutes] = useState(() => String(readLastDuration()))
  // The first category, so one dot is lit from the start: six dark dots
  // with none chosen read as six dots that do not work.
  const [blockCategory, setBlockCategory] = useState<CategoryId | undefined>(() => data.categories[0]?.id)
  const [blockUnbounded, setBlockUnbounded] = useState(false)
  const [blockLibraryListId, setBlockLibraryListId] = useState<string | undefined>(undefined)

  const dragRef = useRef<{ id: string; x: number; y: number } | null>(null)
  const sleepProfiles = data.settings.sleepProfiles
  const categories = data.categories
  const grouped = draft.blocks.some(b => b.groupId)

  // What the time field's hour column paints: the blocks already on the days
  // this press would put the new one on. Adding to the weekdays is one
  // question about five days at once, so an hour taken on any of them is an
  // hour the block would land on something - which is the thing worth knowing
  // before the time is chosen rather than after.
  const taken = useMemo(() => {
    return takenBlocks(blocksAsTasks(draft.blocks.filter(b => b.weekday !== undefined && addDays.includes(b.weekday))), categories)
  }, [draft.blocks, addDays, categories])
  const waking = windowFor(draft.sleepProfileId, { profiles: sleepProfiles })

  useEffect(() => {
    nameRef.current?.focus()
  }, [])

  // Dropping a block on another column moves it there. Ends on the document
  // rather than on the block, because a pointer that left the block is
  // exactly the pointer this is for.
  useEffect(() => {
    function end(e: PointerEvent) {
      const drag = dragRef.current
      dragRef.current = null
      setDraggingId(null)
      if (!drag) return
      const target = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-wt-day]')
      const day = target?.dataset.wtDay
      if (day === undefined) return
      onChange({
        ...draft,
        blocks: draft.blocks.map(b => (b.id === drag.id ? { ...b, weekday: Number(day) } : b)),
      })
    }
    document.addEventListener('pointerup', end)
    document.addEventListener('pointercancel', end)
    return () => {
      document.removeEventListener('pointerup', end)
      document.removeEventListener('pointercancel', end)
    }
  }, [draft, onChange])

  // The block whose note is open, resolved rather than held: it is removed
  // and re-made by every edit above, so a held copy would go stale.
  const noteBlock = draft.blocks.find(b => b.id === noteBlockId)

  function toggleAddDay(day: number) {
    setAddDays(days => (days.includes(day) ? days.filter(d => d !== day) : [...days, day]))
  }

  function blocksOn(day: number) {
    return draft.blocks.filter(b => b.weekday === day)
  }

  function addBlocks() {
    const title = blockTitle.trim()
    if (!title) return
    const targets = addDays
    // A group only exists where there is something to group. One block on one
    // day is a block, and giving it a group of one would mean the edit scope
    // question appears for something that has nowhere else to apply.
    const groupId = targets.length > 1 ? crypto.randomUUID() : undefined
    const made: TemplateBlock[] = targets.map(day => ({
      id: crypto.randomUUID(),
      time: blockTime || undefined,
      title,
      minutes: parseMinutesInput(blockMinutes),
      category: blockCategory,
      unbounded: blockUnbounded || undefined,
      libraryListId: blockLibraryListId,
      weekday: day,
      groupId,
    }))
    onChange({ ...draft, blocks: [...draft.blocks, ...made] })
    // The title clears; the size stays, like the category, because the next
    // block is usually the same kind of thing as the last.
    setBlockTitle('')
  }

  /**
   * Writes a note or a list of steps onto a block, and onto its group where
   * the scope above says so - the same reading `removeBlock` takes of the
   * same choice, and for the same reason: a block put on five days by one
   * press is one thing to the person who made it.
   */
  function editBlock(block: TemplateBlock, change: Partial<TemplateBlock>) {
    const hits =
      editScope === 'group' && block.groupId
        ? (b: TemplateBlock) => b.groupId === block.groupId
        : (b: TemplateBlock) => b.id === block.id
    onChange({ ...draft, blocks: draft.blocks.map(b => (hits(b) ? { ...b, ...change } : b)) })
  }

  /**
   * KEY on a block, checked against every day it would be marked on.
   *
   * A block on five days is five days' worth of the question, and any one
   * of them being full is a no - a template that marked four things on
   * Wednesday and three everywhere else would be a template that quietly
   * did something different on Wednesday. The first day that refuses is the
   * one named, because that is the one to go and look at.
   */
  function toggleBlockKey(block: TemplateBlock) {
    const affected =
      editScope === 'group' && block.groupId
        ? draft.blocks.filter(b => b.groupId === block.groupId)
        : [block]
    for (const one of affected) {
      const verdict = canMarkKey(blocksOn(one.weekday ?? -1), one)
      if (!verdict.allowed) {
        const label = WEEK.find(w => w.day === one.weekday)?.label ?? 'that day'
        setKeyNote(`${label}: ${verdict.message}`)
        return
      }
    }
    setKeyNote(null)
    editBlock(block, { highlight: !block.highlight })
  }

  function removeBlock(block: TemplateBlock) {
    const gone =
      editScope === 'group' && block.groupId
        ? (b: TemplateBlock) => b.groupId === block.groupId
        : (b: TemplateBlock) => b.id === block.id
    setNoteBlockId(null)
    onChange({ ...draft, blocks: draft.blocks.filter(b => !gone(b)) })
  }

  /**
   * Copies a column onto other days, as it stands.
   *
   * The copies and the original share a fresh group, because they were made
   * together and that is exactly what a group means here - the next edit can
   * treat them as one. Days that already hold the source column's own blocks
   * are skipped rather than doubled.
   */
  function copyColumn(from: number, scope: AddScope) {
    const source = blocksOn(from)
    if (source.length === 0) return
    const targets = daysFor(scope, activeDay).filter(d => d !== from)
    if (targets.length === 0) return

    const made: TemplateBlock[] = []
    const regrouped = new Map<string, string>()
    for (const block of source) {
      const groupId = regrouped.get(block.id) ?? crypto.randomUUID()
      regrouped.set(block.id, groupId)
      for (const day of targets) {
        made.push({ ...block, id: crypto.randomUUID(), weekday: day, groupId })
      }
    }
    onChange({
      ...draft,
      blocks: [
        ...draft.blocks.map(b => (regrouped.has(b.id) ? { ...b, groupId: regrouped.get(b.id) } : b)),
        ...made,
      ],
    })
    setCopyFrom(null)
  }

  function setOverride(day: number, patch: WeekDayOverride) {
    const current = draft.weekDays[day] ?? {}
    const next = { ...current, ...patch }
    const weekDays = { ...draft.weekDays }
    // An override equal to nothing is not stored. Absent is the state that
    // means "the template's own answer stands", and writing {} for it would
    // put a shape in the data that reads as a decision nobody made.
    if (next.type === undefined && next.sleepProfileId === undefined) delete weekDays[day]
    else weekDays[day] = next
    onChange({ ...draft, weekDays })
  }

  return (
    <div className="template-editor week-template-editor">
      <div className="template-name-row">
        <input
          ref={nameRef}
          placeholder="Week name"
          value={draft.name}
          onChange={e => onChange({ ...draft, name: e.target.value })}
        />
        <ColorSwatchPicker
          colors={TEMPLATE_COLORS}
          value={draft.color}
          label="Template colour"
          nameOf={paletteColorName}
          onChange={color => onChange({ ...draft, color })}
        />
      </div>

      {grouped && (
        <div className="segmented segmented-quiet wt-scope" role="group" aria-label="Edits apply to">
          <button
            type="button"
            className={editScope === 'group' ? 'active' : ''}
            aria-pressed={editScope === 'group'}
            onClick={() => setEditScope('group')}
          >
            Every day it is on
          </button>
          <button
            type="button"
            className={editScope === 'one' ? 'active' : ''}
            aria-pressed={editScope === 'one'}
            onClick={() => setEditScope('one')}
          >
            Just this day
          </button>
        </div>
      )}

      {/* The day the pressed column makes, at full width with its hours -
          seven narrow columns show the shape of a week, and this shows the
          detail of the one being worked on. */}
      <TemplateTimeline
        blocks={draft.blocks}
        weekday={activeDay}
        sleepProfileId={draft.weekDays[activeDay]?.sleepProfileId ?? draft.sleepProfileId}
        color={draft.color}
        ghostKey={ghostKeyFor(activeDay)}
      />

      <div className="wt-columns">
        {WEEK.map(({ day, label, short }) => {
          const blocks = blocksOn(day)
          const override = draft.weekDays[day]
          return (
            <section
              key={day}
              className={
                ['wt-column', day === activeDay ? 'is-active' : '', draggingId ? 'is-dropping' : '']
                  .filter(Boolean)
                  .join(' ')
              }
              data-wt-day={day}
              aria-label={label}
            >
              <button
                type="button"
                className="wt-day"
                aria-pressed={day === activeDay}
                aria-label={`${label}${day === activeDay ? ', the day Add to uses' : ''}`}
                onClick={() => setActiveDay(day)}
              >
                {short}
              </button>

              {/* The column as the day it makes. Its own scale, because a
                  column carries its own sleep - one shared scale down the
                  left would be a picture of a week where every day wakes at
                  the same hour, which is the thing a week template exists
                  to stop being true. */}
              <TemplateTimeline
                blocks={draft.blocks}
                weekday={day}
                sleepProfileId={override?.sleepProfileId ?? draft.sleepProfileId}
                color={draft.color}
                compact
                ghostKey={ghostKeyFor(day)}
              />

              <ul className="wt-blocks">
                {blocks.map(block => (
                  <li key={block.id} className={draggingId === block.id ? 'wt-block is-dragging' : 'wt-block'}>
                    <button
                      type="button"
                      className="wt-block-body"
                      aria-label={`${block.title} on ${label}. Drag to another day.`}
                      style={{ ['--cat' as string]: categoryColor(block.category, categories) } as React.CSSProperties}
                      onPointerDown={e => {
                        if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
                          e.currentTarget.releasePointerCapture(e.pointerId)
                        }
                        dragRef.current = { id: block.id, x: e.clientX, y: e.clientY }
                        setDraggingId(block.id)
                      }}
                    >
                      {block.time && <span className="wt-block-time">{block.time}</span>}
                      <span className="wt-block-title">{block.title}</span>
                      {block.minutes !== undefined && (
                        <span className="wt-block-size">{formatDuration(block.minutes)}</span>
                      )}
                      {block.libraryListId && (
                        <span className="wt-block-size">
                          from {data.library.find(l => l.id === block.libraryListId)?.name ?? 'a list'}
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      className={block.highlight ? 'wt-block-key is-on' : 'wt-block-key'}
                      aria-pressed={!!block.highlight}
                      aria-label={
                        block.highlight
                          ? `${block.title} on ${label} is a key task`
                          : `Mark ${block.title} on ${label} as a key task`
                      }
                      onClick={() => toggleBlockKey(block)}
                    >
                      Key
                    </button>
                    <BlockNoteButton
                      note={block.note}
                      steps={block.steps}
                      open={noteBlockId === block.id}
                      label={`${block.title} on ${label}`}
                      onToggle={() => setNoteBlockId(id => (id === block.id ? null : block.id))}
                    />
                    <button
                      type="button"
                      className="setting-remove"
                      aria-label={
                        editScope === 'group' && block.groupId
                          ? `Remove ${block.title} from every day it is on`
                          : `Remove ${block.title} from ${label}`
                      }
                      onClick={() => removeBlock(block)}
                    >
                      &times;
                    </button>
                  </li>
                ))}
                {blocks.length === 0 && <li className="wt-empty">No blocks yet</li>}
              </ul>

              <div className="wt-column-foot">
                {typeOpenDay === day ? (
                  <select
                    className="setting-select wt-day-type"
                    aria-label={`Day type for ${label}`}
                    autoFocus
                    value={override?.type ?? ''}
                    onChange={e => {
                      setOverride(day, { type: (e.target.value || undefined) as DayType | undefined })
                      setTypeOpenDay(null)
                    }}
                    onBlur={() => setTypeOpenDay(null)}
                  >
                    <option value="">Week default</option>
                    {DAY_TYPES.map(t => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <button
                    type="button"
                    className="wt-day-type-summary"
                    aria-expanded={false}
                    aria-label={`Day type for ${label}: ${typeLabel(override?.type)}. Change`}
                    onClick={() => setTypeOpenDay(day)}
                  >
                    {typeLabel(override?.type)}
                  </button>
                )}

                {sleepProfiles.length > 1 && (
                  <select
                    className="setting-select wt-day-sleep"
                    aria-label={`Sleep schedule for ${label}`}
                    value={override?.sleepProfileId ?? ''}
                    onChange={e => setOverride(day, { sleepProfileId: e.target.value || undefined })}
                  >
                    <option value="">Week default</option>
                    {sleepProfiles.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                )}

                {blocks.length > 0 && (
                  <Explain id="copy-to">
                    <button
                      type="button"
                      className="setting-quiet wt-copy"
                      aria-expanded={copyFrom === day}
                      onClick={() => setCopyFrom(copyFrom === day ? null : day)}
                    >
                      Copy to
                    </button>
                  </Explain>
                )}

                {copyFrom === day && (
                  <div className="wt-copy-panel" role="group" aria-label={`Copy ${label} to`}>
                    <button type="button" className="chip" onClick={() => copyColumn(day, 'weekdays')}>
                      Weekdays
                    </button>
                    <button type="button" className="chip" onClick={() => copyColumn(day, 'weekend')}>
                      Weekend
                    </button>
                    <button type="button" className="chip" onClick={() => copyColumn(day, 'all')}>
                      All days
                    </button>
                  </div>
                )}
              </div>
            </section>
          )
        })}
      </div>

      {/* The open block's note, under all seven columns rather than inside
          the one it belongs to. A column is a seventh of the editor and a
          recipe typed into a 110px box is a recipe nobody will type. The
          heading names the block and its day, because down here the panel
          has left the column that would have said so. */}
      {keyNote && (
        <p className="template-key-note" role="status">
          {keyNote}
        </p>
      )}

      {noteBlock && (
        <div className="wt-note">
          <span className="wt-note-head">
            {noteBlock.title}
            <span className="wt-note-day">
              {editScope === 'group' && noteBlock.groupId
                ? ' - on every day it is on'
                : ` - ${WEEK.find(w => w.day === noteBlock.weekday)?.label ?? ''}`}
            </span>
          </span>
          <BlockNotePanel
            note={noteBlock.note}
            steps={noteBlock.steps}
            label={noteBlock.title}
            onNote={next => editBlock(noteBlock, { note: next })}
            onSteps={next => editBlock(noteBlock, { steps: next })}
          />
        </div>
      )}

      {/* Two groups under two headings: what the block is, and where it
          goes. The day editor's add row has the first; a week needs the
          second, and it used to sit on the same line as the category dots,
          the library binding and Ongoing, with Add block alone at the far
          right of the line under it - eleven things in a row and the button
          that acted on them nowhere near them. The heading is the smallest
          register the app has, the one a field label uses. */}
      <div className="block-add">
        <div className="block-add-group">
        <span className="block-add-heading">What</span>
        <div className="block-add-line">
          <TimePicker
            value={blockTime}
            onChange={setBlockTime}
            placeholder="09:00"
            ariaLabel="Block time"
            taken={taken}
            wakingStart={waking.start}
            /* Drawn on the column being worked on, and on that one only: a
               block added while Wednesday is open is a Wednesday block, and
               the week's other six say nothing about it. */
            ghost={{ key: ghostKeyFor(activeDay), minutes: parseMinutesInput(blockMinutes), color: categoryColor(blockCategory, data.categories) }}
          />
          <input
            placeholder="What happens"
            value={blockTitle}
            onChange={e => setBlockTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addBlocks()}
          />
          <DurationControl
            minutes={blockMinutes.trim() === '' ? undefined : Number(blockMinutes)}
            allowEmpty
            stepperLabel="How long, in minutes"
            onChange={minutes => setBlockMinutes(minutes === undefined ? '' : String(minutes))}
          />
        </div>
        <div className="block-add-marks">
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
              <CategoryEdit category={categories.find(c => c.id === blockCategory)!} categories={categories} />
            )}
            <CategoryQuickAdd categories={categories} onMade={setBlockCategory} />
          </div>
          {/* The binding, per block, exactly as the day editor has it - a
              week is where it earns its keep, because "Reading on six days
              from MIND and on the Wednesday from CRAFT" is a sentence about a
              week and cannot be said with a day template at all. Hidden while
              the library is empty, so a template editor stays a template
              editor for the many people who never build a list. */}
          {data.library.length > 0 && (
            <select
              className="block-library"
              aria-label="What the new block draws from"
              value={blockLibraryListId ?? ''}
              onChange={e => setBlockLibraryListId(e.target.value || undefined)}
            >
              <option value="">Nothing</option>
              {data.library.map(list => (
                <option key={list.id} value={list.id}>
                  From {list.name}
                </option>
              ))}
            </select>
          )}
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
        </div>
        </div>

        <div className="block-add-group">
        <span className="block-add-heading">Where</span>
        <div className="block-add-where">
          <div className="wt-where-main">
          {/* Seven switches, not a list of named answers. A rotation of
              Mon/Thu, Tue/Fri, Wed/Sat has no name, and naming every
              combination is thirty-one chips - so the days themselves are
              the control and the names become presets on top of it. See
              DECISIONS, where the old argument and what overturned it both
              stand. */}
          <div className="wt-add-to" role="group" aria-label="Add to">
            <Explain id="add-to">
              <span className="muted">Add to</span>
            </Explain>
            <div className="wt-day-toggles">
              {WEEK.map(({ day, label, short }) => (
                <button
                  key={day}
                  type="button"
                  className={addDays.includes(day) ? 'wt-day-toggle is-on' : 'wt-day-toggle'}
                  aria-pressed={addDays.includes(day)}
                  aria-label={label}
                  data-tip={label}
                  onClick={() => toggleAddDay(day)}
                >
                  {/* The initial to read, the day to hear: two of these are
                      T and two are S, which is fine on a row somebody is
                      pointing at and useless to anybody who is not. */}
                  <span aria-hidden="true">{short[0]}</span>
                </button>
              ))}
            </div>
            {/* The fourth of the old named scopes, converted the same way
                the other three were. Without it, going from Weekdays to one
                Thursday block is four switches off - which the week
                editor&apos;s own browser walk caught the moment the switches
                landed. Named for the day so it cannot be read as the switch
                beside it. */}
            <div className="wt-presets">
            <button
              type="button"
              className="chip"
              onClick={() => setAddDays([activeDay])}
            >
              Only {WEEK.find(w => w.day === activeDay)!.short}
            </button>
            {PRESETS.map(({ key, label, days }) => (
              <button
                key={key}
                type="button"
                className="chip"
                // Not aria-pressed: a preset is a press that sets the
                // switches, and the switches are what holds the answer. A
                // preset that looked selected would be a second place the
                // same fact is kept - CONVENTIONS section 23.
                onClick={() => setAddDays(days)}
              >
                {label}
              </button>
            ))}
            </div>
          </div>

          {/* What the press will actually do, so nobody counts switches with
              their eyes. */}
          <p className="wt-add-summary" role="status">
            {addsToLine(addDays)}
          </p>
          </div>

          <button
            className="btn-secondary"
            disabled={!blockTitle.trim() || addDays.length === 0}
            onClick={addBlocks}
          >
            Add a block
          </button>
        </div>
        </div>
      </div>

      <div className="row">
        <button className="primary" disabled={!draft.name.trim()} onClick={onSave}>
          Save template
        </button>
        <button className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}

/**
 * Seven columns of what a week template holds, small enough for a card.
 *
 * A day template's card says "9 blocks", which is the whole of what there is
 * to say about one. A week's shape is the thing worth showing: three heavy
 * days and a hollow Thursday is a fact you can read at this size and cannot
 * read from "23 blocks".
 */
export function WeekPreview({ template }: { template: Template }) {
  const counts = WEEK.map(({ day, short }) => ({
    short,
    count: template.blocks.filter(b => b.weekday === day).length,
  }))
  const most = Math.max(1, ...counts.map(c => c.count))

  return (
    <span className="week-preview" aria-label={counts.map(c => `${c.short} ${c.count}`).join(', ')}>
      {counts.map(c => (
        <span key={c.short} className="week-preview-day" aria-hidden="true">
          <span className="week-preview-bar" style={{ height: `${Math.round((c.count / most) * 100)}%` }} />
          <span className="week-preview-label">{c.short[0]}</span>
        </span>
      ))}
    </span>
  )
}
