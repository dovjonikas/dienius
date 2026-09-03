import { beforeEach, expect, test } from 'vitest'
import { actions, getData } from './store'
import { STORAGE_KEY, defaultData, loadData } from './storage'
import { addWithoutDuplicates, dedupeTasks, identityOf, isRoutine } from './taskIdentity'
import type { Task } from './types'

const MON = '2026-08-31'
const TUE = '2026-09-01'
const WED = '2026-09-02'

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
})

function task(over: Partial<Task> = {}): Task {
  return { id: crypto.randomUUID(), title: 'Commute', done: false, ...over }
}

function titles(date: string) {
  return (getData().days[date]?.tasks ?? []).map(t => t.title)
}

function seedTemplate(name = 'Working day') {
  return actions.addTemplate({
    name,
    color: '#a7c4f5',
    blocks: [
      { time: '08:15', title: 'Commute', minutes: 30 },
      { time: '09:00', title: 'Deep work', minutes: 120 },
    ],
  })
}

// --- identity ------------------------------------------------------------

test('a template task is the same task wherever it lands', () => {
  const a = task({ origin: { type: 'template', sourceId: 't1', blockId: 'b1' } })
  const b = task({ id: 'other', origin: { type: 'template', sourceId: 't1', blockId: 'b1' } })
  expect(identityOf(a)).toBe(identityOf(b))
})

test('two blocks of one template are not the same task', () => {
  const a = task({ origin: { type: 'template', sourceId: 't1', blockId: 'b1' } })
  const b = task({ origin: { type: 'template', sourceId: 't1', blockId: 'b2' } })
  expect(identityOf(a)).not.toBe(identityOf(b))
})

// Two tasks both called "Call the bank" on one day are two calls.
test('a manual task is the same as nothing, including another with its name', () => {
  expect(identityOf(task({ origin: { type: 'manual' } }))).toBeNull()
  expect(identityOf(task())).toBeNull()
  expect(isRoutine(task({ origin: { type: 'manual' } }))).toBe(false)
})

test('a repeat instance written before origins existed still knows its series', () => {
  expect(identityOf(task({ repeatOf: 'src' }))).toBe('repeat:src:')
})

// --- the guard -----------------------------------------------------------

test('adding a task a day already holds adds nothing', () => {
  const origin = { type: 'template' as const, sourceId: 't1', blockId: 'b1' }
  const existing = [task({ origin })]
  expect(addWithoutDuplicates(existing, [task({ id: 'copy', origin })])).toBe(existing)
})

test('a one-off is always added, however many like it are there', () => {
  const existing = [task({ title: 'Call the bank' })]
  const result = addWithoutDuplicates(existing, [task({ title: 'Call the bank' })])
  expect(result).toHaveLength(2)
})

// --- push ----------------------------------------------------------------

test('a one-off moves to tomorrow, as it always has', () => {
  actions.addTask(TUE, 'Call the bank')
  expect(actions.rolloverUnfinished(TUE)).toEqual({ moved: 1, held: 0, skipped: 0 })
  expect(titles(WED)).toEqual(['Call the bank'])
})

// The bug, in one test: a template task pushed onto a day that is going to
// stamp the same template is how a day ended up with two commutes.
test('a template task is not pushed onto a day that will stamp the same template', () => {
  const template = seedTemplate()
  actions.setWeekdayTemplate(3, template.id) // Wednesday
  actions.stamp({ [TUE]: template.id })

  const result = actions.rolloverUnfinished(TUE)
  expect(result).toEqual({ moved: 0, held: 0, skipped: 2 })
  expect(titles(WED)).toEqual([])

  // And when Wednesday opens, it gets exactly one of each.
  actions.ensureDay(WED)
  expect(titles(WED)).toEqual(['Commute', 'Deep work'])
})

test('a template task is not pushed onto a day already stamped from that template', () => {
  const template = seedTemplate()
  actions.stamp({ [TUE]: template.id, [WED]: template.id })
  expect(actions.rolloverUnfinished(TUE).skipped).toBe(2)
  expect(titles(WED)).toEqual(['Commute', 'Deep work'])
})

test('a template task IS pushed onto a day that has nothing to do with that template', () => {
  const template = seedTemplate()
  actions.stamp({ [TUE]: template.id })
  const result = actions.rolloverUnfinished(TUE)
  expect(result.moved).toBe(2)
  expect(titles(WED)).toEqual(['Commute', 'Deep work'])
})

