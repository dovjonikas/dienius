import { useEffect, useState } from 'react'
import { useAppData } from '../../lib/store'
import { goalForDay } from '../../lib/north'

export interface NorthLineProps {
  date: string
  /** Opens the North window. The line is the first way in - CONVENTIONS section 17. */
  onOpenNorth: () => void
}

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
 * It is still a button, because it goes somewhere. But a button that looks
 * like a button would be a fifth thing competing with the four in the header,
 * and this has to lose that competition on purpose.
 *
 * One goal a day, rotating - see `goalForDay`. Not all of them at once: four
 * lines of purpose above a task list is a manifesto, and nobody reads their
 * own manifesto twice.
 *
 * ## Two gestures, and why they no longer fight
 *
 * Hovering or focusing it shows the why and the identity in place; pressing
 * it opens the North window, where all of them are, with the rules under
 * each. Those used to be the same gesture - a press expanded the panel - and
 * making them the same took a small machine to sort out, because on a
 * touchscreen one tap fires a focus and a click, so the focus opened the
 * panel and the click closed it again and a finger could never open it at
 * all. Splitting them removed the machine: hover is a peek, a press is a
 * door, and a phone that has no hover gets the door, which is the half that
 * shows more anyway.
 */
export function NorthLine({ date, onOpenNorth }: NorthLineProps) {
  const data = useAppData()
  const [peeking, setPeeking] = useState(false)

  const goal = goalForDay(data.goals, date)

  // Collapsed whenever the day changes underneath it. Leaving it open across
  // a date change would carry one day's expansion onto another day's goal.
  useEffect(() => {
    setPeeking(false)
  }, [date])

  if (!goal) return null

  const hasMore = !!goal.why || !!goal.identity

  return (
    <div className={peeking ? 'north-line is-open' : 'north-line'} data-tour="north-line">
      <button
        type="button"
        className="north-line-title"
        // No aria-expanded and no aria-controls: this button goes somewhere,
        // it does not disclose anything, and saying otherwise would promise a
        // screen reader a panel that pressing does not open. The peek is a
        // convenience for a pointer and a keyboard; everything in it, and the
        // rules besides, is on the screen the press lands on.
        title="North - 6"
        onClick={onOpenNorth}
        onPointerEnter={e => e.pointerType === 'mouse' && hasMore && setPeeking(true)}
        onPointerLeave={e => e.pointerType === 'mouse' && setPeeking(false)}
        onFocus={() => hasMore && setPeeking(true)}
        onBlur={() => setPeeking(false)}
      >
        {goal.title}
      </button>

      {hasMore && (
        <div className="north-line-more" aria-hidden="true" hidden={!peeking}>
          {goal.why && <p className="north-line-why">{goal.why}</p>}
          {goal.identity && <p className="north-line-identity">{goal.identity}</p>}
        </div>
      )}
    </div>
  )
}
