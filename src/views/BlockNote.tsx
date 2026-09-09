import { useState } from 'react'
import { formatDuration } from '../widgets/day-plan/capacity'
import { parseStepLine } from '../widgets/day-plan/parse'
import type { TemplateStep } from '../lib/types'

/**
 * The note and the steps a template block carries onto every day it stamps.
 *
 * It exists because a template could only ever bring a title and a time. The
 * owner's words were that a meal block should arrive with the recipe on it -
 * and until `TemplateBlock.note` existed, text written into a template
 * reached no day at all: `applyStamps` read the note off the matching prior
 * task, which on a fresh day is nothing. See the stamping rule in
 * `stamping.ts`, which is `match?.note ?? b.note`.
 *
 * **Closed unless asked.** A block that carries nothing looks exactly as it
 * did before this existed - one small word at the end of its row. Most blocks
 * are a title and a time and always will be, and a textarea under every one
 * of them would be a form where there was a list.
 *
 * The button says whether there is anything behind it, because a note nobody
 * can see from the outside is a note nobody remembers writing.
 */
export function blockCarries(note: string | undefined, steps: TemplateStep[] | undefined): boolean {
  return Boolean(note?.trim() || steps?.length)
}

export function BlockNoteButton({
  note,
  steps,
  open,
  label,
  onToggle,
}: {
  note?: string
  steps?: TemplateStep[]
  open: boolean
  /** What this block is, for somebody listening rather than looking. */
  label: string
  onToggle: () => void
}) {
  const carries = blockCarries(note, steps)
  return (
    <button
      type="button"
      className={carries ? 'block-note-toggle has-note' : 'block-note-toggle'}
      aria-expanded={open}
      aria-label={carries ? `Note and steps on ${label}` : `Add a note or steps to ${label}`}
      onClick={onToggle}
    >
      Note
    </button>
  )
}

/**
 * The panel itself.
 *
 * Plain text, deliberately: line breaks and nothing else. A markdown engine
 * here would mean a template note and a task note render differently, and
 * `TaskDetail` shows a note as the lines somebody typed. What the owner asked
 * for was a recipe in a block, and a recipe is a list of lines.
 */
export function BlockNotePanel({
  note,
  steps,
  label,
  expanded = false,
  onNote,
  onSteps,
  onExpanded,
}: {
  note?: string
  steps?: TemplateStep[]
  label: string
  expanded?: boolean
  onNote: (next: string) => void
  onSteps: (next: TemplateStep[]) => void
  onExpanded?: (next: boolean) => void
}) {
  const [draft, setDraft] = useState('')
  const list = steps ?? []

  function addStep() {
    const parsed = parseStepLine(draft)
    if (!parsed) return
    const step: TemplateStep = { id: crypto.randomUUID(), title: parsed.title }
    if (parsed.minutes !== undefined) step.minutes = parsed.minutes
    onSteps([...list, step])
    setDraft('')
  }

  return (
    <div className="block-note">
      <label className="field">
        <span className="field-label">Note</span>
        <textarea
          className="block-note-text"
          rows={3}
          value={note ?? ''}
          aria-label={`Note on ${label}`}
          placeholder="What this block is, in the words you would say to yourself"
          onChange={e => onNote(e.target.value)}
        />
      </label>
      {/* One line, here rather than in Settings: it is a fact about this
          block and not a preference about all of them. A meal block whose
          recipe is the reason you look at the card says so; the rest stay
          behind their mark. */}
      {onExpanded && (
        <label className="block-note-expand">
          <input type="checkbox" checked={expanded} onChange={e => onExpanded(e.target.checked)} />
          <span className="check" aria-hidden="true" />
          <span>Show this note without opening it</span>
        </label>
      )}
      <div className="field">
        <span className="field-label">Steps</span>
        <div className="block-note-steps">
          {list.map(step => (
            <span key={step.id} className="block-note-step">
              <span className="block-note-step-title">{step.title}</span>
              {step.minutes !== undefined && (
                <span className="block-note-step-size">{formatDuration(step.minutes)}</span>
              )}
              <button
                type="button"
                className="subtask-remove"
                aria-label={`Remove step ${step.title} from ${label}`}
                onClick={() => onSteps(list.filter(s => s.id !== step.id))}
              >
                &times;
              </button>
            </span>
          ))}
          {/* The same line the task's own step field takes, so "Meditation 10
              min" means the same thing in a template as it does on a day. */}
          <input
            className="subtask-add"
            placeholder="Add a step, or one with a length: Meditation 10 min"
            aria-label={`Add a step to ${label}`}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key !== 'Enter') return
              e.preventDefault()
              addStep()
            }}
          />
        </div>
      </div>
    </div>
  )
}
