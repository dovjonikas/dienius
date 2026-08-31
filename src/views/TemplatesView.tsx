import { useState } from 'react'
import { actions, useAppData } from '../lib/store'
import type { Template } from '../lib/types'

export const TEMPLATE_COLORS = [
  '#a7c4f5', '#f5b0a7', '#a7e3bd', '#f5db9e',
  '#c9b3f0', '#f0b3d5', '#9ed9e8', '#cde39e',
]

interface DraftBlock {
  time: string
  title: string
}

interface Draft {
  id?: string
  name: string
  color: string
  blocks: DraftBlock[]
}

const emptyDraft = (): Draft => ({ name: '', color: TEMPLATE_COLORS[0], blocks: [] })

export function TemplatesView() {
  const data = useAppData()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [blockTime, setBlockTime] = useState('')
  const [blockTitle, setBlockTitle] = useState('')

  function startEdit(t: Template) {
    setDraft({
      id: t.id,
      name: t.name,
      color: t.color,
      blocks: t.blocks.map(b => ({ time: b.time ?? '', title: b.title })),
    })
  }

  function addBlock() {
    if (!draft || !blockTitle.trim()) return
    setDraft({
      ...draft,
      blocks: [...draft.blocks, { time: blockTime.trim(), title: blockTitle.trim() }],
    })
    setBlockTime('')
    setBlockTitle('')
  }

  function removeBlock(index: number) {
    if (!draft) return
    setDraft({ ...draft, blocks: draft.blocks.filter((_, i) => i !== index) })
  }

  function save() {
    if (!draft || !draft.name.trim()) return
    const blocks = draft.blocks.map(b => ({
      time: b.time || undefined,
      title: b.title,
    }))
    if (draft.id) {
      const existing = data.templates.find(t => t.id === draft.id)
      if (existing) {
        actions.updateTemplate({
          ...existing,
          name: draft.name.trim(),
          color: draft.color,
          blocks: blocks.map(b => ({ id: crypto.randomUUID(), ...b })),
        })
      }
    } else {
      actions.addTemplate({ name: draft.name.trim(), color: draft.color, blocks })
    }
    setDraft(null)
  }

  return (
    <section className="templates">
      <div className="templates-header">
        <h2>Templates</h2>
        {!draft && (
          <button className="primary" onClick={() => setDraft(emptyDraft())}>
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
                className={draft.color === color ? 'swatch selected' : 'swatch'}
                style={{ background: color }}
                onClick={() => setDraft({ ...draft, color })}
              />
            ))}
          </div>
          <ul className="block-list">
            {draft.blocks.map((b, i) => (
              <li key={i}>
                <span className="task-time">{b.time || '--:--'}</span>
                <span>{b.title}</span>
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
            <button onClick={addBlock}>Add block</button>
          </div>
          <div className="row">
            <button className="primary" onClick={save}>Save template</button>
            <button onClick={() => setDraft(null)}>Cancel</button>
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
            <button onClick={() => startEdit(t)}>Edit</button>
            <button aria-label={`Delete ${t.name}`} onClick={() => actions.deleteTemplate(t.id)}>
              Delete
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
