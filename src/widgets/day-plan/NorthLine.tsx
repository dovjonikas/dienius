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
 * wrapping rather than cut. In the evening, from 21:00, the signature stands
 * under it, quieter: the signature is what the day ends on, and the rest of
 * the day's top is the day's line alone (v2.28). A press anywhere on it
 * opens North.
 *
 * Nothing stands here where the text has nothing for the hour - no line under
 * a heading for this part of the day and, outside the evening, no signature
 * to stand alone - or where the switch under Nudges has taken North's text
 * off the day. Until v2.28 a goal's name stood in for it then; goals are
 * retired, and an empty line is not a placeholder.
 */
export function NorthLine({ date, onOpenNorth }: NorthLineProps) {
  const data = useAppData()
  const text = data.picture?.text ?? ''
  if (data.settings.north.stripOnDay === false || text === '') return null
  return <NorthTextLine text={text} date={date} onOpenNorth={onOpenNorth} />
}

/**
 * The text's line, and in the evening the signature, as one thing to press.
 *
 * The line is in the text's own ink at the body size, and the signature a
 * step smaller in the secondary ink under it. The part of the day is only
 * today's - another day, looked at ahead or back, shows its line for the day
 * and no signature. The evening is lib/northLine.ts's: from 21:00, unless the
 * three hours after waking are still running, when it is the morning. In the
 * evening, at an hour whose lines are all under the other part's tag, the
 * signature stands alone; at any other hour with no line, nothing does.
 */
function NorthTextLine({ text, date, onOpenNorth }: { text: string; date: string; onOpenNorth: () => void }) {
  const moment = useNorthMoment()
  const today = date === todayKey()
  const line = northLineForDay(text, date, today ? moment : 'day')
  const { signature } = parseNorth(text)
  const signing = today && moment === 'evening' && signature.length > 0
  if (line === undefined && !signing) return null
  return (
    <div className="north-line" data-tour="north-line">
      <button type="button" className="north-line-text" onClick={onOpenNorth}>
        {line !== undefined && <span className="north-line-words">{line}</span>}
        {signing && <span className="north-line-signature">{signature.join('\n')}</span>}
      </button>
    </div>
  )
}
