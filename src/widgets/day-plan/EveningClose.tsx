import { useState } from 'react'
import { actions, useAppData } from '../../lib/store'
import { todayKey } from '../../lib/dates'
import { isNightKind, kindOnDate } from '../../lib/dayKinds'
import { parseNorth } from '../../lib/northSections'
import { closingAt, eveningSummary, pushableAtClose, stillAhead } from '../../lib/eveningClose'
import { requestCloudBackup } from '../../lib/cloudBackup'

const DISMISSED_KEY = 'dienius:evening-dismissed'

/**
 * The end of the day, said once, quietly.
 *
 * Everything here is tone, and the tone is the feature - see the module
 * comment in lib/eveningClose.ts, which owns the rules and the reasoning.
 * What this file is responsible for is not breaking them:
 *
 * - The one sentence, and no second one about what is left.
 * - No colour that means anything. The card is a surface and muted ink; there
 *   is no accent bar, no tick, no progress ring, nothing that could be read
 *   as a grade.
 * - One button that ends it, and one offer beside it that can be ignored.
 * - Nothing is asked. Three questions lived here until v2.5 and the owner's
 *   verdict was that it was too much; writing has its own place now, with
 *   no schedule attached - see widgets/clock/JournalPanel.
 *
 * Dismissing is remembered for the date, on this device, under its own key -
 * the same shape as the yesterday banner. Deliberately *not* in settings the
 * way the North dismissal is: closing the day is a thing you do at the end of
 * an evening, on the device in your hand, and a phone that refused to offer
 * it because the laptop closed the day at six would be wrong about whose
 * evening it is.
 *
 * It stands on today's page, and closes the day whose evening it is - which
 * since the owner's brief of 2026-09-25 can be yesterday's: a night is
 * closed at eight the morning after, half an hour before the sleep that ends
 * it (lib/eveningClose.ts, `closingAt`).
 */
export function EveningClose({ date }: { date: string }) {
  const data = useAppData()
  const [, setClosed] = useState<string | null>(null)
  const [pushOffered, setPushOffered] = useState<string | null>(null)

  const today = todayKey()
  const now = new Date()
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const closing = date === today ? closingAt(data, today, nowMinutes, readDismissed) : null
  const summary = eveningSummary(closing?.day)
  if (!closing || !summary) return null

  const { signature } = parseNorth(data.picture?.text ?? '')
  // What is still tonight's - a shift that starts at ten, a class running now -
  // is not unfinished, and the push leaves it where it is. Read on the list
  // the push moves, the closing date's own, and on its clock.
  const own = data.days[closing.date]
  const ahead = stillAhead(own, closing.nowMinutes)
  const unfinished = pushableAtClose(own, ahead)
  const yesterday = closing.date !== today

  function close() {
    if (!closing) return
    rememberDismissed(closing.date)
    setClosed(closing.date)
    // The day is over, so its copy can be: the one moment a push is owed
    // that no clock could find. Fire-and-forget - see lib/cloudBackup.ts.
    void requestCloudBackup('evening-close')
  }

  return (
    <aside className="evening-close" aria-label="Closing the day">
      {/* Just the lead. It carried " - sleep in 1h" until v2.6, under a
          header that says "Sleep in 1h" in the same hour, which is the same
          fact twice on one screen - CONVENTIONS section 23. A day closed the
          morning after is not today: a night is the night, and anything
          else the day. */}
      <p className="evening-close-lead">
        {!yesterday ? 'That was today' : isNightKind(kindOnDate(data, closing.date)) ? 'That was the night' : 'That was the day'}
      </p>

      {/* The whole of what the app says about how the day went. One sentence,
          and nothing in it about what was not done. */}
      <p className="evening-close-line">{summary.line}</p>

      {/* Nothing is asked here any more.

          There were three questions on this card until v2.5 - the best
          moment, what was real today, what to tell yourself tomorrow - and
          the owner's verdict on the lot was that it was too much. A card
          that appears every evening with three empty boxes in it is a card
          somebody starts closing without reading. What is left is the
          mechanics it was always for: the day is over, and the things that
          did not happen can go to tomorrow. Writing has its own place now
          and no schedule - see widgets/clock/JournalPanel and DECISIONS
          "A journal, not a form". */}

      <div className="evening-close-foot">
        <button type="button" className="btn-primary" onClick={close}>
          Close the day
        </button>
        {/* Offered, never urged, and never given a reason. Leaving three
            things unfinished is not a problem this card is here to solve. */}
        {/* To the date after the one closing - today, once that is
            yesterday. */}
        {unfinished > 0 && pushOffered !== closing.date && (
          <button
            type="button"
            className="evening-close-push"
            onClick={() => {
              actions.rolloverUnfinished(closing.date, ahead)
              setPushOffered(closing.date)
            }}
          >
            Push {unfinished} to {yesterday ? 'today' : 'tomorrow'}
          </button>
        )}
      </div>

      {/* North's signature, the words the day ends on - the window after
          sleep opens the day with the picture and this closes it. Small,
          last, and only when there is one. It was the first goal's name
          until goals were retired in v2.28. */}
      {signature.length > 0 && <p className="evening-close-north">{signature.join('\n')}</p>}
    </aside>
  )
}

function readDismissed(date: string): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === date
  } catch {
    return false
  }
}

function rememberDismissed(date: string): void {
  try {
    localStorage.setItem(DISMISSED_KEY, date)
  } catch {
    // A device that cannot remember offers the card again, which is a small
    // annoyance rather than a lost anything.
  }
}
