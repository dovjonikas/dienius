import { useState } from 'react'
import { useAppData } from '../../lib/store'
import { northPrompt } from '../../lib/north'
import { todayKey } from '../../lib/dates'

const DISMISSED_KEY = 'dienius:north-dismissed'

/**
 * The one time a goal comes forward on its own.
 *
 * Two occasions, both of them mornings: after a day that got away, and at the
 * start of a week. What it shows is the goal and its reason in full - the
 * commitment, restated. What it does not show is anything about yesterday. No
 * count of what was missed, no percentage, no red, no "you didn't". The app
 * knows exactly how the day went and says none of it, because the moment this
 * card contains a number about the past it becomes a report card, and a
 * report card from a planner is a planner people stop opening.
 *
 * The tone to hold: this is a note from somebody to themselves, written on a
 * better morning. It is allowed to be warm. It is not allowed to be a system
 * telling you off.
 *
 * One button. Dismissing is remembered for the day only - tomorrow is a
 * different morning and will decide again on its own terms.
 */
export function NorthCard() {
  const data = useAppData()
  const today = todayKey()
  const [dismissed, setDismissed] = useState(() => readDismissed())

  const prompt = northPrompt(data, today, dismissed)
  if (!prompt) return null

  const { goal, kind } = prompt

  return (
    <aside className={kind === 'monday' ? 'north-card is-monday' : 'north-card'} aria-label="Why this matters">
      <p className="north-card-lead">{kind === 'monday' ? 'New week.' : 'A reminder of why.'}</p>
      <h2 className="north-card-title">{goal.title}</h2>
      {goal.why && <p className="north-card-why">{goal.why}</p>}
      {goal.identity && <p className="north-card-identity">{goal.identity}</p>}
      <button
        type="button"
        className="north-card-ok"
        onClick={() => {
          writeDismissed(today)
          setDismissed(today)
        }}
      >
        Ok
      </button>
    </aside>
  )
}

/**
 * Its own key, and not in a backup - the same reasoning the yesterday
 * banner's own dismissal follows. "I have already read this today" is a fact
 * about this device this morning, not something worth restoring onto another
 * machine next week. Wrapped, because storage can be unavailable and a card
 * is never worth failing a render over.
 */
function readDismissed(): string | null {
  try {
    return localStorage.getItem(DISMISSED_KEY)
  } catch {
    return null
  }
}

function writeDismissed(date: string): void {
  try {
    localStorage.setItem(DISMISSED_KEY, date)
  } catch {
    // Nothing to do - it simply asks again next time.
  }
}
