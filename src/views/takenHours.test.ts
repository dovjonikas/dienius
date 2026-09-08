import { expect, test } from 'vitest'
import { crossedBy, hourCover, openingHour, takenBlocks, type TakenBlock } from './takenHours'
import { DEFAULT_CATEGORIES } from '../lib/categories'
import type { Task } from '../lib/types'

/**
 * What a day already holds, read one hour at a time.
 *
 * The owner asked for two things and both are here rather than in the
 * component, because jsdom has no layout and neither of them is about pixels:
 * the hour column should open where the day is instead of at midnight, and an
 * hour something already covers should say so before it is picked.
 *
 * The one rule underneath every test below: this counts, it never refuses. An
 * hour that is taken is still an hour you can have.
 */

let n = 0
function task(over: Partial<Task> = {}): Task {
  n += 1
  return { id: `t${n}`, title: `Task ${n}`, done: false, ...over }
}

function at(from: string, to: string, over: Partial<TakenBlock> = {}): TakenBlock {
  const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3))
  return { start: minutes(from), end: minutes(to), ...over }
}

// --- how much of an hour is gone ------------------------------------------

test('an hour a block covers end to end has all sixty of its minutes gone', () => {
  expect(hourCover([at('09:00', '10:00')])[9].minutes).toBe(60)
})

test('an hour covered in part says how much of it, and leaves the next one alone', () => {
  const cover = hourCover([at('09:30', '10:00')])
  expect(cover[9].minutes).toBe(30)
  expect(cover[10].minutes).toBe(0)
})

test('a block running across an hour boundary is counted on both sides of it', () => {
  const cover = hourCover([at('09:45', '10:15')])
  expect(cover[9].minutes).toBe(15)
  expect(cover[10].minutes).toBe(15)
})

test('two blocks in one hour add up', () => {
  expect(hourCover([at('09:00', '09:15'), at('09:40', '10:00')])[9].minutes).toBe(35)
})

// The same twenty minutes booked twice is still twenty minutes gone. An hour
// has sixty and no day has ever had more, so the merge happens before the sum
// - the same reasoning `computeCapacity` merges its anchors for.
test('two blocks on the same minutes take those minutes once, not twice', () => {
  expect(hourCover([at('09:00', '09:20'), at('09:10', '09:20')])[9].minutes).toBe(20)
})

test('an hour nothing covers is clean, and has nothing to say for itself', () => {
  const cover = hourCover([at('09:00', '10:00')])[14]
  expect(cover.minutes).toBe(0)
  expect(cover.saying).toBeUndefined()
  expect(cover.color).toBeUndefined()
})

test('whichever block holds most of an hour is the one that names its colour', () => {
  const cover = hourCover([at('09:00', '09:15', { color: 'blue', label: 'Meals' }), at('09:15', '10:00', { color: 'green', label: 'Deep work' })])
  expect(cover[9].color).toBe('green')
  expect(cover[9].label).toBe('Deep work')
})

// A tie has to break the same way every time, or an hour split down the middle
// changes colour on a reorder that changed nothing.
test('an hour split down the middle reads as the block that starts it', () => {
  const cover = hourCover([at('09:30', '10:00', { color: 'green' }), at('09:00', '09:30', { color: 'blue' })])
  expect(cover[9].color).toBe('blue')
})

// --- what it says out loud ------------------------------------------------

/**
 * Colour is never the only way this control says an hour is gone. The words
 * carry the amount rather than "partly", because the amount is known and it is
 * the half somebody can act on.
 */
test('a taken hour says how much of it is gone and what by', () => {
  const cover = hourCover([at('12:30', '13:00', { label: 'Meals' })])
  expect(cover[12].saying).toBe('12, 30 min taken by Meals')
})

test('a whole hour says it is taken rather than counting to sixty', () => {
  expect(hourCover([at('09:00', '10:00', { label: 'Deep work' })])[9].saying).toBe('09, taken by Deep work')
})

test('a stretch with no category still says the hour is taken', () => {
  expect(hourCover([at('09:00', '10:00')])[9].saying).toBe('09, taken')
})

