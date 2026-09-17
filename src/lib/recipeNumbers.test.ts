import { expect, test } from 'vitest'
import { clearRecipeNumber, recipeNumbers, writeRecipeNumber } from './recipeNumbers'

/**
 * Numbers typed into a recipe's text, read into its fields - Kitchen, v2.30,
 * docs/RESEARCH-KITCHEN.md section 6.3. A number is read where it stands
 * beside its word, in English or Lithuanian; never from inside the ingredients
 * or the steps, where an amount is part of a line; the first mention of each
 * is the one read. And the other way: a field changed or cleared rewrites the
 * number the text says. Every recipe here is a generic one.
 */

function values(text: string) {
  return Object.fromEntries(Object.entries(recipeNumbers(text)).map(([name, found]) => [name, found!.value]))
}

test('a number beside its word is read, the word before it or after, with or without grams and a colon', () => {
  expect(values('450 kcal')).toEqual({ kcal: 450 })
  expect(values('kcal 450')).toEqual({ kcal: 450 })
  expect(values('Calories: 450')).toEqual({ kcal: 450 })
  expect(values('30 g protein')).toEqual({ protein: 30 })
  expect(values('30g protein')).toEqual({ protein: 30 })
  expect(values('Protein: 30 g')).toEqual({ protein: 30 })
  expect(values('carbs 45')).toEqual({ carbs: 45 })
  expect(values('fat: 12.5 g')).toEqual({ fat: 12.5 })
  expect(values('2 servings')).toEqual({ servings: 2 })
  expect(values('Serves 4')).toEqual({ servings: 4 })
  expect(values('Ready in 45 min')).toEqual({ minutes: 45 })
  expect(values('20 minutes')).toEqual({ minutes: 20 })
  expect(values('1 h 30 min')).toEqual({ minutes: 90 })
  expect(values('1.5 h')).toEqual({ minutes: 90 })
})

test('several on one line are each read, and a decimal comma is a decimal', () => {
  expect(values('Per serving: 520 kcal, 38 g protein, 60 g carbs, 12,5 g fat')).toEqual({ kcal: 520, protein: 38, carbs: 60, fat: 12.5 })
})

test('the Lithuanian words are read, with the Lithuanian letters and without them', () => {
  expect(values('450 kalorijų')).toEqual({ kcal: 450 })
  expect(values('baltymai 30 g, angliavandeniai 45 g, riebalai 12 g')).toEqual({ protein: 30, carbs: 45, fat: 12 })
  expect(values('30 g baltymu')).toEqual({ protein: 30 })
  expect(values('2 porcijos, 40 min')).toEqual({ servings: 2, minutes: 40 })
  expect(values('1 val. 15 min')).toEqual({ minutes: 75 })
})

test('nothing is read from inside the ingredients or the steps, and the lines around them are', () => {
  const text = [
    'A quick lunch. Per serving: 350 kcal.',
    '',
    'INGREDIENTS',
    '30 g protein powder',
    '200 g rice',
    '',
    'STEPS',
    'Bake for 20 min.',
    '',
    'NOTES',
    'Serves 2',
  ].join('\n')
  expect(values(text)).toEqual({ kcal: 350, servings: 2 })
})

test('a number that is not beside its word, or a word inside another word, is not read', () => {
  expect(values('Fat-free yogurt with 0% fat and a calzone 3')).toEqual({})
  expect(values('Makes 12 muffins')).toEqual({})
  expect(values('200 g carbonara and 2 fatty slices')).toEqual({})
  expect(values('')).toEqual({})
})

test('the first mention of a number is the one read', () => {
  expect(values('400 kcal\n\n600 kcal')).toEqual({ kcal: 400 })
})

test('a changed field rewrites the number the text says, and nothing else of the text', () => {
  expect(writeRecipeNumber('Per serving: 450 kcal, 30 g protein', 'kcal', 500)).toBe('Per serving: 500 kcal, 30 g protein')
  expect(writeRecipeNumber('Protein: 30 g', 'protein', 32.5)).toBe('Protein: 32.5 g')
  expect(writeRecipeNumber('12,5 g fat', 'fat', 13.5)).toBe('13,5 g fat')
  expect(writeRecipeNumber('Ready in 1 h 30 min', 'minutes', 45)).toBe('Ready in 45 min')
  expect(writeRecipeNumber('Ready in 45 min', 'minutes', 90)).toBe('Ready in 1 h 30 min')
  // A number the text does not say is not written into it.
  expect(writeRecipeNumber('Toast and a banana', 'kcal', 300)).toBe('Toast and a banana')
})

test('a cleared field takes its number out of the text, with the comma it was listed with', () => {
  expect(clearRecipeNumber('Per serving: 450 kcal, 30 g protein', 'kcal')).toBe('Per serving: 30 g protein')
  expect(clearRecipeNumber('Per serving: 450 kcal, 30 g protein', 'protein')).toBe('Per serving: 450 kcal')
  // A line left with nothing on it goes, rather than parting the text in two.
  expect(clearRecipeNumber('A soup.\n450 kcal\nWarm it up.', 'kcal')).toBe('A soup.\nWarm it up.')
  expect(clearRecipeNumber('Toast and a banana', 'kcal')).toBe('Toast and a banana')
})
