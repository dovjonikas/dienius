import { expect, test } from 'vitest'
import { applyStamps, refreshFromTemplate } from './stamping'
import { recipeForDate } from './kitchen'
import { blockCounts } from './blockCounts'
import { planReading } from './planReading'
import { defaultData, exportJson, importJson, validate } from './storage'
import { validate as validateV228 } from './fixtures/validate-v2.28'
import type { DayPlan, Task, Template } from './types'

/**
 * The night's own hours - docs/RESEARCH-SHIFTS.md section 10. A block marked
 * after midnight is written in the template it belongs to and lands on the
 * next date, as that date's task, marked with the night it came from. These
 * are the stamp's rules for it; the composition's are in nightCompose.test.ts.
 * Every name here is a generic one.
 */

const NIGHT: Template = {
  id: 'night',
  name: 'Night shift',
  color: '#c9b3f0',
  blocks: [
    { id: 'shift', time: '22:00', title: 'On shift', minutes: 540 },
    { id: 'meal', time: '01:00', title: 'Night meal', minutes: 30, afterMidnight: true },
    { id: 'home', time: '07:00', title: 'Drive home', minutes: 30, afterMidnight: true },
  ],
}

const DAY: Template = {
  id: 'day',
  name: 'Day shift',
  color: '#a7c4f5',
  blocks: [{ id: 'work', time: '07:00', title: 'At work', minutes: 480 }],
}

const REST: Template = { id: 'rest', name: 'Rest day', color: '#b8e0c8', blocks: [{ id: 'walk', time: '10:00', title: 'Walk' }] }

const TEMPLATES = [NIGHT, DAY, REST]
const MON = '2026-11-02'
const TUE = '2026-11-03'
const WED = '2026-11-04'

const titles = (day: DayPlan | undefined) => (day?.tasks ?? []).map(t => t.title).sort()
const byTitle = (day: DayPlan | undefined, title: string): Task | undefined => day?.tasks.find(t => t.title === title)

test('a date given a template keeps its own blocks, and its hours after midnight land on the next date, marked with the night', () => {
  const days = applyStamps({}, TEMPLATES, { [MON]: 'night' })
  expect(titles(days[MON])).toEqual(['On shift'])
  expect(titles(days[TUE])).toEqual(['Drive home', 'Night meal'])
  expect(byTitle(days[TUE], 'Night meal')).toMatchObject({
    time: '01:00',
    minutes: 30,
    done: false,
    fromTemplate: true,
    nightOf: MON,
    origin: { type: 'template', sourceId: 'night', blockId: 'meal' },
    fromBlock: { title: 'Night meal', time: '01:00', minutes: 30 },
  })
  // The next date is not given a template by the night: it is not stamped.
  expect(days[TUE].templateId).toBeUndefined()
})

test('a template with no hours after midnight writes nothing onto the next date, and makes no day of it', () => {
  const days = applyStamps({}, TEMPLATES, { [MON]: 'day' })
  expect(days[TUE]).toBeUndefined()
})

test("stamping the same template again keeps the night's tasks where they are, tick and id, and adds none", () => {
  const once = applyStamps({}, TEMPLATES, { [MON]: 'night' })
  const meal = byTitle(once[TUE], 'Night meal')!
  const ticked = { ...once, [TUE]: { ...once[TUE], tasks: once[TUE].tasks.map(t => (t.id === meal.id ? { ...t, done: true } : t)) } }
  const twice = applyStamps(ticked, TEMPLATES, { [MON]: 'night' })
  expect(twice[TUE].tasks).toHaveLength(2)
  expect(byTitle(twice[TUE], 'Night meal')).toMatchObject({ id: meal.id, done: true, nightOf: MON })
})

test("a date given another template takes its night off the next date, and gives it the new one's", () => {
  const nights = applyStamps({}, TEMPLATES, { [MON]: 'night' })
  const withOwn = { ...nights, [TUE]: { ...nights[TUE], tasks: [...nights[TUE].tasks, { id: 'mine', title: 'Written by hand', done: false }] } }
  const day = applyStamps(withOwn, TEMPLATES, { [MON]: 'day' })
  expect(titles(day[TUE])).toEqual(['Written by hand'])

  const late: Template = { ...REST, id: 'late', blocks: [{ id: 'film', time: '00:30', title: 'Late film', afterMidnight: true }] }
  const other = applyStamps(nights, [...TEMPLATES, late], { [MON]: 'late' })
  expect(titles(other[TUE])).toEqual(['Late film'])
  expect(byTitle(other[TUE], 'Late film')?.nightOf).toBe(MON)
})

test("taking a date's template off takes its night off the next date, and nothing else", () => {
  const nights = applyStamps({}, TEMPLATES, { [MON]: 'night', [TUE]: 'rest' })
  expect(titles(nights[TUE])).toEqual(['Drive home', 'Night meal', 'Walk'])
  const off = applyStamps(nights, TEMPLATES, { [MON]: null })
  expect(off[MON].templateId).toBeUndefined()
  expect(titles(off[TUE])).toEqual(['Walk'])
  expect(off[TUE].templateId).toBe('rest')
})

