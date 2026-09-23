import { beforeEach, expect, test } from 'vitest'
import { isListLine, readPastedLibrary } from './libraryPaste'
import { actions, getData } from './store'
import { defaultData } from './storage'
import type { LibraryList } from './types'

/**
 * A whole shelf pasted at once - the owner's brief of 2026-09-22, part 4.
 * One line a book, "A title - An author"; a line in capitals is a list and
 * what follows it goes in there. Every title and name here is invented.
 */

function list(name: string, titles: string[] = []): LibraryList {
  return {
    id: name.toLowerCase(),
    name,
    unit: 'chapter',
    items: titles.map((title, i) => ({ id: `${name}-${i}`, title })),
  }
}

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
})

test('a line in capitals is a list, and a line with letters in both cases is a book', () => {
  expect(isListLine('MAIN')).toBe(true)
  expect(isListLine('SIDE READING')).toBe(true)
  expect(isListLine('A Room of One’s Own')).toBe(false)
  expect(isListLine('1984')).toBe(false)
  expect(isListLine('A')).toBe(false)
})

test('a title and an author are read apart, and the lines follow the list above them', () => {
  const read = readPastedLibrary(
    ['MAIN', 'A long walk - A Walker', 'The second book', 'SIDE', 'A short one - Another Name'].join('\n'),
    [list('Main', [])],
    'Main',
  )
  expect(read.rows).toEqual([
    { list: 'Main', title: 'A long walk', author: 'A Walker', state: 'new' },
    { list: 'Main', title: 'The second book', state: 'new' },
    { list: 'Side', title: 'A short one', author: 'Another Name', state: 'new' },
  ])
  // Main is there already; Side is not, and is said so.
  expect(read.newLists).toEqual(['Side'])
})

test('the lines before the first list line go into the list the screen is pointed at', () => {
  const read = readPastedLibrary(['A first book - A Name', 'MAIN', 'A second - Another'].join('\n'), [list('Books')], 'Books')
  expect(read.rows.map(r => [r.list, r.title])).toEqual([
    ['Books', 'A first book'],
    ['Main', 'A second'],
  ])
})

test('a title the list already has is an update, and the order of the lines is kept', () => {
  const read = readPastedLibrary(
    ['A long walk - A Walker', 'A new one - A Name', 'a  LONG walk - Another Walker'].join('\n'),
    [list('Books', ['A long walk'])],
    'Books',
  )
  // The same title said twice: the later line is the one read, in the first's place.
  expect(read.rows).toEqual([
    { list: 'Books', title: 'a  LONG walk', author: 'Another Walker', state: 'update' },
    { list: 'Books', title: 'A new one', author: 'A Name', state: 'new' },
  ])
})

test('a dash inside a title is not its author: the last one is', () => {
  const read = readPastedLibrary(['A book - and its subtitle - A Name'].join('\n'), [list('Books')], 'Books')
  expect(read.rows[0]).toMatchObject({ title: 'A book - and its subtitle', author: 'A Name' })
})

test('the paste makes the lists it names, writes the books in order, and one undo takes it all back', () => {
  const before = getData()
  const read = readPastedLibrary(
    ['MAIN', 'A long walk - A Walker', 'The second book', 'SIDE', 'A short one - Another Name'].join('\n'),
    [],
    'Main',
  )
  const { undo } = actions.importLibrary(read.rows)

  const lists = getData().library
  expect(lists.map(l => l.name)).toEqual(['Main', 'Side'])
  expect(lists[0].items.map(i => [i.title, i.author])).toEqual([
    ['A long walk', 'A Walker'],
    ['The second book', undefined],
  ])
  expect(lists[1].items.map(i => i.title)).toEqual(['A short one'])

  undo()
  expect(getData().library).toEqual(before.library)
})

test('a book the list has keeps its place and its progress, and takes the author it was given', () => {
  actions.addLibraryList({ name: 'Books', unit: 'chapter' })
  const books = getData().library[0]
  actions.addLibraryItemsMany(books.id, [{ title: 'A long walk' }, { title: 'The second book' }])
  const walk = getData().library[0].items[0]
  actions.setLibraryItemProgress(books.id, walk.id, 3, '2026-09-22')

  const read = readPastedLibrary('A long walk - A Walker', getData().library, 'Books')
  actions.importLibrary(read.rows)

  const items = getData().library[0].items
  expect(items.map(i => i.title)).toEqual(['A long walk', 'The second book'])
  expect(items[0]).toMatchObject({ id: walk.id, author: 'A Walker', progress: 3 })
})
