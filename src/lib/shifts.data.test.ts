import { beforeEach, expect, test } from 'vitest'
import { compareSummaries, summarise } from './cloudBackup'
import { defaultData, exportJson, importJson, validate } from './storage'
import { collectEntities, stampChanges } from './syncEntities'
import { isSyncableState, mergeStates, normaliseRemote } from './syncMerge'
import { addWithoutDuplicates, identityOf } from './taskIdentity'
import { validate as validateV228 } from './fixtures/validate-v2.28'
import type { AppData, Routine, Task, Template } from './types'

/**
 * Rotating shifts' data, v2.29 stage 2 - docs/RESEARCH-SHIFTS.md sections 2
 * and 1.4. A day kind is a mark on a day template; a routine is an entity of
 * its own in a top-level list; a routine's task on a day names its routine and
 * what the rule gave it; a day keeps the routines deleted from it by hand.
 * Everything here is optional or a new list, because an older device discards
 * a plan with a value it does not know - and the last test holds that against
 * v2.28's own validation, frozen in fixtures/.
 *
 * Every name and time here is a generic one.
 */

const MORNING = '2026-09-01T08:00:00.000Z'
const NOON = '2026-09-01T12:00:00.000Z'
const EVENING = '2026-09-01T20:00:00.000Z'
const NOW = '2026-09-02T09:00:00.000Z'

let base: AppData

beforeEach(() => {
  base = defaultData()
})

function kind(id: string, letter: string, order: number, over: Partial<Template> = {}): Template {
  return {
    id,
    name: `Kind ${letter}`,
    color: '#a7c4f5',
    type: 'shift',
    blocks: [{ id: `${id}-b`, time: '06:00', title: 'A shift', minutes: 480 }],
    dayKind: { letter, order },
    ...over,
  }
}

function routine(over: Partial<Routine> = {}): Routine {
  return {
    id: 'rt1',
    title: 'Training',
    category: 'health',
    minutes: 60,
    weekdays: [1, 3, 5],
    times: { k1: '17:00', k2: '10:00' },
    ...over,
  }
}

/** A plan with two kinds, a routine, and a day carrying the routine's task and a skip. */
function shiftPlan(): AppData {
  const data = defaultData()
  data.templates = [kind('k1', 'D', 0), kind('k2', 'N', 1, { type: 'night' })]
  data.routines = [routine()]
  data.days['2026-09-02'] = {
    date: '2026-09-02',
    templateId: 'k1',
    dayType: 'shift',
    routineSkips: ['rt-gone'],
    tasks: [
      {
        id: 't1',
        title: 'Training',
        time: '17:00',
        minutes: 60,
        done: false,
        category: 'health',
        routineId: 'rt1',
        fromRoutine: { time: '17:00', minutes: 60 },
      },
    ],
  }
  return data
}

/** A payload as a file holds it, with one path changed. */
function file(data: AppData): Record<string, unknown> {
  return JSON.parse(exportJson(data)) as Record<string, unknown>
}

// --- the guard ---------------------------------------------------------------

test('an empty plan has no routines, and a plan with kinds, routines and a routine task validates', () => {
  expect(base.routines).toEqual([])
  expect(validate(file(shiftPlan()))).toBe(true)
})

test("a kind's letter is one or two characters and its order a whole number from nought", () => {
  for (const dayKind of [{ letter: '', order: 0 }, { letter: 'ABC', order: 0 }, { letter: 'D', order: -1 }, { letter: 'D', order: 1.5 }, { letter: 7, order: 0 }, { order: 0 }]) {
    const data = shiftPlan()
    const payload = file(data) as { templates: Record<string, unknown>[] }
    payload.templates[0].dayKind = dayKind
    expect(validate(payload), JSON.stringify(dayKind)).toBe(false)
  }
  const two = shiftPlan()
  two.templates[0].dayKind = { letter: 'N2', order: 12 }
  expect(validate(file(two))).toBe(true)
})

