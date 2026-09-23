import { useEffect, useRef, useState } from 'react'
import { actions, getData } from '../../lib/store'
import { offerUndo } from '../../lib/undo'
import { parseNorth } from '../../lib/northSections'

/**
 * A whole North text, put in the place of the one here - the owner's brief of
 * 2026-09-22, part 4.
 *
 * Edit opens the text as it is and changes it in place, which is the right
 * door for a word or a line. This is the other one: a text written somewhere
 * else - by the person, or by another agent - pasted in whole. What it will
 * make is read on every keystroke and said above the press: how many
 * headings it found, which of them are for the morning and which for the
 * evening, and whether it has an introduction and a signature. A text pasted
 * in the wrong shape reads as a text that lost its headings, and that is
 * exactly what this says before anything is replaced.
 *
 * Replacing is one commit and one undo, like everything else here.
 */
export function NorthReplace({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [text, setText] = useState('')
  const fieldRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    fieldRef.current?.focus()
  }, [])

  const read = parseNorth(text)
  const morning = read.sections.filter(s => s.tag === 'morning').map(s => s.heading)
  const evening = read.sections.filter(s => s.tag === 'evening').map(s => s.heading)

  function replace() {
    if (text.trim() === '') return
    const before = getData().picture?.text ?? ''
    actions.setPicture(text)
    offerUndo('North replaced', () => actions.setPicture(before))
    onDone()
  }

  return (
    <form
      className="north-editor north-replace"
      noValidate
      onSubmit={e => {
        e.preventDefault()
        replace()
      }}
      onKeyDown={e => {
        if (e.key === 'Escape' && !e.defaultPrevented) {
          e.preventDefault()
          e.stopPropagation()
          onCancel()
        }
      }}
    >
      <label className="field">
        <span className="field-label">The whole text</span>
        <textarea
          ref={fieldRef}
          className="north-editor-text north-replace-text"
          rows={14}
          aria-describedby="north-replace-rule"
          value={text}
          onChange={e => setText(e.target.value)}
        />
      </label>
      <p id="north-replace-rule" className="north-editor-rule">
        A line in capitals is a heading, and <code>[morning]</code> or <code>[evening]</code> at its end says which part of the day it
        is for. A line of <code>---</code> starts the signature at the foot.
      </p>

      <ul className="north-replace-found" aria-label="What it will make">
        <li>
          {read.sections.length === 0
            ? 'No headings yet - the whole text would read as one.'
            : `${read.sections.length} ${read.sections.length === 1 ? 'heading' : 'headings'}: ${read.sections.map(s => s.heading).join(', ')}`}
        </li>
        <li>{morning.length > 0 ? `For the morning: ${morning.join(', ')}` : 'Nothing marked for the morning'}</li>
        <li>{evening.length > 0 ? `For the evening: ${evening.join(', ')}` : 'Nothing marked for the evening'}</li>
        <li>
          {read.intro.length > 0 ? `${read.intro.length} ${read.intro.length === 1 ? 'paragraph' : 'paragraphs'} before the first heading` : 'Nothing before the first heading'}
          {read.signature.length > 0 ? ', and a signature at the foot' : ''}
        </li>
      </ul>

      <div className="north-actions">
        <button type="button" className="btn-quiet" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={text.trim() === ''}>
          Replace what is here
        </button>
      </div>
    </form>
  )
}
