import { useState } from 'react'
import { actions, useAppData } from '../lib/store'
import { PALETTE_COLORS } from '../lib/colors'
import type { DayType, Template } from '../lib/types'

// Kept as the same values PALETTE_COLORS has always had, so every template
// saved before this shared module existed still matches one of these.
export const TEMPLATE_COLORS = PALETTE_COLORS.map(c => c.value)

const DAY_TYPES: { value: DayType; label: string }[] = [
  { value: 'full', label: 'Full day' },
  { value: 'shift', label: 'Shift' },
  { value: 'night', label: 'Night' },
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
  core: boolean
}

interface Draft {
  id?: string
  name: string
  color: string
  type: DayType
  blocks: DraftBlock[]
}

const emptyDraft = (): Draft => ({ name: '', color: TEMPLATE_COLORS[0], type: 'full', blocks: [] })

export function TemplatesView() {
  const data = useAppData()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [blockTime, setBlockTime] = useState('')
  const [blockTitle, setBlockTitle] = useState('')
  const [blockCore, setBlockCore] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  function startEdit(t: Template) {
    setConfirmDeleteId(null)
    setDraft({
      id: t.id,
      name: t.name,
      color: t.color,
      type: t.type ?? 'full',
      blocks: t.blocks.map(b => ({ id: b.id, time: b.time ?? '', title: b.title, core: b.core ?? false })),
    })
    setBlockTime('')
    setBlockTitle('')
    setBlockCore(false)
  }

  function handleDeleteClick(t: Template) {
    if (confirmDeleteId === t.id) {
      actions.deleteTemplate(t.id)
      setConfirmDeleteId(null)
    } else {
      setConfirmDeleteId(t.id)
    }
  }

  function addBlock() {
    if (!draft || !blockTitle.trim()) return
    setDraft({
      ...draft,
      blocks: [...draft.blocks, { time: blockTime.trim(), title: blockTitle.trim(), core: blockCore }],
    })
    setBlockTime('')
    setBlockTitle('')
    setBlockCore(false)
  }

  function removeBlock(index: number) {
    if (!draft) return
    setDraft({ ...draft, blocks: draft.blocks.filter((_, i) => i !== index) })
  }

  function toggleBlockCore(index: number) {
    if (!draft) return
    setDraft({
      ...draft,
      blocks: draft.blocks.map((b, i) => (i === index ? { ...b, core: !b.core } : b)),
    })
  }

  function save() {
    if (!draft || !draft.name.trim()) return
    const blocks = draft.blocks.map(b => ({
      time: b.time || undefined,
      title: b.title,
      core: b.core || undefined,
    }))
    if (draft.id) {
      const existing = data.templates.find(t => t.id === draft.id)
      if (existing) {
        actions.updateTemplate({
          ...existing,
          name: draft.name.trim(),
          color: draft.color,
          type: draft.type,
          // A block carried over from the template being edited keeps its
          // id; a block added during this session gets a fresh one. Losing
          // ids on every save is harmless today - nothing reads them yet -
          // but it would silently break any future feature keyed on them.
          blocks: draft.blocks.map((b, i) => ({ ...blocks[i], id: b.id ?? crypto.randomUUID() })),
        })
      }
    } else {
      actions.addTemplate({ name: draft.name.trim(), color: draft.color, type: draft.type, blocks })
    }
    setDraft(null)
    setBlockTime('')
    setBlockTitle('')
    setBlockCore(false)
  }

  function cancel() {
    setDraft(null)
    setBlockTime('')
    setBlockTitle('')
    setBlockCore(false)
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
              setBlockTime('')
              setBlockTitle('')
              setBlockCore(false)
            }}
          >
            New template
          </button>
        )}
      </div>

      {draft && (
        <div className="template-editor">
          <input
            placeholder="Template name"
            value={draft.name}
            onChange={e => setDraft({ ...draft, name: e.target.value })}
          />
          <div className="palette">
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
          <ul className="block-list">
            {draft.blocks.map((b, i) => (
              <li key={i}>
                <span className="task-time">{b.time || '--:--'}</span>
                <span className="block-title">{b.title}</span>
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
                <button aria-label={`Remove ${b.title}`} onClick={() => removeBlock(i)}>
                  &times;
                </button>
              </li>
            ))}
          </ul>
          <div className="block-add">
            <input
              className="time-input"
              placeholder="09:00"
              value={blockTime}
              onChange={e => setBlockTime(e.target.value)}
            />
            <input
              placeholder="What happens"
              value={blockTitle}
              onChange={e => setBlockTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addBlock()}
            />
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
            <button onClick={addBlock}>Add block</button>
          </div>
          <div className="row">
            <button className="primary" disabled={!draft.name.trim()} onClick={save}>
              Save template
            </button>
            <button onClick={cancel}>Cancel</button>
          </div>
        </div>
      )}

      {!draft && data.templates.length === 0 && (
        <p className="empty">No templates yet. Create one, then stamp it onto days in the calendar.</p>
      )}

      <ul className="template-list">
        {data.templates.map(t => (
          <li key={t.id} className="template-card">
            <span className="dot" style={{ background: t.color }} />
            <div className="template-info">
              <strong>{t.name}</strong>
              <span className="muted">
                {t.blocks.length} {t.blocks.length === 1 ? 'block' : 'blocks'}
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
