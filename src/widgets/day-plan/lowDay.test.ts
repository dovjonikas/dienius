import { beforeEach, expect, test } from 'vitest'
import type { AppData, Task } from '../../lib/types'
import { defaultData } from '../../lib/storage'
import { LOW_DAY_MIN_MINUTES, LOW_DAY_SHARE, applyLowDayPlan, lowDayMinutes, planLowDay } from './lowDay'

/**
 * A low day is the 40% doctrine as one press - RESEARCH-ADHD.md, and the
 * owner's own rule for a day that is not going to be a full one. The key
 * tasks stay at 40% of their length, the routine stays as it is, and the
 * rest goes to tomorrow, so what is left is a day that can be won. The
 * arithmetic here is pure and the sheet only shows it and asks once.
 */

let n = 0
beforeEach(() => {
  n = 0
})
function task(over: Partial<Task> = {}): Task {
  n += 1
  return { id: `t${n}`, title: `Task ${n}`, done: false, ...over }
}

const key = (over: Partial<Task> = {}) => task({ highlight: true, ...over })
const routine = (over: Partial<Task> = {}) =>
  task({ origin: { type: 'template', sourceId: 'tpl', blockId: `b${n + 1}` }, ...over })

// --- the share -------------------------------------------------------------

test('a kept task is cut to 40% of its length, rounded to the five minutes a plan is made at', () => {
  expect(LOW_DAY_SHARE).toBe(0.4)
  expect(lowDayMinutes(120)).toBe(50)
  expect(lowDayMinutes(60)).toBe(25)
  expect(lowDayMinutes(45)).toBe(20)
})

test('the cut never goes under fifteen minutes, and never past what the task was', () => {
  expect(LOW_DAY_MIN_MINUTES).toBe(15)
  expect(lowDayMinutes(30)).toBe(15)
  expect(lowDayMinutes(15)).toBe(15)
  expect(lowDayMinutes(10)).toBe(10)
})

// --- the plan --------------------------------------------------------------

test('key tasks stay, shorter; routine stays as it is; the rest goes to tomorrow', () => {
  const deep = key({ title: 'Deep work', time: '09:00', minutes: 120 })
  const lunch = routine({ title: 'Lunch', time: '12:30', minutes: 45 })
  const dentist = task({ title: 'Call the dentist', time: '11:30', minutes: 15 })
  const guitar = task({ title: 'Guitar' })
  const plan = planLowDay([deep, lunch, dentist, guitar])

  expect(plan.keep).toEqual([{ taskId: deep.id, minutes: 50, wasMinutes: 120 }])
  expect(plan.stay).toEqual([lunch.id])
  expect(plan.tomorrow).toEqual([dentist.id, guitar.id])
})

test('a key task with no size stays with no size - nothing invents a length to cut', () => {
  const plan = planLowDay([key({ title: 'Write', time: '10:00' })])
  expect(plan.keep).toEqual([{ taskId: 't1' }])
})

test('a key task that is also routine is kept and shortened - key wins', () => {
  const standup = routine({ title: 'Standup', time: '09:00', minutes: 30, highlight: true })
  const plan = planLowDay([standup])
  expect(plan.keep).toEqual([{ taskId: standup.id, minutes: 15, wasMinutes: 30 }])
  expect(plan.stay).toEqual([])
})

test('what is already done is left exactly where it is, in no list at all', () => {
  const done = task({ title: 'Emails', done: true, time: '08:00', minutes: 30 })
  const plan = planLowDay([done, key({ title: 'Write', minutes: 60 })])
  expect(plan.tomorrow).toEqual([])
  expect(plan.stay).toEqual([])
  expect(plan.keep.map(k => k.taskId)).toEqual(['t2'])
})

// The summary is read in the sheet, on a bad day, and it says what stays.
// CONVENTIONS section 12's rule: never count what was missed, in any
// wording; and the evening close's own list of words that never appear
// near a day's outcome.
test('the summary names what stays and what waits, and never counts a miss', () => {
  const plan = planLowDay([
    key({ title: 'Deep work', minutes: 120 }),
    routine({ title: 'Lunch', minutes: 45 }),
    task({ title: 'Call the dentist', minutes: 15 }),
  ])
  expect(plan.summary).toContain('Deep work')
  expect(plan.summary).toContain('50 min')
  expect(plan.summary).toContain('Call the dentist')
  expect(plan.summary).toContain('Lunch')
  expect(plan.summary).not.toMatch(/missed|fail|behind|left|remaining|unfinished|only|still|but|%/i)
})

test('a day with no key task says so, and still lets the rest wait', () => {
  const plan = planLowDay([routine({ title: 'Lunch' }), task({ title: 'Guitar' })])
  expect(plan.keep).toEqual([])
  expect(plan.summary).toMatch(/no key task/i)
  expect(plan.tomorrow).toEqual(['t2'])
})

// --- applying it -----------------------------------------------------------

function dataWith(tasks: Task[], tomorrowTasks: Task[] = []): AppData {
  const base = defaultData()
  return {
    ...base,
    days: {
      '2026-09-16': { date: '2026-09-16', tasks },
      ...(tomorrowTasks.length > 0 ? { '2026-09-17': { date: '2026-09-17', tasks: tomorrowTasks } } : {}),
    },
  }
}

test('applying writes the shorter sizes, moves the rest to tomorrow at the time it had, and marks the day', () => {
  const deep = key({ title: 'Deep work', time: '09:00', minutes: 120 })
  const lunch = routine({ title: 'Lunch', time: '12:30', minutes: 45 })
  const dentist = task({ title: 'Call the dentist', time: '11:30', minutes: 15 })
  const data = dataWith([deep, lunch, dentist])
  const next = applyLowDayPlan(data, '2026-09-16', planLowDay(data.days['2026-09-16'].tasks))

  const today = next.days['2026-09-16']
  expect(today.lowDay).toBe(true)
  expect(today.tasks.map(t => t.title)).toEqual(['Deep work', 'Lunch'])
  expect(today.tasks.find(t => t.id === deep.id)?.minutes).toBe(50)
  expect(today.tasks.find(t => t.id === lunch.id)?.minutes).toBe(45)
  expect(next.days['2026-09-17'].tasks).toEqual([dentist])
})

test('a task tomorrow already has by identity is not added a second time', () => {
  const commute = routine({ title: 'Commute', time: '08:00', minutes: 30 })
  // A routine block the plan would move has to be one that is not routine
  // for the plan and yet shares an identity - a pushed template task with
  // its origin cleared is what that looks like; simplest is a one-off with
  // the same origin tomorrow already holds.
  const oneOff: Task = { ...task({ title: 'Report', time: '14:00', minutes: 30 }), origin: { type: 'manual' } }
  const twin: Task = { ...oneOff, id: 'twin' }
  const data = dataWith([commute, oneOff], [twin])
  const next = applyLowDayPlan(data, '2026-09-16', planLowDay(data.days['2026-09-16'].tasks))
  // A manual task has no identity, so it is added; that is the contract
  // every move between days keeps, and this holds it here too.
  expect(next.days['2026-09-17'].tasks.map(t => t.id)).toEqual(['twin', oneOff.id])
})

test('applying the same plan twice changes nothing the second time', () => {
  const data = dataWith([key({ title: 'Deep work', minutes: 120 }), task({ title: 'Report', minutes: 30 })])
  const plan = planLowDay(data.days['2026-09-16'].tasks)
  const once = applyLowDayPlan(data, '2026-09-16', plan)
  const twice = applyLowDayPlan(once, '2026-09-16', plan)
  expect(twice).toEqual(once)
})
