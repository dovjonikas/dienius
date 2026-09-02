import { beforeEach, expect, test } from 'vitest'
import { actions, getData } from './store'
import { defaultData } from './storage'

// The same Wednesday-anchored week repeats.test.ts uses.
const WED = '2026-09-02'
const THU = '2026-09-03'
const FRI = '2026-09-04'
const SAT = '2026-09-05'
const NEXT_WED = '2026-09-09'

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
})

function tasks(date: string) {
  return getData().days[date]?.tasks ?? []
}

function titles(date: string) {
  return tasks(date).map(t => t.title)
}

function seedRepeating(repeat: 'daily' | 'weekdays' | 'weekly', date = WED): string {
  actions.addTask(date, 'Medication', '09:00')
  const id = tasks(date)[0].id
  actions.setTaskRepeat(date, id, repeat)
  return id
}

// --- ensureDay: repeats ---------------------------------------------------

test('opening a later day puts the repeating task on it', () => {
  seedRepeating('daily')
  actions.ensureDay(THU)
  expect(titles(THU)).toEqual(['Medication'])
})

test('opening the same day twice does not double anything', () => {
  seedRepeating('daily')
  actions.ensureDay(THU)
  expect(actions.ensureDay(THU)).toBe(false)
  expect(titles(THU)).toEqual(['Medication'])
})

test('a weekdays series lands on Friday and not on Saturday', () => {
  seedRepeating('weekdays')
  actions.ensureDay(FRI)
  actions.ensureDay(SAT)
  expect(titles(FRI)).toEqual(['Medication'])
  expect(titles(SAT)).toEqual([])
})

test('a weekly series lands on the same weekday a week later, and nowhere between', () => {
  seedRepeating('weekly')
  actions.ensureDay(THU)
  actions.ensureDay(NEXT_WED)
  expect(titles(THU)).toEqual([])
  expect(titles(NEXT_WED)).toEqual(['Medication'])
})

test('an instance is a real task - it ticks off, and the source is untouched', () => {
  const sourceId = seedRepeating('daily')
  actions.ensureDay(THU)
  actions.toggleTask(THU, tasks(THU)[0].id)
  expect(tasks(THU)[0].done).toBe(true)
  expect(tasks(WED).find(t => t.id === sourceId)!.done).toBe(false)
})

// The whole reason autoApplied is recorded rather than inferred: automatic is
// a starting point, not a rule the day is held to.
test('a day whose instance was deleted stays empty when it is opened again', () => {
  seedRepeating('daily')
  actions.ensureDay(THU)
  actions.deleteTask(THU, tasks(THU)[0].id)
  actions.ensureDay(THU)
  expect(titles(THU)).toEqual([])
})

test('deleting just this day leaves every other day alone', () => {
  seedRepeating('daily')
  actions.ensureDay(THU)
  actions.ensureDay(FRI)
  actions.deleteTask(THU, tasks(THU)[0].id, 'day')

  expect(titles(THU)).toEqual([])
  expect(titles(FRI)).toEqual(['Medication'])
  expect(tasks(WED)[0].repeat).toBe('daily')
})

test('deleting the series ends it here and ahead, and leaves days already lived alone', () => {
  const sourceId = seedRepeating('daily')
  actions.ensureDay(THU)
  actions.ensureDay(FRI)
  actions.deleteTask(THU, tasks(THU)[0].id, 'series')

  // Wednesday happened. Whatever was decided about Thursday, it still did.
  expect(titles(WED)).toEqual(['Medication'])
  expect(tasks(WED).find(t => t.id === sourceId)!.repeat).toBeUndefined()
  expect(titles(THU)).toEqual([])
  expect(titles(FRI)).toEqual([])
})

test('a series that has been ended generates nothing on a day opened afterwards', () => {
  seedRepeating('daily')
  actions.ensureDay(THU)
  actions.deleteTask(THU, tasks(THU)[0].id, 'series')
  actions.ensureDay(NEXT_WED)
  expect(titles(NEXT_WED)).toEqual([])
})

