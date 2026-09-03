import { useEffect, useId, useRef, useState } from 'react'
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
  /**
   * Which kind of pointer pressed this, if one did - cleared on blur.
   *
   * The line opens three ways, and on a touchscreen two of them fire for one
   * gesture: a tap focuses the button and then clicks it. Without knowing that
   * a press is in progress, the focus opens the panel and the click
   * immediately closes it, so a finger can never open it at all.
   */
  const pressedWith = useRef<string | null>(null)

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
        // Hover opens it on a pointer, tap opens it on a finger, and focus
        // opens it on a keyboard: this is the one thing on the page where
        // "look closer" and "press" mean the same thing.
        //
        // Three ways in, one piece of state, and the whole difficulty is that
        // a device usually has more than one of them. `pressedWith` is what
        // sorts them out - see its own comment above.
        onPointerDown={e => {
          pressedWith.current = e.pointerType
        }}
        onClick={() => {
          // A mouse already has this open by hovering. Toggling on its click
          // would collapse the panel under a cursor still sitting on it, at
          // the exact moment the person asked to see more.
          if (!hasMore || pressedWith.current === 'mouse') return
          setOpen(o => !o)
        }}
        onPointerEnter={e => e.pointerType === 'mouse' && hasMore && setOpen(true)}
        onPointerLeave={e => e.pointerType === 'mouse' && setOpen(false)}
        // Only a focus that did not come from a press. A tap focuses the
        // button on its way to the click, and opening here as well would
        // leave the click with nothing to do but close it again.
        onFocus={() => hasMore && pressedWith.current === null && setOpen(true)}
        onBlur={() => {
          pressedWith.current = null
          setOpen(false)
        }}
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
