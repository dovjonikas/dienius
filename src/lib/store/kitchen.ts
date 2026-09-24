import { commit, getData } from './core'
import { blockRecipeIds, cleanRecipe, isMealCategory, mealFields, type RecipeInput } from '../kitchen'
import { sameName } from '../recipeImport'
import { joinWaitingRecipes } from '../waitingRecipes'
import { MEAL_TYPES, type MealType, type Recipe, type TemplateBlock } from '../types'

/** A recipe with these meals, in the app's order - and with none, no field at all. */
function withMeals(recipe: Recipe, meals: readonly MealType[]): Recipe {
  const ordered = MEAL_TYPES.filter(meal => meals.includes(meal))
  const { mealTypes: _meals, ...rest } = recipe
  return ordered.length > 0 ? { ...rest, mealTypes: ordered } : rest
}

/** The numbers an import reads from a text, each written over the recipe's only when the text says it. */
const IMPORTED_NUMBERS = ['kcal', 'protein', 'carbs', 'fat', 'servings', 'minutes'] as const

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
    const recipes = [...data.recipes, recipe]
    // A template meal block waiting for a recipe of this name takes it now.
    commit({ ...data, recipes, templates: joinWaitingRecipes(data.templates, recipes) })
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
    const recipes = data.recipes.map(r => (r.id !== id ? r : { id: r.id, ...fields, ...(r.cooked !== undefined ? { cooked: r.cooked } : {}), updatedAt: r.updatedAt }))
    // Renamed into a name a block was waiting for, it is that block's now.
    commit({ ...data, recipes, templates: joinWaitingRecipes(data.templates, recipes) })
  },

  /**
   * Many recipes at once, as Kitchen's Paste many hands them over - v2.32,
   * lib/recipeImport.ts. Each is a new recipe, or writes over the recipe it
   * names - by its id, or by a name Kitchen already has, so no import ever
   * makes a second recipe of one name. Written over, a recipe takes the
   * pasted name, text and meals, and the numbers the text says; a number the
   * text says nothing about is left as it was, and so is its count of times
   * cooked and its id, which every block that walks it holds. A row with no
   * name is passed over. One commit, so one undo puts every recipe back.
   */
  importRecipes(rows: readonly (RecipeInput & { existingId?: string })[]): { added: number; updated: number; undo: () => void } {
    const previous = getData()
    let recipes = [...previous.recipes]
    let added = 0
    let updated = 0
    for (const row of rows) {
      const at = recipes.findIndex(r => r.id === row.existingId || sameName(r.title, row.title))
      const had = at === -1 ? undefined : recipes[at]
      const input: RecipeInput = { ...row }
      if (had) for (const name of IMPORTED_NUMBERS) if (input[name] === undefined) input[name] = had[name]
      const fields = cleanRecipe(input)
      if (!fields) continue
      if (had) {
        recipes[at] = { id: had.id, ...fields, ...(had.cooked !== undefined ? { cooked: had.cooked } : {}), updatedAt: had.updatedAt }
        updated++
      } else {
        recipes = [...recipes, { id: crypto.randomUUID(), ...fields }]
        added++
      }
    }
    if (added + updated > 0) commit({ ...previous, recipes, templates: joinWaitingRecipes(previous.templates, recipes) })
    return { added, updated, undo: () => commit(previous) }
  },

  /** A recipe's meals, chosen on its card in Kitchen - v2.32. Everything else about it stays. */
  setRecipeMeals(id: string, meals: readonly MealType[]): void {
    const data = getData()
    commit({ ...data, recipes: data.recipes.map(r => (r.id === id ? withMeals(r, meals) : r)) })
  },

  /**
   * One meal given to several recipes at once, or taken off them - Kitchen's
   * Select, v2.32. The recipes not named, and every other meal of the ones
   * named, stay as they were.
   */
  setMealOnRecipes(ids: readonly string[], meal: MealType, on: boolean): void {
    const data = getData()
    const named = new Set(ids)
    commit({
      ...data,
      recipes: data.recipes.map(r => {
        if (!named.has(r.id) || (r.mealTypes?.includes(meal) ?? false) === on) return r
        return withMeals(r, on ? [...(r.mealTypes ?? []), meal] : (r.mealTypes ?? []).filter(m => m !== meal))
      }),
    })
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
   *
   * A block that follows its meal - v2.32 - walks the meal's recipes and
   * nothing else, so the recipe joins it by joining the meal: it is given the
   * block's meal, and the block goes on following.
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
      if (block.followMeal && block.mealType) {
        const meal = block.mealType
        commit({
          ...data,
          recipes: data.recipes.map(r =>
            r.id !== recipeId || r.mealTypes?.includes(meal) ? r : { ...r, mealTypes: MEAL_TYPES.filter(m => m === meal || r.mealTypes?.includes(m)) },
          ),
        })
        return true
      }
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
