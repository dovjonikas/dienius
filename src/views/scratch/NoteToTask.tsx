import { useEffect, useRef, useState } from 'react'
import type { ScratchNote } from '../../lib/types'
import { DurationChips } from '../DurationControl'
import { resolvedColor } from '../../lib/categories'
import { useAppData } from '../../lib/store'
import { scratchTitle } from '../../lib/scratch'

/**
 * A note on its way to becoming a task, with everything about that task on
 * screen before it exists.
 *
 * Until v2.5 "To task" ran the note through quick-add's parser and the note
 * vanished. Two things wrong with that, and both were the owner's to notice.
 * A line written as a thought almost never reads as "14:00 Call the bank 20
 * min", so it landed untimed and unsized and had to be opened and fixed
 * anyway - one press became three. And the note was gone, so the words it
 * was actually written in were gone with it, which is exactly what somebody
 * wanted when they wrote a sentence instead of a title.
 *
 * So this asks once, with the title already filled in and everything else a
 * tap away, and Cancel leaves nothing behind. The note stays either way -
 * see `scratchToTaskKeepingNote` for what the two ends hold.
 */

export interface NoteToTaskProps {
  note: ScratchNote
  onSave: (task: { title: string; time?: string; minutes?: number; category?: string; highlight?: boolean }) => void
  onCancel: () => void
}

/** A time somebody would type, or nothing. Same shape quick-add accepts. */
function readTime(value: string): string | undefined {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) return undefined
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour > 23 || minute > 59) return undefined
  return `${String(hour).padStart(2, '0')}:${match[2]}`
}

export function NoteToTask({ note, onSave, onCancel }: NoteToTaskProps) {
  const categories = useAppData().categories
  // The note's first line, shortened: a title is a line, and a note can be a
  // paragraph. The whole note stays where it is either way.
  const [title, setTitle] = useState(() => scratchTitle(note.text, 80))
  const [time, setTime] = useState('')
  const [minutes, setMinutes] = useState<number | undefined>(undefined)
  const [category, setCategory] = useState<string | undefined>(undefined)
  const [highlight, setHighlight] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    titleRef.current?.focus()
    titleRef.current?.select()
  }, [])

  function save() {
    const text = title.trim()
    if (!text) return
    onSave({ title: text, time: readTime(time), minutes, category, highlight: highlight || undefined })
  }

  return (
    <div className="note-task-scrim" onClick={onCancel}>
      <div
        className="note-task"
        role="dialog"
        aria-label="New task from a note"
        data-keeps-keys=""
        onClick={e => e.stopPropagation()}
        onKeyDown={e => {
          if (e.key === 'Escape') {
            e.stopPropagation()
            onCancel()
          }
        }}
      >
        <label className="field">
          <span className="field-label">What it is</span>
          <input
            ref={titleRef}
            aria-label="What it is"
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => {
              if (e.key !== 'Enter') return
              e.preventDefault()
              save()
            }}
          />
        </label>

        <div className="note-task-row">
          <label className="field note-task-time">
            <span className="field-label">When</span>
            <input aria-label="Start time" inputMode="numeric" placeholder="14:00" value={time} onChange={e => setTime(e.target.value)} />
          </label>
          <div className="field note-task-size">
            <span className="field-label">How long</span>
            <DurationChips minutes={minutes} onChange={setMinutes} />
          </div>
        </div>

        <div className="field">
          <span className="field-label">Category</span>
          <div className="category-picker" role="group" aria-label="Category">
            {categories.map(c => (
              <button
                key={c.id}
                type="button"
                className={c.id === category ? 'category-swatch selected' : 'category-swatch'}
                style={{ ['--cat' as string]: resolvedColor(c) } as React.CSSProperties}
                aria-label={c.label}
                aria-pressed={c.id === category}
                data-tip={c.label}
                onClick={() => setCategory(c.id === category ? undefined : c.id)}
              />
            ))}
          </div>
        </div>

        <div className="note-task-foot">
          <button type="button" className={highlight ? 'task-detail-toggle active' : 'task-detail-toggle'} aria-pressed={highlight} onClick={() => setHighlight(h => !h)}>
            {highlight ? 'A key task today' : 'Mark as key'}
          </button>
          <span className="note-task-actions">
            <button type="button" className="btn-secondary" onClick={onCancel}>
              Cancel
            </button>
            <button type="button" className="primary" disabled={!title.trim()} onClick={save}>
              Save
            </button>
          </span>
        </div>
      </div>
    </div>
  )
}