// --- the day, and somebody else's calendar, as stretches -------------------

test("a task's own category is what its hours are painted and named with", () => {
  const blocks = takenBlocks([task({ time: '09:00', minutes: 60, category: 'core' })], DEFAULT_CATEGORIES)
  expect(blocks).toEqual([{ start: 540, end: 600, color: 'var(--cat-core)', label: 'Deep work' }])
})

test('a task with no day-position - a float - is not a stretch of the day', () => {
  expect(takenBlocks([task({ minutes: 60 })], DEFAULT_CATEGORIES)).toEqual([])
})

/**
 * An unsized anchor takes no part of an hour, and that is deliberate. Its real
 * length is unknown, `capacity.ts` has refused to invent one since v1.0, and an
 * hour painted as gone on a guessed half hour is exactly the kind of claim that
 * makes a planner stop being believed.
 */
test('a timed task with no length paints nothing, because nobody knows how long it is', () => {
  expect(takenBlocks([task({ time: '09:00' })], DEFAULT_CATEGORIES)).toEqual([])
})

test("somebody else's meeting takes the hour a task would, and carries no colour", () => {
  const blocks = takenBlocks([], DEFAULT_CATEGORIES, [{ start: 600, end: 660 }])
  expect(blocks).toEqual([{ start: 600, end: 660 }])
  expect(hourCover(blocks)[10].saying).toBe('10, taken')
})

// --- where the column opens -----------------------------------------------

/**
 * Three answers in order, and the first one that exists wins: the value the
 * field is holding, the first free stretch after the last block of the day,
 * the hour the day wakes. Midnight was the old answer to all three, which is
 * seven flicks of a thumb past hours nobody plans in.
 */
test('the value the field is already holding is where the column opens', () => {
  expect(openingHour('14:30', [at('09:00', '10:00')], 7 * 60)).toBe(14)
})

test('with nothing set, it opens on the first free stretch after the last block', () => {
  expect(openingHour('', [at('07:00', '08:00'), at('09:00', '10:30')], 7 * 60)).toBe(10)
})

test('a day with nothing on it opens at the hour it wakes', () => {
  expect(openingHour('', [], 7 * 60)).toBe(7)
})

// Waking is a floor on the free stretch too. A stray task logged for two in
// the morning is the last block of the day by the clock, and opening there
// would be the arithmetic being right about a question nobody asked.
test('a task in the small hours does not drag the column down there', () => {
  expect(openingHour('', [at('01:00', '02:00')], 7 * 60)).toBe(7)
})

test('a day booked to the last minute opens on its last hour rather than past the end of it', () => {
  expect(openingHour('', [at('22:00', '24:00')], 7 * 60)).toBe(23)
})

// A caller with no day behind it - Settings' sleep window - passes nothing and
// gets midnight, which is where this control has always opened.
test('a field with no day behind it opens where it always did', () => {
  expect(openingHour('', [], 0)).toBe(0)
})

/**
 * What a candidate would run into. Half-open on both sides, so a day that
 * runs block to block with no air in it is a day, not a pile of collisions.
 */
const MORNING = [
  { id: 'shower', start: 420, end: 450 },
  { id: 'deep', start: 540, end: 660 },
]

test('a candidate over a block names that block', () => {
  expect(crossedBy({ start: 600, end: 630 }, MORNING)).toEqual(['deep'])
})

test('a candidate that only touches a block edge names nothing', () => {
  expect(crossedBy({ start: 660, end: 690 }, MORNING)).toEqual([])
  expect(crossedBy({ start: 510, end: 540 }, MORNING)).toEqual([])
})

test('a candidate across two blocks names both', () => {
  expect(crossedBy({ start: 400, end: 700 }, MORNING)).toEqual(['shower', 'deep'])
})

test('a candidate with no length crosses nothing, however it is placed', () => {
  expect(crossedBy({ start: 600, end: 600 }, MORNING)).toEqual([])
})

test('an empty day has nothing to run into', () => {
  expect(crossedBy({ start: 600, end: 660 }, [])).toEqual([])
})
