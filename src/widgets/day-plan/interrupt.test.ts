import { afterEach, beforeEach, expect, test } from 'vitest'
import { dayChoices, dayLabel, dayWordsFor, defaultChoices, roundUp, shapeInterval, shortDate } from './interrupt'
import { forgetRecentTitles, readRecentTitles, rememberTitle } from './replanPrefs'
import type { Task } from '../../lib/types'

const WINDOW = { start: 7 * 60, end: 23 * 60 }
const t = (h: number, m = 0) => h * 60 + m

// 2026-09-08 is a Tuesday.
const TUESDAY = '2026-09-08'

/**
 * A call names the shape of the loss, not its minutes. Each shape is a
 * stretch of the waking window; a shape nothing is left of is null, and the
 * chip for it is disabled rather than fitted to nothing.
 */
test('the four shapes cut the waking window at one and at six', () => {
  expect(shapeInterval('morning', WINDOW)).toEqual({ start: t(7), end: t(13) })
  expect(shapeInterval('afternoon', WINDOW)).toEqual({ start: t(13), end: t(18) })
  expect(shapeInterval('evening', WINDOW)).toEqual({ start: t(18), end: t(23) })
  expect(shapeInterval('whole', WINDOW)).toEqual({ start: t(7), end: t(23) })
})

test('on today a shape starts no earlier than now, and a shape already behind is not offered', () => {
  expect(shapeInterval('morning', WINDOW, t(15))).toBeNull()
  expect(shapeInterval('afternoon', WINDOW, t(15))).toEqual({ start: t(15), end: t(18) })
  expect(shapeInterval('whole', WINDOW, t(15))).toEqual({ start: t(15), end: t(23) })
})

test('a schedule that wakes after lunch has no morning, and one that sleeps before six has no evening', () => {
  expect(shapeInterval('morning', { start: t(14), end: t(23) })).toBeNull()
  expect(shapeInterval('evening', { start: t(6), end: t(17) })).toBeNull()
  expect(shapeInterval('afternoon', { start: t(14), end: t(23) })).toEqual({ start: t(14), end: t(18) })
})

test('now rounds up to the next five minutes, the grain the grid snaps to', () => {
  expect(roundUp(t(10, 1))).toBe(t(10, 5))
  expect(roundUp(t(10, 5))).toBe(t(10, 5))
})

/**
 * WHEN is seven chips from today, not this week's Monday to Sunday: a chip
 * for a day that has passed is a chip nobody can press.
 */
test('the day chips run seven days from today, named the way a person names them', () => {
  const chips = dayChoices(TUESDAY)
  expect(chips.map(c => c.label)).toEqual(['Today', 'Tomorrow', 'Thu 10', 'Fri 11', 'Sat 12', 'Sun 13', 'Mon 14'])
  expect(chips[0].date).toBe(TUESDAY)
  expect(chips[6].date).toBe('2026-09-14')
})

test('a day beyond the week carries its date, so a picked day reads as one', () => {
  expect(dayLabel('2026-09-25', TUESDAY)).toBe('Fri 25 Sep')
  expect(shortDate('2026-10-03')).toBe('3 Oct')
})

/**
 * The summary and the free-windows line name the day the same way, from
 * one function, so the two can never be about different days.
 */
test('the day is named as a person would name it, and so is the day after', () => {
  expect(dayWordsFor(TUESDAY, TUESDAY)).toEqual({ day: 'today', next: 'tomorrow' })
  expect(dayWordsFor('2026-09-09', TUESDAY)).toEqual({ day: 'tomorrow', next: 'the day after' })
  expect(dayWordsFor('2026-09-10', TUESDAY)).toEqual({ day: 'on Thursday', next: 'Friday' })
  expect(dayWordsFor('2026-09-14', TUESDAY)).toEqual({ day: 'on Monday', next: 'Tuesday' })
  expect(dayWordsFor('2026-09-25', TUESDAY)).toEqual({ day: 'on 25 Sep', next: '26 Sep' })
})

/**
 * The proposal before anybody chooses: a routine block is skipped for the
 * day, because its template makes it again and a commute moved to nine at
 * night is not a plan; a one-off has no entry and is fitted by default.
 */
test('only routine blocks get a default choice, and it is to skip them', () => {
  const routine: Task = { id: 'commute', title: 'Commute', time: '08:00', done: false, origin: { type: 'template', sourceId: 'work', blockId: 'b1' } }
  const repeat: Task = { id: 'pills', title: 'Pills', time: '08:30', done: false, repeatOf: 'series' }
  const oneOff: Task = { id: 'bank', title: 'Call the bank', time: '09:00', done: false, origin: { type: 'manual' } }
  expect(defaultChoices([routine, repeat, oneOff])).toEqual({ commute: 'drop', pills: 'drop' })
})

// --- the names it remembers ----------------------------------------------------

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  forgetRecentTitles()
})

/**
 * A device habit, not a plan: the last three names, most recent first,
 * under their own key, outside the backup and outside sync.
 */
test('the last three names are kept, most recent first, without repeats', () => {
  rememberTitle('Dad')
  rememberTitle('Dentist')
  rememberTitle('dad')
  expect(readRecentTitles()).toEqual(['dad', 'Dentist'])
  rememberTitle('School')
  rememberTitle('Mum')
  expect(readRecentTitles()).toEqual(['Mum', 'School', 'dad'])
})

test('the stand-in name and a blank are never remembered', () => {
  rememberTitle('Something came up')
  rememberTitle('   ')
  expect(readRecentTitles()).toEqual([])
})

test('a value this did not write is read as no names, not as a crash', () => {
  localStorage.setItem('dienius:replan-titles', '{"not":"a list"}')
  expect(readRecentTitles()).toEqual([])
  localStorage.setItem('dienius:replan-titles', '[1, "Dad", ""]')
  expect(readRecentTitles()).toEqual(['Dad'])
})
