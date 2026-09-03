import { expect, test } from 'vitest'
import { applyPlan, describeDelta, findConflicts, planInterrupt, planRescue, planShift } from './replan'
import { defaultData } from '../../lib/storage'
import type { Task } from '../../lib/types'

const WINDOW = { start: 7 * 60, end: 23 * 60 }
const DAY = '2026-09-03'
const NEXT = '2026-09-04'

function task(id: string, time: string | undefined, minutes?: number, patch: Partial<Task> = {}): Task {
  return { id, title: id, time, minutes, done: false, ...patch }
}

const t = (h: number, m = 0) => h * 60 + m

/**
 * Something came up. The interruption is a block; what it lands on is a
 * conflict; each conflict has three ways out and the summary names every
 * one that took the last of them. Nothing is ever kept at a time it can no
 * longer have without being said.
 */
test('an interruption collides with what it overlaps, including a task already in progress', () => {
  const tasks = [task('coffee', '07:30', 20), task('deep', '09:00', 120), task('standup', '11:15', 15), task('lunch', '12:30', 45)]
  const hits = findConflicts(tasks, { title: 'Dentist', start: t(10), minutes: 90 })
  expect(hits.map(x => x.id)).toEqual(['deep', 'standup'])
})

test('with no known length the interruption reaches the end of the day and everything after it collides', () => {
  const tasks = [task('coffee', '07:30', 20), task('deep', '09:00', 120), task('read', '20:00', 40)]
  const hits = findConflicts(tasks, { title: 'Call', start: t(10) })
  expect(hits.map(x => x.id)).toEqual(['deep', 'read'])
})

test('a done task is never a conflict, and neither is an untimed one', () => {
  const tasks = [task('deep', '09:00', 120, { done: true }), task('float', undefined, 30)]
  expect(findConflicts(tasks, { title: 'X', start: t(9), minutes: 60 })).toEqual([])
})

test('squeezing moves a conflict into the first gap after the interruption that holds it', () => {
  const tasks = [task('deep', '09:00', 60), task('lunch', '12:30', 45), task('gym', '17:30', 60)]
  const plan = planInterrupt(tasks, { title: 'Dentist', start: t(9), minutes: 60 }, {}, WINDOW)
  expect(plan.add).toEqual({ title: 'Dentist', time: '09:00', minutes: 60, category: undefined })
  expect(plan.moves).toEqual([{ taskId: 'deep', time: '10:00' }])
  expect(plan.tomorrow).toEqual([])
  expect(plan.summary).toContain('deep')
  expect(plan.summary).not.toMatch(/missed/i)
})

test('a key task is squeezed in before an ordinary one that was earlier', () => {
  const tasks = [task('admin', '09:00', 60), task('key', '10:00', 60, { highlight: true }), task('wall', '11:00', 660)]
  const plan = planInterrupt(tasks, { title: 'X', start: t(9), minutes: 120 }, {}, WINDOW)
  // One hour free at 22:00-23:00 only, since the wall runs 11:00-22:00.
  expect(plan.moves).toEqual([{ taskId: 'key', time: '22:00' }])
  expect(plan.tomorrow).toEqual(['admin'])
  expect(plan.summary).toContain('No room left today for admin')
})

test('each conflict can be sent to tomorrow or dropped instead, and the summary says which', () => {
  const tasks = [task('a', '09:00', 60), task('b', '10:00', 60), task('c', '11:00', 60)]
  const plan = planInterrupt(tasks, { title: 'X', start: t(9), minutes: 180 }, { a: 'tomorrow', b: 'drop', c: 'keep' }, WINDOW)
  expect(plan.tomorrow).toEqual(['a'])
  expect(plan.drop).toEqual(['b'])
  expect(plan.keep).toEqual(['c'])
  expect(plan.moves).toEqual([])
  expect(plan.summary).toContain('Tomorrow: a.')
  expect(plan.summary).toContain('Dropped: b.')
})

test('external calendar time is not a gap', () => {
  const tasks = [task('deep', '09:00', 60)]
  const busy = [{ start: t(10), end: t(12) }]
  const plan = planInterrupt(tasks, { title: 'X', start: t(9), minutes: 60 }, {}, WINDOW, busy)
  expect(plan.moves).toEqual([{ taskId: 'deep', time: '12:00' }])
})

/**
 * Shift the rest. Everything from now moves by the same amount; what would
 * end after the waking window is named and goes to tomorrow, and a task
 * already in progress stays - it started.
 */
test('shifting moves every anchor from now on by the delta and leaves the one in progress', () => {
  const tasks = [task('now', '14:00', 60), task('a', '15:00', 30), task('b', '16:00', 30), task('done', '17:00', 30, { done: true })]
  const plan = planShift(tasks, t(14, 20), 30, WINDOW)
  expect(plan.moves).toEqual([
    { taskId: 'a', time: '15:30' },
    { taskId: 'b', time: '16:30' },
  ])
  expect(plan.summary).toBe('Everything from 14:20 moves 30 min later.')
})

