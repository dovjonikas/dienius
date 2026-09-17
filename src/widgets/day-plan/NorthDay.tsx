import { useEffect, useId, useState } from 'react'
import { useAppData } from '../../lib/store'
import { parseNorth } from '../../lib/northSections'
import { NorthSection } from '../../views/north/NorthSection'

/**
 * North on the day: the signature as one quiet line, and the headings as a
 * quiet list, each opening what it holds. Never the introduction.
 *
 * ## What of the text, and why only that
 *
 * The owner's brief took the text apart by what each part is for. The
 * introduction is read whole, once, after sleep - in the window that opens
 * then, and on the page - and a text read all day becomes wallpaper by the
 * end of a week, so the day never shows it. The signature is the line a
 * letter ends on and is short by nature, so it is the one part always in
 * view. The headings are an index: small and quiet, and the words under one
 * come when asked, the same way and by the same component as on the page -
 * a pointer resting on a heading lays them out under it over the column and
 * moves nothing, and a press opens them in the column.
 *
 * ## Where
 *
 * Beside the day, in the rail, where there is a rail: the rail is the day's
 * narrow column of context - the month, the templates, what is next and the
 * day's numbers - and North stands between the templates and what is next,
 * so that a 768px window shows the signature without the rail being
 * scrolled. It was a row of headings under the day's title until v2.24, and
 * a row over the task list is on the way to everything.
 *
 * Where there is no rail - a phone, a window too narrow for one - it is one
 * line under the day's title instead: the word North, and a press on it
 * opens the headings under it. The signature is in the day's own line above
 * it since v2.26 (NorthLine), so the fold does not say it again.
 *
 * No card, no edge and no ground: it is part of the page, not a widget on
 * it. The switch under Nudges takes it off the day, and only off is carried
 * in the plan - see `NorthSettings.stripOnDay`.
 */
export function NorthDay({ date, folded = false }: { date: string; folded?: boolean }) {
  const data = useAppData()
  const [open, setOpen] = useState(false)
  const listId = useId()

  // Folded again whenever the day changes underneath it, and every heading
  // with it - the sections are keyed by the date below.
  useEffect(() => {
    setOpen(false)
  }, [date])

  if (data.settings.north.stripOnDay === false) return null
  const { sections, signature } = parseNorth(data.picture?.text ?? '')
  if (sections.length === 0 && signature.length === 0) return null

  const headings =
    sections.length > 0 ? (
      <div id={listId} className="north-sections">
        {sections.map((section, i) => (
          <NorthSection key={`${date}-${i}`} heading={section.heading} paragraphs={section.paragraphs} />
        ))}
      </div>
    ) : null

  if (folded) {
    if (!headings) return null
    return (
      <div className="north-day is-folded" role="group" aria-label="North">
        <button
          type="button"
          className="north-day-line"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          onClick={() => setOpen(o => !o)}
        >
          North
        </button>
        {open && headings}
      </div>
    )
  }

  return (
    <section className="north-day" aria-label="North">
      {signature.length > 0 && (
        <div className="north-day-signature">
          {signature.map((paragraph, i) => (
            <p key={i} className="north-paragraph">
              {paragraph}
            </p>
          ))}
        </div>
      )}
      {headings}
    </section>
  )
}
