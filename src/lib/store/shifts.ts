import { commit, getData } from './core'
import { todayKey } from '../dates'
import { applyRoster, composeDay } from '../shiftDay'
import { cleanLetter, dayKinds, kindOnDate } from '../dayKinds'
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

  /**
   * Takes a routine away, and hands back the way to put it back - a routine is
   * a handful of fields somebody typed once, and losing it to a misplaced press
   * is the kind of mistake lib/undo.ts exists for.
   */
  /**
   * The roster, laid over the plan - docs/RESEARCH-SHIFTS.md section 6.2. One
   * commit over every date the draft holds, so sync stamps each day once and
   * nothing is half applied if the tab closes; a draft that changes nothing
   * writes nothing at all, which is what makes applying the same month twice
   * the same as applying it once. The way back is the plan as it stood.
   */
  applyRoster(dates: Record<string, string | null>): { undo: () => void } {
    const previous = getData()
    const next = applyRoster(previous, dates, todayKey())
    if (next !== previous) commit(next)
    return { undo: () => commit(previous) }
  },

/**
   * Every day from today on, made to agree with the routines as they are now -
   * docs/RESEARCH-SHIFTS.md section 6.4. Offered once, after a routine's rule
   * changes, and never taken without the press: a day already stamped is a day
   * somebody may have looked at.
   *
   * Only the dates that have a kind, since a routine only lands on those, and
   * only what still follows the rule: an instance moved, renamed or ticked by
   * hand keeps its change, which is `withRoutineTasks`' own rule. A date
   * behind today is never touched.
   */
  followRoutines(): { undo: () => void } {
    const previous = getData()
    const today = todayKey()
    let next = previous
    for (const date of Object.keys(previous.days).sort()) {
      if (date < today) continue
      const kind = kindOnDate(next, date)
      if (!kind) continue
      const { day } = composeDay(next, date, kind, on => kindOnDate(next, on), today)
      if (day !== next.days[date]) next = { ...next, days: { ...next.days, [date]: day } }
    }
    if (next !== previous) commit(next)
    return { undo: () => commit(previous) }
  },

  removeRoutine(id: string): { undo: () => void } {
    const previous = getData()
    commit({ ...previous, routines: previous.routines.filter(r => r.id !== id) })
    return { undo: () => commit(previous) }
  },
}
