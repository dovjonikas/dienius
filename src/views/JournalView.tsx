import { useEffect, useMemo, useRef, useState } from 'react'
import { actions, useAppData } from '../lib/store'
import { addDays, formatDayTitle, todayKey } from '../lib/dates'
import { copyText, daysWithJournal, hasJournal, journalMarkdown, searchJournal } from '../lib/journal'
import { MiniCalendar } from '../widgets/day-plan/MiniCalendar'
import { useRestoreFocus } from '../lib/useRestoreFocus'

/**
 * The whole journal: a month on the left, a day on the right.
 *
 * The panel at the clock is for writing on today. This is for reading back,
 * which is a different thing and wants a different shape: the month with a
 * quiet dot on the days that have something, the chosen day's words beside
 * it, a search across everything, and the copy that puts a month into a
 * conversation in one press.
 *
 * **A day with nothing on it looks like a day with nothing on it.** No
 * count of the days written, no streak, no run, nothing anywhere that turns
 * a month of squares into a report card. That is the whole reason the
 * three questions came out - see DECISIONS "A journal, not a form" - and it
 * would be a strange thing to put back on the reading side.
 */

/** How long typing settles before it is written. The same as the panel's. */
const SAVE_AFTER_MS = 500

export function JournalView() {
  const data = useAppData()
  const [date, setDate] = useState(todayKey)
  const [query, setQuery] = useState('')
  const [text, setText] = useState(() => data.days[todayKey()]?.journal ?? '')
  const [copied, setCopied] = useState<'day' | 'month' | null>(null)

  const stored = data.days[date]?.journal ?? ''
  const written = useMemo(
    () => new Set(Object.keys(data.days).filter(d => hasJournal(data.days[d]))),
    [data.days],
  )
  const hits = searchJournal(data.days, query)

  function goTo(next: string) {
    if (next === date) return
    actions.setJournal(date, text)
    setDate(next)
    setText(data.days[next]?.journal ?? '')
  }

  // The same debounce the panel keeps, on a ref rather than on the render's
  // own closure: a timer held by a function that is new every keystroke is a
  // timer that is never cleared.
  const timer = useRef(0)
  // What is in the box when the view goes is written, not dropped: the
  // debounce is a convenience, not a decision about whether to keep it.
  const pending = useRef({ date, text })
  pending.current = { date, text }
  useEffect(
    () => () => {
      window.clearTimeout(timer.current)
      actions.setJournal(pending.current.date, pending.current.text)
    },
    [],
  )

  function write(next: string) {
    setText(next)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => actions.setJournal(date, next), SAVE_AFTER_MS)
  }

  // One flag for both buttons, holding which of them was pressed: two
  // booleans would let both read "Copied" if somebody pressed one and then
  // the other inside the second and a half.
  function said(which: 'day' | 'month') {
    setCopied(which)
    window.setTimeout(() => setCopied(null), 1500)
  }

  async function copyMonth() {
    const first = `${date.slice(0, 7)}-01`
    const dates = Array.from({ length: 31 }, (_, i) => addDays(first, i)).filter(d => d.startsWith(date.slice(0, 7)))
    const month = new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    if (await copyText(journalMarkdown(data.days, dates, month))) said('month')
  }

  // The day on its own. The month is the one this was built for - a stretch
  // of writing into a conversation in one press - but a single day is what
  // somebody reaches for when they want to send what they wrote this
  // morning and nothing else, and the week already has its own button under
  // the week view and in Review.
  async function copyDay() {
    if (await copyText(journalMarkdown(data.days, [date], formatDayTitle(date)))) said('day')
  }

  return (
    <section className="journal-view" aria-label="Journal">
      <div className="journal-view-head">
        <h2>Journal</h2>
        <input
          className="journal-search"
          type="search"
          aria-label="Search everything written"
          placeholder="Search"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <button type="button" className="btn-secondary" disabled={!hasJournal(data.days[date])} onClick={copyDay}>
          {copied === 'day' ? 'Copied' : 'Copy this day'}
        </button>
        <button type="button" className="btn-secondary" disabled={daysWithJournal(data.days, [...written]).length === 0} onClick={copyMonth}>
          {copied === 'month' ? 'Copied' : 'Copy this month'}
        </button>
      </div>

      <div className="journal-view-body">
        <div className="journal-view-side">
          <MiniCalendar date={date} onDateChange={goTo} marked={written} />
          {query.trim() !== '' && (
            <ul className="journal-hits" aria-label="What the search found">
              {hits.length === 0 ? (
                <li className="journal-hits-none">Nothing with that word in it.</li>
              ) : (
                hits.map(hit => (
                  <li key={hit}>
                    <button type="button" onClick={() => goTo(hit)}>
                      <span className="journal-hit-date">{formatDayTitle(hit)}</span>
                      <span className="journal-hit-line">{data.days[hit].journal!.split('\n')[0]}</span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>

        <div className="journal-view-day">
          <p className="journal-view-date">{formatDayTitle(date)}</p>
          <textarea
            className="journal-box journal-box-full"
            aria-label={`Journal for ${formatDayTitle(date)}`}
            placeholder="..."
            value={text === stored ? stored : text}
            onChange={e => write(e.target.value)}
          />
        </div>
      </div>
    </section>
  )
}

/**
 * The whole journal over the app, the same shape Scratch takes.
 *
 * Not a seventh tab in the rail: this is a place to read back rather than a
 * place to be, and the rail is for the six places a day is planned from. It
 * closes on Escape and on the scrim, like every other overlay here.
 */
export function JournalOverlay({ onClose }: { onClose: () => void }) {
  useRestoreFocus()
  return (
    <div className="journal-scrim" onClick={onClose}>
      <div
        className="journal-overlay"
        role="dialog"
        aria-label="Journal"
        data-keeps-keys=""
        onClick={e => e.stopPropagation()}
        onKeyDown={e => {
          if (e.key !== 'Escape') return
          e.stopPropagation()
          onClose()
        }}
      >
        <button type="button" className="task-detail-close journal-close" aria-label="Close the journal" onClick={onClose}>
          &times;
        </button>
        <JournalView />
      </div>
    </div>
  )
}
