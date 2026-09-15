import type { DayPlan } from '../../lib/types'
import { actions } from '../../lib/store'
import { offerUndo } from '../../lib/undo'
import { useTimelineDrag, type TimelineDrag } from './useTimelineDrag'

/**
 * The day's binding of the timeline drag.
 *
 * Until v2.21 the gestures lived here, bound to a date and to the store.
 * They live in `useTimelineDrag` now, which knows nothing about dates or
 * the store - the template editor's picture wanted the same two gestures,
 * and the plan said the machinery should be reused rather than written a
 * second time. What is left here is what a drag *means* on a day: a task
 * reshaped, a way back offered, and a drop on the tray taking the time off.
 * The template editor binds the same hook to a draft block, and there the
 * tray does not exist.
 */
export type DayDrag = TimelineDrag

export function useDayDrag(date: string, day: DayPlan | undefined): DayDrag {
  return useTimelineDrag({
    tasks: day?.tasks ?? [],
    reshape: (taskId, patch) => actions.reshapeTask(date, taskId, patch),
    unanchor: taskId => actions.unanchorTask(date, taskId),
    offerUndo,
  })
}
