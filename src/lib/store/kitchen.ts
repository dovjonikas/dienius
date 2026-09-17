import { commit, getData } from './core'
import { cleanRecipe, type RecipeInput } from '../kitchen'
import type { Recipe } from '../types'

/**
 * Kitchen: recipes, written, rewritten, cooked and let go. What a form's
 * input becomes is `cleanRecipe`, tested on its own; nothing here adds up
 * anything across recipes or days - see lib/kitchen.ts.
 */
export const kitchenActions = {
  /** A new recipe at the end of the list, or nothing when there is no name or no text. */
  addRecipe(input: RecipeInput): Recipe | undefined {
    const fields = cleanRecipe(input)
    if (!fields) return undefined
    const data = getData()
    const recipe: Recipe = { id: crypto.randomUUID(), ...fields }
    commit({ ...data, recipes: [...data.recipes, recipe] })
    // The stored one, stamped by the commit.
    return getData().recipes.find(r => r.id === recipe.id) ?? recipe
  },

  /**
   * The form's whole input written over the recipe: a field emptied in the
   * form is gone from the recipe. How many times it was cooked is not the
   * form's, and stays. An input with no name or no text changes nothing.
   */
  updateRecipe(id: string, input: RecipeInput): void {
    const fields = cleanRecipe(input)
    if (!fields) return
    const data = getData()
    commit({
      ...data,
      recipes: data.recipes.map(r => (r.id !== id ? r : { id: r.id, ...fields, ...(r.cooked !== undefined ? { cooked: r.cooked } : {}), updatedAt: r.updatedAt })),
    })
  },

  /** Done in Cook: one more time cooked. Nothing else is recorded - no date, no streak. */
  markCooked(id: string): void {
    const data = getData()
    if (!data.recipes.some(r => r.id === id)) return
    commit({ ...data, recipes: data.recipes.map(r => (r.id === id ? { ...r, cooked: (r.cooked ?? 0) + 1 } : r)) })
  },

  /**
   * A removed recipe put back, whole, by the undo its removal offered - the
   * commit clears its tombstone. A recipe already there is left as it is.
   */
  restoreRecipe(recipe: Recipe): void {
    const data = getData()
    if (data.recipes.some(r => r.id === recipe.id)) return
    commit({ ...data, recipes: [...data.recipes, recipe] })
  },

  /** Gone, on every device - the commit leaves the tombstone. A block that named it simply names nothing. */
  removeRecipe(id: string): void {
    const data = getData()
    commit({ ...data, recipes: data.recipes.filter(r => r.id !== id) })
  },
}
