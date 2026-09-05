import { useEffect, useRef, useState } from 'react'
import { PALETTE_COLORS, paletteColorName } from '../lib/colors'
import { categoryColor, resolvedColor } from '../lib/categories'
import { useAppData } from '../lib/store'
import { formatDuration, parseMinutesInput } from '../widgets/day-plan/capacity'
import type { CategoryId } from '../lib/categories'
import type { DayType, Template, TemplateBlock, WeekDayOverride } from '../lib/types'
import { ColorSwatchPicker } from './ColorSwatchPicker'
import { DurationControl } from './DurationControl'
import { Explain } from './Explain'
import { TimePicker } from './TimePicker'

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

/** Which days one press puts a block on. */
export type AddScope = 'day' | 'weekdays' | 'weekend' | 'all'

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
  const [addScope, setAddScope] = useState<AddScope>('day')
  const [editScope, setEditScope] = useState<'one' | 'group'>('group')
  const [copyFrom, setCopyFrom] = useState<number | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)

  const [blockTime, setBlockTime] = useState('')
  const [blockTitle, setBlockTitle] = useState('')
  const [blockMinutes, setBlockMinutes] = useState('')
  const [blockCategory, setBlockCategory] = useState<CategoryId | undefined>(undefined)
  const [blockUnbounded, setBlockUnbounded] = useState(false)
  const [blockLibraryListId, setBlockLibraryListId] = useState<string | undefined>(undefined)

  const dragRef = useRef<{ id: string; x: number; y: number } | null>(null)
  const sleepProfiles = data.settings.sleepProfiles
  const categories = data.categories
  const grouped = draft.blocks.some(b => b.groupId)

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

  function blocksOn(day: number) {
    return draft.blocks.filter(b => b.weekday === day)
  }

  function addBlocks() {
    const title = blockTitle.trim()
    if (!title) return
    const targets = daysFor(addScope, activeDay)
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
    setBlockTitle('')
    setBlockMinutes('')
  }

  function removeBlock(block: TemplateBlock) {
    const gone =
      editScope === 'group' && block.groupId
        ? (b: TemplateBlock) => b.groupId === block.groupId
        : (b: TemplateBlock) => b.id === block.id
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
                {blocks.length === 0 && <li className="wt-empty">-</li>}
              </ul>

              <div className="wt-column-foot">
                <select
                  className="setting-select wt-day-type"
                  aria-label={`Day type for ${label}`}
                  value={override?.type ?? ''}
                  onChange={e => setOverride(day, { type: (e.target.value || undefined) as DayType | undefined })}
                >
                  <option value="">Same as the week</option>
                  {DAY_TYPES.map(t => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>

                {sleepProfiles.length > 1 && (
                  <select
                    className="setting-select wt-day-sleep"
                    aria-label={`Sleep schedule for ${label}`}
                    value={override?.sleepProfileId ?? ''}
                    onChange={e => setOverride(day, { sleepProfileId: e.target.value || undefined })}
                  >
                    <option value="">Same as the week</option>
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

      {/* The same two levels the day editor's add row has, plus the one thing
          only a week needs: which days one press puts this on. */}
      <div className="block-add">
        <div className="block-add-line">
          <TimePicker value={blockTime} onChange={setBlockTime} placeholder="09:00" ariaLabel="Block time" />
          <input
            placeholder="What happens"
            value={blockTitle}
            onChange={e => setBlockTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addBlocks()}
          />
          <DurationControl
            minutes={blockMinutes.trim() === '' ? undefined : Number(blockMinutes)}
            allowEmpty
            stepperLabel="Size in minutes"
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
                title={c.label}
                onClick={() => setBlockCategory(c.id)}
              />
            ))}
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

          <div className="wt-add-to" role="group" aria-label="Add to">
            <Explain id="add-to">
              <span className="muted">Add to</span>
            </Explain>
            {(
              [
                ['day', WEEK.find(w => w.day === activeDay)!.label],
                ['weekdays', 'Weekdays'],
                ['weekend', 'Weekend'],
                ['all', 'All days'],
              ] as [AddScope, string][]
            ).map(([scope, label]) => (
              <button
                key={scope}
                type="button"
                className={addScope === scope ? 'chip selected' : 'chip'}
                aria-pressed={addScope === scope}
                onClick={() => setAddScope(scope)}
              >
                {label}
              </button>
            ))}
          </div>

          <button className="btn-secondary" disabled={!blockTitle.trim()} onClick={addBlocks}>
            Add block
          </button>
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
