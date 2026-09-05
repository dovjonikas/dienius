import { commit, getData } from './core'
import { rulesForGoal } from '../north'
import { MAX_RULES_PER_GOAL, type IfThenEntry } from '../types'

/**
 * The rules that protect a goal - "what pulls me off this".
 *
 * Everything about scheduling one of these onto a day is gone: there is no
 * rotation, no last-shown date and no eligibility. A rule is read in the
 * North window under the goal it belongs to, and once in a while under the
 * why on the card that comes forward after a slow day. Those are the two
 * places, and neither of them needs the app to remember anything about the
 * rule beyond what somebody wrote in it.
 */
export const ifThenActions = {
  /**
   * Writes a rule, optionally under a goal.
   *
   * The cap refuses rather than evicting, and it returns `null` to say so -
   * a caller that silently dropped the fifth rule would be a cap nobody can
   * see. `MAX_RULES_PER_GOAL` explains why five.
   */
  addIfThen(input: { trigger: string; action: string; color?: string; goalId?: string }): IfThenEntry | null {
    const data = getData()
    if (input.goalId && rulesForGoal(data.ifThens, input.goalId).length >= MAX_RULES_PER_GOAL) {
      return null
    }
    const entry: IfThenEntry = {
      id: crypto.randomUUID(),
      trigger: input.trigger,
      action: input.action,
      color: input.color,
      goalId: input.goalId,
    }
    commit({ ...data, ifThens: [...data.ifThens, entry] })
    return entry
  },

  updateIfThen(entry: IfThenEntry): void {
    const data = getData()
    commit({ ...data, ifThens: data.ifThens.map(e => (e.id === entry.id ? entry : e)) })
  },

  /**
   * Files a rule under a goal, or takes it back out with `undefined`.
   *
   * This is the whole of the migration for rules written before goals had
   * anything to do with them: nothing is guessed at on load, the North
   * window shows the unfiled ones in their own group, and each is moved by
   * somebody choosing where it goes. Refuses when the goal is already full,
   * for the same reason `addIfThen` does.
   */
  assignIfThenGoal(id: string, goalId: string | undefined): boolean {
    const data = getData()
    const entry = data.ifThens.find(e => e.id === id)
    if (!entry) return false
    if (goalId && entry.goalId !== goalId && rulesForGoal(data.ifThens, goalId).length >= MAX_RULES_PER_GOAL) {
      return false
    }
    commit({
      ...data,
      ifThens: data.ifThens.map(e => (e.id === id ? { ...e, goalId } : e)),
    })
    return true
  },

  deleteIfThen(id: string): void {
    const data = getData()
    commit({ ...data, ifThens: data.ifThens.filter(e => e.id !== id) })
  },
}
