import { useEffect, useId, useState } from 'react'
import { useAppData } from '../../lib/store'
import { goalForDay } from '../../lib/north'

/**
 * One line of quiet text under the header: the thing the days are for.
 *
 * Everything about how this is drawn is an argument that it is not UI. No
 * icon, no border, no background, no chevron, nothing that looks pressable
 * and nothing that looks like a heading. Small, wide-tracked, uppercase, in
 * the muted ink - the register of a watermark or a running head, not of a
 * control. It is not here to be acted on; it is here so that on the four
 * hundredth ordinary Tuesday, what the Tuesdays are for is still in the room.
 *
 * It is still a button, because it opens. But a button that looks like a
 * button would be a fifth thing competing with the four in the header, and
 * this has to lose that competition on purpose.
 *
 * One goal a day, rotating - see `goalForDay`. Not all of them at once: four
 * lines of purpose above a task list is a manifesto, and nobody reads their
 * own manifesto twice.
 */
export function NorthLine({ date }: { date: string }) {
  const data = useAppData()
  const [open, setOpen] = useState(false)
  const panelId = useId()

  const goal = goalForDay(data.goals, date)

  // Collapsed whenever the day changes underneath it. Leaving it open across
  // a date change would carry one day's expansion onto another day's goal.
  useEffect(() => {
    setOpen(false)
  }, [date])

  if (!goal) return null

  const hasMore = !!goal.why || !!goal.identity

  return (
    <div className={open ? 'north-line is-open' : 'north-line'}>
      <button
        type="button"
        className="north-line-title"
        aria-expanded={hasMore ? open : undefined}
        aria-controls={hasMore ? panelId : undefined}
        // Hover opens it on a pointer and tap opens it on a finger, which are
        // the same gesture here: this is the one thing on the page where
        // "look closer" and "press" mean the same thing. The hover half is in
        // CSS so it costs nothing on a device that has no hover.
        onClick={() => hasMore && setOpen(o => !o)}
        onPointerEnter={e => e.pointerType === 'mouse' && hasMore && setOpen(true)}
        onPointerLeave={e => e.pointerType === 'mouse' && setOpen(false)}
        onFocus={() => hasMore && setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        {goal.title}
      </button>

      {hasMore && (
        <div className="north-line-more" id={panelId} hidden={!open}>
          {goal.why && <p className="north-line-why">{goal.why}</p>}
          {goal.identity && <p className="north-line-identity">{goal.identity}</p>}
        </div>
      )}
    </div>
  )
}
