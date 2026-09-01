import { useEffect, useRef, useState } from 'react'
import { actions, useAppData } from '../../lib/store'
import { PALETTE_COLORS, paletteColorName } from '../../lib/colors'
import type { DayType, IfThenEntry, IfThenWhen } from '../../lib/types'

interface Draft {
  trigger: string
  action: string
  color?: string
  dayTypes?: DayType[]
  when?: IfThenWhen
}

const emptyDraft = (): Draft => ({ trigger: '', action: '', color: undefined, dayTypes: undefined, when: undefined })

const DAY_TYPE_OPTIONS: { value: DayType; label: string }[] = [
  { value: 'full', label: 'Full day' },
  { value: 'shift', label: 'Shift' },
  { value: 'night', label: 'Night' },
  { value: 'rest', label: 'Rest' },
]

// undefined stands for "any time" here, the same way it stands for "no
// tag" on the color picker below - selecting it writes an absent `when`
// rather than the literal string 'any', so a rule saved through the app
// always takes the plainer of the two equivalent shapes.
const WHEN_OPTIONS: { value: IfThenWhen | undefined; label: string }[] = [
  { value: undefined, label: 'Any time' },
  { value: 'morning', label: 'Morning' },
  { value: 'day', label: 'Day' },
  { value: 'evening', label: 'Evening' },
]

function dayTypesLabel(dayTypes: DayType[] | undefined): string | undefined {
  if (!dayTypes || dayTypes.length === 0) return undefined
  return dayTypes.map(dt => DAY_TYPE_OPTIONS.find(o => o.value === dt)?.label ?? dt).join(', ')
}

function whenLabel(when: IfThenWhen | undefined): string | undefined {
  if (!when || when === 'any') return undefined
  return WHEN_OPTIONS.find(o => o.value === when)?.label
}

interface IfThenFormProps {
  draft: Draft
  onChange: (draft: Draft) => void
  onSave: () => void
  onCancel: () => void
}

// Only one of these is ever mounted at a time - either the "new entry" form
// above the list, or one card's in-place edit form - so static ids are safe
// and do not need to be made unique per entry.
const TRIGGER_INPUT_ID = 'if-then-trigger-input'
const ACTION_INPUT_ID = 'if-then-action-input'
const TRIGGER_HINT_ID = 'if-then-trigger-hint'

