import { expect, test } from 'vitest'
import type { Task } from '../../lib/types'
import { RETURN_MIN_MINUTES, RETURN_MIN_SHARE, planReturn, setAsideOf } from './setAside'

/**
 * A block that was taken off the day by a replan is not gone: it waits, and
 * it comes back when there is room. The owner's scenario, in their words -
 * replan without knowing how long ("something this evening"), take
 * something off, and that something must not disappear; it stays faded, and
 * one press brings it back when you get home.
 *
 * The arithmetic here is what "when there is room" means. The sheet only
 * shows it and asks once.
 */

const WINDOW = { start: 7 * 60, end: 23 * 60 }

let n = 0
function task(over: Partial<Task> = {}): Task {
  n += 1
  return { id: `t${n}`, title: `Task ${n}`, done: false, ...over }
}

const at = (time: string, minutes: number, over: Partial<Task> = {}) => task({ time, minutes, ...over })
const aside = (minutes: number, over: Partial<Task> = {}) => task({ minutes, setAside: true, time: '18:00', ...over })

// --- what is set aside -----------------------------------------------------

test('the set-aside blocks are the ones marked, in the order they were put down', () => {
  const day = [at('09:00', 60), aside(120, { title: 'Gym' }), at('12:00', 30), aside(30, { title: 'Reading' })]
  expect(setAsideOf(day).map(t => t.title)).toEqual(['Gym', 'Reading'])
})

test('one that has been ticked is not waiting for anything', () => {
  expect(setAsideOf([aside(60, { done: true })])).toEqual([])
})

// --- the offer -------------------------------------------------------------

test('it comes back whole in the first gap from now that holds it', () => {
  const gym = aside(60, { title: 'Gym' })
  const day = [at('19:00', 30), gym]
  const offer = planReturn(gym, day, 18 * 60 + 30, WINDOW)

  expect(offer).toMatchObject({ time: '19:30', minutes: 60, shortened: false, tomorrow: false })
  expect(offer.line).toBe('19:30 - 20:30')
})

test('never before now: a gap that started an hour ago is not a gap', () => {
  const gym = aside(60, { title: 'Gym' })
  const day = [at('08:00', 30), gym]
  const offer = planReturn(gym, day, 20 * 60, WINDOW)
  expect(offer.time).toBe('20:00')
})

test('with less room than it wants, it comes back shorter and says so in one line', () => {
  const gym = aside(120, { title: 'Gym' })
  const offer = planReturn(gym, [gym], 22 * 60, WINDOW)

  expect(offer).toMatchObject({ time: '22:00', minutes: 60, wasMinutes: 120, shortened: true, tomorrow: false })
  expect(offer.line).toBe('22:00 - 23:00, 2h shortened to 1h - that is what is left')
})

test('under a quarter of an hour is not a sitting, so it waits for tomorrow', () => {
  expect(RETURN_MIN_MINUTES).toBe(15)
  const gym = aside(60, { title: 'Gym' })
  const offer = planReturn(gym, [gym], 22 * 60 + 50, WINDOW)
  expect(offer).toMatchObject({ tomorrow: true, shortened: false })
  expect(offer.line).toBe('Tomorrow, at the time it had')
})

test('under half of what it was is not that block any more, so it waits too', () => {
  expect(RETURN_MIN_SHARE).toBe(0.5)
  const deep = aside(120, { title: 'Deep work' })
  // Fifty minutes left: over the floor, under half of two hours.
  const offer = planReturn(deep, [deep], 22 * 60 + 10, WINDOW)
  expect(offer.tomorrow).toBe(true)
})

test('exactly half is still that block', () => {
  const deep = aside(120, { title: 'Deep work' })
  const offer = planReturn(deep, [deep], 22 * 60, WINDOW)
  expect(offer).toMatchObject({ minutes: 60, tomorrow: false, shortened: true })
})

test('a block with no length asks for the half hour every unsized task is read as', () => {
  const thing = task({ setAside: true, title: 'Call the plumber' })
  const offer = planReturn(thing, [thing], 20 * 60, WINDOW)
  expect(offer).toMatchObject({ time: '20:00', tomorrow: false })
  expect(offer.minutes).toBeUndefined()
})

test('the day being full to bedtime sends it to tomorrow rather than squeezing it in', () => {
  const gym = aside(60, { title: 'Gym' })
  const day = [at('20:00', 180), gym]
  const offer = planReturn(gym, day, 20 * 60, WINDOW)
  expect(offer.tomorrow).toBe(true)
})

test('the offer never counts what was missed, in any wording', () => {
  const gym = aside(120, { title: 'Gym' })
  for (const now of [18 * 60, 22 * 60, 22 * 60 + 50]) {
    const offer = planReturn(gym, [gym], now, WINDOW)
    expect(offer.line).not.toMatch(/missed|fail|behind|unfinished|only|still|but|%/i)
  }
})

// 9. The score counts a block once. Waiting, returned, or moved, it is the
// same block with the same id - see CONVENTIONS section 12's eleven rules.
test('a block that waits and comes back is the same block, not a second one', () => {
  const gym = aside(60, { title: 'Gym' })
  const offer = planReturn(gym, [gym], 18 * 60, WINDOW)
  expect(offer.taskId).toBe(gym.id)
})

// 11. Twice is once. Asking for the same offer twice gives the same answer,
// because nothing about the day has changed by asking.
test('asking twice gives the same offer', () => {
  const gym = aside(60, { title: 'Gym' })
  const day = [at('19:00', 30), gym]
  expect(planReturn(gym, day, 18 * 60 + 30, WINDOW)).toEqual(planReturn(gym, day, 18 * 60 + 30, WINDOW))
})
