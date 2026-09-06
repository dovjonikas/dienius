import { useEffect, useState } from 'react'
import { useAppData } from '../lib/store'
import { copyText, daysWithJournal, journalMarkdown } from '../lib/journal'

export interface CopyJournalButtonProps {
  /** The days the copy covers, in order. */
  dates: string[]
  /** The stretch's name for the markdown heading - "7 - 13 September 2026", "September 2026". */
  title: string
  /** "Copy week journal", "Copy month journal". */
  label: string
}

/**
 * One press that puts a stretch of the journal on the clipboard as
 * markdown, to paste into whatever is reading it next - the owner's other
 * chat, mostly. The week has one under its columns and Review has one for
 * the month; both are this.
 *
 * A text button rather than a filled one, because copying is not the thing
 * either screen is for. It says "Copied" for a moment and then says its
 * name again; when the stretch has nothing written on it there is nothing
 * to copy and the button is greyed with the fact in its tooltip, not hidden
 * - a control that appears only once you have used the feature is a control
 * nobody finds.
 */
export function CopyJournalButton({ dates, title, label }: CopyJournalButtonProps) {
  const data = useAppData()
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const has = daysWithJournal(data.days, dates).length > 0

  useEffect(() => {
    if (state === 'idle') return
    const timer = setTimeout(() => setState('idle'), 2000)
    return () => clearTimeout(timer)
  }, [state])

  async function copy() {
    const ok = await copyText(journalMarkdown(data.days, dates, title))
    setState(ok ? 'copied' : 'failed')
  }

  const what = label.replace(/^Copy /, '')
  return (
    <span className="copy-journal">
      <button
        type="button"
        className="link-button"
        disabled={!has}
        title={has ? 'As markdown, to paste anywhere' : `No journal lines in this ${what.replace(/ journal$/, '')}`}
        onClick={copy}
      >
        {state === 'copied' ? 'Copied' : state === 'failed' ? 'Could not copy' : label}
      </button>
      {/* A status rather than an aria-live attribute: the week already has a
          live region of its own for drags, and a second attribute ahead of
          it in the DOM was what a screen reader - and the week's tests -
          found first. */}
      <span className="visually-hidden" role="status">
        {state === 'copied' ? `${what} copied as text.` : state === 'failed' ? 'The clipboard could not be written.' : ''}
      </span>
    </span>
  )
}