test("the next date's own stamp keeps last night's tasks, whatever it is stamped with and whatever it was", () => {
  const nights = applyStamps({}, TEMPLATES, { [MON]: 'night' })
  // A second night after the first: its own shift, the first night's hours,
  // and its own hours on the date after.
  const second = applyStamps(nights, TEMPLATES, { [TUE]: 'night' })
  expect(titles(second[TUE])).toEqual(['Drive home', 'Night meal', 'On shift'])
  expect(second[TUE].tasks.filter(t => t.nightOf === MON)).toHaveLength(2)
  expect(titles(second[WED])).toEqual(['Drive home', 'Night meal'])
  expect(second[WED].tasks.every(t => t.nightOf === TUE)).toBe(true)
  // Stamped again with something else, and taken off: last night stays.
  const rest = applyStamps(second, TEMPLATES, { [TUE]: 'rest' })
  expect(rest[TUE].tasks.filter(t => t.nightOf === MON)).toHaveLength(2)
  expect(titles(rest[WED])).toEqual([])
  const bare = applyStamps(rest, TEMPLATES, { [TUE]: null })
  expect(titles(bare[TUE])).toEqual(['Drive home', 'Night meal'])
})

test('both dates of a run stamped in one go, in either order, come out the same', () => {
  const forward = applyStamps({}, TEMPLATES, { [MON]: 'night', [TUE]: 'night' })
  const backward = applyStamps({}, TEMPLATES, { [TUE]: 'night', [MON]: 'night' })
  const shape = (days: Record<string, DayPlan>) =>
    Object.fromEntries(Object.entries(days).map(([date, day]) => [date, day.tasks.map(t => `${t.title}|${t.nightOf ?? ''}`).sort()]))
  expect(shape(forward)).toEqual(shape(backward))
  expect(forward[TUE].tasks.filter(t => t.nightOf === MON).map(t => t.title).sort()).toEqual(['Drive home', 'Night meal'])
  expect(forward[WED].tasks.filter(t => t.nightOf === TUE).map(t => t.title).sort()).toEqual(['Drive home', 'Night meal'])
})

test("a task of the night's block already on the next date, pushed there by hand, is taken for the night's rather than doubled", () => {
  const pushed: Task = {
    id: 'pushed',
    title: 'Night meal',
    time: '01:00',
    done: false,
    pushCount: 1,
    origin: { type: 'template', sourceId: 'night', blockId: 'meal' },
  }
  const days = applyStamps({ [TUE]: { date: TUE, tasks: [pushed] } }, TEMPLATES, { [MON]: 'night' })
  const meals = days[TUE].tasks.filter(t => t.title === 'Night meal')
  expect(meals).toHaveLength(1)
  expect(meals[0]).toMatchObject({ id: 'pushed', nightOf: MON, fromTemplate: true, pushCount: 1 })
})

test("a night's meal takes the recipe its night's date gives it in the block's walk", () => {
  const walking: Template = {
    ...NIGHT,
    blocks: [{ id: 'meal', time: '01:00', title: 'Night meal', category: 'meal', recipeIds: ['soup', 'stew', 'rice'], afterMidnight: true }],
  }
  const days = applyStamps({}, [walking], { [MON]: 'night', [TUE]: 'night' })
  expect(byTitle(days[TUE], 'Night meal')?.recipeId).toBe(recipeForDate(['soup', 'stew', 'rice'], MON))
  expect(byTitle(days[WED], 'Night meal')?.recipeId).toBe(recipeForDate(['soup', 'stew', 'rice'], TUE))
  expect(recipeForDate(['soup', 'stew', 'rice'], MON)).not.toBe(recipeForDate(['soup', 'stew', 'rice'], TUE))
})

test("the night's key blocks share the next date's three with what is already key there", () => {
  const keyed: Template = {
    ...NIGHT,
    blocks: [
      { id: 'a', time: '00:30', title: 'First', highlight: true, afterMidnight: true },
      { id: 'b', time: '02:00', title: 'Second', highlight: true, afterMidnight: true },
    ],
  }
  const own: Task[] = [
    { id: 'k1', title: 'Key one', done: false, highlight: true },
    { id: 'k2', title: 'Key two', done: false, highlight: true },
  ]
  const days = applyStamps({ [TUE]: { date: TUE, tasks: own } }, [keyed], { [MON]: 'night' })
  expect(days[TUE].tasks.filter(t => t.highlight).map(t => t.title).sort()).toEqual(['First', 'Key one', 'Key two'])
})

