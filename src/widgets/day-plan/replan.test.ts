import { expect, test } from 'vitest'
import { applyPlan, describeDelta, findConflicts, formatFreeWindows, freeWindows, planInterrupt, planRescue, planShift } from './replan'
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
  expect(plan.summary).toContain('Set aside, waiting: b.')
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
 * Back. Key tasks first, then core, then the rest; what fits in the
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
  expect(plan.summary).toBe('Nothing left on the list - the day is yours.')
})

// --- applying ---------------------------------------------------------------

function withTasks(tasks: Task[]) {
  const data = defaultData()
  data.days[DAY] = { date: DAY, tasks }
  return data
}

test('applying a plan re-times, moves to tomorrow, sets aside, and adds the interruption', () => {
  let n = 0
  const data = withTasks([task('a', '09:00', 60), task('b', '10:00', 60), task('c', '11:00', 60)])
  const plan = planInterrupt(data.days[DAY].tasks, { title: 'Dentist', start: t(9), minutes: 180 }, { b: 'tomorrow', c: 'drop' }, WINDOW)
  const next = applyPlan(data, DAY, plan, () => `new-${++n}`)
  // 'c' is still on the day, waiting - see setAside.ts and DECISIONS "Set
  // aside, not deleted". Nothing an interruption touches leaves the day.
  expect(next.days[DAY].tasks.map(x => [x.id, x.time, x.setAside ?? false])).toEqual([
    ['a', '12:00', false],
    ['c', '11:00', true],
    ['new-1', '09:00', false],
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

/**
 * A routine block whose time has passed stays where it is.
 *
 * This used to fit a missed Standup into the evening because the evening was
 * free - honest arithmetic and a silly plan, and the whole point of the
 * rescue is producing one somebody believes. What makes a task routine is
 * that it came from a template or a repeat: it has a slot in the shape of
 * the day rather than a job that needs doing at some point.
 */
test('a routine block whose time has passed is left alone, not moved into the evening', () => {
  const tasks: Task[] = [
    { id: 'standup', title: 'Standup', done: false, time: '09:00', minutes: 15, origin: { type: 'template', sourceId: 'work', blockId: 'b1' } },
    { id: 'errand', title: 'Post the parcel', done: false, time: '10:00', minutes: 30 },
  ]
  const plan = planRescue(tasks, 18 * 60, { start: 7 * 60, end: 23 * 60 })

  expect(plan.moves.map(m => m.taskId)).toEqual(['errand'])
  expect(plan.keep).toContain('standup')
  expect(plan.tomorrow).not.toContain('standup')
  expect(plan.summary).toContain('Routine block left where it is.')
})

test('a routine block is not sent to tomorrow either, because tomorrow already has it', () => {
  // The same judgment the rollover button already makes: pushing a routine
  // task onto a day whose template produces it is the duplicate this app
  // spent v1.4 learning to avoid.
  const tasks: Task[] = [
    { id: 'a', title: 'Standup', done: false, time: '09:00', minutes: 15, repeatOf: 'series-1' },
    { id: 'b', title: 'Lunch', done: false, time: '12:30', minutes: 45, origin: { type: 'repeat', sourceId: 'series-2' } },
  ]
  const plan = planRescue(tasks, 22 * 60 + 30, { start: 7 * 60, end: 23 * 60 })

  expect(plan.tomorrow).toEqual([])
  expect(plan.keep).toEqual(expect.arrayContaining(['a', 'b']))
  expect(plan.summary).toContain('Routine blocks left where they are.')
})

test('a one-off whose time has passed is still rescued, and says nothing about routine', () => {
  const tasks: Task[] = [{ id: 'call', title: 'Call the bank', done: false, time: '10:00', minutes: 30 }]
  const plan = planRescue(tasks, 18 * 60, { start: 7 * 60, end: 23 * 60 })
  expect(plan.moves).toHaveLength(1)
  expect(plan.summary).not.toContain('Routine')
})

// --- any day of the week ------------------------------------------------------

/**
 * Replan v2 asks the same arithmetic about a day that has not started. The
 * gaps before the interruption are real gaps then - a task the afternoon
 * lost can go into a free morning - so the caller says where fitting may
 * begin, and the summary is told what to call the day.
 */
test('given a start-from, a moved task may land before the interruption - once the gaps after it are full', () => {
  const tasks = [task('deep', '15:00', 60), task('wall', '16:00', 420)]
  const interruption = { title: 'Dad', start: t(15), minutes: 60 }
  expect(planInterrupt(tasks, interruption, {}, WINDOW).tomorrow).toEqual(['deep'])
  expect(planInterrupt(tasks, interruption, {}, WINDOW, [], { from: WINDOW.start }).moves).toEqual([{ taskId: 'deep', time: '07:00' }])
})

test('with room on both sides, what the afternoon lost goes into the evening rather than the morning', () => {
  const tasks = [task('lunch', '12:30', 45)]
  const plan = planInterrupt(tasks, { title: 'Dad', start: t(12), minutes: 360 }, {}, WINDOW, [], { from: WINDOW.start })
  expect(plan.moves).toEqual([{ taskId: 'lunch', time: '18:00' }])
})

test('the summary speaks about the day it is for, not about today', () => {
  const words = { day: 'on Thursday', next: 'Friday' }
  const tasks = [task('early', '07:00', 120), task('a', '09:00', 60), task('wall', '10:00', 780)]
  const plan = planInterrupt(tasks, { title: 'Dad', start: t(9), minutes: 60 }, {}, WINDOW, [], { from: WINDOW.start, words })
  expect(plan.summary).toContain('No room left on Thursday for a - Friday.')
  const chosen = planInterrupt(tasks, { title: 'Dad', start: t(9), minutes: 60 }, { a: 'tomorrow' }, WINDOW, [], { words })
  expect(chosen.summary).toContain('Friday: a.')
})

/**
 * The routine is not in the way, and never was. A commute or a lunch the
 * afternoon ran over did not happen, and tomorrow has one of its own - so
 * it is not moved, not set aside and not offered anywhere. It was a choice
 * until v2.5 and the answer was always the same, which is what a rule is.
 * See CONVENTIONS section 12.
 */
test('a routine block is never in the way: it is not offered a choice, and the summary says it stays', () => {
  const commute = task('commute', '09:00', 30, { origin: { type: 'template', sourceId: 'work', blockId: 'b1' } })
  const errand = task('errand', '09:30', 30)
  const plan = planInterrupt([commute, errand], { title: 'Dad', start: t(9), minutes: 60 }, { commute: 'drop', errand: 'drop' }, WINDOW)

  expect(plan.drop).toEqual(['errand'])
  expect(plan.moves).toEqual([])
  expect(plan.tomorrow).toEqual([])
  expect(plan.summary).toContain('The routine stays: commute.')
  expect(plan.summary).toContain('Set aside, waiting: errand.')
})

test('a routine block is not among the conflicts a sheet would offer choices for', () => {
  const commute = task('commute', '09:00', 30, { origin: { type: 'template', sourceId: 'work', blockId: 'b1' } })
  const errand = task('errand', '09:30', 30)
  expect(findConflicts([commute, errand], { title: 'Dad', start: t(9), minutes: 60 }).map(x => x.id)).toEqual(['errand'])
})

test('an interruption with no name is called what the sheet is called', () => {
  const plan = planInterrupt([], { title: '   ', start: t(9), minutes: 60 }, {}, WINDOW)
  expect(plan.add?.title).toBe('Something came up')
})

/**
 * The free-windows line is the answer for the person on the phone: what is
 * left of the day once the plan is in, said the way it would be said.
 */
test('free windows are the gaps left around what stays, from a given minute, none shorter than half an hour', () => {
  const tasks = [task('a', '09:00', 60), task('b', '12:00', 30), task('c', '12:40', 20, { done: true }), task('d', '17:00', 60)]
  const gaps = freeWindows(tasks, WINDOW, [{ start: t(10), end: t(11, 45) }], t(8))
  expect(gaps.map(g => [g.start, g.end])).toEqual([[t(8), t(9)], [t(12, 30), t(17)], [t(18), t(23)]])
  expect(formatFreeWindows(gaps, WINDOW)).toBe('Free today: 08:00-09:00, 12:30-17:00, after 18:00.')
})

test('a day with nothing left says so as a fact, in the words of that day', () => {
  const gaps = freeWindows([task('wall', '07:00', 16 * 60)], WINDOW)
  expect(gaps).toEqual([])
  expect(formatFreeWindows(gaps, WINDOW, { day: 'on Thursday', next: 'Friday' })).toBe('No free time left on Thursday.')
})

test('a stretch too short to offer is not offered', () => {
  const gaps = freeWindows([task('a', '09:00', 60), task('b', '10:20', 60)], WINDOW, [], t(9))
  expect(gaps.map(g => g.start)).toEqual([t(11, 20)])
})

/**
 * Applying marks the day, and a dropped repeat instance leaves the skip a
 * hand delete would leave - a tombstone rather than a silence.
 */
test('applying writes the day it was replanned on, and only then', () => {
  const data = withTasks([task('a', '09:00', 60)])
  const plan = planInterrupt(data.days[DAY].tasks, { title: 'Dad', start: t(9), minutes: 60 }, {}, WINDOW)
  expect(applyPlan(data, DAY, plan, () => 'id').days[DAY].replannedOn).toBeUndefined()
  expect(applyPlan(data, DAY, plan, () => 'id', { replannedOn: '2026-09-01' }).days[DAY].replannedOn).toBe('2026-09-01')
})

/**
 * A repeat instance taken off the day used to be deleted, with its series
 * id written into `repeatSkips` so the rollover would not put it back. Since
 * v2.5 nothing is deleted: the block waits on the day, so there is nothing
 * for a skip to prevent and no skip is written. A day that already carries
 * skips from before keeps them.
 */
test('a one-off set aside stays on the day, and no skip is written for anything', () => {
  const data = withTasks([task('pills', '09:00', 10, { repeatOf: 'series' }), task('walk', '10:00', 30)])
  const plan = planInterrupt(data.days[DAY].tasks, { title: 'Dad', start: t(9), minutes: 120 }, { pills: 'drop', walk: 'drop' }, WINDOW)
  const next = applyPlan(data, DAY, plan, () => 'id')

  expect(next.days[DAY].repeatSkips).toBeUndefined()
  // 'pills' repeats daily, which makes it routine: it is not in the way and
  // nothing happens to it. 'walk' is a one-off and waits.
  expect(next.days[DAY].tasks.filter(x => x.setAside).map(x => x.id)).toEqual(['walk'])
})

test('the interruption arrives as a manual task, which is what it is', () => {
  const data = withTasks([])
  const plan = planInterrupt([], { title: 'Dad', start: t(9), minutes: 60 }, {}, WINDOW)
  expect(applyPlan(data, DAY, plan, () => 'id').days[DAY].tasks[0].origin).toEqual({ type: 'manual' })
})

/**
 * The eleven rules a replan follows, in CONVENTIONS section 12. Most were
 * already true and had never been written down as a test; these are the
 * ones a change to the packer could quietly break.
 */

// 2. Key tasks first. A key task is never pushed out by one that is not.
test('the key tasks take the gaps first, whatever order they were in', () => {
  const plain = task('plain', '13:00', 60)
  const key = { ...task('key', '14:00', 60), highlight: true }
  const plan = planInterrupt([plain, key], { title: 'X', start: t(13), minutes: 120 }, {}, { start: t(7), end: t(16) })
  // One gap of an hour is left before four; the key task has it.
  expect(plan.moves.map(m => m.taskId)).toEqual(['key'])
  expect(plan.tomorrow).toEqual(['plain'])
})

// 4. Nothing into the past. A gap that started before now is not a gap.
test('nothing is placed before the time the plan is made at', () => {
  const late = task('late', '09:00', 30)
  const plan = planRescue([late], t(15), WINDOW)
  expect(plan.moves.every(m => m.time >= '15:00')).toBe(true)
})

// 5. Sleep is a wall. Nothing is placed past the end of the waking window.
test('nothing is placed past the start of sleep, however much is left over', () => {
  const a = task('a', '09:00', 90)
  const b = task('b', '10:30', 90)
  const plan = planInterrupt([a, b], { title: 'X', start: t(9), minutes: 60 }, {}, { start: t(7), end: t(12) })
  const placed = plan.moves.map(m => m.time)
  expect(placed.every(time => time < '12:00')).toBe(true)
})

// 6. A block has a window it means anything in. Gym at eleven is not gym.
test('a block is not placed past the hour it stops being itself, and waits for tomorrow', () => {
  const gym = { ...task('gym', '18:00', 60), category: 'health' }
  const wall = task('wall', '18:00', 240)
  const plan = planInterrupt([gym, wall], { title: 'X', start: t(18), minutes: 60 }, { wall: 'keep' }, WINDOW)
  // The only room after the interruption is past nine, which is past what
  // a Health block is - so it goes to tomorrow rather than to 22:00.
  expect(plan.moves).toEqual([])
  expect(plan.tomorrow).toEqual(['gym'])
})

// 7. Two meals do not end up an hour apart because the afternoon moved.
test('a meal is not placed within two hours of another meal', () => {
  const lunch = { ...task('lunch', '12:30', 45), category: 'meal' }
  const dinner = { ...task('dinner', '18:00', 45), category: 'meal' }
  const plan = planInterrupt([lunch, dinner], { title: 'X', start: t(18), minutes: 30 }, { lunch: 'keep' }, WINDOW)
  const placed = plan.moves.find(m => m.taskId === 'dinner')
  expect(placed && placed.time >= '14:30').toBe(true)
})

// 11. The same plan twice is the same day. Sync hands intentions over twice.
test('placing the same plan twice lands everything in the same place', () => {
  const data = withTasks([task('a', '09:00', 60), task('b', '10:00', 60)])
  const plan = planInterrupt(data.days[DAY].tasks, { title: 'X', start: t(9), minutes: 120 }, {}, WINDOW)
  const once = applyPlan(data, DAY, plan, () => 'id')
  const twice = applyPlan(once, DAY, plan, () => 'id')
  expect(twice.days[DAY].tasks).toEqual(once.days[DAY].tasks)
})