test('a repeat instance is never pushed - its series produces tomorrow itself', () => {
  actions.addTask(MON, 'Medication', '09:00')
  actions.setTaskRepeat(MON, getData().days[MON].tasks[0].id, 'daily')
  actions.ensureDay(TUE)

  expect(actions.rolloverUnfinished(TUE)).toEqual({ moved: 0, held: 0, skipped: 1 })
  actions.ensureDay(WED)
  expect(titles(WED)).toEqual(['Medication'])
})

test('one-offs and routine tasks on the same day are reported separately', () => {
  const template = seedTemplate()
  actions.setWeekdayTemplate(3, template.id)
  actions.stamp({ [TUE]: template.id })
  actions.addTask(TUE, 'Call the bank')

  expect(actions.rolloverUnfinished(TUE)).toEqual({ moved: 1, held: 0, skipped: 2 })
  expect(titles(WED)).toEqual(['Call the bank'])
})

// --- stamp ---------------------------------------------------------------

test('stamping the same template twice is idempotent', () => {
  const template = seedTemplate()
  actions.stamp({ [TUE]: template.id })
  actions.stamp({ [TUE]: template.id })
  expect(titles(TUE)).toEqual(['Commute', 'Deep work'])
})

test('stamping onto a day already holding a pushed instance merges rather than doubling', () => {
  const template = seedTemplate()
  actions.stamp({ [MON]: template.id })
  // Force the push through by giving Tuesday nothing that covers it.
  actions.rolloverUnfinished(MON)
  expect(titles(TUE)).toEqual(['Commute', 'Deep work'])

  actions.stamp({ [TUE]: template.id })
  expect(titles(TUE)).toEqual(['Commute', 'Deep work'])
})

test('a merge keeps the state the day earned', () => {
  const template = seedTemplate()
  actions.stamp({ [TUE]: template.id })
  const commute = getData().days[TUE].tasks[0]
  actions.toggleTask(TUE, commute.id)
  actions.setTaskNote(TUE, commute.id, 'the long way')
  actions.toggleTaskHighlight(TUE, commute.id)

  actions.stamp({ [TUE]: template.id })
  const after = getData().days[TUE].tasks.find(t => t.title === 'Commute')!
  expect(after.done).toBe(true)
  expect(after.note).toBe('the long way')
  expect(after.highlight).toBe(true)
})

test('a manual task on a stamped day survives a re-stamp', () => {
  const template = seedTemplate()
  actions.stamp({ [TUE]: template.id })
  actions.addTask(TUE, 'Call the bank')
  actions.stamp({ [TUE]: template.id })
  expect(titles(TUE)).toContain('Call the bank')
})

// --- the repair ----------------------------------------------------------

test('a stored day holding duplicates is repaired on load, keeping the one with the work in it', () => {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      ...defaultData(),
      days: {
        [TUE]: {
          date: TUE,
          tasks: [
            { id: 'a', title: 'Commute', done: false, time: '08:15', minutes: 30 },
            { id: 'b', title: 'Commute', done: true, time: '08:15', minutes: 30 },
            { id: 'c', title: 'Deep work', done: false, time: '09:00', minutes: 120 },
          ],
        },
      },
    }),
  )
  const loaded = loadData()
  expect(loaded.days[TUE].tasks.map(t => t.title)).toEqual(['Commute', 'Deep work'])
  expect(loaded.days[TUE].tasks[0].done).toBe(true)
})

// Two untimed tasks with the same name are plausibly two real errands.
test('two untimed tasks with the same name are left alone - they may be two errands', () => {
  const tasks = [task({ title: 'Call the bank' }), task({ title: 'Call the bank' })]
  expect(dedupeTasks(tasks)).toHaveLength(2)
})

test('the repair keeps the original order and is idempotent', () => {
  const tasks = [
    task({ title: 'A', time: '08:00', minutes: 30 }),
    task({ title: 'B', time: '09:00', minutes: 30 }),
    task({ title: 'A', time: '08:00', minutes: 30 }),
  ]
  const once = dedupeTasks(tasks)
  expect(once.map(t => t.title)).toEqual(['A', 'B'])
  expect(dedupeTasks(once)).toEqual(once)
})

test('a day with nothing duplicated comes back untouched', () => {
  const tasks = [task({ title: 'A', time: '08:00' }), task({ title: 'B', time: '09:00' })]
  expect(dedupeTasks(tasks)).toHaveLength(2)
})
