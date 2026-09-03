import { useEffect, useRef, useState } from 'react'
import { actions, useAppData } from '../../lib/store'
import { addDays, formatDayTitle, todayKey } from '../../lib/dates'
import { offerUndo } from '../../lib/undo'
import {
  BUG_TAG,
  allScratchTags,
  bugExport,
  filterScratch,
  hasTag,
  isTaskIntent,
  isTaskMarkOnly,
  scratchCount,
  sortScratch,
  stripTags,
  stripTaskMark,
} from '../../lib/scratch'
import { parseQuickAdd } from '../../widgets/day-plan/parse'
import type { ScratchNote } from '../../lib/types'

/**
 * The scratch overlay - see lib/scratch.ts for what it is and is not.
 *
 * The box is at the top with the cursor already in it, and the stream is
 * under it. Every keystroke is saved: the first character creates the note
 * and every one after rewrites it, so there is no Save and nothing to lose by
 * leaving. Enter finishes a note and starts the next; Escape leaves. The
 * note being typed is not shown in the list under the box, because it is
 * already on screen - in the box.
 *
 * What a note can become is on the note itself, later: a task on today
 * (through quick-add's own parser, so "14:00 Call the bank 20 min" lands
 * timed and sized), an inbox line, a pinned note, or nothing.
 */

export interface ScratchProps {
  open: boolean
  onClose: () => void
}

export function Scratch({ open, onClose }: ScratchProps) {
  if (!open) return null
  return <ScratchPanel onClose={onClose} />
}

