import { parseHeadings } from './headings'

/**
 * A recipe's text, read for its page - Kitchen, since v2.27.
 *
 * The rule is North's and so is the parser (lib/headings.ts): a line in
 * capitals is a heading and owns the lines under it to the next heading, and
 * the lines before the first are the introduction. A recipe adds no
 * signature and no tags - a line of `---` and words in brackets are only text
 * in a recipe. What it adds is on top of the parse, for two headings:
 *
 * - under **INGREDIENTS** every line is an ingredient, one to a line;
 * - under **STEPS** every line is a step, numbered in order on the page.
 *
 * Known in capitals with or without a colon after them, and as the whole
 * heading only: SAUCE INGREDIENTS is a heading over its paragraphs, because
 * a rule that guessed at every heading with the word in it would guess wrong
 * as often as right. A second INGREDIENTS or STEPS is a second list, in its
 * place. Anything else - another heading, or a text with no heading at all -
 * is shown as it was typed.
 *
 * Nothing reads quantities out of a line. "250 g lentils" is a line.
 */

/** One part of a recipe under its heading, in the order it was written. */
export type RecipePart =
  | { kind: 'ingredients'; heading: string; items: string[] }
  | { kind: 'steps'; heading: string; items: string[] }
  | { kind: 'section'; heading: string; paragraphs: string[] }

/** A recipe's text as it reads: what comes before the headings, and the parts under them. */
export interface RecipeReading {
  /** The paragraphs before the first heading. A text with no heading is all of it. */
  intro: string[]
  parts: RecipePart[]
}

/** A heading that makes a list, by its words, with or without a colon after them. */
export function listKind(heading: string): 'ingredients' | 'steps' | undefined {
  const words = heading.replace(/\s*:$/, '')
  if (words === 'INGREDIENTS') return 'ingredients'
  if (words === 'STEPS') return 'steps'
  return undefined
}

/** A bullet a pasted list comes with: a hyphen, an asterisk or a dot, and a space. */
const BULLET = /^[-*•]\s+/

/** A number a pasted step comes with: "1." or "1)", and a space. */
const STEP_NUMBER = /^\d+[.)]\s+/

/**
 * Every line of a list's paragraphs, one item to a line, with the marker it
 * was typed with taken off - a bullet from anything, a number from a step,
 * since the page numbers the steps itself.
 */
function items(paragraphs: string[], kind: 'ingredients' | 'steps'): string[] {
  const out: string[] = []
  for (const paragraph of paragraphs) {
    for (const line of paragraph.split('\n')) {
      let item = line.replace(BULLET, '')
      if (kind === 'steps') item = item.replace(STEP_NUMBER, '')
      item = item.trim()
      if (item) out.push(item)
    }
  }
  return out
}

/** A recipe's text as its introduction and its parts. */
export function readRecipe(text: string): RecipeReading {
  const { intro, sections } = parseHeadings(text)
  return {
    intro,
    parts: sections.map((section): RecipePart => {
      const kind = listKind(section.heading)
      return kind
        ? { kind, heading: section.heading, items: items(section.paragraphs, kind) }
        : { kind: 'section', heading: section.heading, paragraphs: section.paragraphs }
    }),
  }
}

/** Every ingredient in the recipe, from every INGREDIENTS list, in order. */
export function recipeIngredients(reading: RecipeReading): string[] {
  return reading.parts.flatMap(part => (part.kind === 'ingredients' ? part.items : []))
}

