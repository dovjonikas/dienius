import { beforeEach, expect, test } from 'vitest'
import { defaultData } from './storage'
import { stampChanges } from './syncEntities'
import { isSyncableState, mergeStates, normaliseRemote } from './syncMerge'
import type { AppData, Task } from './types'

const DATE = '2026-09-01'
const MORNING = '2026-09-01T08:00:00.000Z'
const NOON = '2026-09-01T12:00:00.000Z'
const EVENING = '2026-09-01T20:00:00.000Z'
const NOW = '2026-09-02T09:00:00.000Z'

let base: AppData

beforeEach(() => {
  base = defaultData()
})

function task(over: Partial<Task> = {}): Task {
  return { id: 't1', title: 'Deep work', done: false, ...over }
}

function withTasks(data: AppData, tasks: Task[], date = DATE): AppData {
  return { ...data, days: { ...data.days, [date]: { date, tasks } } }
}

/** A state as it would be after a device made a change at a given instant. */
function device(build: (data: AppData) => AppData, at: string, from = base): AppData {
  return stampChanges(from, build(from), at)
}

function taskOn(data: AppData, date = DATE): Task[] {
  return data.days[date]?.tasks ?? []
}

/**
 * Edits one task in place, keeping every other field it already had.
 *
 * Rebuilding a task from a literal drops its `updatedAt`, which makes it look
 * brand new to the diff and stamps it with the current instant - so both
 * sides of a merge end up "just changed" and the test proves nothing.
 */
function editTask(data: AppData, id: string, patch: Partial<Task>, date = DATE): AppData {
  return {
    ...data,
    days: {
      ...data.days,
      [date]: { ...data.days[date], tasks: data.days[date].tasks.map(t => (t.id === id ? { ...t, ...patch } : t)) },
    },
  }
}

// --- the case this whole feature exists for ------------------------------

test('a morning on the phone and an evening on the PC both survive', () => {
  const shared = device(d => withTasks(d, [task({ id: 'a' }), task({ id: 'b', title: 'Gym' })]), MORNING)

  // Phone: ticks one off at breakfast.
  const phone = device(d => editTask(d, 'a', { done: true }), NOON, shared)
  // PC, having never seen that: renames the other.
  const pc = device(d => editTask(d, 'b', { title: 'Gym, long one' }), EVENING, shared)

  const merged = mergeStates(phone, pc, NOW).data
  const [a, b] = taskOn(merged).sort((x, y) => x.id.localeCompare(y.id))
  expect(a.done).toBe(true)
  expect(b.title).toBe('Gym, long one')
})

// Whole-state last-write-wins is exactly what this proves wrong: it would
// keep one side entirely and lose the other's whole morning.
test('the later state does not simply replace the earlier one', () => {
  const shared = device(d => withTasks(d, [task({ id: 'a' }), task({ id: 'b', title: 'Gym' })]), MORNING)
  const phone = device(d => editTask(d, 'a', { done: true }), NOON, shared)
  const pc = device(d => editTask(d, 'b', { done: true }), EVENING, shared)

  const merged = mergeStates(phone, pc, NOW).data
  expect(taskOn(merged).every(t => t.done)).toBe(true)
})

test('the later edit to the same task wins, in both directions', () => {
  const shared = device(d => withTasks(d, [task({ title: 'First' })]), MORNING)
  const early = device(d => editTask(d, 't1', { title: 'Early' }), NOON, shared)
  const late = device(d => editTask(d, 't1', { title: 'Late' }), EVENING, shared)

  expect(taskOn(mergeStates(early, late, NOW).data)[0].title).toBe('Late')
  expect(taskOn(mergeStates(late, early, NOW).data)[0].title).toBe('Late')
})

// --- what one side has and the other has never seen ----------------------

test('a task created on one device arrives on the other', () => {
  const phone = device(d => withTasks(d, [task({ id: 'new', title: 'Call the bank' })]), NOON)
  const merged = mergeStates(base, phone, NOW).data
  expect(taskOn(merged).map(t => t.title)).toEqual(['Call the bank'])
})

test('merging with a state that knows nothing changes nothing', () => {
  const local = device(d => withTasks(d, [task()]), NOON)
  const merged = mergeStates(local, normaliseRemote(defaultData()), NOW)
  expect(taskOn(merged.data)).toHaveLength(1)
  expect(merged.deleted).toBe(0)
})

// --- deletion, which is the half that needs tombstones -------------------

test('a task deleted on one device disappears on the other', () => {
  const shared = device(d => withTasks(d, [task()]), MORNING)
  const phone = device(d => withTasks(d, []), NOON, shared)

  const merged = mergeStates(shared, phone, NOW)
  expect(taskOn(merged.data)).toHaveLength(0)
  expect(merged.deleted).toBe(1)
})

