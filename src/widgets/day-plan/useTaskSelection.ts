import { useEffect, useRef, useState } from 'react'
import type { Task } from '../../lib/types'
import { actions } from '../../lib/store'

/**
 * "Where does this fit?" - selecting one untimed task so the day can offer it
 * a place, and putting focus back where it came from afterwards.
 *
 * Only ever one selection at a time: choosing a different task's title while
 * one is already selected simply moves the selection rather than stacking
 * sheets, since there is only ever one thing to decide about at once.
 */

export interface TaskSelection {
  selectedTaskId: string | null
  /** Focus target for when a sheet closes on a task whose trigger is gone. */
  taskListRef: React.RefObject<HTMLUListElement | null>
  toggleSelect: (taskId: string) => void
  closeSelection: () => void
  placeSelected: (taskId: string, time: string) => void
}

export function useTaskSelection(
  date: string,
  tasks: Task[],
  isTimelineVisible: boolean,
  announce: (text: string) => void,
): TaskSelection {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  // Where focus lands once the sheet closes - the same trigger's own title
  // button when it still renders one, or the task list itself when it does
  // not (placing a float turns it into an anchor, whose title is no longer a
  // select button at all) - see the effect below, and TimelineGrid.tsx's own
  // `pendingFocusGapStart` for the same pattern applied to a gap's trigger.
  const pendingSelectFocusRef = useRef<string | null>(null)
  const taskListRef = useRef<HTMLUListElement>(null)

  // Selecting a task and getting anything done to it are two different
  // actions, and only one of them ends the selection on its own. If the
  // selected task is finished (its own checkbox, independent of the title
  // button next to it) or removed entirely while its sheet is open, "where
  // does this fit" no longer means anything - clear it rather than leave a
  // sheet open on a task that no longer needs placing.
  useEffect(() => {
    if (selectedTaskId && !tasks.some(t => t.id === selectedTaskId && !t.done)) {
      setSelectedTaskId(null)
    }
  }, [tasks, selectedTaskId])

  useEffect(() => {
    if (pendingSelectFocusRef.current === null) return
    const id = pendingSelectFocusRef.current
    pendingSelectFocusRef.current = null
    const trigger = document.querySelector<HTMLButtonElement>(`[data-select-task="${id}"]`)
    if (trigger) trigger.focus()
    else taskListRef.current?.focus()
  })

  function toggleSelect(taskId: string) {
    if (selectedTaskId === taskId) {
      pendingSelectFocusRef.current = taskId
      setSelectedTaskId(null)
      return
    }
    setSelectedTaskId(taskId)
    // Opening the grid is a defensible side effect of selecting, not an extra
    // decision of its own: the offers sheet already works with the timeline
    // collapsed, but the whole point of "open the calendar" in the brief is
    // seeing the offer as a place in the day, not just a sentence about one.
    // This flips the same app-wide setting the disclosure button itself flips
    // - see docs/TIMELINE.md section 5 - so it behaves exactly like opening it
    // by hand: it stays open afterward, on this day and every one after, until
    // the owner closes it again. Only when the grid is not already visible,
    // though - at a wide viewport isTimelineVisible is already true regardless
    // of the stored setting (see docs/LAYOUT-WIDE.md section 5), and writing
    // true here anyway would silently clobber the phone's own choice the next
    // time this same install is opened narrow.
    if (!isTimelineVisible) actions.setTimelineExpanded(true)
  }

  function closeSelection() {
    pendingSelectFocusRef.current = selectedTaskId
    setSelectedTaskId(null)
  }

  function placeSelected(taskId: string, time: string) {
    const task = tasks.find(t => t.id === taskId)
    if (actions.placeFloat(date, taskId, time)) {
      announce(task ? `${task.title} placed at ${time}.` : `Placed at ${time}.`)
    }
    // Placing always ends the selection, whether or not it actually moved
    // anything - a refused placement (a race with some other update) has
    // nothing left worth asking about either. See TaskGapOffers.tsx: one tap
    // places it, and there is no confirmation step in between.
    closeSelection()
  }

  return { selectedTaskId, taskListRef, toggleSelect, closeSelection, placeSelected }
}
