import { isHeading } from './headings'
import { listKind } from './recipeText'

/**
 * Numbers typed into a recipe's text, read into its fields - Kitchen, since
 * v2.30, and docs/RESEARCH-KITCHEN.md section 6.3.
 *
 * Writing "Per serving: 450 kcal, 30 g protein" fills the two fields, the way
 * the Library's add line reads "12 chapters" out of a book's line (CONVENTIONS
 * 16). A number is read where it stands beside its word - after it ("450
 * kcal", "30 g protein", "2 servings", "45 min", "1 h 30 min") or before it
 * ("Protein: 30 g", "serves 4") - in English or in Lithuanian, with the
 * Lithuanian letters or without them, and a decimal comma is a decimal.
 *
 * **Never from inside the ingredients or the steps.** "30 g protein powder" is
 * an ingredient, not a serving's protein, and "Bake for 20 min" is a step; an
 * amount in such a line stays words (section 2). The lines around them - an
 * introduction, a heading of their own - are read. **The first mention** of
 * each number is the one read.
 *
 * And the way back, so the text and the fields are one truth: a field changed
 * rewrites the number the text says, and a field cleared takes it out.
 */

export type RecipeNumberName = 'kcal' | 'protein' | 'carbs' | 'fat' | 'servings' | 'minutes'

/** A number found in the text, and where. */
export interface ReadNumber {
  value: number
  /** The characters to write a new value over: the digits, or the whole phrase for minutes. */
  start: number
  end: number
  /** The whole mention - the number, its unit and its word - for taking it out. */
  phraseStart: number
  phraseEnd: number
  /** Written with a decimal comma. */
  comma: boolean
  /** The word hours were written with, for minutes written in hours. */
  hourWord?: string
}

type Found = Partial<Record<RecipeNumberName, ReadNumber>>

/** The words for each number, the longer before the shorter. */
const WORDS: Record<Exclude<RecipeNumberName, 'minutes'>, string[]> = {
  kcal: ['kilocalories', 'calories', 'calorie', 'kcal', 'cal', 'kalorijos', 'kalorijų', 'kaloriju', 'kalorijas', 'kalorija'],
  protein: ['proteins', 'protein', 'baltymai', 'baltymų', 'baltymu', 'baltymus'],
  carbs: ['carbohydrates', 'carbohydrate', 'carbs', 'carb', 'angliavandeniai', 'angliavandenių', 'angliavandeniu', 'angliavandenius'],
  fat: ['fats', 'fat', 'riebalai', 'riebalų', 'riebalu', 'riebalus'],
  servings: ['servings', 'serving', 'serves', 'portions', 'portion', 'porcijos', 'porcija', 'porcijų', 'porciju', 'porcijas'],
}

const NUMBER = String.raw`(\d+(?:[.,]\d+)?)`
const GRAMS = String.raw`(?:g|gr|grams|gram|gramai|gramų|gramu)\.?`
const HOURS = String.raw`(hours|hour|hrs|hr|h|valandos|valanda|valandų|valandu|val)`
const MINUTES = String.raw`(?:minutes|minute|mins|min|minutės|minučių|minuciu)\.?`

/** "450 kcal", "30 g protein": the number, grams perhaps, and the word straight after. */
function numberFirst(words: string[]): RegExp {
  return new RegExp(String.raw`(?<![\p{L}\d.,])${NUMBER}\s*(?:${GRAMS}\s*)?(${words.join('|')})(?!\p{L})`, 'giu')
}

/** "Protein: 30 g", "serves 4": the word, a colon perhaps, and the number straight after. */
function wordFirst(words: string[]): RegExp {
  return new RegExp(String.raw`(?<!\p{L})(${words.join('|')})\s*[:=]?\s*${NUMBER}(?:\s*${GRAMS}(?!\p{L}))?(?![\d.,]*\d)`, 'giu')
}

/** "1 h 30 min", "1.5 h", "1 val. 15 min". */
const IN_HOURS = new RegExp(String.raw`(?<![\p{L}\d.,])${NUMBER}\s*${HOURS}\.?(?:\s*(\d+)\s*${MINUTES})?(?!\p{L})`, 'giu')

/** "45 min", "20 minutes". */
const IN_MINUTES = new RegExp(String.raw`(?<![\p{L}\d.,])(\d+)\s*${MINUTES}(?!\p{L})`, 'giu')

function valueOf(raw: string): number {
  return Number(raw.replace(',', '.'))
}

/** The lines numbers are read from, with where each starts: every line not inside INGREDIENTS or STEPS. */
function readableLines(text: string): { line: string; offset: number }[] {
  const out: { line: string; offset: number }[] = []
  let offset = 0
  let inList = false
  for (const line of text.split('\n')) {
    if (isHeading(line)) {
      inList = listKind(line.trim()) !== undefined
      if (!inList) out.push({ line, offset })
    } else if (!inList) {
      out.push({ line, offset })
    }
    offset += line.length + 1
  }
  return out
}

