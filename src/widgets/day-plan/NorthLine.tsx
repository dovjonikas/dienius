import { useAppData } from '../../lib/store'
import { todayKey } from '../../lib/dates'
import { northLineForDay } from '../../lib/northLine'
import { parseNorth } from '../../lib/northSections'
import { useNorthMoment } from '../../lib/useNorthMoment'

export interface NorthLineProps {
  date: string
  /** Opens North. The line is the first way in - CONVENTIONS section 17. */
  onOpenNorth: () => void
}

/**
 * North on the day's top, under the date.
 *
 * One line of North's text - a line written under one of its headings,
 * picked for the date and the part of the day by lib/northLine.ts - whole,
 * wrapping rather than cut, and the signature under it, quieter. A press
 * anywhere on it opens North.
 *
 * Nothing stands here where the text has nothing for the day - no text, or
 * a text with no line under a heading and no signature - or where the
 * switch under Nudges has taken North's text off the day. Until v2.28 a
 * goal's name stood in for it then; goals are retired, and an empty line is
 * not a placeholder.
 */
export function NorthLine({ date, onOpenNorth }: NorthLineProps) {
  const data = useAppData()
  const text = data.picture?.text ?? ''
  if (data.settings.north.stripOnDay === false || text === '') return null
  return <NorthTextLine text={text} date={date} onOpenNorth={onOpenNorth} />
}

/**
 * The text's line and the signature, as one thing to press.
 *
 * The line is in the text's own ink at the body size, and the signature a
 * step smaller in the secondary ink under it: the line is today's, the
 * signature every day's. The part of the day is only today's - another day,
 * looked at ahead or back, shows its line for the day. At an hour whose
 * lines are all under the other part's tag the signature stands alone.
 */
function NorthTextLine({ text, date, onOpenNorth }: { text: string; date: string; onOpenNorth: () => void }) {
  const moment = useNorthMoment()
  const line = northLineForDay(text, date, date === todayKey() ? moment : 'day')
  const { signature } = parseNorth(text)
  if (line === undefined && signature.length === 0) return null
  return (
    <div className="north-line" data-tour="north-line">
      <button type="button" className="north-line-text" onClick={onOpenNorth}>
        {line !== undefined && <span className="north-line-words">{line}</span>}
        {signature.length > 0 && <span className="north-line-signature">{signature.join('\n')}</span>}
      </button>
    </div>
  )
}
