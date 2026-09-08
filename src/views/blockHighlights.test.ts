import { expect, test } from 'vitest'
import { canMarkKey } from './blockHighlights'
import { MAX_HIGHLIGHTS } from '../lib/types'

// The cap is per day, and a refusal has to say what is in the way.

const block = (id: string, title: string, time?: string, highlight?: boolean) => ({ id, title, time, highlight })

test('a fourth key block on a day is refused, and the three already there are named in time order', () => {
  const day = [
    block('a', 'Afternoon', '13:00', true),
    block('b', 'Morning', '07:00', true),
    block('c', 'Mid-morning', '09:00', true),
    block('d', 'Evening', '19:00'),
  ]
  const verdict = canMarkKey(day, day[3])
  expect(verdict.allowed).toBe(false)
  expect(verdict.blocking).toEqual(['Morning', 'Mid-morning', 'Afternoon'])
  expect(verdict.message).toBe('3 already matter here: Morning, Mid-morning, Afternoon. Take one off first.')
})

test('the third is allowed, because three is the number', () => {
  const day = [block('a', 'One', '07:00', true), block('b', 'Two', '09:00', true), block('c', 'Three', '13:00')]
  expect(canMarkKey(day, day[2]).allowed).toBe(true)
  expect(MAX_HIGHLIGHTS).toBe(3)
})

test('taking KEY off always works, however full the day is', () => {
  const day = [
    block('a', 'One', '07:00', true),
    block('b', 'Two', '09:00', true),
    block('c', 'Three', '13:00', true),
  ]
  const verdict = canMarkKey(day, day[0])
  expect(verdict.allowed).toBe(true)
  expect(verdict.message).toBeUndefined()
})

test('a block does not count itself out', () => {
  // Two others marked, and this one already marked: pressing it is a
  // removal, and asking whether a fourth fits would be the wrong question.
  const day = [block('a', 'One', '07:00', true), block('b', 'Two', '09:00', true), block('c', 'Three', '13:00', true)]
  expect(canMarkKey(day, day[2]).allowed).toBe(true)
})

test('an untimed block in the way is still named, last', () => {
  const day = [
    block('a', 'Whenever', undefined, true),
    block('b', 'Morning', '07:00', true),
    block('c', 'Noon', '12:00', true),
    block('d', 'New one'),
  ]
  expect(canMarkKey(day, day[3]).blocking).toEqual(['Morning', 'Noon', 'Whenever'])
})
