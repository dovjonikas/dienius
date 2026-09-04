import { expect, test } from 'vitest'
import { rolloverSplit } from './rollover'
import { defaultData } from '../../lib/storage'
import type { AppData, Task } from '../../lib/types'

const DATE = '2026-09-01'
const TOMORROW = '2026-09-02'

function task(patch: Partial<Task> = {}): Task {
  return { id: `t${Math.random()}`, title: 'Thing', done: false, ...patch }
}

function state(patch: Partial<AppData> = {}): AppData {
  return { ...defaultData(), ...patch }
}

/**
 * The counts behind the push button's sentence. Extracted from DayView with
 * the rest of the task column; these pin the three-way split it always made,
 * which no test reached directly while it was inline arithmetic.
 */

test('an ordinary unfinished task is one the button would move', () => {
  const split = rolloverSplit(state(), DATE, [task()])
  expect(split).toEqual({ pushable: 1, held: 0, covered: 0 })
})

test('finished tasks are not counted at all', () => {
  const split = rolloverSplit(state(), DATE, [task({ done: true }), task()])
  expect(split.pushable).toBe(1)
})

test('a task already at the push bound is held, not pushable', () => {
  const split = rolloverSplit(state(), DATE, [task({ pushCount: 2 })])
  expect(split).toEqual({ pushable: 0, held: 1, covered: 0 })
})

// The distinction the button's sentence exists for: a routine task is not
// "staying here", it is arriving tomorrow by itself, and calling it held would
// say something untrue about it.
test('a repeat instance is covered rather than held - tomorrow gets it anyway', () => {
  const split = rolloverSplit(state(), DATE, [task({ repeatOf: 'r1', origin: { type: 'repeat', sourceId: 'r1' } })])
  expect(split).toEqual({ pushable: 0, held: 0, covered: 1 })
})

// The source of a series is a manual task with repeat set. It was pushed
// like any one-off, and tomorrow held it twice: the instance the series had
// made, and the source arriving with a push count.
test('the source of a series that reaches tomorrow is covered, like its instances', () => {
  const split = rolloverSplit(state(), DATE, [task({ repeat: 'daily' })])
  expect(split).toEqual({ pushable: 0, held: 0, covered: 1 })
})

test('a weekly source whose series skips tomorrow is pushable like any other', () => {
  // DATE is a Tuesday; a weekly series from it next lands on the Tuesday after.
  const split = rolloverSplit(state(), DATE, [task({ repeat: 'weekly' })])
  expect(split).toEqual({ pushable: 1, held: 0, covered: 0 })
})

test('a template task tomorrow already has is covered', () => {
  const data = state({
    days: {
      [TOMORROW]: {
        date: TOMORROW,
        tasks: [task({ id: 'x', title: 'Commute', origin: { type: 'template', sourceId: 'tpl', blockId: 'b1' } })],
      },
    },
  })
  const today = [task({ title: 'Commute', origin: { type: 'template', sourceId: 'tpl', blockId: 'b1' } })]
  expect(rolloverSplit(data, DATE, today).covered).toBe(1)
})

test('the same task on a day tomorrow does not have is pushable like any other', () => {
  const today = [task({ title: 'Commute', origin: { type: 'template', sourceId: 'tpl', blockId: 'b1' } })]
  expect(rolloverSplit(state(), DATE, today).pushable).toBe(1)
})

test('an empty day splits into nothing rather than into zeroes that mean something', () => {
  expect(rolloverSplit(state(), DATE, [])).toEqual({ pushable: 0, held: 0, covered: 0 })
})
