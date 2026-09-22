import { isHeading } from './headings'
import { recipeNumbers } from './recipeNumbers'
import { mealsFromName } from './mealWords'
import type { RecipeInput } from './kitchen'
import { MEAL_TYPES, type MealType, type MealWord, type Recipe } from './types'

/**
 * Many recipes pasted at once - Kitchen, since v2.32.
 *
 * Thirty recipes already written in Kitchen's own shape - a line of numbers,
 * INGREDIENTS, STEPS - were thirty trips through New recipe: open, paste,
 * choose the meals, save. Here they go in as one text. A line that starts
 * `NAME:` begins a recipe and its words are the name; a line of `---` ends
 * one, and then the first line of the next is its name when it is neither a
 * heading nor a line of numbers. Each piece is read the way New recipe reads
 * a recipe - its numbers by lib/recipeNumbers.ts, its lists by
 * lib/recipeText.ts when it is shown - and its meals from its name's first
 * word (lib/mealWords.ts).
 *
 * Nothing is saved here. What this returns is the list the page shows before
 * the press - which are new, which write over a recipe of the same name,
 * which cannot be saved and why - so the same text pasted twice makes no
 * second copy of anything.
 */

/** One recipe as it was pasted: its name when it has one, and the rest. */
export interface PastedRecipe {
  title?: string
  /** Everything else in the piece, trimmed at its two ends. */
  text: string
}

/** A line that begins a recipe, and the name after it. */
const NAME_LINE = /^\s*name\s*:(.*)$/i

/** A line that ends one. */
const RULE_LINE = /^\s*-{3,}\s*$/

/** The text in pieces, one a recipe, with no empty piece. */
export function splitPastedRecipes(pasted: string): PastedRecipe[] {
  const pieces: { title?: string; named: boolean; lines: string[] }[] = []
  let current: { title?: string; named: boolean; lines: string[] } | undefined
  for (const line of pasted.replace(/\r\n?/g, '\n').split('\n')) {
    const name = NAME_LINE.exec(line)
    if (name) {
      const title = name[1].trim()
      current = { ...(title ? { title } : {}), named: true, lines: [] }
      pieces.push(current)
    } else if (RULE_LINE.test(line)) {
      current = undefined
    } else {
      if (!current) {
        current = { named: false, lines: [] }
        pieces.push(current)
      }
      current.lines.push(line)
    }
  }

  const out: PastedRecipe[] = []
  for (const piece of pieces) {
    let lines = piece.lines
    let title = piece.title
    // A piece parted by --- is named by its first line, when that line is a
    // name: not a heading, and not the numbers a recipe opens on.
    if (!piece.named) {
      const first = lines.findIndex(line => line.trim() !== '')
      if (first === -1) continue
      const line = lines[first].trim()
      if (!isHeading(line) && Object.keys(recipeNumbers(line)).length === 0) {
        title = line
        lines = lines.slice(first + 1)
      }
    }
    const text = lines.join('\n').trim()
    if (title === undefined && text === '') continue
    out.push({ ...(title !== undefined ? { title } : {}), text })
  }
  return out
}

/**
 * What saving a row will do: a new recipe, the one of that name written over,
 * nothing because it has no name, or nothing because the same name comes
 * again further down and that one is saved.
 */
export type ImportState = 'new' | 'update' | 'untitled' | 'repeated'

/** Where a row's meals came from: its name's word, the recipe it writes over, or nowhere. */
export type MealsFrom = 'name' | 'kept' | 'none'

/** One pasted recipe as the list shows it before the press. */
export interface ImportRow {
  /** Steady while the text above it is edited: its place in the paste. */
  key: string
  /** Empty for a piece with no name. */
  title: string
  state: ImportState
  /** The recipe a row of state `update` writes over. */
  existingId?: string
  /** The meals the row starts with, and where they came from. */
  meals: MealType[]
  from: MealsFrom
  /** The two numbers the row shows, when its text says them. */
  kcal?: number
  protein?: number
  /** What saving it hands the store: the name, the text, the numbers the text says, and the meals. */
  input: RecipeInput & { text: string; mealTypes: MealType[] }
}

/** Two names are one name: the same words, whatever their case, accents or spacing. */
export function sameName(a: string, b: string): boolean {
  const flat = (s: string) => s.trim().replace(/\s+/g, ' ')
  return flat(a).localeCompare(flat(b), undefined, { sensitivity: 'base' }) === 0
}

/** Every pasted recipe as a row of the list, in the order it was pasted. */
export function readPastedRecipes(pasted: string, recipes: readonly Recipe[], words: readonly MealWord[]): ImportRow[] {
  const pieces = splitPastedRecipes(pasted)
  return pieces.map((piece, index): ImportRow => {
    const title = piece.title ?? ''
    const said = recipeNumbers(piece.text)
    const existing = title ? recipes.find(r => sameName(r.title, title)) : undefined
    const repeated = title !== '' && pieces.slice(index + 1).some(later => later.title !== undefined && sameName(later.title, title))
    const state: ImportState = !title ? 'untitled' : repeated ? 'repeated' : existing ? 'update' : 'new'

    // A recipe written over keeps the meals it has - given since, on its card
    // or its form - and its name's word adds its own: the same text pasted
    // again never takes a meal away.
    const named = title ? mealsFromName(title, words) : undefined
    const kept = existing?.mealTypes ?? []
    const meals = MEAL_TYPES.filter(meal => named?.includes(meal) || kept.includes(meal))
    const from: MealsFrom = named !== undefined ? 'name' : kept.length > 0 ? 'kept' : 'none'

    const input: ImportRow['input'] = { title, text: piece.text, mealTypes: [...meals] }
    for (const name of ['kcal', 'protein', 'carbs', 'fat', 'servings', 'minutes'] as const) {
      const value = said[name]?.value
      if (value !== undefined) input[name] = value
    }
    return {
      key: `pasted-${index}`,
      title,
      state,
      ...(existing && state === 'update' ? { existingId: existing.id } : {}),
      meals: [...meals],
      from,
      ...(input.kcal !== undefined ? { kcal: input.kcal } : {}),
      ...(input.protein !== undefined ? { protein: input.protein } : {}),
      input,
    }
  })
}
