import { beforeEach, expect, test } from 'vitest'
import { actions, getData } from './store'
import { applyRoster } from './shiftDay'
import { defaultData } from './storage'
import { addDays, todayKey } from './dates'
import type { AppData, Routine, Task, Template } from './types'

/**
 * The night's own hours through the doors a person uses - docs/RESEARCH-SHIFTS.md
 * section 10: a night's task carried to another date by hand is that date's own
 * from then on, and a kind stamped by hand or taken off by an ordinary template
 * is followed by the dates around it. Every name here is a generic one.
 */

const KIND = (id: string, name: string, letter: string, order: number, blocks: Template['blocks']): Template =>
  ({ id, name, color: '#a7c4f5', blocks, dayKind: { letter, order } }) as Template

const NIGHT = KIND('night', 'Night shift', 'N', 0, [
  { id: 'shift', time: '22:00', title: 'On shift', minutes: 540 },
  { id: 'meal', time: '01:00', title: 'Night meal', minutes: 30, afterMidnight: true },
  { id: 'home', time: '07:00', title: 'Drive home', minutes: 30, afterMidnight: true },
])
const REST = KIND('rest', 'Rest day', 'R', 1, [])
const PLAIN: Template = { id: 'plain', name: 'Working day', color: '#a7e3bd', blocks: [{ id: 'desk', time: '09:00', title: 'Deep work', minutes: 120 }] }

const TRAINING: Routine = { id: 'gym', title: 'Training', minutes: 45, weekdays: [0, 1, 2, 3, 4, 5, 6], times: { rest: '07:15' } } as Routine

// Tomorrow and the days after it: in reach of every door.
const D1 = addDays(todayKey(), 1)
const D2 = addDays(todayKey(), 2)
const D3 = addDays(todayKey(), 3)

function plan(): AppData {
  const data = defaultData()
  data.templates = [NIGHT, REST, PLAIN]
  data.routines = [TRAINING]
  return data
}

const find = (date: string, title: string): Task | undefined => getData().days[date]?.tasks.find(t => t.title === title)

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(applyRoster(plan(), { [D1]: 'night', [D2]: 'rest' }, todayKey()))
})

test("the night's hours are on the morning after, and the routine there runs into them", () => {
  expect(find(D2, 'Night meal')?.nightOf).toBe(D1)
  expect(find(D2, 'Training')?.time).toBeUndefined()
})

test("a night's task pushed on to the date after is that date's own there, without the mark", () => {
  const meal = find(D2, 'Night meal')!
  expect(actions.pushTask(D2, meal.id)).toBe(true)
  const pushed = find(D3, 'Night meal')!
  expect(pushed.nightOf).toBeUndefined()
  expect(pushed.pushCount).toBe(1)
})

test("a night's task left undone is carried on by the evening's push, without the mark, to a date whose own night does not bring it", () => {
  // The day after the rest day is a night shift of its own: its night's meal
  // lands on the date after it, so it does not bring this one.
  actions.resetForTests(applyRoster(plan(), { [D1]: 'night', [D2]: 'rest', [D3]: 'night' }, todayKey()))
  actions.rolloverUnfinished(D2)
  const carried = getData().days[D3].tasks.filter(t => t.title === 'Night meal')
  expect(carried).toHaveLength(1)
  expect(carried[0].nightOf).toBeUndefined()
})

test("a night's task moved to another date by hand is that date's own there", () => {
  const home = find(D2, 'Drive home')!
  expect(actions.moveTaskToDay(D2, D3, home.id)).toBe(true)
  expect(find(D3, 'Drive home')?.nightOf).toBeUndefined()
})

test('a kind stamped by hand from the month is followed by the dates around it', () => {
  actions.resetForTests(applyRoster(plan(), { [D2]: 'rest' }, todayKey()))
  expect(find(D2, 'Training')?.time).toBe('07:15')
  actions.stamp({ [D1]: 'night' })
  expect(find(D2, 'Night meal')?.nightOf).toBe(D1)
  expect(find(D2, 'Training')?.time).toBeUndefined()
})

test('a kind taken off by an ordinary template takes its night with it, and the dates around it follow', () => {
  actions.stamp({ [D1]: 'plain' })
  expect(getData().days[D1].templateId).toBe('plain')
  expect(find(D2, 'Night meal')).toBeUndefined()
  expect(find(D2, 'Training')?.time).toBe('07:15')
})

test("a template made with a block after midnight keeps it", () => {
  const made = actions.addTemplate({
    name: 'Late shift',
    color: '#c9b3f0',
    blocks: [{ title: 'Snack', time: '00:30', afterMidnight: true }],
  })
  expect(getData().templates.find(t => t.id === made.id)?.blocks[0].afterMidnight).toBe(true)
})
