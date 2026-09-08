import { useState } from 'react'
import { actions, useAppData } from '../../lib/store'
import { offerUndo } from '../../lib/undo'
import { formatDuration, windowFor } from './capacity'
import { planReturn, setAsideOf } from './setAside'

/**
 * What a replan took off the day, waiting at the bottom of it.
 *
 * The owner's scenario, in their words: you replan an evening without
 * knowing how long it will take, something comes off, and that something
 * must not disappear - it stays faded, and when you get home one press puts
 * it back. So this is deliberately the quietest thing on the screen: no
 * colour, no count, no time on the clock, and nothing that reads as a
 * reproach. It is a shelf, not a list of failures.
 *
 * One press opens the offer - where it would go and how long it would be -
 * and one more takes it. Nothing moves before the second press, which is
 * the same "proposed, not asked" rule every other replan follows.
 *
 * After midnight it is gone without a word. A day that is over has nothing
 * to bring anything back into, and a strip that survived into the next
 * morning would be a list of yesterday's leftovers, which is exactly the
 * kind of counting CONVENTIONS section 12 forbids.
 */

export interface SetAsideStripProps {
  date: string
  /** Minutes since midnight, for finding the next free stretch. */
  nowMinutes: number
  /** The strip belongs to today. Any other day shows nothing. */
  isToday: boolean
}

export function SetAsideStrip({ date, nowMinutes, isToday }: SetAsideStripProps) {
  const data = useAppData()
  const [openId, setOpenId] = useState<string | null>(null)
  const day = data.days[date]
  const waiting = setAsideOf(day?.tasks ?? [])

  if (!isToday || waiting.length === 0) return null

  const window = windowFor(day?.sleepProfileId, { profiles: data.settings.sleepProfiles })
  const open = waiting.find(t => t.id === openId)
  const offer = open ? planReturn(open, day?.tasks ?? [], nowMinutes, window) : null

  function take() {
    if (!offer || !open) return
    const undo = actions.returnSetAside(date, offer)
    setOpenId(null)
    if (undo) offerUndo(offer.tomorrow ? `${open.title} moved to tomorrow` : `${open.title} is back`, undo)
  }

  return (
    <div className="set-aside">
      <span className="set-aside-label">Set aside</span>
      <ul className="set-aside-list">
        {waiting.map(task => (
          <li key={task.id}>
            <button
              type="button"
              className={task.id === openId ? 'set-aside-item is-open' : 'set-aside-item'}
              aria-expanded={task.id === openId}
              onClick={() => setOpenId(id => (id === task.id ? null : task.id))}
            >
              <span className="set-aside-title">{task.title}</span>
              {task.minutes !== undefined && <span className="set-aside-length">{formatDuration(task.minutes)}</span>}
            </button>
          </li>
        ))}
      </ul>

      {offer && (
        <div className="set-aside-offer">
          <p className="set-aside-line" role="status">
            {offer.line}
          </p>
          <span className="set-aside-actions">
            <button type="button" className="btn-secondary" onClick={() => setOpenId(null)}>
              Not now
            </button>
            <button type="button" className="primary" onClick={take}>
              Bring back
            </button>
          </span>
        </div>
      )}
    </div>
  )
}
