import { expect, test } from 'vitest'
import {
  currentItem,
  hasAnotherSeason,
  isItemFinished,
  itemProgress,
  nextSeason,
  parseLibraryItemInput,
  progressLabel,
  progressPercent,
  stepsOneAtATime,
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

// --- how one item is counted, when the list's own unit is not the answer ----
//
// The list still owns the unit; a shelf just holds things of different
// shapes. A Books list holds a book whose sections are short and unnumbered
// beside one with twenty named chapters, and a Watching list holds films,
// which have no parts at all, beside a series that has three seasons of them.

const SHELF = { name: 'Books', unit: 'chapter', unitShort: 'ch' }

test('a page-counted item is spoken in pages, because that is the question being asked', () => {
  expect(progressLabel(SHELF, { id: 'a', title: 'The War of Art', track: 'pages', total: 139, progress: 68 })).toBe(
    'p. 68/139',
  )
  expect(progressLabel(SHELF, { id: 'a', title: 'Turning Pro', track: 'pages', progress: 20 })).toBe('p. 20')
})

test('a film has no number at all, because saying 0/0 about one is worse than saying nothing', () => {
  expect(progressLabel(SHELF, { id: 'a', title: 'Interstellar', track: 'movie' })).toBe('not yet')
  expect(progressLabel(SHELF, { id: 'a', title: 'Interstellar', track: 'movie', finished: '2026-09-01' })).toBe(
    'watched',
  )
})

test('a series reads the way anybody says it out loud', () => {
  expect(
    progressLabel(SHELF, { id: 'a', title: 'Invincible', track: 'series', season: 2, total: 8, progress: 5 }),
  ).toBe('S2 E5/8')
  // Ten episodes and no seasons worth naming is just ep 5/10.
  expect(progressLabel(SHELF, { id: 'a', title: 'From', track: 'series', total: 10, progress: 5 })).toBe('ep 5/10')
})

test('pages are never stepped one at a time, and a film has nothing to step', () => {
  expect(stepsOneAtATime({ id: 'a', title: 'x', track: 'pages' })).toBe(false)
  expect(stepsOneAtATime({ id: 'a', title: 'x', track: 'movie' })).toBe(false)
  expect(stepsOneAtATime({ id: 'a', title: 'x', track: 'series' })).toBe(true)
  expect(stepsOneAtATime({ id: 'a', title: 'x' })).toBe(true)
})

test('a film is only ever finished by somebody saying so', () => {
  // Nothing to count means nothing can conclude it is over. Without this a
  // film would be finished the moment it was added, having "completed" all
  // zero of its parts.
  expect(isItemFinished({ id: 'a', title: 'Interstellar', track: 'movie' })).toBe(false)
  expect(isItemFinished({ id: 'a', title: 'Interstellar', track: 'movie', finished: '2026-09-01' })).toBe(true)
})

test('the end of a season is not the end of a series', () => {
  const midway = { id: 'a', title: 'Invincible', track: 'series' as const, seasons: 3, season: 1, total: 8, progress: 8 }
  expect(isItemFinished(midway)).toBe(false)
  expect(hasAnotherSeason(midway)).toBe(true)
  // The last season, finished, is the whole thing finished.
  expect(isItemFinished({ ...midway, season: 3 })).toBe(true)
})

test('taking on the next season starts it at nothing, with its length unknown again', () => {
  const item = { id: 'a', title: 'Invincible', track: 'series' as const, seasons: 3, season: 1, total: 8, progress: 8 }
  // Unknown rather than carried over: nobody knows how many episodes the next
  // season has until they look it up, and copying the last one's count would
  // be a guess wearing a number.
  expect(nextSeason(item)).toEqual({ season: 2, progress: 0, total: undefined })
})

// --- what a typed line says about shape ------------------------------------

test('a trailing unit word says how this one is counted', () => {
  expect(parseLibraryItemInput('The War of Art, 139 pages')).toEqual({
    title: 'The War of Art',
    total: 139,
    track: 'pages',
  })
  expect(parseLibraryItemInput('From, 10 episodes')).toEqual({ title: 'From', total: 10, track: 'series' })
})

test('seasons say how many there are, episodes say how long one is', () => {
  expect(parseLibraryItemInput('Invincible, 3 seasons')).toEqual({
    title: 'Invincible',
    track: 'series',
    seasons: 3,
    season: 1,
  })
})

test('a shape can be named with no number at all', () => {
  expect(parseLibraryItemInput('Interstellar, movie')).toEqual({ title: 'Interstellar', track: 'movie' })
  expect(parseLibraryItemInput('Interstellar - film')).toEqual({ title: 'Interstellar', track: 'movie' })
})

test('a trailing word with nothing marking it off is part of the title', () => {
  // Without the comma or dash, "The Third Man" would come back as a title of
  // two words and a track, which is a worse failure than not supporting the
  // short form at all.
  expect(parseLibraryItemInput('The Third Man')).toEqual({ title: 'The Third Man' })
  expect(parseLibraryItemInput('Watching movie')).toEqual({ title: 'Watching movie' })
})

test('the list own unit is still the ordinary case', () => {
  expect(parseLibraryItemInput('Sapiens, 20 chapters')).toEqual({ title: 'Sapiens', total: 20 })
  expect(parseLibraryItemInput('Andor s2, 12')).toEqual({ title: 'Andor s2', total: 12 })
})
