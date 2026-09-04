import { commit, getData } from './core'
import type { DayType, IfThenEntry, IfThenWhen } from '../types'

/** If-then rules and the rotation's own bookkeeping. */
export const ifThenActions = {
  addIfThen(input: {
    trigger: string
    action: string
    color?: string
    dayTypes?: DayType[]
    when?: IfThenWhen
  }): IfThenEntry {
    const data = getData()
    const entry: IfThenEntry = {
      id: crypto.randomUUID(),
      trigger: input.trigger,
      action: input.action,
      color: input.color,
      dayTypes: input.dayTypes,
      when: input.when,
    }
    commit({ ...data, ifThens: [...data.ifThens, entry] })
    return entry
  },

  updateIfThen(entry: IfThenEntry): void {
    const data = getData()
    commit({ ...data, ifThens: data.ifThens.map(e => (e.id === entry.id ? entry : e)) })
  },

  deleteIfThen(id: string): void {
    const data = getData()
    commit({ ...data, ifThens: data.ifThens.filter(e => e.id !== id) })
  },

  /**
   * Records that `id` was the rule `pickIfThenRule` chose to surface for
   * `date` - the rotation's own scheduling metadata, not a measurement of
   * the rule. Called once per day from `IfThenDayRule`'s own effect, and
   * only ever moves `lastSurfaced` forward to the date it was actually
   * shown on; nothing about the rule's trigger, action or tags changes.
   */
  markIfThenSurfaced(id: string, date: string): void {
    const data = getData()
    commit({
      ...data,
      ifThens: data.ifThens.map(e => (e.id === id ? { ...e, lastSurfaced: date } : e)),
    })
  },
}