function IfThenForm({ draft, onChange, onSave, onCancel }: IfThenFormProps) {
  const triggerRef = useRef<HTMLInputElement>(null)

  // Moves focus into the form the moment it appears, for both a brand new
  // entry and an in-place edit - otherwise a keyboard or screen reader user
  // has no way to know the form opened at all and has to tab blindly to
  // find it, which defeats the point of editing being "one click away".
  useEffect(() => {
    triggerRef.current?.focus()
  }, [])

  function toggleDayType(value: DayType) {
    const current = draft.dayTypes ?? []
    const next = current.includes(value) ? current.filter(v => v !== value) : [...current, value]
    onChange({ ...draft, dayTypes: next.length > 0 ? next : undefined })
  }

  return (
    <div className="if-then-form">
      <label className="visually-hidden" htmlFor={TRIGGER_INPUT_ID}>Trigger</label>
      <span className="if-then-prefix" aria-hidden="true">If</span>
      <input
        id={TRIGGER_INPUT_ID}
        ref={triggerRef}
        placeholder="I get home and the kitchen is a mess"
        value={draft.trigger}
        aria-describedby={TRIGGER_HINT_ID}
        onChange={e => onChange({ ...draft, trigger: e.target.value })}
      />
      <p id={TRIGGER_HINT_ID} className="muted if-then-hint">
        A specific moment, not a feeling - where you are, what just happened.
      </p>
      <label className="visually-hidden" htmlFor={ACTION_INPUT_ID}>Action</label>
      <span className="if-then-prefix" aria-hidden="true">Then</span>
      <input
        id={ACTION_INPUT_ID}
        placeholder="I set a timer for ten minutes and do only the sink"
        value={draft.action}
        onChange={e => onChange({ ...draft, action: e.target.value })}
      />
      <div className="palette">
        <button
          type="button"
          aria-label="No tag"
          aria-pressed={draft.color === undefined}
          className={draft.color === undefined ? 'swatch swatch-none selected' : 'swatch swatch-none'}
          onClick={() => onChange({ ...draft, color: undefined })}
        >
          &times;
        </button>
        {PALETTE_COLORS.map(c => (
          <button
            key={c.value}
            type="button"
            aria-label={`Tag ${c.name}`}
            aria-pressed={draft.color === c.value}
            className={draft.color === c.value ? 'swatch selected' : 'swatch'}
            style={{ background: c.value }}
            onClick={() => onChange({ ...draft, color: c.value })}
          />
        ))}
      </div>
      {/* Which days this rule is even eligible to surface on, and which
          part of the day - see docs/TIMELINE.md section 6. Both default to
          "every day, any time", so writing a rule works exactly as it
          always has if these are never touched. */}
      <div className="if-then-scope">
        <span className="muted">Applies on</span>
        <div className="if-then-scope-chips" role="group" aria-label="Day types this rule applies to">
          {DAY_TYPE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              className={draft.dayTypes?.includes(opt.value) ? 'chip selected' : 'chip'}
              aria-pressed={!!draft.dayTypes?.includes(opt.value)}
              onClick={() => toggleDayType(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="muted if-then-hint">Leave every option off to show this rule on every day.</p>
      </div>
      <div className="if-then-scope">
        <span className="muted">Time of day</span>
        <div className="segmented" role="group" aria-label="Time of day this rule applies to">
          {WHEN_OPTIONS.map(opt => (
            <button
              key={opt.label}
              type="button"
              className={draft.when === opt.value ? 'active' : ''}
              aria-pressed={draft.when === opt.value}
              onClick={() => onChange({ ...draft, when: opt.value })}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      <div className="row">
        <button className="primary" disabled={!draft.trigger.trim() || !draft.action.trim()} onClick={onSave}>
          Save
        </button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}

/**
 * The full if-then list: create, edit in place, delete, filter by tag.
 * This used to be its own stacked section on the day view - see
 * docs/TIMELINE.md section 6 for why it moved. It now only ever mounts
 * inside `IfThenSheet`, opened by tapping the one rule `IfThenDayRule`
 * surfaces there; this component itself does not know or care where it is
 * rendered, and reads its own slice of the store rather than taking data
 * as props.
 */
export function IfThenBoard() {
  const data = useAppData()
  const [editingId, setEditingId] = useState<string | 'new' | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft())
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [filterColor, setFilterColor] = useState<string | 'none' | null>(null)

  function startNew() {
    setConfirmDeleteId(null)
    setDraft(emptyDraft())
    setEditingId('new')
  }

  function startEdit(entry: IfThenEntry) {
    setConfirmDeleteId(null)
    setDraft({ trigger: entry.trigger, action: entry.action, color: entry.color, dayTypes: entry.dayTypes, when: entry.when })
    setEditingId(entry.id)
  }

  function cancelEdit() {
    setEditingId(null)
    setDraft(emptyDraft())
  }

  function save() {
    const trigger = draft.trigger.trim()
    const action = draft.action.trim()
    if (!trigger || !action) return
    if (editingId === 'new') {
      actions.addIfThen({ trigger, action, color: draft.color, dayTypes: draft.dayTypes, when: draft.when })
    } else if (editingId) {
      const existing = data.ifThens.find(e => e.id === editingId)
      if (existing) {
        actions.updateIfThen({ ...existing, trigger, action, color: draft.color, dayTypes: draft.dayTypes, when: draft.when })
      }
    }
    setEditingId(null)
    setDraft(emptyDraft())
  }

  function handleDeleteClick(entry: IfThenEntry) {
    if (confirmDeleteId === entry.id) {
      actions.deleteIfThen(entry.id)
      setConfirmDeleteId(null)
    } else {
      setConfirmDeleteId(entry.id)
    }
  }

  function toggleFilter(value: string | 'none') {
    setFilterColor(prev => (prev === value ? null : value))
  }

  const usedColors = PALETTE_COLORS.map(c => c.value).filter(value => data.ifThens.some(e => e.color === value))
  const hasUntagged = data.ifThens.some(e => !e.color)
  const showFilters = usedColors.length + (hasUntagged ? 1 : 0) > 1

  const visibleEntries = data.ifThens.filter(e => {
    if (filterColor === null) return true
    if (filterColor === 'none') return !e.color
    return e.color === filterColor
  })

  return (
    <section className="if-then-board">
      <div className="if-then-header">
        <h2>If-then</h2>
        {editingId === null && (
          <button className="primary" onClick={startNew}>
            New if-then
          </button>
        )}
      </div>

      {editingId === 'new' && (
        <IfThenForm draft={draft} onChange={setDraft} onSave={save} onCancel={cancelEdit} />
      )}

      {showFilters && (
        <div className="if-then-filters" role="group" aria-label="Filter by tag">
          <button
            className={filterColor === null ? 'chip selected' : 'chip'}
            aria-pressed={filterColor === null}
            onClick={() => setFilterColor(null)}
          >
            All
          </button>
          {usedColors.map(color => (
            <button
              key={color}
              className={filterColor === color ? 'chip selected' : 'chip'}
              aria-pressed={filterColor === color}
              style={{ background: color }}
              onClick={() => toggleFilter(color)}
            >
              {paletteColorName(color)}
            </button>
          ))}
          {hasUntagged && (
            <button
              className={filterColor === 'none' ? 'chip selected' : 'chip'}
              aria-pressed={filterColor === 'none'}
              onClick={() => toggleFilter('none')}
            >
              No tag
            </button>
          )}
        </div>
      )}

      {data.ifThens.length === 0 && (
        <p className="empty">
          No if-then entries yet. Write one for a specific moment - what happens, and the one thing already decided.
        </p>
      )}

      {data.ifThens.length > 0 && visibleEntries.length === 0 && (
        <p className="empty">Nothing tagged this way.</p>
      )}

      <ul className="if-then-list">
        {visibleEntries.map(entry => (
          <li
            key={entry.id}
            className="if-then-card"
            style={entry.color ? { borderLeftColor: entry.color } : undefined}
          >
            {editingId === entry.id ? (
              <IfThenForm draft={draft} onChange={setDraft} onSave={save} onCancel={cancelEdit} />
            ) : (
              <>
                <p className="if-then-trigger">
                  <span className="if-then-prefix">If</span>
                  {entry.trigger}
                </p>
                <p className="if-then-action">
                  <span className="if-then-prefix">Then</span>
                  {entry.action}
                </p>
                {entry.color && (
                  <span className="if-then-tag" style={{ background: entry.color }}>
                    {paletteColorName(entry.color)}
                  </span>
                )}
                {(dayTypesLabel(entry.dayTypes) || whenLabel(entry.when)) && (
                  <p className="if-then-scope-note">
                    {[dayTypesLabel(entry.dayTypes), whenLabel(entry.when)].filter(Boolean).join(' · ')}
                  </p>
                )}
                <div className="if-then-card-actions">
                  <button aria-label={`Edit "${entry.trigger}"`} onClick={() => startEdit(entry)}>
                    Edit
                  </button>
                  <button
                    aria-label={
                      confirmDeleteId === entry.id ? `Confirm delete "${entry.trigger}"` : `Delete "${entry.trigger}"`
                    }
                    className={confirmDeleteId === entry.id ? 'danger' : ''}
                    onClick={() => handleDeleteClick(entry)}
                    onBlur={() => setConfirmDeleteId(prev => (prev === entry.id ? null : prev))}
                  >
                    {confirmDeleteId === entry.id ? 'Confirm?' : 'Delete'}
                  </button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