test("opening the next date brings a night's task up to its block, with its night's recipe", () => {
  const walking: Template = {
    ...NIGHT,
    blocks: [{ id: 'meal', time: '01:00', title: 'Night meal', category: 'meal', recipeIds: ['soup', 'stew'], afterMidnight: true }],
  }
  const days = applyStamps({}, [walking], { [MON]: 'night' })
  const moved: Template = { ...walking, blocks: [{ ...walking.blocks[0], time: '01:30', note: 'Warm it first' }] }
  const refreshed = refreshFromTemplate(days[TUE], [moved], [])!
  expect(byTitle(refreshed, 'Night meal')).toMatchObject({ time: '01:30', note: 'Warm it first', recipeId: recipeForDate(['soup', 'stew'], MON) })
})

// --- the readers: a night's block is found on the date after its night -----------------------

test('the block counts find a night block done on the date after its night, and a second night of a run as its own', () => {
  const data = defaultData()
  data.templates = TEMPLATES
  // One night, its meal done on the morning after, which is a rest day.
  data.days = applyStamps({}, TEMPLATES, { [MON]: 'night', [TUE]: 'rest' })
  const tick = (date: string, night: string) =>
    (data.days[date] = { ...data.days[date], tasks: data.days[date].tasks.map(t => (t.nightOf === night && t.title === 'Night meal' ? { ...t, done: true } : t)) })
  tick(TUE, MON)
  expect(blockCounts(data, WED).find(c => c.blockId === 'meal')).toMatchObject({ days: 1, last7: 1, last30: 1 })

  // Two nights, and only the second one's meal done: it is the second night's.
  data.days = applyStamps({}, TEMPLATES, { [MON]: 'night', [TUE]: 'night' })
  tick(WED, TUE)
  expect(blockCounts(data, WED).find(c => c.blockId === 'meal')).toMatchObject({ days: 2, last7: 1, last30: 1 })
})

test('the plan reading finds a night block on the date after its night, moved where it was moved', () => {
  const data = defaultData()
  data.templates = TEMPLATES
  data.days = applyStamps({}, TEMPLATES, { [MON]: 'night' })
  data.days[TUE] = {
    ...data.days[TUE],
    tasks: data.days[TUE].tasks.map(t => (t.title === 'Night meal' ? { ...t, time: '01:30', done: true } : t.title === 'Drive home' ? { ...t, done: true } : t)),
  }
  const readings = planReading(data, [MON], WED)
  expect(readings.find(r => r.blockId === 'meal')).toMatchObject({ days: 1, movedLater: 1, avgLater: 30 })
  expect(readings.find(r => r.blockId === 'home')).toMatchObject({ days: 1, atTime: 1 })
})

// --- the data: two optional fields, and an older device -------------------------------------

function nightPlan() {
  const data = defaultData()
  data.templates = TEMPLATES
  data.days = applyStamps({}, TEMPLATES, { [MON]: 'night' })
  return data
}

const fileOf = (data: ReturnType<typeof defaultData>) => JSON.parse(exportJson(data)) as {
  templates: { blocks: Record<string, unknown>[] }[]
  days: Record<string, { tasks: Record<string, unknown>[] }>
}

test("a block after midnight and a night's task survive export and re-import, and the file is the plan again", () => {
  const data = nightPlan()
  const text = exportJson(data)
  const back = importJson(text)
  expect(back.templates[0].blocks[1].afterMidnight).toBe(true)
  expect(back.days[TUE].tasks.every(t => t.nightOf === MON)).toBe(true)
  expect(exportJson(back)).toBe(text)
})

test("the guard takes a block's after midnight as yes or no and a task's night as a date's text, and refuses anything else", () => {
  expect(validate(fileOf(nightPlan()))).toBe(true)
  const badBlock = fileOf(nightPlan())
  badBlock.templates[0].blocks[1].afterMidnight = 'yes'
  expect(validate(badBlock)).toBe(false)
  const badTask = fileOf(nightPlan())
  badTask.days[TUE].tasks[0].nightOf = 5
  expect(validate(badTask)).toBe(false)
})

test("v2.28's validation, the oldest a device may still run, accepts a plan with both fields", () => {
  expect(validateV228(fileOf(nightPlan()))).toBe(true)
})

test("stamping a date with its own template again keeps last night's tasks, even one with the title and time of a block of its own", () => {
  // A plain template whose own block and night block share a name and an hour:
  // one at one in the morning of its date, one at one in the morning after.
  const checks: Template = {
    id: 'checks',
    name: 'Night checks',
    color: '#c9b3f0',
    blocks: [
      { id: 'early', time: '01:00', title: 'Check in' },
      { id: 'late', time: '01:00', title: 'Check in', afterMidnight: true },
    ],
  }
  const both = applyStamps({}, [checks], { [MON]: 'checks', [TUE]: 'checks' })
  // Tuesday's own check was deleted by hand; last night's stays.
  const deleted = { ...both, [TUE]: { ...both[TUE], tasks: both[TUE].tasks.filter(t => t.nightOf === MON) } }
  const again = applyStamps(deleted, [checks], { [TUE]: 'checks' })
  expect(again[TUE].tasks.filter(t => t.nightOf === MON)).toHaveLength(1)
  expect(again[TUE].tasks.filter(t => !t.nightOf)).toHaveLength(1)
})
