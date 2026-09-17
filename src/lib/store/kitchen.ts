import { commit, getData } from './core'
import { blockRecipeIds, cleanRecipe, isMealCategory, mealFields, type RecipeInput } from '../kitchen'
import type { Recipe, TemplateBlock } from '../types'

/**
 * Kitchen: recipes, written, rewritten and let go. What a form's
 * input becomes is `cleanRecipe`, tested on its own; nothing here adds up
 * anything across recipes or days - see lib/kitchen.ts.
 */
export const kitchenActions = {
  /** A new recipe at the end of the list, or nothing when there is no name. */
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
   * form is gone from the recipe. A times-cooked count an older device wrote is
   * not the form's, and stays. An input with no name changes nothing.
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

  /**
   * A removed recipe put back, whole, by the undo its removal offered - the
   * commit clears its tombstone. A recipe already there is left as it is.
   */
  restoreRecipe(recipe: Recipe): void {
    const data = getData()
    if (data.recipes.some(r => r.id === recipe.id)) return
    commit({ ...data, recipes: [...data.recipes, recipe] })
  },

  /**
   * Gone, on every device - the commit leaves the tombstone - and off every
   * template block that walked it, so no day ahead is given a recipe that is
   * not there. A day already stamped with it names nothing, as a dangling id
   * does. The undo puts the plan back as it was, blocks and all.
   */
  removeRecipe(id: string): { undo: () => void } {
    const previous = getData()
    const templates = previous.templates.map(t => {
      if (!t.blocks.some(b => blockRecipeIds(b).includes(id))) return t
      return {
        ...t,
        blocks: t.blocks.map(b => {
          const ids = blockRecipeIds(b)
          if (!ids.includes(id)) return b
          const { recipeIds: _ids, recipeId: _id, ...rest } = b
          const left = mealFields({ recipeIds: ids.filter(other => other !== id) })
          return { ...rest, ...(left.recipeIds ? { recipeIds: left.recipeIds, recipeId: left.recipeId } : {}) }
        }),
      }
    })
    commit({ ...previous, templates, recipes: previous.recipes.filter(r => r.id !== id) })
    return { undo: () => commit(previous) }
  },

  /**
   * A recipe put into a template from its page - v2.30. Into one of the
   * template's meal blocks, where it joins the recipes the block walks (once),
   * and a kind of meal left to the day gives way to it; or as a new meal block
   * at a time and a length, on a day template, with the recipe to walk. False,
   * and nothing written, for a recipe or a template that is not there, a block
   * that is not a meal, or a new block asked of a week.
   */
  addRecipeToTemplate(
    templateId: string,
    recipeId: string,
    into: { blockId: string } | { block: { title: string; time?: string; minutes?: number } },
  ): boolean {
    const data = getData()
    const template = data.templates.find(t => t.id === templateId)
    if (!template || !data.recipes.some(r => r.id === recipeId)) return false
    if ('blockId' in into) {
      const block = template.blocks.find(b => b.id === into.blockId)
      if (!block || !isMealCategory(block.category)) return false
      const ids = blockRecipeIds(block)
      const walk = ids.includes(recipeId) ? ids : [...ids, recipeId]
      const next: TemplateBlock = { ...block, ...mealFields({ recipeIds: walk }) }
      commit({ ...data, templates: data.templates.map(t => (t.id === templateId ? { ...t, blocks: t.blocks.map(b => (b.id === block.id ? next : b)) } : t)) })
      return true
    }
    if (template.kind === 'week') return false
    const made: TemplateBlock = { id: crypto.randomUUID(), title: into.block.title, category: 'meal', recipeIds: [recipeId], recipeId }
    if (into.block.time) made.time = into.block.time
    if (into.block.minutes !== undefined && into.block.minutes > 0) made.minutes = into.block.minutes
    commit({ ...data, templates: data.templates.map(t => (t.id === templateId ? { ...t, blocks: [...t.blocks, made] } : t)) })
    return true
  },
}
