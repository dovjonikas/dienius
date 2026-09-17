import { commit, getData } from './core'
import { cleanLetter, dayKinds } from '../dayKinds'
import { cleanRoutine, type RoutineInput } from '../routines'
import type { DayKindMark, Routine } from '../types'

/**
 * Rotating shifts - kinds of day and routines, since v2.29. See
 * docs/RESEARCH-SHIFTS.md. Applying a roster to dates is stage 7's and lives
 * with the rest of a day's writes when it arrives.
 */
export const shiftActions = {
  /**
   * Marks a day template as a kind of day, or takes the mark off with null. A
   * letter with nothing in it is no mark. A week template is never a kind -
   * see `isDayKind` - so it is not marked.
   */
  setDayKind(templateId: string, mark: DayKindMark | null): void {
    const data = getData()
    const template = data.templates.find(t => t.id === templateId)
    if (!template) return
    const letter = mark ? cleanLetter(mark.letter) : ''
    if (letter && template.kind === 'week') return
    const templates = data.templates.map(t => {
      if (t.id !== templateId) return t
      const { dayKind: _mark, ...rest } = t
      if (!letter) return rest
      const order = Math.max(0, Math.floor(Number.isFinite(mark!.order) ? mark!.order : 0))
      return { ...rest, dayKind: { letter, order } }
    })
    commit({ ...data, templates })
  },

  /** Writes a routine, or nothing when there is no routine in what was given - see `cleanRoutine`. */
  addRoutine(input: RoutineInput): Routine | undefined {
    const data = getData()
    const clean = cleanRoutine(input, dayKinds(data.templates).map(t => t.id))
    if (!clean) return undefined
    const routine: Routine = { id: crypto.randomUUID(), ...clean }
    commit({ ...data, routines: [...data.routines, routine] })
    return routine
  },

  /**
   * Rewrites a routine as a whole. A change that would leave no routine - an
   * emptied title, no weekday - changes nothing: removing is its own action.
   */
  updateRoutine(id: string, input: RoutineInput): void {
    const data = getData()
    const clean = cleanRoutine(input, dayKinds(data.templates).map(t => t.id))
    if (!clean || !data.routines.some(r => r.id === id)) return
    commit({ ...data, routines: data.routines.map(r => (r.id === id ? { id, ...clean } : r)) })
  },

  removeRoutine(id: string): void {
    const data = getData()
    commit({ ...data, routines: data.routines.filter(r => r.id !== id) })
  },
}
