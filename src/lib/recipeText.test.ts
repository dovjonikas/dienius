import { expect, test } from 'vitest'
import { readRecipe, recipeIngredients, recipeSteps } from './recipeText'

/**
 * A recipe's text, read for its page and for Cook. The rule is North's - a
 * line in capitals is a heading - and two headings mean something more:
 * under INGREDIENTS every line is an ingredient, and under STEPS every line
 * is a step. Anything else is shown as it was typed. Every recipe here is a
 * generic one.
 */

test('a text with no heading reads as typed, paragraph by paragraph, and has no ingredients or steps', () => {
  const reading = readRecipe('Toast the bread.\nSpread it with butter.\n\nEat it warm.')
  expect(reading).toEqual({ intro: ['Toast the bread.\nSpread it with butter.', 'Eat it warm.'], parts: [] })
  expect(recipeIngredients(reading)).toEqual([])
  expect(recipeSteps(reading)).toEqual([])
})

test('the lines under INGREDIENTS are the ingredients, one to a line, whatever blank lines or bullets they were typed with', () => {
  const reading = readRecipe('INGREDIENTS\n250 g lentils\n\n- 1 onion\n* 2 carrots\n• 1 litre stock\n1. a pinch of salt')
  expect(reading.parts).toEqual([
    { kind: 'ingredients', heading: 'INGREDIENTS', items: ['250 g lentils', '1 onion', '2 carrots', '1 litre stock', '1. a pinch of salt'] },
  ])
  expect(recipeIngredients(reading)).toEqual(['250 g lentils', '1 onion', '2 carrots', '1 litre stock', '1. a pinch of salt'])
})

test('the lines under STEPS are the steps in order, one to a line, without the numbers they were typed with', () => {
  const reading = readRecipe('STEPS\n1. Chop the onion.\n2) Soften it in oil.\n\n- Add the lentils.\nSimmer for twenty minutes.')
  expect(reading.parts).toEqual([
    { kind: 'steps', heading: 'STEPS', items: ['Chop the onion.', 'Soften it in oil.', 'Add the lentils.', 'Simmer for twenty minutes.'] },
  ])
  expect(recipeSteps(reading)).toEqual(['Chop the onion.', 'Soften it in oil.', 'Add the lentils.', 'Simmer for twenty minutes.'])
})

test('any other heading stands over its paragraphs, and every part keeps the place it was written in', () => {
  const reading = readRecipe('Keeps for three days.\n\nSTEPS\nBoil it.\nTO SERVE\nWith bread.\n\nOr rice.\nINGREDIENTS\nwater')
  expect(reading.intro).toEqual(['Keeps for three days.'])
  expect(reading.parts).toEqual([
    { kind: 'steps', heading: 'STEPS', items: ['Boil it.'] },
    { kind: 'section', heading: 'TO SERVE', paragraphs: ['With bread.', 'Or rice.'] },
    { kind: 'ingredients', heading: 'INGREDIENTS', items: ['water'] },
  ])
})

test('INGREDIENTS and STEPS are known with or without a colon, a second list of either adds to the first, and nothing else is either', () => {
  const reading = readRecipe('INGREDIENTS:\nflour\nSTEPS:\nMix.\nSAUCE INGREDIENTS\ncream\nINGREDIENTS\nsugar\nSTEP\nBake.')
  expect(reading.parts.map(part => part.kind)).toEqual(['ingredients', 'steps', 'section', 'ingredients', 'section'])
  expect(recipeIngredients(reading)).toEqual(['flour', 'sugar'])
  expect(recipeSteps(reading)).toEqual(['Mix.'])
})

test('in a recipe a line of --- and words in brackets are text, and a heading with nothing under it is still a heading', () => {
  const reading = readRecipe('NOTES [morning]\n---\nINGREDIENTS\nSTEPS\nStir [gently].')
  expect(reading.intro).toEqual(['NOTES [morning]\n---'])
  expect(reading.parts).toEqual([
    { kind: 'ingredients', heading: 'INGREDIENTS', items: [] },
    { kind: 'steps', heading: 'STEPS', items: ['Stir [gently].'] },
  ])
})
