import { commit, getData } from './core'
import type { AppData, BacklogItem, Category, DayPlan, Template } from '../types'
import { isCategoryColorReadable } from '../categories'

/** What a delete rewrote, kept so one press can put it all back. */
export interface CategorySlice {
  categories: Category[]
  days: Record<string, DayPlan>
  templates: Template[]
  backlog: BacklogItem[]
}

export function categorySlice(data: AppData): CategorySlice {
  return { categories: data.categories, days: data.days, templates: data.templates, backlog: data.backlog }
}

const MAX_LABEL = 40

/**
 * The kinds of thing a day is made of - the owner's list, not the app's.
 *
 * Everything here is deliberately unguarded except two things: a label has to
 * say something, and a colour has to be readable. There is no cap on how many
 * categories there may be, no reserved id, and nothing that refuses to let one
 * of the six the app shipped be renamed or deleted. Settings says once what
 * the number is for and then gets out of the way - see `categories.ts` for
 * why about six is advice rather than a rule.
 */
export const categoryActions = {
  /**
   * A new one, at the end of the list.
   *
   * The colour is required, and that is not an oversight: a category the owner
   * made has no `--cat-*` pair in styles.css behind it, so absent would mean
   * no colour at all rather than "the built-in one". The editor does not offer
   * "no colour" for a new one either, and this refuses a call that tries.
   */
  addCategory(input: { label: string; color: string }): Category | undefined {
    const data = getData()
    const label = input.label.trim().slice(0, MAX_LABEL)
    if (!label) return undefined
    if (!isCategoryColorReadable(input.color)) return undefined
    const category: Category = { id: crypto.randomUUID(), label, color: input.color }
    commit({ ...data, categories: [...data.categories, category] })
    return category
  },

  /**
   * A rename, a recolour, or both.
   *
   * `color: null` is how a default comes back, and only a default has one to
   * come back to: it deletes the literal, which returns one of the six to its
   * built-in pair and its two-theme behaviour. Somebody who tried a green
   * Health and disliked it should not have to remember the original hex.
   *
   * An unreadable colour is refused rather than clamped. Silently changing
   * what somebody picked is worse than saying it will not read - a clamped
   * colour is a third thing that is neither what they chose nor what the app
   * would have chosen, and nothing would tell them it happened.
   */
  updateCategory(id: string, patch: { label?: string; color?: string | null }): void {
    const data = getData()
    if (patch.color !== undefined && patch.color !== null && !isCategoryColorReadable(patch.color)) return
    commit({
      ...data,
      categories: data.categories.map(c => {
        if (c.id !== id) return c
        const label = patch.label !== undefined ? patch.label.trim().slice(0, MAX_LABEL) || c.label : c.label
        const color = patch.color === undefined ? c.color : (patch.color ?? undefined)
        return { ...c, label, color }
      }),
    })
  },

  /** The order is the array's own - it is what the swatch row draws, and there is nothing else it could be. */
  reorderCategories(from: number, to: number): void {
    const data = getData()
    const next = [...data.categories]
    if (from < 0 || from >= next.length || to < 0 || to >= next.length || from === to) return
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    commit({ ...data, categories: next })
  },

  /**
   * Deleting one, and moving what it would otherwise orphan.
   *
   * One commit: every task, template block and backlog item pointing at `id`
   * is rewritten to `moveTo`, and the category goes. Never a silent loss and
   * never a locked delete - a dangling id would degrade to "no category" the
   * way every other dangling id in this app degrades, which is safe but is
   * also a day quietly losing its colour with nothing said about it.
   *
   * The last one cannot go, because there is nowhere to move to. The dialog
   * says so on the disabled button rather than hiding it.
   */
  deleteCategory(id: string, moveTo: string | undefined): void {
    const data = getData()
    if (data.categories.length <= 1) return
    if (!data.categories.some(c => c.id === id)) return
    if (moveTo !== undefined && (moveTo === id || !data.categories.some(c => c.id === moveTo))) return

    const days: Record<string, DayPlan> = {}
    for (const [date, day] of Object.entries(data.days)) {
      const tasks = day.tasks.map(t => (t.category === id ? { ...t, category: moveTo } : t))
      days[date] = tasks.some((t, i) => t !== day.tasks[i]) ? { ...day, tasks } : day
    }

    const templates = data.templates.map(template => {
      const blocks = template.blocks.map(b => (b.category === id ? { ...b, category: moveTo } : b))
      return blocks.some((b, i) => b !== template.blocks[i]) ? { ...template, blocks } : template
    })

    const backlog = data.backlog.map(item => (item.category === id ? { ...item, category: moveTo } : item))

    commit({ ...data, categories: data.categories.filter(c => c.id !== id), days, templates, backlog })
  },

  /** The one undo behind a delete: the four lists it rewrote, exactly as they were. */
  restoreCategories(slice: CategorySlice): void {
    commit({ ...getData(), ...slice })
  },
}

/**
 * How much a delete is about to touch, for the sentence on the dialog.
 *
 * A fact about a button, not a warning, and it is stated once. Nothing uses
 * it? The sentence goes and the button reads plain "Delete".
 */
export function categoryUsage(data: AppData, id: string): { tasks: number; blocks: number; backlog: number } {
  let tasks = 0
  for (const day of Object.values(data.days)) for (const task of day.tasks) if (task.category === id) tasks++
  let blocks = 0
  for (const template of data.templates) for (const block of template.blocks) if (block.category === id) blocks++
  const backlog = data.backlog.filter(item => item.category === id).length
  return { tasks, blocks, backlog }
}
