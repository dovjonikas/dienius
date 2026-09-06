import { expect, test } from 'vitest'
import type { Task } from '../../lib/types'
import { LATEST_BY_CATEGORY, MEALS_APART_MINUTES, latestFor, placementOk } from './placement'

/**
 * When a block may land, beyond "there is a gap there".
 *
 * The owner's two rules, in their words: gym at eleven at night is not gym,
 * and two meals do not end up an hour apart because the afternoon moved.
 * Both are about the same thing - a gap in a calendar is not the same as a
 * time a thing can actually happen - and both are cheap to state and
 * impossible to remember every time by hand.
 */

let n = 0
function task(over: Partial<Task> = {}): Task {
  n += 1
  return { id: `t${n}`, title: `Task ${n}`, done: false, ...over }
}

// --- how late a thing can be -----------------------------------------------

test('each kind of block has an hour past which it stops being that block', () => {
  expect(LATEST_BY_CATEGORY.health).toBe(21 * 60)
  expect(LATEST_BY_CATEGORY.core).toBe(20 * 60)
  expect(LATEST_BY_CATEGORY.meal).toBe(21 * 60)
})

test('a block says its own latest, and that wins over the kind it is', () => {
  expect(latestFor(task({ category: 'health', latest: '23:00' }))).toBe(23 * 60)
  expect(latestFor(task({ category: 'health' }))).toBe(21 * 60)
})

test('a kind nobody wrote a rule for is not restricted at all', () => {
  expect(latestFor(task({ category: 'personal' }))).toBeUndefined()
  expect(latestFor(task())).toBeUndefined()
})

test('gym at eleven is not gym, and the rule says so at the start time', () => {
  const gym = task({ title: 'Gym', category: 'health', minutes: 60 })
  expect(placementOk(gym, 20 * 60, [])).toBe(true)
  expect(placementOk(gym, 21 * 60, [])).toBe(true)
  expect(placementOk(gym, 21 * 60 + 1, [])).toBe(false)
})

test('a block with no rule lands wherever there is room', () => {
  const call = task({ title: 'Call the bank', minutes: 15 })
  expect(placementOk(call, 22 * 60 + 30, [])).toBe(true)
})

// --- meals do not clump ----------------------------------------------------

test('two meals stay at least two hours apart after anything moves', () => {
  expect(MEALS_APART_MINUTES).toBe(120)
  const lunch = task({ title: 'Lunch', category: 'meal', time: '12:30', minutes: 45 })
  const dinner = task({ title: 'Dinner', category: 'meal', minutes: 45 })

  expect(placementOk(dinner, 13 * 60, [lunch])).toBe(false)
  expect(placementOk(dinner, 14 * 60 + 29, [lunch])).toBe(false)
  expect(placementOk(dinner, 14 * 60 + 30, [lunch])).toBe(true)
})

test('the two hours are counted either side, so a meal before one is held off too', () => {
  const dinner = task({ title: 'Dinner', category: 'meal', time: '18:00', minutes: 45 })
  const lunch = task({ title: 'Lunch', category: 'meal', minutes: 45 })
  expect(placementOk(lunch, 17 * 60, [dinner])).toBe(false)
  expect(placementOk(lunch, 16 * 60, [dinner])).toBe(true)
})

test('a meal is not held off by itself, which is what a re-time is', () => {
  const lunch = task({ title: 'Lunch', category: 'meal', time: '12:30', minutes: 45 })
  expect(placementOk(lunch, 13 * 60, [lunch])).toBe(true)
})

test('a meal is not held off by something that is not one', () => {
  const deep = task({ title: 'Deep work', category: 'core', time: '12:00', minutes: 60 })
  const lunch = task({ title: 'Lunch', category: 'meal', minutes: 45 })
  expect(placementOk(lunch, 13 * 60, [deep])).toBe(true)
})

test('a meal already done is still a meal for the two hours after it', () => {
  const lunch = task({ title: 'Lunch', category: 'meal', time: '12:30', minutes: 45, done: true })
  const dinner = task({ title: 'Dinner', category: 'meal', minutes: 45 })
  expect(placementOk(dinner, 13 * 60, [lunch])).toBe(false)
})
