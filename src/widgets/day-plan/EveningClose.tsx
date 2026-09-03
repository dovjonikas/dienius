import { useEffect, useState } from 'react'
import { actions, useAppData } from '../../lib/store'
import { todayKey } from '../../lib/dates'
import { activeGoals } from '../../lib/north'
import {
  DEFAULT_EVENING_CLOSE,
  eveningSummary,
  pushableAtClose,
  shouldClose,
} from '../../lib/eveningClose'
import { minutesUntilSleep, sleepProfileWindow, wakingWindow, formatDuration } from './capacity'

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
 * - The question, if it is on, is a plain empty field with a placeholder. It
 *   never asks twice: a day that already carries a line shows the line.
 *
 * Dismissing is remembered for the date, on this device, under its own key -
 * the same shape as the yesterday banner. Deliberately *not* in settings the
 * way the North dismissal is: closing the day is a thing you do at the end of
 * an evening, on the device in your hand, and a phone that refused to offer
 * it because the laptop closed the day at six would be wrong about whose
 * evening it is.
 */
export function EveningClose({ date }: { date: string }) {
  const data = useAppData()
  const [dismissed, setDismissed] = useState(() => readDismissed(date))
  const [moment, setMoment] = useState('')
  const [pushOffered, setPushOffered] = useState(false)

  const day = data.days[date]
  const settings = data.settings.eveningClose ?? DEFAULT_EVENING_CLOSE
  const now = new Date()
  const nowMinutes = now.getHours() * 60 + now.getMinutes()

  // The date changing under a card that is open - a phone left on the day
  // view past midnight - resets the dismissal to whatever the new day says.
  useEffect(() => {
    setDismissed(readDismissed(date))
    setMoment('')
    setPushOffered(false)
  }, [date])

  const open = shouldClose({ day, settings, nowMinutes, isToday: date === todayKey(), dismissed })
  const summary = eveningSummary(day)
  if (!open || !summary) return null

  const goal = activeGoals(data.goals)[0]
  const waking = wakingWindow(sleepProfileWindow(day?.sleepProfileId, { profiles: data.settings.sleepProfiles }))
  const untilSleep = minutesUntilSleep(nowMinutes, waking)
  const unfinished = pushableAtClose(day)

  function close() {
    if (settings.askBestMoment && moment.trim()) actions.setBestMoment(date, moment)
    rememberDismissed(date)
    setDismissed(true)
  }

  return (
    <aside className="evening-close" aria-label="Closing the day">
      <p className="evening-close-lead">
        That was today
        {untilSleep !== null && untilSleep > 0 && (
          <span className="evening-close-sleep"> - sleep in {formatDuration(untilSleep)}</span>
        )}
      </p>

      {/* The whole of what the app says about how the day went. One sentence,
          and nothing in it about what was not done. */}
      <p className="evening-close-line">{summary.line}</p>

      {settings.askBestMoment && (
        <label className="evening-close-moment">
          <span className="field-label">Best moment today?</span>
          {/* Not required, not validated, not counted. A day with nothing in
              this field is not a day missing anything - which is why an
              answer already given is shown as the value rather than the
              question being asked again. */}
          <input
            value={moment || day?.bestMoment || ''}
            maxLength={140}
            placeholder="Optional. One line, for the calendar to remember."
            onChange={e => setMoment(e.target.value)}
          />
        </label>
      )}

      <div className="evening-close-foot">
        <button type="button" className="btn-primary" onClick={close}>
          Close the day
        </button>
        {/* Offered, never urged, and never given a reason. Leaving three
            things unfinished is not a problem this card is here to solve. */}
        {unfinished > 0 && !pushOffered && (
          <button
            type="button"
            className="evening-close-push"
            onClick={() => {
              actions.rolloverUnfinished(date)
              setPushOffered(true)
            }}
          >
            {unfinished} unfinished - push to tomorrow?
          </button>
        )}
      </div>

      {/* The morning card says why you are starting; this says where you are
          going. Small, last, and only when there is a goal to say it with. */}
      {goal && <p className="evening-close-north">{goal.title}</p>}
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
