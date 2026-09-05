import { useEffect, useRef, useState } from 'react'
import { PALETTE_COLORS } from '../../lib/colors'

export interface RuleDraft {
  trigger: string
  action: string
  color?: string
}

export interface RuleFormProps {
  draft?: RuleDraft
  onSave: (draft: RuleDraft) => void
  onCancel: () => void
}

/**
 * The one form a rule is written in, wherever it is written.
 *
 * Two lines and an optional tag, and that is the whole of it. The old board
 * asked for four more things - which day types the rule was eligible on,
 * which third of the day, and by implication when it would be shown - and
 * every one of those existed to serve a surfacing mechanism that no longer
 * exists. A form that asks four questions about scheduling before it will
 * take a sentence is a form people close, which is a large part of why the
 * old list stayed at three entries.
 *
 * The placeholders are the copy that does the work. "A trigger" asked cold
 * produces an empty box; an example of the shape of an answer produces an
 * answer, and the examples are written in the second person because that is
 * the voice the field wants back.
 */
export function RuleForm({ draft, onSave, onCancel }: RuleFormProps) {
  const [trigger, setTrigger] = useState(draft?.trigger ?? '')
  const [action, setAction] = useState(draft?.action ?? '')
  const [color, setColor] = useState<string | undefined>(draft?.color)
  const triggerRef = useRef<HTMLInputElement>(null)

  // Focus lands in the form the moment it opens, for a new rule and for an
  // edit alike - otherwise somebody on a keyboard has no way to know a form
  // appeared at all and has to tab blindly to find it.
  useEffect(() => {
    triggerRef.current?.focus()
  }, [])

  const ready = trigger.trim().length > 0 && action.trim().length > 0

  function save() {
    if (!ready) return
    onSave({ trigger: trigger.trim(), action: action.trim(), color })
  }

  // Enter saves from either field. Both are single-line, so the key has
  // nothing else to do in them, and reaching for the mouse to commit two
  // short sentences is the kind of friction that stops a rule being written.
  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    save()
  }

  return (
    <div className="rule-form">
      <label className="field">
        <span className="field-label">If</span>
        <input
          ref={triggerRef}
          value={trigger}
          maxLength={140}
          placeholder="I catch myself scrolling at 23:00"
          onChange={e => setTrigger(e.target.value)}
          onKeyDown={onKeyDown}
        />
      </label>
      <p className="muted rule-form-hint">A moment you can catch: where you are, what just happened.</p>
      <label className="field">
        <span className="field-label">Then</span>
        <input
          value={action}
          maxLength={140}
          placeholder="phone in the kitchen, book in hand"
          onChange={e => setAction(e.target.value)}
          onKeyDown={onKeyDown}
        />
      </label>
      <div className="color-palette" role="group" aria-label="Tag">
        <button
          type="button"
          aria-label="No tag"
          aria-pressed={color === undefined}
          className={color === undefined ? 'swatch swatch-none selected' : 'swatch swatch-none'}
          onClick={() => setColor(undefined)}
        >
          &times;
        </button>
        {PALETTE_COLORS.map(c => (
          <button
            key={c.value}
            type="button"
            aria-label={`Tag ${c.name}`}
            aria-pressed={color === c.value}
            className={color === c.value ? 'swatch selected' : 'swatch'}
            style={{ background: c.value, ['--swatch' as string]: c.value }}
            onClick={() => setColor(c.value)}
          />
        ))}
      </div>
      <div className="rule-form-actions">
        <button type="button" className="btn-primary" disabled={!ready} onClick={save}>
          {draft ? 'Save' : 'Write it down'}
        </button>
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}