// Without a tombstone the device that still holds it looks like the one with
// the newer information, and hands it straight back.
test('a deletion is not undone by the device that still has the task', () => {
  const shared = device(d => withTasks(d, [task()]), MORNING)
  const phone = device(d => withTasks(d, []), NOON, shared)

  // The PC syncs, accepts the deletion, then syncs again against a phone that
  // has done nothing further.
  const once = mergeStates(shared, phone, NOW).data
  const twice = mergeStates(once, phone, NOW).data
  expect(taskOn(twice)).toHaveLength(0)
})

test('an edit made after a deletion elsewhere wins, and the task comes back', () => {
  const shared = device(d => withTasks(d, [task()]), MORNING)
  const deletedOnPhone = device(d => withTasks(d, []), NOON, shared)
  const editedOnPc = device(d => editTask(d, 't1', { title: 'Actually still doing this' }), EVENING, shared)

  const merged = mergeStates(deletedOnPhone, editedOnPc, NOW).data
  expect(taskOn(merged).map(t => t.title)).toEqual(['Actually still doing this'])
  expect(merged.tombstones?.['task:t1']).toBeUndefined()
})

test('a deletion made after an edit elsewhere wins, and the task stays gone', () => {
  const shared = device(d => withTasks(d, [task()]), MORNING)
  const editedOnPc = device(d => editTask(d, 't1', { title: 'Renamed' }), NOON, shared)
  const deletedOnPhone = device(d => withTasks(d, []), EVENING, shared)

  expect(taskOn(mergeStates(editedOnPc, deletedOnPhone, NOW).data)).toHaveLength(0)
})

// --- the other entity kinds ----------------------------------------------

test('a library item advanced on the phone and a list renamed on the PC both stick', () => {
  const shared = device(
    d => ({
      ...d,
      library: [{ id: 'l', name: 'Books', unit: 'chapter', items: [{ id: 'i', title: 'A book', progress: 1 }] }],
    }),
    MORNING,
  )
  const phone = device(
    d => ({ ...d, library: [{ ...d.library[0], items: [{ ...d.library[0].items[0], progress: 4 }] }] }),
    NOON,
    shared,
  )
  const pc = device(d => ({ ...d, library: [{ ...d.library[0], name: 'Reading' }] }), EVENING, shared)

  const merged = mergeStates(phone, pc, NOW).data
  expect(merged.library[0].name).toBe('Reading')
  expect(merged.library[0].items[0].progress).toBe(4)
})

test('goals merge per goal, and one archived elsewhere stays archived', () => {
  const shared = device(
    d => ({ ...d, goals: [{ id: 'g1', title: 'One', createdAt: DATE }, { id: 'g2', title: 'Two', createdAt: DATE }] }),
    MORNING,
  )
  const phone = device(d => ({ ...d, goals: [{ ...d.goals[0], archivedAt: DATE }, d.goals[1]] }), NOON, shared)
  const pc = device(d => ({ ...d, goals: [d.goals[0], { ...d.goals[1], why: 'Because' }] }), EVENING, shared)

  const merged = mergeStates(phone, pc, NOW).data
  expect(merged.goals.find(g => g.id === 'g1')?.archivedAt).toBe(DATE)
  expect(merged.goals.find(g => g.id === 'g2')?.why).toBe('Because')
})

test('a template edited on one device replaces the older copy whole', () => {
  const shared = device(
    d => ({ ...d, templates: [{ id: 't', name: 'Work', color: '#a7c4f5', blocks: [{ id: 'b', title: 'Gym' }] }] }),
    MORNING,
  )
  const pc = device(
    d => ({ ...d, templates: [{ ...d.templates[0], blocks: [{ id: 'b', title: 'Gym' }, { id: 'c', title: 'Lunch' }] }] }),
    EVENING,
    shared,
  )
  expect(mergeStates(shared, pc, NOW).data.templates[0].blocks).toHaveLength(2)
})

// --- settings, field by field --------------------------------------------

test('a theme on one device and a sleep schedule on the other do not fight', () => {
  const shared = device(d => d, MORNING)
  const phone = device(
    d => ({ ...d, settings: { ...d.settings, textScale: 'l' as const } }),
    NOON,
    shared,
  )
  const pc = device(
    d => ({ ...d, settings: { ...d.settings, density: 'compact' as const } }),
    EVENING,
    shared,
  )

  const merged = mergeStates(phone, pc, NOW).data
  expect(merged.settings.textScale).toBe('l')
  expect(merged.settings.density).toBe('compact')
})

// "I have read this today" is a fact about the person, not the device.
test('the North dismissal travels between devices', () => {
  const shared = device(d => d, MORNING)
  const phone = device(d => ({ ...d, settings: { ...d.settings, northDismissedOn: DATE } }), NOON, shared)
  expect(mergeStates(shared, phone, NOW).data.settings.northDismissedOn).toBe(DATE)
})

// --- moving a task between days ------------------------------------------

