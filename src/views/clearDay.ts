import { actions } from '../lib/store'
import { longWeekday } from '../lib/dates'
import { offerUndo } from '../lib/undo'

/**
 * Clearing a day, said the same way wherever it is offered.
 *
 * Two places offer it - the month's day card, and the week column's head,
 * which is where somebody stamping a week on a Wednesday afternoon is
 * already standing - and a destructive action that asks two different
 * questions in two places is two actions as far as anybody reading them is
 * concerned. So the sentence lives here with the press behind it.
 *
 * The count and the day are both in the question because both are what
 * somebody is about to lose track of: "Clear this day?" on a screen showing
 * seven columns does not say which day, and it does not say that the day
 * being cleared has nine things on it.
 */

/** "Clear 9 tasks from Wednesday?" - and "1 task" for the one. */
export function clearDayQuestion(date: string, count: number): string {
  return `Clear ${count} ${count === 1 ? 'task' : 'tasks'} from ${longWeekday(date)}?`
}

/**
 * Clears the day and puts the five-second offer up, the way every expensive
 * action in this app does. False when there was nothing to clear, which is
 * what a second press on an offer already taken is.
 */
export function clearDayNow(date: string): boolean {
  const done = actions.clearDay(date)
  if (!done) return false
  offerUndo(`${longWeekday(date)} cleared`, done.undo)
  return true
}
