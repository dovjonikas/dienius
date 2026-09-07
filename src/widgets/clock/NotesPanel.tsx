import { useState } from 'react'
import { actions, useAppData } from '../../lib/store'
import { scratchTitle, sortScratch } from '../../lib/scratch'

/** How many of the last notes the panel shows. Enough to recognise one, few enough not to be a list. */
const RECENT_NOTES = 3

/**
 * One line, kept, and the panel is gone.
 *
 * Its own button in the header since v2.5's follow-up, next to the journal
 * it is most often confused with. It was the third tab of the clock panel
 * before that, on the reasoning that the clock is the one control on screen
 * from every tab - the reasoning held and the shape did not, because
 * reaching a line you wanted to write meant pressing a picture of a clock
 * and then reading four labels to find the one that was not about time.
 *
 * **Not a second Scratch.** The overlay is a place to sit: a draft per
 * keystroke, the whole stream, pictures, the actions on every note. This is
 * a door somebody is already halfway through - type, Enter, gone, still
 * looking at whatever they were looking at. The last three are here to
 * recognise rather than to read, and Open notes hands over to the stream.
 *
 * **And it is not the journal.** A note is a thought caught on the way past:
 * short, undated in any way that matters, and it turns into a task. A
 * journal entry is a day - dated, kept, turned into nothing. Notes is for
 * doing; the journal is for remembering. See DECISIONS "A journal, not a
 * form".
 */
export interface NotesPanelProps {
  /** Hands over to the whole stream. */
  onOpenFull: () => void
  /** Closes the panel - a note kept is a panel done. */
  onClose: () => void
}

export function NotesPanel({ onOpenFull, onClose }: NotesPanelProps) {
  const data = useAppData()
  const [note, setNote] = useState('')
  const recent = sortScratch(data.scratch).slice(0, RECENT_NOTES)

  function keepNote() {
    const text = note.trim()
    if (!text) return
    actions.addScratch(text)
    setNote('')
    onClose()
  }

  return (
    <div className="clock-panel clock-notes">
      <textarea
        className="clock-note-input"
        aria-label="A quick note"
        placeholder="One line. Enter keeps it."
        rows={2}
        autoFocus
        value={note}
        onChange={e => setNote(e.target.value)}
        onKeyDown={e => {
          if (e.key !== 'Enter' || e.shiftKey) return
          e.preventDefault()
          keepNote()
        }}
      />
      {recent.length === 0 ? (
        <p className="clock-note">Nothing written down yet.</p>
      ) : (
        <ul className="clock-note-list">
          {recent.map(n => (
            <li key={n.id}>{scratchTitle(n.text, 60)}</li>
          ))}
        </ul>
      )}
      <button type="button" className="clock-note-open" onClick={onOpenFull}>
        Open notes
      </button>
    </div>
  )
}
