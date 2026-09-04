import { useState } from 'react'
import { actions, useAppData } from '../../lib/store'
import { addDays, todayKey } from '../../lib/dates'
import { isPushable } from '../../lib/pushRules'

const DISMISSED_KEY = 'dienius:yesterday-dismissed'

/**
 * What yesterday left behind, said once.
 *
 * The alternative - moving unfinished work forward on its own overnight -
 * was rejected in this app long before this banner existed, and for the same
 * reason it is rejected here: a plan that rewrites itself while you sleep is
 * a plan you did not make. Waking up to nine tasks you never agreed to
 * carry is exactly the morning this app is trying not to produce.
 *
 * So it states the fact and offers the one action, which takes one tap. Push
 * moves what can be pushed and says so; Dismiss means "I have seen it" and
 * is remembered for the rest of the day, not forever - tomorrow this asks
 * again about a different yesterday.
 *
 * Only ever on today, and only when there is genuinely something. A day in
 * the past has its own unfinished work sitting right there on it; a day in
 * the future has no yesterday worth the name.
 */
export function YesterdayBanner({ date }: { date: string }) {
  const data = useAppData()
  const [dismissed, setDismissed] = useState(() => readDismissed() === date)
  const [pushed, setPushed] = useState<{ moved: number; held: number } | null>(null)

  const isToday = date === todayKey()
  const yesterday = addDays(date, -1)
  const unfinished = (data.days[yesterday]?.tasks ?? []).filter(t => !t.done)

  if (!isToday || dismissed) return null

  function dismiss() {
    writeDismissed(date)
    setDismissed(true)
  }

  // Checked before "is there anything left", not after. A push moves the
  // tasks off yesterday, so the moment the button works there is nothing
  // unfinished there any more - and the early return below used to fire
  // first, taking the "Moved 3 to today." line with it. The banner simply
  // vanished on the press, and the sentence written to confirm it was only
  // ever reachable when something had stayed behind. Found by the rollover
  // e2e test in v1.11.
  if (pushed) {
    return (
      <div className="yesterday-banner is-done" role="status">
        <p>
          {pushed.moved > 0 ? `Moved ${pushed.moved} to today.` : 'Nothing could move.'}
          {pushed.held > 0 && ` ${pushed.held} stayed - already pushed as far as it goes.`}
        </p>
        <button type="button" className="yesterday-dismiss" onClick={dismiss}>
          Close
        </button>
      </div>
    )
  }

  if (unfinished.length === 0) return null
  const pushable = unfinished.filter(isPushable).length

  return (
    <div className="yesterday-banner" role="status">
      <p>
        Yesterday: {unfinished.length} unfinished
        {pushable < unfinished.length && ` - ${pushable} can still move`}
      </p>
      <div className="yesterday-actions">
        <button
          type="button"
          className="btn-secondary"
          disabled={pushable === 0}
          onClick={() => {
            const result = actions.rolloverUnfinished(yesterday)
            writeDismissed(date)
            setPushed(result)
          }}
        >
          Push to today
        </button>
        <button type="button" className="yesterday-dismiss" onClick={dismiss}>
          Dismiss
        </button>
      </div>
    </div>
  )
}

/**
 * Its own key, not part of the backup.
 *
 * "I have already looked at this" is a fact about this device this morning,
 * not something worth restoring onto another machine next Tuesday - the same
 * reasoning that keeps a running timer out of the backup. Wrapped, because
 * storage can be unavailable and a banner is never worth failing a render
 * over.
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
    // Nothing to do - the banner simply asks again next time.
  }
}