function ScratchPanel({ onClose }: { onClose: () => void }) {
  const data = useAppData()
  const [draft, setDraft] = useState('')
  const [draftId, setDraftId] = useState<string | null>(null)
  const [tag, setTag] = useState<string | null>(null)
  const [taskMode, setTaskMode] = useState(false)
  const [status, setStatus] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Grows with the text, up to the cap the stylesheet sets. A textarea that
  // scrolls inside itself at two lines is the one that gets a number typed
  // out of sight.
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    // Two pixels of slack: a line-height that rounds up by one leaves the
    // box one pixel short of its own text and a scrollbar beside one line.
    el.style.height = `${el.scrollHeight + 2}px`
  }, [draft])

  // Whether this line is meant as something to do. Two ways in and one
  // meaning: a leading "!" for somebody already typing, the toggle for a
  // thumb. Derived rather than stored, so the mark and the toggle can never
  // disagree about where Enter is going to send the line.
  const typedIntent = isTaskIntent(draft)
  const intent = taskMode || typedIntent

  function handleChange(text: string) {
    setDraft(text)
    // A line meant as a task is never written into the stream at all - not
    // written and then moved, which would leave a note behind every time
    // somebody changed their mind mid-sentence. If one was already started
    // before the "!" appeared, it goes now.
    if (taskMode || isTaskIntent(text) || isTaskMarkOnly(text)) {
      if (draftId !== null) {
        actions.deleteScratch(draftId)
        setDraftId(null)
      }
      return
    }
    if (draftId === null) {
      if (!text.trim()) return
      setDraftId(actions.addScratch(text).id)
    } else if (!text.trim()) {
      // Backspaced to nothing: the note goes too, rather than an empty line
      // sitting in the stream for ever.
      actions.deleteScratch(draftId)
      setDraftId(null)
    } else {
      actions.updateScratch(draftId, text)
    }
  }

  function finishNote() {
    if (intent) {
      const text = stripTaskMark(draft).trim()
      if (!text) return
      actions.addInboxItem(text)
      setStatus('Sent to the inbox.')
      // Back to a note afterwards. The toggle is about this line, not about
      // the rest of the sitting: the next thing somebody blurts out is far
      // more often a note, which is what this box is for.
      setTaskMode(false)
    }
    setDraft('')
    setDraftId(null)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onClose()
      return
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      finishNote()
    }
  }

  const tags = allScratchTags(data.scratch)
  const notes = sortScratch(filterScratch(data.scratch, tag)).filter(n => n.id !== draftId)
  const bugs = data.scratch.filter(n => hasTag(n, BUG_TAG)).length

  async function exportBugs() {
    const text = bugExport(data.scratch)
    try {
      await navigator.clipboard.writeText(text)
      setStatus(`Copied ${bugs} ${bugs === 1 ? 'bug' : 'bugs'} as a markdown list.`)
    } catch {
      setStatus('The clipboard is not reachable here. Select the notes and copy them by hand.')
    }
  }

  function toTask(note: ScratchNote) {
    const parsed = parseQuickAdd(stripTags(note.text))
    if (!parsed) return
    const today = todayKey()
    if (actions.scratchToTask(note.id, today, { title: parsed.title, time: parsed.time, minutes: parsed.minutes })) {
      setStatus(`${parsed.title} is on today${parsed.time ? ` at ${parsed.time}` : ''}.`)
    }
  }

  function toInbox(note: ScratchNote) {
    if (actions.scratchToInbox(note.id, stripTags(note.text))) setStatus('Moved to the inbox.')
  }

  function remove(note: ScratchNote) {
    actions.deleteScratch(note.id)
    offerUndo('Note deleted', () => actions.restoreScratch(note))
  }

  return (
    <div className="scratch-scrim" onClick={onClose}>
      <div
        className="scratch"
        role="dialog"
        aria-label="Scratch"
        data-keeps-keys=""
        onClick={e => e.stopPropagation()}
      >
        <div className="scratch-field">
          <textarea
            ref={inputRef}
            className="scratch-input"
            aria-label="Scratch note"
            placeholder={intent ? 'Something to do. Enter sends it to the inbox.' : 'Write it down. A #tag is a filter.'}
            rows={1}
            value={draft}
            onChange={e => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          {/* Where this line is going, said before Enter rather than after.
              The toggle and the leading "!" are the same intent expressed two
              ways - one for a thumb, one for somebody already typing - and
              the marker shows whichever is in force, so a line that starts
              with "!" reads as a task without the toggle having been touched. */}
          <button
            type="button"
            className={intent ? 'scratch-intent is-task' : 'scratch-intent'}
            aria-pressed={intent}
            aria-label={intent ? 'Going to the inbox as a task. Make it a note instead' : 'Staying as a note. Make it a task instead'}
            onClick={() => {
              // Turning it off has to take the mark off too, or the line would
              // still read as a task and the toggle would appear not to work.
              if (typedIntent) handleChange(stripTaskMark(draft))
              setTaskMode(!intent)
            }}
          >
            {intent ? 'Task' : 'Note'}
          </button>
        </div>

        <div className="scratch-bar">
          <button
            type="button"
            className={tag === null ? 'scratch-tag active' : 'scratch-tag'}
            aria-pressed={tag === null}
            onClick={() => setTag(null)}
          >
            All
          </button>
          {tags.map(t => (
            <button
              key={t.tag}
              type="button"
              className={tag === t.tag ? 'scratch-tag active' : 'scratch-tag'}
              aria-pressed={tag === t.tag}
              onClick={() => setTag(tag === t.tag ? null : t.tag)}
            >
              #{t.tag}
            </button>
          ))}
          {bugs > 0 && (
            <button type="button" className="scratch-export" onClick={exportBugs}>
              Export bugs
            </button>
          )}
          <span className="scratch-count">{scratchCount(data.scratch.length)}</span>
          {/* On a phone the sheet is the whole screen and there is no scrim
              to tap and no Escape to press, so the way out has to be a
              button. Nothing is lost by it: everything is saved already. */}
          <button type="button" className="scratch-close" aria-label="Close scratch" onClick={onClose}>
            &times;
          </button>
        </div>

        {/* Visible, and announced. One line, replaced by the next thing that
            happens; never a toast stacking up in a corner. */}
        {status && (
          <p className="scratch-status" role="status">
            {status}
          </p>
        )}

        {notes.length === 0 ? (
          <p className="scratch-empty">
            {tag ? `Nothing tagged #${tag}.` : draftId ? 'Enter keeps it and starts the next.' : 'Nothing here yet. Type, and it is kept.'}
          </p>
        ) : (
          <ul className="scratch-list">
            {notes.map(note => (
              <li key={note.id} className={note.pinned ? 'scratch-note is-pinned' : 'scratch-note'}>
                <p className="scratch-note-text">{withTags(note.text)}</p>
                <div className="scratch-note-foot">
                  <span className="scratch-note-when">{whenLabel(note)}</span>
                  <button type="button" className="scratch-note-action" onClick={() => toTask(note)}>
                    To task
                  </button>
                  <button type="button" className="scratch-note-action" onClick={() => toInbox(note)}>
                    To inbox
                  </button>
                  <button
                    type="button"
                    className="scratch-note-action"
                    aria-pressed={note.pinned ?? false}
                    onClick={() => actions.toggleScratchPin(note.id)}
                  >
                    {note.pinned ? 'Unpin' : 'Pin'}
                  </button>
                  <button type="button" className="scratch-note-action is-danger" onClick={() => remove(note)}>
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

/** The tags in accent, the rest as written. */
function withTags(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  const re = /(^|\s)(#[\p{L}\p{N}_-]+)/gu
  let last = 0
  for (const m of text.matchAll(re)) {
    const start = (m.index ?? 0) + m[1].length
    if (start > last) parts.push(text.slice(last, start))
    parts.push(<mark key={start}>{m[2]}</mark>)
    last = start + m[2].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

/** "Today 14:32", "Yesterday 09:10", or the day and date. */
function whenLabel(note: ScratchNote): string {
  const today = todayKey()
  const day = note.date === today ? 'Today' : note.date === addDays(today, -1) ? 'Yesterday' : formatDayTitle(note.date)
  const d = new Date(note.createdAt)
  const time = Number.isNaN(d.getTime())
    ? ''
    : ` ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  return `${day}${time}`
}