test('a routine has a title, a length from a minute to twelve hours, at least one weekday, and times on the clock', () => {
  const bad: Partial<Record<keyof Routine, unknown>>[] = [
    { title: '' },
    { title: 7 },
    { minutes: 0 },
    { minutes: 721 },
    { minutes: 30.5 },
    { weekdays: [] },
    { weekdays: [7] },
    { weekdays: [1, 1] },
    { weekdays: 'mon' },
    { times: { k1: '25:00' } },
    { times: { k1: '9:00' } },
    { times: { '': '09:00' } },
    { times: ['09:00'] },
    { category: '' },
  ]
  for (const over of bad) {
    const payload = file(shiftPlan()) as { routines: Record<string, unknown>[] }
    payload.routines[0] = { ...payload.routines[0], ...over }
    expect(validate(payload), JSON.stringify(over)).toBe(false)
  }
  const none = file(shiftPlan()) as { routines: Record<string, unknown>[] }
  none.routines[0] = { ...none.routines[0], times: {} }
  delete none.routines[0].category
  expect(validate(none), 'a routine with no time for any kind yet, and no category').toBe(true)
})

test("a routine task's routine id is text, what the rule gave it is a time and a length, and a day's skips are ids", () => {
  const cases: [string, (p: { days: Record<string, { routineSkips?: unknown; tasks: Record<string, unknown>[] }> }) => void][] = [
    ['routineId', p => (p.days['2026-09-02'].tasks[0].routineId = 3)],
    ['fromRoutine not a record', p => (p.days['2026-09-02'].tasks[0].fromRoutine = '17:00')],
    ['fromRoutine time off the clock', p => (p.days['2026-09-02'].tasks[0].fromRoutine = { time: '24:30', minutes: 60 })],
    ['fromRoutine without minutes', p => (p.days['2026-09-02'].tasks[0].fromRoutine = { time: '17:00' })],
    ['routineSkips not a list', p => (p.days['2026-09-02'].routineSkips = 'rt-gone')],
    ['routineSkips not text', p => (p.days['2026-09-02'].routineSkips = [4])],
  ]
  for (const [name, spoil] of cases) {
    const payload = file(shiftPlan()) as Parameters<(typeof cases)[number][1]>[0]
    spoil(payload)
    expect(validate(payload), name).toBe(false)
  }
  const untimed = shiftPlan()
  untimed.days['2026-09-02'].tasks[0] = { ...untimed.days['2026-09-02'].tasks[0], time: undefined, fromRoutine: { minutes: 60 } }
  expect(validate(file(untimed)), 'a routine task the rule gave no time').toBe(true)
})

// --- the file ----------------------------------------------------------------

test('kinds, routines, routine tasks and skips survive export and re-import, and the file is the plan again', () => {
  const data = shiftPlan()
  const text = exportJson(data)
  const back = importJson(text)
  expect(back.templates.map(t => t.dayKind)).toEqual([
    { letter: 'D', order: 0 },
    { letter: 'N', order: 1 },
  ])
  expect(back.routines).toEqual(data.routines)
  expect(back.days['2026-09-02'].tasks[0]).toMatchObject({ routineId: 'rt1', fromRoutine: { time: '17:00', minutes: 60 } })
  expect(back.days['2026-09-02'].routineSkips).toEqual(['rt-gone'])
  expect(exportJson(back)).toBe(text)
})

test('a backup from before rotating shifts loads with no routines, and nothing else changed', () => {
  const data = defaultData()
  data.picture = { text: 'a first line' }
  const old = file(data)
  delete old.routines
  const loaded = importJson(JSON.stringify(old))
  expect(loaded.routines).toEqual([])
  expect({ ...loaded, routines: undefined }).toEqual({ ...data, routines: undefined })
})

// --- an older device -------------------------------------------------------------------

/**
 * The reason every field above is optional and every list new: v2.28's own
 * validation, run on a plan carrying all of them, has to accept it - or a phone
 * that has not updated yet opens empty the moment sync hands it the plan. And
 * the copy has to be able to say no, or it proves nothing: a task origin it does
 * not know is refused, which is exactly why a routine's task names its routine in
 * a field of its own rather than in its origin.
 */
test("v2.28's validation accepts a plan with every field rotating shifts adds, and still refuses a value it does not know", () => {
  const data = shiftPlan()
  data.days['2026-09-02'].tasks.push({
    id: 't2',
    title: 'A routine the rule gave no time',
    done: false,
    routineId: 'rt1',
    fromRoutine: { minutes: 60 },
  })
  const payload = file(data)
  expect(validateV228(payload)).toBe(true)
  expect(validate(payload)).toBe(true)

  const withNewOrigin = file(data) as { days: Record<string, { tasks: Record<string, unknown>[] }> }
  withNewOrigin.days['2026-09-02'].tasks[0].origin = { type: 'routine', sourceId: 'rt1' }
  expect(validateV228(withNewOrigin)).toBe(false)
})

