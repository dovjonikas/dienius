import { useEffect, useRef, useState } from 'react'
import { actions, useAppData } from '../../lib/store'
import { addDays, formatDayTitle, todayKey } from '../../lib/dates'

/**
 * The journal: a day, and whatever you wanted to say on it.
 *
 * It was three questions on a schedule until v2.5 - one in the morning and
 * two on the evening close card - and the owner's verdict was that it was
 * too much. A form that appears every evening with three empty boxes is a
 * form somebody starts skipping, and then starts avoiding the card that
 * carries it. See DECISIONS "A journal, not a form".
 *
 * So there are no questions here. A date, arrows through the days, and one
 * box. It saves while you type, on a short debounce, and there is no Save
 * button because there is nothing to decide.
 *
 * **A day with nothing on it says nothing.** No "you missed a day", no
 * streak, no count of the days written. Most days have nothing on them and
 * that is not a state this app remarks on - the same rule the scratch count
 * and the day's own score keep.
 *
 * **It is not Notes, and the empty state says which.** A note is a thought
 * caught on the way past, undated in any way that matters, and it turns
 * into a task. This is a day, dated, kept, and turns into nothing.
 */

/** How long typing settles before it is written. Long enough not to commit per keystroke. */
const SAVE_AFTER_MS = 500

export interface JournalPanelProps {
  /** Hands over to the full view - a month at a time, and the search. */
  onOpenFull: () => void
}

export function JournalPanel({ onOpenFull }: JournalPanelProps) {
  const data = useAppData()
  const [date, setDate] = useState(todayKey)
  const stored = data.days[date]?.journal ?? ''
  const [text, setText] = useState(stored)
  const boxRef = useRef<HTMLTextAreaElement>(null)
  const dateRef = useRef(date)

  useEffect(() => {
    boxRef.current?.focus()
  }, [])

  // Moving to another day shows that day's writing rather than carrying the
  // last one's over - and it writes what was in the box first, because the
  // debounce below may not have fired yet.
  useEffect(() => {
    if (dateRef.current === date) return
    actions.setJournal(dateRef.current, text)
    dateRef.current = date
    setText(data.days[date]?.journal ?? '')
    // Only when the day changes; `text` is deliberately not a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date])

  useEffect(() => {
    if (text === stored) return
    const timer = setTimeout(() => actions.setJournal(date, text), SAVE_AFTER_MS)
    return () => clearTimeout(timer)
  }, [text, stored, date])

  // And whatever is still in the box when the panel goes. Without this the
  // last half second of typing is lost every time somebody writes a line and
  // closes the panel, which is the ordinary way to use it.
  const pending = useRef({ date, text })
  pending.current = { date, text }
  useEffect(() => () => actions.setJournal(pending.current.date, pending.current.text), [])

  return (
    <div className="clock-panel journal-panel">
      <div className="journal-days">
        <button type="button" className="journal-step" aria-label="The day before" onClick={() => setDate(d => addDays(d, -1))}>
          &larr;
        </button>
        <span className="journal-date">{date === todayKey() ? 'Today' : formatDayTitle(date)}</span>
        <button
          type="button"
          className="journal-step"
          aria-label="The day after"
          disabled={date >= todayKey()}
          onClick={() => setDate(d => addDays(d, 1))}
        >
          &rarr;
        </button>
      </div>

      <textarea
        ref={boxRef}
        className="journal-box"
        aria-label={`Journal for ${formatDayTitle(date)}`}
        placeholder="..."
        rows={6}
        value={text}
        onChange={e => setText(e.target.value)}
      />

      {/* Notes and the journal are one press apart on the same popover and
          both are a box you type into, so nothing in the shape of either
          says which is which. It is said once, on a day with nothing on it,
          where somebody is deciding which one they wanted - and it goes the
          moment there is writing, because a line explaining itself over
          your own words is the app talking during a sentence. */}
      {text.trim() === '' && (
        <p className="journal-difference">Notes is for doing. This is for remembering.</p>
      )}

      <button type="button" className="clock-note-open" onClick={onOpenFull}>
        Open full
      </button>
    </div>
  )
}
