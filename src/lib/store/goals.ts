import { commit, getData } from './core'
import type { Goal, Settings } from '../types'
import { canAddGoal } from '../north'

/** North: goals and their settings. Nothing here measures anything - see lib/north.ts. */
export const goalActions = {
  /**
   * Writing one down. Refused past the cap rather than silently dropping the
   * oldest - four is a decision about how many directions fit in a life, and
   * quietly evicting one would make the cap invisible.
   */
  addGoal(input: { title: string; why?: string; identity?: string }, today: string): Goal | undefined {
    const data = getData()
    if (!input.title.trim()) return undefined
    if (!canAddGoal(data.goals)) return undefined
    const goal: Goal = {
      id: crypto.randomUUID(),
      title: input.title.trim(),
      why: input.why?.trim() || undefined,
      identity: input.identity?.trim() || undefined,
      createdAt: today,
    }
    commit({ ...data, goals: [...data.goals, goal] })
    return goal
  },

  updateGoal(id: string, patch: { title?: string; why?: string; identity?: string }): void {
    const data = getData()
    commit({
      ...data,
      goals: data.goals.map(g =>
        g.id !== id
          ? g
          : {
              ...g,
              title: patch.title !== undefined ? patch.title.trim() || g.title : g.title,
              why: patch.why !== undefined ? patch.why.trim() || undefined : g.why,
              identity: patch.identity !== undefined ? patch.identity.trim() || undefined : g.identity,
            },
      ),
    })
  },

  /**
   * Moving one out of the way. Not a delete and not a verdict: nothing
   * records whether it was reached or abandoned, because that is exactly the
   * scoring this feature exists without. `createdAt` is untouched, so an
   * archived goal still knows how long it was carried.
   */
  archiveGoal(id: string, today: string): void {
    const data = getData()
    commit({ ...data, goals: data.goals.map(g => (g.id === id ? { ...g, archivedAt: today } : g)) })
  },

  /** Bringing one back, if there is room for it. */
  restoreGoal(id: string): void {
    const data = getData()
    if (!canAddGoal(data.goals)) return
    commit({ ...data, goals: data.goals.map(g => (g.id === id ? { ...g, archivedAt: undefined } : g)) })
  },

  deleteGoal(id: string): void {
    const data = getData()
    commit({ ...data, goals: data.goals.filter(g => g.id !== id) })
  },

  setNorthSettings(north: Settings['north']): void {
    const data = getData()
    commit({ ...data, settings: { ...data.settings, north } })
  },
}
