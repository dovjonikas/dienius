import { MEAL_TYPES, type MealType, type MealWord, type Settings } from './types'

/**
 * The meals a recipe's name says - Kitchen, since v2.32.
 *
 * A name that starts with a word and a colon - "Lunch: a bean bowl" - says
 * which meals the recipe is for, by a list of words Settings keeps. A word
 * can say several meals, or none: a name that starts with a word that says
 * none is still sorted by it, since the word stays in the name. Read when
 * many recipes are pasted at once and when a name is typed into New recipe,
 * and in both places it is a first answer that a press changes.
 *
 * The list starts as the six meals' own names, each for itself. Anything
 * else is somebody's own way of naming their food, and theirs to write in
 * Settings - not the app's to guess.
 */

/** Written the way the meals are named on every screen - lib/kitchen.ts has the same words. */
const MEAL_NAMES: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  'pre-gym': 'Pre-gym',
  'post-gym': 'Post-gym',
  snack: 'Snack',
}

/** The words a new device starts with: each meal's own name, for itself. */
export const DEFAULT_MEAL_WORDS: MealWord[] = MEAL_TYPES.map(meal => ({ word: MEAL_NAMES[meal], meals: [meal] }))

/** The longest a name's first word may be - a few words, never a sentence. */
export const MEAL_WORD_MAX = 24

/**
 * The word before the first colon a name starts with: letters first, then
 * letters, digits, spaces and hyphens, at most `MEAL_WORD_MAX` of them.
 * Nothing when the name has no such word - "12:30 lunch" starts with a time.
 */
export function namePrefix(title: string): string | undefined {
  const found = new RegExp(String.raw`^\s*(\p{L}[\p{L}\p{N} '-]{0,${MEAL_WORD_MAX - 1}}?)\s*:`, 'u').exec(title)
  return found ? found[1].trim() : undefined
}

/** A word as two are compared: lowercased, a space and a hyphen the same. */
function key(word: string): string {
  return word.trim().toLocaleLowerCase().replace(/[\s-]+/g, '-')
}

/** Meals in the app's order, each once, and only the app's. */
function inOrder(meals: readonly unknown[]): MealType[] {
  return MEAL_TYPES.filter(meal => meals.includes(meal))
}

function isMealWord(x: unknown): x is MealWord {
  if (typeof x !== 'object' || x === null) return false
  const w = x as Record<string, unknown>
  return typeof w.word === 'string' && w.word.trim() !== '' && Array.isArray(w.meals)
}

/**
 * The words in force: the list Settings keeps, or the six until somebody
 * changes it. A stored word that is not one - no word, no list of meals - is
 * passed over, and a meal this app does not have is dropped from a word,
 * rather than a file refused over a setting.
 */
export function mealWordsOf(settings: Pick<Settings, 'mealWords'>): MealWord[] {
  const stored: unknown = settings.mealWords
  if (!Array.isArray(stored)) return DEFAULT_MEAL_WORDS
  return stored.filter(isMealWord).map(w => ({ word: w.word.trim(), meals: inOrder(w.meals) }))
}

/**
 * A list as Settings writes it: each word trimmed and at most
 * `MEAL_WORD_MAX` long, an empty one left out, a word said twice kept the
 * first time, and each word's meals in the app's order.
 */
export function cleanMealWords(words: readonly MealWord[]): MealWord[] {
  const seen = new Set<string>()
  const out: MealWord[] = []
  for (const w of words) {
    const word = w.word.trim().slice(0, MEAL_WORD_MAX)
    if (!word || seen.has(key(word))) continue
    seen.add(key(word))
    out.push({ word, meals: inOrder(w.meals) })
  }
  return out
}

/**
 * The meals a name's first word says, in the app's order - none for a word
 * that says none - or nothing when the name starts with no word the list has.
 */
export function mealsFromName(title: string, words: readonly MealWord[]): MealType[] | undefined {
  const prefix = namePrefix(title)
  if (prefix === undefined) return undefined
  const found = words.find(w => key(w.word) === key(prefix))
  return found ? inOrder(found.meals) : undefined
}