test('a task pushed to another day arrives on that day, not both', () => {
  const shared = device(d => withTasks(d, [task()]), MORNING)
  const phone = device(
    d => ({
      ...d,
      days: {
        [DATE]: { ...d.days[DATE], tasks: [] },
        '2026-09-02': { date: '2026-09-02', tasks: [{ ...d.days[DATE].tasks[0], pushCount: 1 }] },
      },
    }),
    NOON,
    shared,
  )

  const merged = mergeStates(shared, phone, NOW).data
  expect(taskOn(merged, DATE)).toHaveLength(0)
  expect(taskOn(merged, '2026-09-02')).toHaveLength(1)
})

// --- conservatism --------------------------------------------------------

test('a payload that is not a state is refused', () => {
  expect(isSyncableState(null)).toBe(false)
  expect(isSyncableState('{}')).toBe(false)
  expect(isSyncableState({})).toBe(false)
  expect(isSyncableState({ days: [], templates: [], settings: {} })).toBe(false)
  expect(isSyncableState({ days: {}, templates: {}, settings: {} })).toBe(false)
  expect(isSyncableState({ days: {}, templates: [], settings: {} })).toBe(true)
})

test('a state missing collections merges as one that simply knows nothing about them', () => {
  const local = device(d => withTasks(d, [task()]), NOON)
  const partial = normaliseRemote({ days: {}, templates: [], settings: local.settings } as unknown as AppData)
  const merged = mergeStates(local, partial, NOW)
  expect(taskOn(merged.data)).toHaveLength(1)
  expect(merged.deleted).toBe(0)
})

// --- merging is stable ---------------------------------------------------

test('merging twice changes nothing the second time', () => {
  const shared = device(d => withTasks(d, [task({ id: 'a' })]), MORNING)
  const phone = device(
    d => ({ ...d, days: { [DATE]: { ...d.days[DATE], tasks: [{ ...d.days[DATE].tasks[0], done: true }, task({ id: 'b', title: 'New' })] } } }),
    NOON,
    shared,
  )

  const once = mergeStates(shared, phone, NOW).data
  const twice = mergeStates(once, phone, NOW)
  expect(twice.applied).toBe(0)
  expect(taskOn(twice.data)).toHaveLength(2)
})

test('a state merged with itself is unchanged', () => {
  const local = device(d => withTasks(d, [task(), task({ id: 'b', title: 'Gym' })]), NOON)
  const merged = mergeStates(local, local, NOW)
  expect(taskOn(merged.data)).toHaveLength(2)
  expect(merged.applied).toBe(0)
  expect(merged.deleted).toBe(0)
})

// --- what stays local ----------------------------------------------------

test('a day that ends up with no meta and no tasks is dropped rather than kept as a shell', () => {
  const shared = device(d => withTasks(d, [task()]), MORNING)
  const phone = device(d => ({ ...d, days: {} }), NOON, shared)
  expect(Object.keys(mergeStates(shared, phone, NOW).data.days)).toEqual([])
})

/**
 * The backlog merges per item, the same grain as an inbox line. Two devices
 * adding to it on the same evening must both keep what they added: this is
 * the list somebody reaches for when a day has room, and losing half of it to
 * a merge would be the one failure that makes them stop trusting it.
 */
test('a backlog item added on the phone and one added on the PC both survive', () => {
  const phone = device(d => ({ ...d, backlog: [{ id: 'b1', title: 'Fix the bike light' }] }), MORNING)
  const pc = device(d => ({ ...d, backlog: [{ id: 'b2', title: 'Book the dentist' }] }), EVENING)
  const merged = mergeStates(phone, pc, NOW).data
  expect(merged.backlog.map(i => i.title).sort()).toEqual(['Book the dentist', 'Fix the bike light'])
})

test('an item pulled onto a day on one device does not come back from the other', () => {
  const both = device(d => ({ ...d, backlog: [{ id: 'b1', title: 'Fix the bike light' }] }), MORNING)
  // The phone schedules it: the task appears on the day and the item leaves
  // the backlog, in one commit.
  const phone = device(
    d => ({ ...withTasks(d, [task({ id: 't9', title: 'Fix the bike light' })]), backlog: [] }),
    EVENING,
    both,
  )
  const merged = mergeStates(phone, both, NOW).data
  expect(merged.backlog).toEqual([])
  expect(taskOn(merged).map(t => t.title)).toEqual(['Fix the bike light'])
})

test('a reordering on one device does not resurrect an item deleted on the other', () => {
  const both = device(
    d => ({ ...d, backlog: [{ id: 'b1', title: 'First' }, { id: 'b2', title: 'Second' }] }),
    MORNING,
  )
  const phone = device(d => ({ ...d, backlog: [d.backlog[1], d.backlog[0]] }), NOON, both)
  const pc = device(d => ({ ...d, backlog: d.backlog.filter(i => i.id !== 'b1') }), EVENING, both)
  const merged = mergeStates(phone, pc, NOW).data
  expect(merged.backlog.map(i => i.id)).toEqual(['b2'])
})
