import { beforeEach, expect, test } from 'vitest'
import type { TemplateBlock } from '../lib/types'
import { blocksAsTasks, overlapsIn, templateSummary } from './templateDay'

/**
 * A template read as a day rather than as a list.
 *
 * The owner's words: when you are building a template you want to see not
 * only the items but the timeline, how each one falls, with the sleep you
 * have chosen. The point is the thing a list cannot show - how much day
 * there actually is, and whether what you have put in it fits.
 *
 * This module is the arithmetic. The drawing is TimelineGrid, unchanged,
 * because a template's day and a real day are the same picture.
 */

let n = 0
beforeEach(() => {
  n = 0
})

function block(over: Partial<TemplateBlock> = {}): TemplateBlock {
  n += 1
  return { id: `b${n}`, title: `Block ${n}`, ...over }
}

const WINDOW = { start: 7 * 60, end: 23 * 60 }

// --- the blocks as a day ---------------------------------------------------

test('a block becomes the task the grid already knows how to draw', () => {
  const tasks = blocksAsTasks([block({ time: '09:00', minutes: 120, title: 'Deep work', category: 'core', core: true })])
  expect(tasks).toEqual([
    { id: 'b1', title: 'Deep work', time: '09:00', minutes: 120, category: 'core', core: true, done: false },
  ])
})

test('a block with no time is a float, exactly as an untimed task is', () => {
  expect(blocksAsTasks([block({ title: 'Read' })])[0]).toMatchObject({ title: 'Read', done: false })
  expect(blocksAsTasks([block({ title: 'Read' })])[0].time).toBeUndefined()
})

test('only the blocks of the column being looked at, on a week template', () => {
  const week = [block({ weekday: 1, title: 'Monday thing' }), block({ weekday: 3, title: 'Wednesday thing' })]
  expect(blocksAsTasks(week, 3).map(t => t.title)).toEqual(['Wednesday thing'])
  expect(blocksAsTasks(week).map(t => t.title)).toEqual(['Monday thing', 'Wednesday thing'])
})

// --- what overlaps ---------------------------------------------------------

test('two blocks on the same half hour are named with the stretch they share', () => {
  const found = overlapsIn([
    block({ time: '09:00', minutes: 60, title: 'Deep work' }),
    block({ time: '09:30', minutes: 60, title: 'Standup' }),
  ])
  expect(found).toEqual([{ from: '09:30', to: '10:00', ids: ['b1', 'b2'] }])
})

test('blocks that only touch do not overlap - the end of one is the start of the next', () => {
  expect(overlapsIn([block({ time: '09:00', minutes: 60 }), block({ time: '10:00', minutes: 60 })])).toEqual([])
})

test('a block with no length is read as the half hour every unsized thing is', () => {
  const found = overlapsIn([block({ time: '09:00' }), block({ time: '09:15', minutes: 30 })])
  expect(found).toHaveLength(1)
})

test('an untimed block overlaps nothing, because it is nowhere yet', () => {
  expect(overlapsIn([block({ title: 'Read' }), block({ time: '09:00', minutes: 60 })])).toEqual([])
})

test('three on one stretch are one overlap naming all three', () => {
  const found = overlapsIn([
    block({ time: '09:00', minutes: 120 }),
    block({ time: '09:30', minutes: 60 }),
    block({ time: '09:45', minutes: 30 }),
  ])
  expect(found).toHaveLength(1)
  expect(found[0].ids).toEqual(['b1', 'b2', 'b3'])
})

test('two separate clashes are two lines, not one', () => {
  const found = overlapsIn([
    block({ time: '09:00', minutes: 60 }),
    block({ time: '09:30', minutes: 60 }),
    block({ time: '14:00', minutes: 60 }),
    block({ time: '14:30', minutes: 60 }),
  ])
  expect(found.map(o => o.from)).toEqual(['09:30', '14:30'])
})

// --- the one line under it -------------------------------------------------

test('the summary is the day in four numbers', () => {
  const summary = templateSummary(
    [
      block({ time: '09:00', minutes: 120, core: true }),
      block({ time: '12:30', minutes: 45 }),
      block({ time: '18:00', minutes: 60, core: true }),
    ],
    WINDOW,
  )
  expect(summary).toEqual({ timedMinutes: 225, freeMinutes: 735, sleepMinutes: 480, keyCount: 2 })
})

test('an untimed block is counted in neither the timed nor the free', () => {
  const summary = templateSummary([block({ title: 'Read' })], WINDOW)
  expect(summary.timedMinutes).toBe(0)
  expect(summary.freeMinutes).toBe(960)
})

test('overlapping blocks are counted once, so the day never adds up to more than it is', () => {
  const summary = templateSummary(
    [block({ time: '09:00', minutes: 60 }), block({ time: '09:30', minutes: 60 })],
    WINDOW,
  )
  expect(summary.timedMinutes).toBe(90)
  expect(summary.freeMinutes).toBe(870)
})

test('a template with nothing in it is a whole waking day of free time', () => {
  expect(templateSummary([], WINDOW)).toEqual({ timedMinutes: 0, freeMinutes: 960, sleepMinutes: 480, keyCount: 0 })
})
