import { expect, test } from 'vitest'
import { headingLineKinds, isHeading, parseHeadings, splitHeading, tagAt } from './headings'
import { NORTH_RULES, parseNorth } from './northSections'
import { readRecipe } from './recipeText'

/**
 * The capitals rule, once, for every text that has it - North's and a
 * recipe's. A line whose letters are all capitals is a heading and owns
 * everything under it to the next one; a blank line parts paragraphs. What a
 * kind of text adds on top is a rule it passes in: North's tags and its
 * signature, and nothing for a recipe. Every line here is a generic one.
 */

test('a line whose letters are all capitals is a heading, and the lines under it are its paragraphs', () => {
  expect(parseHeadings('a line before any heading\n\nFIRST HEADING\na line under it\n\na second paragraph\nSECOND HEADING 2\nlast')).toEqual({
    intro: ['a line before any heading'],
    sections: [
      { heading: 'FIRST HEADING', paragraphs: ['a line under it', 'a second paragraph'] },
      { heading: 'SECOND HEADING 2', paragraphs: ['last'] },
    ],
    signature: [],
  })
  expect(isHeading('2026')).toBe(false)
  expect(isHeading('Not THIS')).toBe(false)
  expect(isHeading('  ŽALIA  ')).toBe(true)
})

test('with no rules of its own a text has no signature and no tags: a line of --- is text, and brackets are words', () => {
  expect(parseHeadings('A HEADING [MORNING]\na line\n---\nANOTHER HEADING\nmore')).toEqual({
    intro: [],
    sections: [
      { heading: 'A HEADING [MORNING]', paragraphs: ['a line\n---'] },
      { heading: 'ANOTHER HEADING', paragraphs: ['more'] },
    ],
    signature: [],
  })
  expect(splitHeading('A HEADING [morning]')).toEqual({ heading: 'A HEADING [morning]' })
  expect(isHeading('A HEADING [morning]')).toBe(false)
  expect(tagAt('A HEADING [MORNING]')).toBe(-1)
  expect(headingLineKinds('A HEADING\n---\nANOTHER')).toEqual(['heading', 'text', 'heading'])
})

test("North's rules add its signature and its two tags, and read everything else by the same rule", () => {
  expect(parseHeadings('WAKING [morning]\na line\n---\nA SIGNATURE', NORTH_RULES)).toEqual({
    intro: [],
    sections: [{ heading: 'WAKING', tag: 'morning', paragraphs: ['a line'] }],
    signature: ['A SIGNATURE'],
  })
  expect(headingLineKinds('WAKING [evening]\n---\nCAPITALS', NORTH_RULES)).toEqual(['heading', 'mark', 'text'])
  expect(tagAt('  A HEADING   [Evening]  ', NORTH_RULES)).toBe(11)
})

test('North and a recipe find the same headings in the same text, because it is one parser', () => {
  const texts = [
    'an introduction\n\nINGREDIENTS\nwater\nsalt\n\nSTEPS\nBoil it.\nSalt it.',
    'no heading at all\n\nonly paragraphs',
    'FIRST HEADING\n\n\nSECOND HEADING\na line under the second\n\na paragraph',
  ]
  for (const text of texts) {
    const north = parseNorth(text)
    const shared = parseHeadings(text)
    expect(north).toEqual(shared)
    const recipe = readRecipe(text)
    expect(recipe.intro).toEqual(shared.intro)
    expect(recipe.parts.map(part => part.heading)).toEqual(shared.sections.map(section => section.heading))
  }
})