test('a shift respects the sleep boundary: what no longer fits goes to tomorrow, and is named', () => {
  const tasks = [task('a', '20:00', 60), task('read', '22:00', 40)]
  const plan = planShift(tasks, t(19), 60, WINDOW)
  expect(plan.moves).toEqual([{ taskId: 'a', time: '21:00' }])
  expect(plan.tomorrow).toEqual(['read'])
  expect(plan.summary).toContain('read - tomorrow')
})

test('deltas read as words', () => {
  expect(describeDelta(30)).toBe('30 min later')
  expect(describeDelta(60)).toBe('1h later')
  expect(describeDelta(90)).toBe('1h 30 min later')
})

/**
 * I'm back. Key tasks first, then core, then the rest; what fits in the
 * time left is placed, the rest goes to tomorrow. The summary leads with
 * what is still winnable and never with what was missed.
 */
test('the rescue fits key tasks first into the time left, around anchors still to come', () => {
  const tasks = [
    task('email', '09:00', 60),
    task('key1', '10:00', 60, { highlight: true }),
    task('key2', '11:00', 60, { highlight: true }),
    task('float', undefined, 30),
    task('dinner', '19:00', 60),
    task('key3', '20:00', 30, { highlight: true }),
  ]
  // Back at 17:00 with 07:00-23:00 awake: 17:00-19:00 free, then 20:30-23:00.
  const plan = planRescue(tasks, t(17), WINDOW)
  expect(plan.moves.slice(0, 2)).toEqual([
    { taskId: 'key1', time: '17:00' },
    { taskId: 'key2', time: '18:00' },
  ])
  expect(plan.keep).toEqual(['dinner', 'key3'])
  expect(plan.summary).toMatch(/^Still winnable: 3 of 3 key\./)
  expect(plan.summary).not.toMatch(/miss/i)
})

test('what does not fit goes to tomorrow and the summary counts it, not the failure', () => {
  const tasks = [task('a', '09:00', 120, { highlight: true }), task('b', '11:00', 120, { highlight: true }), task('c', '13:00', 120)]
  const plan = planRescue(tasks, t(21), WINDOW)
  expect(plan.moves).toEqual([{ taskId: 'a', time: '21:00' }])
  expect(plan.tomorrow).toEqual(['b', 'c'])
  expect(plan.summary).toBe('Still winnable: 1 of 2 key. 1 on today, 2 to tomorrow.')
})

test('with nothing open the rescue has nothing to say but that', () => {
  const plan = planRescue([task('a', '09:00', 30, { done: true })], t(15), WINDOW)
  expect(plan.summary).toBe('Nothing left on the list. The day is yours.')
})

// --- applying ---------------------------------------------------------------

function withTasks(tasks: Task[]) {
  const data = defaultData()
  data.days[DAY] = { date: DAY, tasks }
  return data
}

test('applying a plan re-times, moves to tomorrow, drops, and adds the interruption', () => {
  let n = 0
  const data = withTasks([task('a', '09:00', 60), task('b', '10:00', 60), task('c', '11:00', 60)])
  const plan = planInterrupt(data.days[DAY].tasks, { title: 'Dentist', start: t(9), minutes: 180 }, { b: 'tomorrow', c: 'drop' }, WINDOW)
  const next = applyPlan(data, DAY, plan, () => `new-${++n}`)
  expect(next.days[DAY].tasks.map(x => [x.id, x.time])).toEqual([
    ['a', '12:00'],
    ['new-1', '09:00'],
  ])
  expect(next.days[NEXT].tasks.map(x => x.id)).toEqual(['b'])
})

/**
 * Sync can hand the same intention over from two devices, so applying a
 * plan twice must change nothing the second time.
 */
test('applying the same plan twice changes nothing the second time', () => {
  let n = 0
  const data = withTasks([task('a', '09:00', 60), task('b', '10:00', 60)])
  const plan = planInterrupt(data.days[DAY].tasks, { title: 'Dentist', start: t(9), minutes: 120 }, { b: 'tomorrow' }, WINDOW)
  const once = applyPlan(data, DAY, plan, () => `new-${++n}`)
  const twice = applyPlan(once, DAY, plan, () => `new-${++n}`)
  expect(twice.days[DAY].tasks).toEqual(once.days[DAY].tasks)
  expect(twice.days[NEXT].tasks).toEqual(once.days[NEXT].tasks)
})

test('a task tomorrow already has by identity is not added a second time', () => {
  const data = withTasks([task('a', '09:00', 60, { origin: { type: 'template', sourceId: 't', blockId: 'x' } })])
  data.days[NEXT] = { date: NEXT, tasks: [task('a2', '09:00', 60, { origin: { type: 'template', sourceId: 't', blockId: 'x' } })] }
  const plan = planShift(data.days[DAY].tasks, t(8), 15 * 60, WINDOW)
  expect(plan.tomorrow).toEqual(['a'])
  const next = applyPlan(data, DAY, plan, () => 'id')
  expect(next.days[NEXT].tasks.map(x => x.id)).toEqual(['a2'])
  expect(next.days[DAY].tasks).toEqual([])
})
