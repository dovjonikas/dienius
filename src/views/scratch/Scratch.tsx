import { useEffect, useRef, useState } from 'react'
import { useRestoreFocus } from '../../lib/useRestoreFocus'
import { actions, getData, useAppData } from '../../lib/store'
import { addDays, formatDayShort, todayKey } from '../../lib/dates'
import { offerUndo } from '../../lib/undo'
import { isTaskIntent, isTaskMarkOnly, scratchCount, sortScratch, stripTaskMark } from '../../lib/scratch'
import { keepPhoto, refusePhoto, shrinkPhoto } from '../../lib/photos'
import { NotePhotos } from './NotePhotos'
import { NoteToTask } from './NoteToTask'
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
 * timed and sized), a line in Later, a pinned note, or nothing.
 */

export interface ScratchProps {
  open: boolean
  onClose: () => void
  /** Opens a day at a task - the way back from a note to what it became. */
  onOpenTask?: (date: string, taskId: string) => void
}

export function Scratch({ open, onClose, onOpenTask }: ScratchProps) {
  if (!open) return null
  return <ScratchPanel onClose={onClose} onOpenTask={onOpenTask} />
}

function ScratchPanel({ onClose, onOpenTask }: { onClose: () => void; onOpenTask?: (date: string, taskId: string) => void }) {
  useRestoreFocus()
  const data = useAppData()
  const [draft, setDraft] = useState('')
  const [draftId, setDraftId] = useState<string | null>(null)
  const [taskMode, setTaskMode] = useState(false)
  const [status, setStatus] = useState('')
  const [making, setMaking] = useState<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

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
      // sitting in the stream for ever - unless a picture was pasted into
      // it, in which case the note is the picture and the words were never
      // the point.
      if (draftNote?.photos?.length) {
        actions.updateScratch(draftId, text)
        return
      }
      actions.deleteScratch(draftId)
      setDraftId(null)
    } else {
      actions.updateScratch(draftId, text)
    }
  }

  /**
   * A picture into the note being written, by any of the three ways in.
   *
   * The note is made if there is not one yet, so a screenshot pasted before
   * a single word is typed has somewhere to land - which is the common
   * case: see something, press the shortcut, paste, carry on.
   *
   * Each picture is shrunk first (see lib/photos.ts), then checked against
   * the two limits, then written to IndexedDB, then named on the note. A
   * refusal is a sentence in the same status line every other outcome uses,
   * and it stops at the one that was refused rather than abandoning the
   * ones already in.
   */
  async function attach(files: File[]) {
    const pictures = files.filter(f => f.type.startsWith('image/') || f.size > 0)
    if (pictures.length === 0) return
    let id = draftId
    if (id === null) {
      id = actions.addScratch(draft).id
      setDraftId(id)
    }
    let added = 0
    for (const file of pictures) {
      const shrunk = await shrinkPhoto(file)
      const blob = shrunk?.blob ?? file
      const width = shrunk?.width ?? 0
      const height = shrunk?.height ?? 0
      const note = getData().scratch.find(n => n.id === id)
      const refusal = refusePhoto(blob, note?.photos?.length ?? 0)
      if (refusal) {
        setStatus(refusal)
        break
      }
      // jsdom and a browser with no canvas give no size back. A square box
      // is a better guess than a zero, which would collapse the thumbnail.
      const kept = await keepPhoto(blob, width || 1, height || 1)
      if (!kept) {
        setStatus('There was no room to keep that picture on this device.')
        break
      }
      actions.addScratchPhoto(id, kept)
      added += 1
    }
    if (added > 0) setStatus(added === 1 ? 'Picture added.' : `${added} pictures added.`)
  }

  function onPaste(e: React.ClipboardEvent) {
    const files = [...(e.clipboardData?.files ?? [])]
    // A paste with no file in it is a paste of text, and belongs to the
    // browser: preventing it here would break the ordinary Ctrl+V.
    if (files.length === 0) return
    e.preventDefault()
    void attach(files)
  }

  function onDrop(e: React.DragEvent) {
    const files = [...(e.dataTransfer?.files ?? [])]
    if (files.length === 0) return
    e.preventDefault()
    void attach(files)
  }

  function finishNote() {
    if (intent) {
      const title = stripTaskMark(draft).trim()
      if (!title) return
      actions.addLaterItem({ title })
      setStatus('Sent to Later.')
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

  const notes = sortScratch(data.scratch).filter(n => n.id !== draftId)
  const draftNote = draftId === null ? undefined : data.scratch.find(n => n.id === draftId)
  const makingNote = making === null ? undefined : data.scratch.find(n => n.id === making)

  // The editor first, the task after. See NoteToTask for why the old
  // one-press-and-gone was wrong in both directions.
  function makeTask(note: ScratchNote) {
    setMaking(note.id)
  }

  function saveTask(note: ScratchNote, task: { title: string; time?: string; minutes?: number; category?: string; highlight?: boolean }) {
    const today = todayKey()
    const id = actions.scratchToTaskKeepingNote(note.id, today, task)
    setMaking(null)
    if (id) setStatus(`${task.title} is on today${task.time ? ` at ${task.time}` : ''}. The note stays here.`)
  }

  function toLater(note: ScratchNote) {
    if (actions.scratchToLater(note.id, note.text)) setStatus('Moved to Later.')
  }

  async function remove(note: ScratchNote) {
    // The pictures go with it, and the undo brings both back - see
    // deleteScratchWithPhotos for why the blobs are not simply held.
    const undo = await actions.deleteScratchWithPhotos(note.id)
    offerUndo('Note deleted', () => void undo())
  }

  return (
    <div className="scratch-scrim" onClick={onClose}>
      <div
        className="scratch"
        role="dialog"
        aria-label="Notes"
        data-keeps-keys=""
        onClick={e => e.stopPropagation()}
        onDrop={onDrop}
        onDragOver={e => e.preventDefault()}
      >
        <div className="scratch-field">
          <textarea
            ref={inputRef}
            className="scratch-input"
            aria-label="Note"
            placeholder={intent ? 'Something to do. Enter sends it to Later.' : 'Write it down. Enter keeps it.'}
            rows={1}
            value={draft}
            onChange={e => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={onPaste}
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
            aria-label={intent ? 'Going to Later as a task. Make it a note instead' : 'Staying as a note. Make it a task instead'}
            onClick={() => {
              // Turning it off has to take the mark off too, or the line would
              // still read as a task and the toggle would appear not to work.
              if (typedIntent) handleChange(stripTaskMark(draft))
              setTaskMode(!intent)
            }}
          >
            {intent ? 'Task' : 'Note'}
          </button>
          {/* The third way in, for a phone: the picker it opens offers the
              camera and the gallery both, which is what `image/*` with no
              `capture` means. A screenshot on a desktop arrives by paste
              and never touches this button. */}
          <button type="button" className="scratch-photo-add" aria-label="Add a picture" onClick={() => fileRef.current?.click()}>
            +
          </button>
          {/* The way out, in the row with the other two controls rather than
              on a bar of its own beside the count, where it read as a
              control with no obvious job. On a phone the sheet is the whole
              screen and there is no scrim to tap and no Escape to press, so
              it has to be a button. Nothing is lost by it: everything is
              saved already. */}
          <button type="button" className="scratch-close" aria-label="Close" onClick={onClose}>
            &times;
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="visually-hidden"
            tabIndex={-1}
            onChange={e => {
              const files = [...(e.target.files ?? [])]
              e.target.value = ''
              void attach(files)
            }}
          />
        </div>

        {draftNote?.photos && draftNote.photos.length > 0 && (
          <div className="scratch-draft-photos">
            <NotePhotos photos={draftNote.photos} onRemove={photoId => void actions.removeScratchPhoto(draftNote.id, photoId)} />
          </div>
        )}

        {/* The count, once there is something to count. "Nothing yet" on
            the bar over "Nothing here yet - type, and it is kept." under it
            was one fact said twice on an empty stream - CONVENTIONS section
            23 - and the second of them is the one that says what to do. */}
        {data.scratch.length > 0 && (
          <div className="scratch-bar">
            <span className="scratch-count">{scratchCount(data.scratch.length)}</span>
          </div>
        )}

        {/* Visible, and announced. One line, replaced by the next thing that
            happens; never a toast stacking up in a corner. */}
        {status && (
          <p className="scratch-status" role="status">
            {status}
          </p>
        )}

        {makingNote && <NoteToTask note={makingNote} onSave={task => saveTask(makingNote, task)} onCancel={() => setMaking(null)} />}

        {notes.length === 0 ? (
          <p className="scratch-empty">
            {draftId ? 'Enter keeps it and starts the next.' : 'Nothing here yet - type, and it is kept.'}
          </p>
        ) : (
          <ul className="scratch-list">
            {notes.map(note => (
              <li key={note.id} className={note.pinned ? 'scratch-note is-pinned' : 'scratch-note'}>
                {note.text && <p className="scratch-note-text">{note.text}</p>}
                {note.photos && note.photos.length > 0 && (
                  <NotePhotos photos={note.photos} onRemove={photoId => void actions.removeScratchPhoto(note.id, photoId)} />
                )}
                <div className="scratch-note-foot">
                  <span className="scratch-note-when">{whenLabel(note)}</span>
                  {/* One group, so that on a phone with a long date - "Thursday,
                      September 3 17:47" - the four wrap under it together
                      rather than Delete dropping onto a line of its own. */}
                  <span className="scratch-note-actions">
                    {note.taskId && note.taskDate ? (
                      <button
                        type="button"
                        className="scratch-note-action is-linked"
                        aria-label={`Open the task this note became`}
                        onClick={() => {
                          onOpenTask?.(note.taskDate!, note.taskId!)
                          onClose()
                        }}
                      >
                        Open the task
                      </button>
                    ) : (
                      <button type="button" className="scratch-note-action" onClick={() => makeTask(note)}>
                        To task
                      </button>
                    )}
                    <button type="button" className="scratch-note-action" onClick={() => toLater(note)}>
                      To Later
                    </button>
                    <button
                      type="button"
                      className="scratch-note-action"
                      aria-pressed={note.pinned ?? false}
                      onClick={() => actions.toggleScratchPin(note.id)}
                    >
                      {note.pinned ? 'Unpin' : 'Pin'}
                    </button>
                    <button type="button" className="scratch-note-action is-danger" onClick={() => void remove(note)}>
                      Delete
                    </button>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

/**
 * "Today 14:32", "Yesterday 09:10", or "Sat 12 Sep 14:00".
 *
 * Short on purpose, all three of them: the row this sits on carries four
 * actions beside it, and `formatDayTitle`'s "Monday, September 14" is wide
 * enough on a phone to push them onto a line of their own - so a note from
 * last week stood 19px taller than the four above it.
 */
function whenLabel(note: ScratchNote): string {
  const today = todayKey()
  const day = note.date === today ? 'Today' : note.date === addDays(today, -1) ? 'Yesterday' : formatDayShort(note.date)
  const d = new Date(note.createdAt)
  const time = Number.isNaN(d.getTime())
    ? ''
    : ` ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  return `${day}${time}`
}
