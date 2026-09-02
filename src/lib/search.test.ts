import { beforeEach, expect, test } from 'vitest'
import { defaultData } from './storage'
import { addMonths, parseDateQuery, searchEverything } from './search'
import type { AppData, Task } from './types'

// 2026-09-02 is a Wednesday.
const TODAY = '2026-09-02'

let data: AppData

beforeEach(() => {
  data = defaultData()
})

function task(over: Partial<Task> = {}): Task {
  return { id: crypto.randomUUID(), title: 'A task', done: false, ...over }
}

function seed(date: string, tasks: Task[]) {
  data.days[date] = { date, tasks }
}

// --- what is searched ----------------------------------------------------

test('a task is found by its title', () => {
  seed(TODAY, [task({ title: 'Call the bank' })])
  expect(searchEverything(data, 'bank', TODAY).map(r => r.title)).toEqual(['Call the bank'])
})

test('a note is searched, and reported as a note rather than as the title again', () => {
  seed(TODAY, [task({ title: 'Deep work block', note: 'the tricky bit is section 3' })])
  const [found] = searchEverything(data, 'tricky', TODAY)
  expect(found.kind).toBe('note')
  expect(found.detail).toBe('the tricky bit is section 3')
})

// One task should never be two results.
test('a task whose title and note both match appears once', () => {
  seed(TODAY, [task({ title: 'Bank', note: 'the bank again' })])
  expect(searchEverything(data, 'bank', TODAY)).toHaveLength(1)
})

test('library items are searched too, and say how far through they are', () => {
  data.library = [
    { id: 'l', name: 'Books', unit: 'chapter', unitShort: 'ch', items: [{ id: 'i', title: 'Daring Greatly', total: 12, progress: 4 }] },
  ]
  const [found] = searchEverything(data, 'daring', TODAY)
  expect(found.kind).toBe('library')
  expect(found.detail).toBe('Books - ch 4/12')
  expect(found.target).toEqual({ type: 'library', listId: 'l', itemId: 'i' })
})

test('a task result carries the day it is on, which is where Enter goes', () => {
  seed('2026-08-14', [task({ title: 'Dentist' })])
  expect(searchEverything(data, 'dentist', TODAY)[0].target).toEqual({ type: 'day', date: '2026-08-14' })
})

// --- how much is enough to search ----------------------------------------

test('one character searches nothing - it would match most of the store', () => {
  seed(TODAY, [task({ title: 'Call the bank' })])
  expect(searchEverything(data, 'b', TODAY)).toEqual([])
  expect(searchEverything(data, '   ', TODAY)).toEqual([])
})

// --- matching ------------------------------------------------------------

test('case and accents are ignored in both directions', () => {
  seed(TODAY, [task({ title: 'Café run' })])
  expect(searchEverything(data, 'CAFE', TODAY)).toHaveLength(1)
  seed(TODAY, [task({ title: 'Cafe run' })])
  expect(searchEverything(data, 'café', TODAY)).toHaveLength(1)
})

test('a match at the start of a title outranks one in the middle', () => {
  seed(TODAY, [task({ title: 'Later the bank' }), task({ title: 'Bank the cheque' })])
  expect(searchEverything(data, 'bank', TODAY).map(r => r.title)).toEqual([
    'Bank the cheque',
    'Later the bank',
  ])
})

test('a word-boundary match outranks one inside a word', () => {
  seed(TODAY, [task({ title: 'Rebankable' }), task({ title: 'Go bank something' })])
  expect(searchEverything(data, 'bank', TODAY)[0].title).toBe('Go bank something')
})

test('a title outranks a note', () => {
  seed(TODAY, [task({ title: 'Something else', note: 'about the dentist' }), task({ title: 'Dentist' })])
  expect(searchEverything(data, 'dentist', TODAY)[0].title).toBe('Dentist')
})

test('nothing matching is an empty list, not a guess', () => {
  seed(TODAY, [task({ title: 'Call the bank' })])
  expect(searchEverything(data, 'zebra', TODAY)).toEqual([])
})

test('results are capped, so a common word does not return the whole store', () => {
  seed(TODAY, Array.from({ length: 40 }, (_, i) => task({ title: `Task about banking ${i}` })))
  expect(searchEverything(data, 'banking', TODAY).length).toBeLessThanOrEqual(12)
})

// --- typing a date -------------------------------------------------------

test('the three words a person actually types resolve', () => {
  expect(parseDateQuery('today', TODAY)).toBe(TODAY)
  expect(parseDateQuery('tomorrow', TODAY)).toBe('2026-09-03')
  expect(parseDateQuery('Yesterday', TODAY)).toBe('2026-09-01')
})

test('a full date key is taken as itself', () => {
  expect(parseDateQuery('2026-12-25', TODAY)).toBe('2026-12-25')
})

test('a bare number means that day of this month, and only if it exists', () => {
  expect(parseDateQuery('14', TODAY)).toBe('2026-09-14')
  expect(parseDateQuery('31', TODAY)).toBeUndefined() // September has 30
  expect(parseDateQuery('0', TODAY)).toBeUndefined()
})

// Somebody typing "monday" on a Monday means the Monday coming, or they
// would have typed "today".
test('a weekday means the next one, never today', () => {
  expect(parseDateQuery('friday', TODAY)).toBe('2026-09-04')
  expect(parseDateQuery('wed', TODAY)).toBe('2026-09-09')
})

test('anything else is a search, not a date - it does not guess', () => {
  expect(parseDateQuery('bank', TODAY)).toBeUndefined()
  expect(parseDateQuery('mo', TODAY)).toBeUndefined()
  expect(parseDateQuery('', TODAY)).toBeUndefined()
})

// --- month arithmetic ----------------------------------------------------

test('a month back from the 31st lands on the last day of a shorter month', () => {
  expect(addMonths('2026-03-31', -1)).toBe('2026-02-28')
  expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
  expect(addMonths('2026-09-15', -1)).toBe('2026-08-15')
})
