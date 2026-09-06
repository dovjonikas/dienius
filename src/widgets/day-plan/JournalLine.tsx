import { useEffect, useRef, useState } from 'react'
import { actions, getData, useAppData } from '../../lib/store'
import { JOURNAL_QUESTIONS } from '../../lib/journal'

/**
 * The morning line: "Today: ..." under the North line, one line, optional.
 *
 * Drawn in the North line's own register - small, quiet, no box until it is
 * touched - because it is the same kind of thing: not a control, a sentence
 * that belongs to the day. The North line says what the days are for; this
 * says what this one is for, in the person's own words, and it is allowed
 * to say nothing at all. Nothing counts whether it was written.
 *
 * It saves on blur, on Enter and on leaving the day, not on every
 * keystroke. A field bound straight to a store that trims what it keeps
 * eats the space being typed; a draft that is committed when the person is
 * done typing does not, and the draft is committed on the way out too, so
 * moving to another day mid-sentence loses nothing. Escape puts the saved
 * line back.
 */
export function JournalLine({ date }: { date: string }) {
  const data = useAppData()
  const saved = data.days[date]?.journal?.intent ?? ''
  // `null` until touched, and the text after - the same shape the evening
  // card's field uses, for the same reason: a line cleared to empty has to
  // be tellable from a line never touched. The ref mirrors it for the
  // cleanup below, which runs after the next render has already moved on.
  const [draft, setDraft] = useState<string | null>(null)
  const draftRef = useRef<string | null>(null)

  function edit(text: string) {
    draftRef.current = text
    setDraft(text)
  }

  function settle() {
    draftRef.current = null
    setDraft(null)
  }

  // Leaving the day, or the screen, with a draft in hand writes it to the
  // day it was typed on. `date` here is the effect's own, which is the day
  // being left; the draft comes from the ref, because by the time this
  // cleanup runs the component has already rendered for the next day.
  useEffect(() => {
    return () => {
      write(date, draftRef.current)
      draftRef.current = null
    }
  }, [date])

  useEffect(() => {
    setDraft(null)
  }, [date])

  const value = draft ?? saved

  return (
    <label className="journal-line">
      <span className="journal-line-label">{JOURNAL_QUESTIONS.intent}</span>
      <input
        className="journal-line-input"
        value={value}
        placeholder="One line about what this day is for. Optional."
        aria-label="Today, in one line"
        onChange={e => edit(e.target.value)}
        onBlur={() => {
          write(date, draftRef.current)
          settle()
        }}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault()
            e.currentTarget.blur()
          } else if (e.key === 'Escape') {
            e.stopPropagation()
            settle()
            e.currentTarget.blur()
          }
        }}
      />
    </label>
  )
}

/** Writes a draft to a day, unless there is no draft or it says what the day already says. */
function write(date: string, draft: string | null): void {
  if (draft === null) return
  const saved = getData().days[date]?.journal?.intent ?? ''
  if (draft.trim() !== saved) actions.setJournal(date, { intent: draft })
}
