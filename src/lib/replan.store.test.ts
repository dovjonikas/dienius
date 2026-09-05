import { beforeEach, expect, test } from 'vitest'
import { actions, getData } from './store'
import { defaultData } from './storage'
import { addDays, todayKey, weekOf } from './dates'
import { weekdayOf } from './repeats'
import { planWeekStamp } from '../views/week/weekStamp'
import { findConflicts, planInterrupt, planShift } from '../widgets/day-plan/replan'
import { dayWordsFor, defaultChoices } from '../widgets/day-plan/interrupt'

const WINDOW = { start: 7 * 60, end: 23 * 60 }
const TODAY = todayKey()
/** Two days from now - far enough that nothing has opened it, near enough to be in the week row. */
const SOON = addDays(TODAY, 2)
const DAD = { title: 'Dad', start: 13 * 60, minutes: 5 * 60 }

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
})

function mapTemplateOnto(date: string) {
  const template = actions.addTemplate({
    name: 'Workday',
    color: '#a7c4f5',
    blocks: [
      { time: '08:00', title: 'Commute', minutes: 30 },
      { time: '09:00', title: 'Deep work', minutes: 120 },
      { time: '13:30', title: 'Meetings', minutes: 90 },
      { time: '16:00', title: 'Email', minutes: 60 },
    ],
  })
  actions.setWeekdayTemplate(weekdayOf(date), template.id)
  return template
}

/** What the sheet does when a day is chosen: opens it, then plans against what is there. */
function planAfternoonGone(date: string) {
  actions.ensureDay(date)
  const tasks = getData().days[date].tasks
  const conflicts = findConflicts(tasks, DAD)
  return planInterrupt(tasks, DAD, defaultChoices(conflicts), WINDOW, [], { from: WINDOW.start, words: dayWordsFor(date, TODAY) })
}

/**
 * An interruption landing on a day nobody has opened. Choosing the day in
 * the sheet opens it - its weekday template, exactly as looking at it would
 * - and the plan goes onto that day, so opening it later shows what was
 * accepted rather than a template stamped over a note.
 */
test('a replan on a day nobody opened lands on the day its template makes, with the routine blocks it hits skipped', () => {
  const template = mapTemplateOnto(SOON)
  expect(getData().days[SOON]).toBeUndefined()

  const plan = planAfternoonGone(SOON)
  expect(plan.drop).toHaveLength(2)
  expect(plan.summary).toContain('Skipped')
  expect(plan.summary).not.toContain('Dropped')

  actions.applyReplan(SOON, plan)
  const day = getData().days[SOON]
  expect(day.templateId).toBe(template.id)
  expect(day.autoApplied).toBe(true)
  expect(day.replannedOn).toBe(TODAY)
  expect(day.tasks.map(t => `${t.title}@${t.time}`)).toEqual(['Commute@08:00', 'Deep work@09:00', 'Dad@13:00'])
})

/**
 * The belt to that pair of braces: a plan that reaches a day nobody opened
 * still lands on the day its template makes, because applying opens it
 * first. Only a plan that names no task can arrive that way - anything else
 * was planned against a day that had been opened.
 */
test('applying to a day nobody opened materialises it first, in the same commit', () => {
  mapTemplateOnto(SOON)
  const plan = planInterrupt([], { title: 'Dad', start: 19 * 60, minutes: 60 }, {}, WINDOW, [], { from: WINDOW.start })
  actions.applyReplan(SOON, plan)
  const day = getData().days[SOON]
  expect(day.autoApplied).toBe(true)
  expect(day.tasks.map(t => t.title)).toEqual(['Commute', 'Deep work', 'Meetings', 'Email', 'Dad'])
})

test('opening the day afterwards changes nothing, and Stamp week leaves it alone - the replan by hand wins', () => {
  mapTemplateOnto(SOON)
  actions.applyReplan(SOON, planAfternoonGone(SOON))
  const after = getData().days[SOON]

  expect(actions.ensureDay(SOON)).toBe(false)
  expect(getData().days[SOON]).toEqual(after)

  const stamp = planWeekStamp(weekOf(SOON), getData())
  expect(stamp.stamps[SOON]).toBeUndefined()
})

test('undo puts the day back to what its template made, and takes the mark with it', () => {
  mapTemplateOnto(SOON)
  const { undo } = actions.applyReplan(SOON, planAfternoonGone(SOON))
  expect(getData().days[SOON].tasks.map(t => t.title)).toContain('Dad')
  undo()
  const day = getData().days[SOON]
  expect(day.tasks.map(t => t.title)).toEqual(['Commute', 'Deep work', 'Meetings', 'Email'])
  expect(day.replannedOn).toBeUndefined()
})

test('the other doors mark the day too - a shifted today is a replanned today', () => {
  actions.addTask(TODAY, 'Call the bank', '15:00')
  const plan = planShift(getData().days[TODAY].tasks, 14 * 60, 30, WINDOW)
  actions.applyReplan(TODAY, plan)
  expect(getData().days[TODAY].replannedOn).toBe(TODAY)
  expect(getData().days[TODAY].tasks[0].time).toBe('15:30')
})

test('a day the weekday plan says nothing about is made empty and marked, so a later mapping does not stamp over the plan', () => {
  const plan = planInterrupt([], { title: 'Dad', start: 9 * 60, minutes: 60 }, {}, WINDOW, [], { from: WINDOW.start })
  actions.applyReplan(SOON, plan)
  const day = getData().days[SOON]
  expect(day.autoApplied).toBe(true)
  expect(day.tasks.map(t => t.title)).toEqual(['Dad'])
  mapTemplateOnto(SOON)
  expect(actions.ensureDay(SOON)).toBe(false)
  expect(getData().days[SOON].tasks.map(t => t.title)).toEqual(['Dad'])
})