test('changing the repeat on an instance for the series changes the source too', () => {
  const sourceId = seedRepeating('daily')
  actions.ensureDay(THU)
  actions.setTaskRepeat(THU, tasks(THU)[0].id, 'weekly', 'series')
  expect(tasks(WED).find(t => t.id === sourceId)!.repeat).toBe('weekly')
})

test('changing it for just this day detaches the instance and leaves the series running', () => {
  const sourceId = seedRepeating('daily')
  actions.ensureDay(THU)
  actions.setTaskRepeat(THU, tasks(THU)[0].id, undefined, 'day')

  expect(tasks(THU)[0].repeat).toBeUndefined()
  expect(tasks(THU)[0].repeatOf).toBeUndefined()
  expect(tasks(WED).find(t => t.id === sourceId)!.repeat).toBe('daily')
})

// --- ensureDay: the weekday map ------------------------------------------

function seedTemplate(name: string) {
  return actions.addTemplate({
    name,
    color: '#a7c4f5',
    blocks: [{ time: '09:00', title: `${name} block`, minutes: 60 }],
  })
}

test('a weekday with no template starts empty, exactly as it always has', () => {
  actions.ensureDay(THU)
  expect(titles(THU)).toEqual([])
})

test('a mapped weekday opens already stamped', () => {
  const template = seedTemplate('Working day')
  actions.setWeekdayTemplate(4, template.id) // Thursday
  actions.ensureDay(THU)
  expect(titles(THU)).toEqual(['Working day block'])
  expect(getData().days[THU].templateId).toBe(template.id)
})

test('only the mapped weekday is stamped', () => {
  const template = seedTemplate('Working day')
  actions.setWeekdayTemplate(4, template.id)
  actions.ensureDay(FRI)
  expect(titles(FRI)).toEqual([])
})

// A deliberate choice outranks a standing one, always.
test('a day stamped by hand is never re-stamped by the map', () => {
  const working = seedTemplate('Working day')
  const rest = seedTemplate('Rest day')
  actions.setWeekdayTemplate(4, working.id)
  actions.stamp({ [THU]: rest.id })

  actions.ensureDay(THU)
  expect(titles(THU)).toEqual(['Rest day block'])
  expect(getData().days[THU].templateId).toBe(rest.id)
})

test('a template deleted off an auto-stamped day stays deleted', () => {
  const template = seedTemplate('Working day')
  actions.setWeekdayTemplate(4, template.id)
  actions.ensureDay(THU)
  actions.deleteTask(THU, tasks(THU)[0].id)
  actions.ensureDay(THU)
  expect(titles(THU)).toEqual([])
})

test('a map pointing at a template that was deleted stamps nothing rather than failing', () => {
  const template = seedTemplate('Working day')
  actions.setWeekdayTemplate(4, template.id)
  actions.deleteTemplate(template.id)
  expect(() => actions.ensureDay(THU)).not.toThrow()
  expect(titles(THU)).toEqual([])
})

test('clearing a weekday removes it from the map rather than storing an empty id', () => {
  const template = seedTemplate('Working day')
  actions.setWeekdayTemplate(4, template.id)
  actions.setWeekdayTemplate(4, undefined)
  expect(getData().settings.weekdayTemplates).toEqual({})
})

// Both promises, on one day. A stamped Tuesday still owes you your daily
// medication - they are different things and neither cancels the other.
test('a mapped day gets its template and its repeats together', () => {
  const template = seedTemplate('Working day')
  actions.setWeekdayTemplate(4, template.id)
  seedRepeating('daily')
  actions.ensureDay(THU)
  expect(titles(THU).sort()).toEqual(['Medication', 'Working day block'])
})

// --- the task reminder setting -------------------------------------------

test('the before-a-task nudge is off on a fresh install, at five minutes', () => {
  expect(getData().settings.taskReminder).toEqual({ enabled: false, minutesBefore: 5 })
})

test('turning it on and changing its lead time touches nothing else', () => {
  actions.setTaskReminder({ enabled: true, minutesBefore: 15 })
  expect(getData().settings.taskReminder).toEqual({ enabled: true, minutesBefore: 15 })
  expect(getData().settings.reminder.enabled).toBe(false)
})