/** Every number read from one line, the numbers-first way before the words-first way. */
function readLine(line: string, offset: number): { name: RecipeNumberName; found: ReadNumber }[] {
  const out: { name: RecipeNumberName; found: ReadNumber }[] = []
  // Which characters a number has been read from already, so one number is
  // never read twice - "520 kcal 38 g protein" is 520 kcal and 38 g protein,
  // not also "kcal 38".
  const taken: [number, number][] = []
  const free = (start: number, end: number) => taken.every(([a, b]) => end <= a || start >= b)
  const take = (name: RecipeNumberName, found: ReadNumber, digitsStart: number, digitsEnd: number) => {
    if (!free(digitsStart, digitsEnd)) return
    taken.push([digitsStart, digitsEnd])
    out.push({ name, found })
  }

  for (const match of line.matchAll(IN_HOURS)) {
    const [whole, hours, hourWord, minutes] = match
    const at = match.index!
    const value = Math.round(valueOf(hours) * 60 + (minutes ? Number(minutes) : 0))
    const found: ReadNumber = { value, start: offset + at, end: offset + at + whole.length, phraseStart: offset + at, phraseEnd: offset + at + whole.length, comma: hours.includes(','), hourWord }
    take('minutes', found, at, at + whole.length)
  }
  for (const match of line.matchAll(IN_MINUTES)) {
    const [whole, minutes] = match
    const at = match.index!
    const found: ReadNumber = { value: Number(minutes), start: offset + at, end: offset + at + whole.length, phraseStart: offset + at, phraseEnd: offset + at + whole.length, comma: false }
    take('minutes', found, at, at + whole.length)
  }
  for (const [name, words] of Object.entries(WORDS) as [Exclude<RecipeNumberName, 'minutes'>, string[]][]) {
    for (const match of line.matchAll(numberFirst(words))) {
      const [whole, digits] = match
      const at = match.index!
      const found: ReadNumber = { value: valueOf(digits), start: offset + at, end: offset + at + digits.length, phraseStart: offset + at, phraseEnd: offset + at + whole.length, comma: digits.includes(',') }
      take(name, found, at, at + digits.length)
    }
  }
  for (const [name, words] of Object.entries(WORDS) as [Exclude<RecipeNumberName, 'minutes'>, string[]][]) {
    for (const match of line.matchAll(wordFirst(words))) {
      const [whole, word, digits] = match
      const at = match.index!
      const digitsAt = at + whole.indexOf(digits, word.length)
      const found: ReadNumber = { value: valueOf(digits), start: offset + digitsAt, end: offset + digitsAt + digits.length, phraseStart: offset + at, phraseEnd: offset + at + whole.length, comma: digits.includes(',') }
      take(name, found, digitsAt, digitsAt + digits.length)
    }
  }
  return out
}

/** The numbers a recipe's text says, each at its first mention. */
export function recipeNumbers(text: string): Found {
  const found: Found = {}
  for (const { line, offset } of readableLines(text)) {
    const read = readLine(line, offset).sort((a, b) => a.found.phraseStart - b.found.phraseStart)
    for (const { name, found: number } of read) {
      const first = found[name]
      if (!first || number.phraseStart < first.phraseStart) found[name] = number
    }
  }
  return found
}

/** A number as the text writes it: whole, or to a tenth, with the comma it was written with. */
function written(value: number, comma: boolean): string {
  const text = Number.isInteger(value) ? String(value) : String(Math.round(value * 10) / 10)
  return comma ? text.replace('.', ',') : text
}

/** Minutes as the text writes them: "45 min", or "1 h 30 min" from an hour. */
function writtenMinutes(value: number, hourWord: string | undefined): string {
  const minutes = Math.max(0, Math.round(value))
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  const word = hourWord ?? 'h'
  return rest === 0 ? `${hours} ${word}` : `${hours} ${word} ${rest} min`
}

/** The text with the number it says for `name` written as `value`; the text as it was when it says none. */
export function writeRecipeNumber(text: string, name: RecipeNumberName, value: number): string {
  const found = recipeNumbers(text)[name]
  if (!found) return text
  const replacement = name === 'minutes' ? writtenMinutes(value, found.hourWord) : written(value, found.comma)
  return text.slice(0, found.start) + replacement + text.slice(found.end)
}

/**
 * The text with the number it says for `name` taken out: the mention, and the
 * comma it was listed with, so "450 kcal, 30 g protein" loses one and keeps a
 * list. A line left with nothing on it goes, rather than parting the text in
 * two. The text as it was when it says none.
 */
export function clearRecipeNumber(text: string, name: RecipeNumberName): string {
  const found = recipeNumbers(text)[name]
  if (!found) return text
  let start = found.phraseStart
  let end = found.phraseEnd
  const after = /^\s*[,;·]\s*/.exec(text.slice(end))
  if (after) {
    end += after[0].length
  } else {
    const before = /\s*[,;·]\s*$/.exec(text.slice(0, start))
    if (before) start -= before[0].length
  }
  const next = text.slice(0, start) + text.slice(end)
  // The line the mention was on, as it is now.
  const lineStart = next.lastIndexOf('\n', start - 1) + 1
  const lineEndAt = next.indexOf('\n', start)
  const lineEnd = lineEndAt === -1 ? next.length : lineEndAt
  if (next.slice(lineStart, lineEnd).trim() !== '') return next
  // Nothing left on it: the line goes, and one of the breaks around it.
  if (lineEndAt !== -1) return next.slice(0, lineStart) + next.slice(lineEnd + 1)
  return next.slice(0, Math.max(0, lineStart - 1))
}
