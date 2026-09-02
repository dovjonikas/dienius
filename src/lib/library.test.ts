import { expect, test } from 'vitest'
import {
  currentItem,
  isItemFinished,
  itemProgress,
  parseLibraryItemInput,
  progressLabel,
  progressPercent,
  unitPlural,
  unitShort,
} from './library'
import type { LibraryItem, LibraryList } from './types'

const BOOKS: LibraryList = { id: 'l', name: 'Books', unit: 'chapter', unitShort: 'ch', items: [] }

function item(over: Partial<LibraryItem> = {}): LibraryItem {
  return { id: 'i', title: 'A book', ...over }
}

// --- the unit ------------------------------------------------------------
//
// The unit is the whole reason this is one feature rather than three - a
// list that calls episodes "items completed" reads like a database. So the
// pluralisation is small on purpose and covers exactly the words real units
// are, with unitPlural as the escape hatch for everything else.

test('a unit pluralises the ordinary way', () => {
  expect(unitPlural({ unit: 'chapter' })).toBe('chapters')
  expect(unitPlural({ unit: 'lesson' })).toBe('lessons')
})

test('a unit ending in a sibilant takes -es rather than a bare -s', () => {
  expect(unitPlural({ unit: 'class' })).toBe('classes')
  expect(unitPlural({ unit: 'batch' })).toBe('batches')
  expect(unitPlural({ unit: 'box' })).toBe('boxes')
})

test('a consonant plus y becomes -ies, but a vowel plus y does not', () => {
  expect(unitPlural({ unit: 'story' })).toBe('stories')
  expect(unitPlural({ unit: 'day' })).toBe('days')
})

test('a list that names its own plural is never guessed at', () => {
  expect(unitPlural({ unit: 'foot', unitPlural: 'feet' })).toBe('feet')
})

test('an empty unit still produces a readable word rather than a bare s', () => {
  expect(unitPlural({ unit: '' })).toBe('units')
})

test('the short form falls back to the full unit when a list never named one', () => {
  expect(unitShort({ unit: 'chapter', unitShort: 'ch' })).toBe('ch')
  expect(unitShort({ unit: 'session' })).toBe('session')
})

// --- progress ------------------------------------------------------------

test('progress is clamped to the total, so a corrupt count cannot read past the end', () => {
  expect(itemProgress(item({ total: 12, progress: 99 }))).toBe(12)
  expect(itemProgress(item({ total: 12, progress: -4 }))).toBe(0)
})

test('an item with no total counts up with nothing to clamp against', () => {
  expect(itemProgress(item({ progress: 40 }))).toBe(40)
})

test('absent progress is none, not a missing value', () => {
  expect(itemProgress(item())).toBe(0)
})

test('an item is finished either by reaching its total or by being marked so', () => {
  expect(isItemFinished(item({ total: 12, progress: 12 }))).toBe(true)
  expect(isItemFinished(item({ total: 12, progress: 11 }))).toBe(false)
  // The manual override - somebody decides a podcast is done. This is why
  // finished is a stored flag rather than derived from the count alone.
  expect(isItemFinished(item({ progress: 40, finished: '2026-09-01' }))).toBe(true)
})

test('an item with no total is never finished by counting alone', () => {
  expect(isItemFinished(item({ progress: 9999 }))).toBe(false)
})

test('the progress label speaks the list own unit, with and without a total', () => {
  expect(progressLabel(BOOKS, item({ total: 12, progress: 4 }))).toBe('ch 4/12')
  expect(progressLabel(BOOKS, item({ progress: 9 }))).toBe('ch 9')
})

test('percent is null for an item with no total to be a fraction of', () => {
  expect(progressPercent(item({ total: 12, progress: 3 }))).toBe(25)
  expect(progressPercent(item({ progress: 3 }))).toBeUndefined()
  expect(progressPercent(item({ total: 0, progress: 3 }))).toBeUndefined()
})

// --- which item a session goes into --------------------------------------

test('the current item is the first unfinished one, not the most recently touched', () => {
  const list: LibraryList = {
    ...BOOKS,
    items: [
      item({ id: 'a', total: 4, progress: 4 }),
      item({ id: 'b', total: 10, progress: 0 }),
      item({ id: 'c', total: 10, progress: 7 }),
    ],
  }
  // b, not c - the list is hand-ordered and drag-reorderable, so the owner
  // has already said which is next by putting it there.
  expect(currentItem(list)?.id).toBe('b')
})

test('a list with nothing unfinished left has no current item', () => {
  const list: LibraryList = { ...BOOKS, items: [item({ total: 4, progress: 4 })] }
  expect(currentItem(list)).toBeUndefined()
})

// --- the typed line ------------------------------------------------------

test('a trailing count with a unit word becomes the total', () => {
  expect(parseLibraryItemInput('Daring Greatly, 12 chapters')).toEqual({ title: 'Daring Greatly', total: 12 })
})

test('a trailing bare number becomes the total too', () => {
  expect(parseLibraryItemInput('Andor s2, 12')).toEqual({ title: 'Andor s2', total: 12 })
})

test('a line with no count is all title', () => {
  expect(parseLibraryItemInput('The Odyssey')).toEqual({ title: 'The Odyssey' })
})

// A number inside a title is left alone entirely, which is the whole reason
// the pattern is anchored to the end of the line.
test('a number in the middle of a title survives being typed', () => {
  expect(parseLibraryItemInput('Catch-22 is the one')).toEqual({ title: 'Catch-22 is the one' })
})

// Producing an item with no name at all is worse than taking a strange title
// at its word, so a line that is only a count stays a title.
test('a line that is nothing but a count stays a title rather than a nameless item', () => {
  expect(parseLibraryItemInput('12 chapters')).toEqual({ title: '12 chapters' })
})

test('an empty line makes nothing', () => {
  expect(parseLibraryItemInput('   ')).toBeUndefined()
})

test('a zero or negative count is not a total', () => {
  expect(parseLibraryItemInput('Something, 0')).toEqual({ title: 'Something, 0' })
})
