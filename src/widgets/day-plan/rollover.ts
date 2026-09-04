import type { AppData, Task } from '../../lib/types'
import { addDays } from '../../lib/dates'
import { isPushable } from '../../lib/pushRules'
import { isRoutine, willReceive } from '../../lib/taskIdentity'
import { sourceCovers, weekdayOf } from '../../lib/repeats'

/**
 * What "push what is left to tomorrow" would actually do, counted three ways.
 *
 * Three, not two - see actions.rolloverUnfinished. A routine task tomorrow is
 * getting anyway is not "held", it is simply not this button's business, and
 * lumping it in with the ones at the push bound would make the count say
 * something untrue about both.
 */
export interface RolloverSplit {
  /** Would move. */
  pushable: number
  /** Would not, because it is already at the push bound - see pushRules. */
  held: number
  /** Would not, because tomorrow has it anyway. */
  covered: number
}

export function rolloverSplit(data: AppData, date: string, tasks: Task[]): RolloverSplit {
  const unfinished = tasks.filter(t => !t.done)
  const tomorrow = addDays(date, 1)
  const mappedTomorrow = data.settings.weekdayTemplates[weekdayOf(tomorrow)]
  const covered = unfinished.filter(
    t =>
      (isRoutine(t) && (t.repeatOf !== undefined || willReceive(data.days[tomorrow], t, mappedTomorrow))) ||
      sourceCovers(t, date, tomorrow),
  )
  const oneOff = unfinished.filter(t => !covered.includes(t))
  const pushable = oneOff.filter(isPushable).length
  return { pushable, held: oneOff.length - pushable, covered: covered.length }
}
