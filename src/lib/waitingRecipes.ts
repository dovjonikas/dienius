import type { Recipe, Template } from './types'
import { mealFields } from './kitchen'
import { sameName } from './recipeImport'

/**
 * Template meal blocks waiting for a recipe by name - the owner's brief of
 * 2026-09-22, part 2.
 *
 * A templates file names its recipes (docs/TEMPLATE-JSON.md), and is often
 * pasted before the recipes it names are: the week first, the recipes after.
 * A name Kitchen does not have yet is kept on the block
 * (`TemplateBlock.waitingRecipes`) instead of dropped, and the block takes the
 * recipe as soon as Kitchen has one of that name - added one at a time, many
 * pasted at once, or renamed into it - found the way the import finds one:
 * the same words, whatever their case or spacing (`sameName`).
 *
 * Joined into the recipe the templates would have walked had it been there
 * when they were imported: after the recipes the block already had, in the
 * order the file named them. A day already stamped from the block takes it
 * when it is next opened, as it takes any change to its template.
 */
export function joinWaitingRecipes(templates: Template[], recipes: readonly Recipe[]): Template[] {
  let changed = false
  const next = templates.map(template => {
    if (!template.blocks.some(b => b.waitingRecipes?.length)) return template
    let touched = false
    const blocks = template.blocks.map(block => {
      if (!block.waitingRecipes?.length) return block
      const had = block.recipeIds?.length ? block.recipeIds : block.recipeId ? [block.recipeId] : []
      const arrived: string[] = []
      const still: string[] = []
      for (const name of block.waitingRecipes) {
        const recipe = recipes.find(r => sameName(r.title, name))
        if (!recipe) still.push(name)
        else if (!had.includes(recipe.id) && !arrived.includes(recipe.id)) arrived.push(recipe.id)
      }
      if (still.length === block.waitingRecipes.length) return block
      touched = true
      const { waitingRecipes: _waited, ...rest } = block
      const fields = mealFields({ recipeIds: [...had, ...arrived], mealType: block.mealType, follow: block.followMeal })
      return { ...rest, ...fields, ...(still.length > 0 ? { waitingRecipes: still } : {}) }
    })
    if (!touched) return template
    changed = true
    return { ...template, blocks }
  })
  return changed ? next : templates
}
