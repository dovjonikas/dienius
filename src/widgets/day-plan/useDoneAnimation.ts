import { useEffect, useRef, useState } from 'react'
import { actions } from '../../lib/store'

/**
 * How long a task that has just been checked stays in the open list before it
 * moves down into the Done section - long enough for the card's own finishing
 * animation (.task-leaving in styles.css) to actually be seen.
 *
 * The move is the point of the interaction: the list gets shorter every time
 * something is finished, so by the end of a day the screen is nearly empty and
 * the progress bar is full. Doing it instantly on the click makes the card
 * vanish, which reads as "did I just delete that?" rather than as progress.
 * Holding it for a beat first turns the same state change into something
 * watched. Kept in sync by hand with the animation duration in styles.css; if
 * the two ever disagree, the shorter one is what is seen.
 */
const DONE_LEAVE_MS = 420

/**
 * Checking a task off, and holding its card in place while it plays out.
 *
 * The store write happens first and unconditionally, so the score, the
 * timeline block and everything else derived from it all update on the click
 * itself; only where the row is *drawn* waits. Nothing here can ever disagree
 * with what is actually saved.
 */
export function useDoneAnimation(date: string): {
  leavingId: string | null
  toggleDone: (taskId: string, wasDone: boolean) => void
} {
  const [leavingId, setLeavingId] = useState<string | null>(null)
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (leaveTimer.current) clearTimeout(leaveTimer.current)
    },
    [],
  )

  function toggleDone(taskId: string, wasDone: boolean) {
    actions.toggleTask(date, taskId)
    if (leaveTimer.current) clearTimeout(leaveTimer.current)
    // Undoing - unchecking something that is still mid-animation - cancels the
    // hold rather than leaving a task pinned in the open list by a timer
    // nobody can see any more.
    if (wasDone) {
      setLeavingId(null)
      return
    }
    setLeavingId(taskId)
    leaveTimer.current = setTimeout(() => setLeavingId(null), DONE_LEAVE_MS)
  }

  return { leavingId, toggleDone }
}