// --- identity -----------------------------------------------------------------------------

test("a routine's task is known by its routine, so a day never holds two of one routine", () => {
  const task = shiftPlan().days['2026-09-02'].tasks[0]
  expect(identityOf(task)).toBe('routine:rt1:')
  const again: Task = { ...task, id: 't9', time: '18:00' }
  expect(addWithoutDuplicates([task], [again])).toEqual([task])
  const other: Task = { ...task, id: 't10', routineId: 'rt2' }
  expect(addWithoutDuplicates([task], [other])).toHaveLength(2)
})

// --- sync ----------------------------------------------------------------------

/** A state as it would be after a device made a change at a given instant. */
function device(build: (data: AppData) => AppData, at: string, from = base): AppData {
  return stampChanges(from, build(from), at)
}

function withRoutines(data: AppData, routines: Routine[]): AppData {
  return { ...data, routines }
}

test('a routine is an entity of its own: a new or changed one is stamped, and a removed one leaves a tombstone', () => {
  const added = device(d => withRoutines(d, [routine(), routine({ id: 'rt2', title: 'Reading' })]), MORNING)
  expect(added.routines.map(r => r.updatedAt)).toEqual([MORNING, MORNING])
  expect(collectEntities(added).get('routine:rt1')?.kind).toBe('routine')

  const moved = device(d => withRoutines(d, [{ ...d.routines[0], times: { k1: '18:00' } }, d.routines[1]]), NOON, added)
  expect(moved.routines[0].updatedAt).toBe(NOON)
  expect(moved.routines[1].updatedAt).toBe(MORNING)

  const removed = device(d => withRoutines(d, [d.routines[0]]), EVENING, moved)
  expect(removed.tombstones?.['routine:rt2']).toBe(EVENING)
})

test('a routine changed on the phone and another on the PC both survive a merge, and a deleted one stays deleted', () => {
  const shared = device(d => withRoutines(d, [routine(), routine({ id: 'rt2', title: 'Reading' })]), MORNING)
  const phone = device(d => withRoutines(d, [{ ...d.routines[0], minutes: 45 }, d.routines[1]]), NOON, shared)
  const pc = device(d => withRoutines(d, [d.routines[0], { ...d.routines[1], weekdays: [0, 6] }]), EVENING, shared)
  const merged = mergeStates(phone, pc, NOW).data
  expect(merged.routines.find(r => r.id === 'rt1')?.minutes).toBe(45)
  expect(merged.routines.find(r => r.id === 'rt2')?.weekdays).toEqual([0, 6])

  const gone = device(d => withRoutines(d, [d.routines[1]]), EVENING, shared)
  expect(mergeStates(shared, gone, NOW).data.routines.map(r => r.id)).toEqual(['rt2'])
  expect(mergeStates(gone, shared, NOW).data.routines.map(r => r.id)).toEqual(['rt2'])
})

test('a kind mark travels with its template, and a state whose routines are not a list is not one to merge with', () => {
  const shared = device(d => ({ ...d, templates: [kind('k1', 'D', 0)] }), MORNING)
  const phone = device(d => ({ ...d, templates: [{ ...d.templates[0], dayKind: { letter: 'E', order: 0 } }] }), NOON, shared)
  expect(mergeStates(shared, phone, NOW).data.templates[0].dayKind).toEqual({ letter: 'E', order: 0 })

  expect(isSyncableState({ days: {}, templates: [], settings: {}, routines: {} })).toBe(false)
  expect(isSyncableState({ days: {}, templates: [], settings: {}, routines: [] })).toBe(true)
  const local = device(d => withRoutines(d, [routine()]), NOON)
  const partial = normaliseRemote({ days: {}, templates: [], settings: local.settings } as unknown as AppData)
  expect(partial.routines).toEqual([])
  const merged = mergeStates(local, partial, NOW)
  expect(merged.data.routines).toHaveLength(1)
  expect(merged.deleted).toBe(0)
})

// --- the restore's summary -------------------------------------------------------

test("a copy's summary counts its routines, and a restore that would bring fewer says so", () => {
  const here = withRoutines(base, [routine(), routine({ id: 'rt2' })])
  expect(summarise(here).routines).toBe(2)
  const row = compareSummaries(summarise(here), summarise(defaultData())).find(r => r.label === 'Routines')
  expect(row).toMatchObject({ here: 2, cloud: 0, loses: true })
})
