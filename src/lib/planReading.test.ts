import { expect, test } from 'vitest'
import { planReading, readingLine, readingMarkdown } from './planReading'
import { datesBetween } from './review'
import { defaultData } from './storage'
import { applyStamps } from './stamping'
import { formatWeekTitle } from './dates'
import type { AppData, DayPlan, Task, Template } from './types'

/**
 * The reading is counts from the days and the templates as they are, and
 * nothing recorded on the way: a block happened at its time when its task is
 * done at the block's time, moved when it sits at another time, was set aside
 * when the flag says so, and was not done otherwise - unticked at its time or
 * gone from the day. The tests below are the fixture week the brief asked
 * for, one state at a time, then the order, the edges and the copy.
 */

const work: Template = {
  id: 't1',
  name: 'Work day',
  color: '#8ab6f9',
  blocks: [
    { id: 'b1', time: '09:00', title: 'Deep work', minutes: 120 },
    { id: 'b2', time: '12:30', title: 'Lunch', minutes: 45 },
    { id: 'b3', title: 'Something outside' },
  ],
}

/** Monday 7 to Sunday 13 September 2026. */
const WEEK = datesBetween('2026-09-07', '2026-09-13')
const WORKDAYS = WEEK.slice(0, 5)
/** The Monday after, so every day of the week is in the past. */
const AFTER = '2026-09-14'

let ids = 0

/** A task as stamping writes it for a block, with whatever happened to it after. */
function taskFor(blockId: string, over: Partial<Task> = {}, template: Template = work): Task {
  const block = template.blocks.find(b => b.id === blockId)!
  return {
    id: `task-${++ids}`,
    title: block.title,
    time: block.time,
    done: false,
    fromTemplate: true,
    origin: { type: 'template', sourceId: template.id, blockId },
    ...over,
  }
}

function dayOf(date: string, tasks: Task[], templateId = 't1'): DayPlan {
  return { date, templateId, tasks }
}

function weekOf(days: DayPlan[], templates: Template[] = [work]): AppData {
  return { ...defaultData(), templates, days: Object.fromEntries(days.map(d => [d.date, d])) }
}

const lineFor = (readings: ReturnType<typeof planReading>, title: string) =>
  readingLine(readings.find(r => r.title === title)!)

test('a block done at its time on every day reads happened at its time N of N days and nothing else', () => {
  const data = weekOf(
    WORKDAYS.map(date =>
      dayOf(date, [taskFor('b1', { done: true }), taskFor('b2', { done: true }), taskFor('b3', { done: true })]),
    ),
  )
  const readings = planReading(data, WEEK, AFTER)
  expect(lineFor(readings, 'Deep work')).toBe('Deep work 09:00 - happened at its time 5 of 5 days')
  expect(lineFor(readings, 'Lunch')).toBe('Lunch 12:30 - happened at its time 5 of 5 days')
})

test('a block moved later on three days says how many times and the average, and is not counted as happened at its time', () => {
  const moved = ['10:00', '10:00', '10:30']
  const data = weekOf(
    WORKDAYS.map((date, i) =>
      dayOf(date, [i < 2 ? taskFor('b1', { done: true }) : taskFor('b1', { time: moved[i - 2], done: i === 2 })]),
    ),
  )
  const readings = planReading(data, WEEK, AFTER)
  expect(lineFor(readings, 'Deep work')).toBe(
    'Deep work 09:00 - happened at its time 2 of 5 days, moved later 3 times (avg +1h 10 min)',
  )
  expect(readings.find(r => r.title === 'Deep work')).toMatchObject({ atTime: 2, movedLater: 3, avgLater: 70 })
})

test('a block moved earlier reads moved earlier with a minus', () => {
  const data = weekOf(
    WORKDAYS.map((date, i) => dayOf(date, [taskFor('b2', i === 0 ? { time: '12:00', done: true } : { done: true })])),
  )
  const readings = planReading(data, WEEK, AFTER)
  expect(lineFor(readings, 'Lunch')).toBe('Lunch 12:30 - happened at its time 4 of 5 days, moved earlier once (-30 min)')
})

test('once and twice are words, three is a number', () => {
  const data = weekOf(
    WORKDAYS.map((date, i) =>
      dayOf(date, [
        // Deep work: three days half an hour later.
        taskFor('b1', i < 2 ? { done: true } : { time: '09:30', done: true }),
        // Lunch: twice later, a quarter and three quarters of an hour.
        taskFor('b2', i === 0 ? { time: '12:45' } : i === 1 ? { time: '13:15' } : { done: true }),
        // Something outside: done every day but one.
        taskFor('b3', { done: i !== 4 }),
      ]),
    ),
  )
  const readings = planReading(data, WEEK, AFTER)
  expect(lineFor(readings, 'Deep work')).toBe(
    'Deep work 09:00 - happened at its time 2 of 5 days, moved later 3 times (avg +30 min)',
  )
  expect(lineFor(readings, 'Lunch')).toBe('Lunch 12:30 - happened at its time 3 of 5 days, moved later twice (avg +30 min)')
  expect(lineFor(readings, 'Something outside')).toBe('Something outside - happened 4 of 5 days, not done once')
})

test('a set-aside block that is not done is set aside, and one that was brought back and done is not', () => {
  const data = weekOf([
    dayOf(WEEK[0], [taskFor('b1', { setAside: true })]),
    // Brought back: the flag is gone and the tick is there.
    dayOf(WEEK[1], [taskFor('b1', { done: true })]),
  ])
  const readings = planReading(data, WEEK, AFTER)
  expect(lineFor(readings, 'Deep work')).toBe('Deep work 09:00 - happened at its time 1 of 2 days, set aside once')
})

test('a block whose task is gone from the day is not done', () => {
  const data = weekOf([
    dayOf(WEEK[0], [taskFor('b2', { done: true })]),
    dayOf(WEEK[1], [taskFor('b2', { done: true })]),
  ])
  const readings = planReading(data, WEEK, AFTER)
  expect(lineFor(readings, 'Deep work')).toBe('Deep work 09:00 - happened at its time 0 of 2 days, not done twice')
  // An unticked task still on the day at its time is not done either.
  const unticked = planReading(weekOf([dayOf(WEEK[0], [taskFor('b1')])]), WEEK, AFTER)
  expect(lineFor(unticked, 'Deep work')).toBe('Deep work 09:00 - happened at its time 0 of 1 day, not done once')
})

test('a block with no time on the template reads happened rather than at its time', () => {
  const data = weekOf(
    WORKDAYS.map((date, i) =>
      // Ticked on two days, once after being given a time by hand - with no
      // time on the template there is nothing for that to differ from.
      dayOf(date, [taskFor('b3', i === 0 ? { done: true } : i === 1 ? { time: '16:00', done: true } : {})]),
    ),
  )
  const readings = planReading(data, WEEK, AFTER)
  expect(lineFor(readings, 'Something outside')).toBe('Something outside - happened 2 of 5 days, not done 3 times')
  expect(readings.find(r => r.title === 'Something outside')).toMatchObject({ movedLater: 0, movedEarlier: 0 })
})

test('only days before today count, so the current week reads Monday to yesterday', () => {
  const data = weekOf(WEEK.map(date => dayOf(date, [taskFor('b1', { done: true })])))
  const thursday = planReading(data, WEEK, '2026-09-10')
  expect(lineFor(thursday, 'Deep work')).toBe('Deep work 09:00 - happened at its time 3 of 3 days')
  // On the Monday nothing has happened yet, and the reading says nothing.
  expect(planReading(data, WEEK, '2026-09-07')).toEqual([])
})

test('the largest disagreement comes first, then the most moved, then the earlier time', () => {
  const four: Template = { ...work, blocks: [...work.blocks, { id: 'b4', time: '14:00', title: 'Email', minutes: 30 }] }
  const data = weekOf(
    WORKDAYS.map((date, i) =>
      dayOf(date, [
        // Deep work: two days it did not happen.
        taskFor('b1', { done: i < 3 }, four),
        // Lunch: two days later, the same two days short of its time.
        taskFor('b2', i < 3 ? { done: true } : { time: '13:00', done: true }, four),
        // Something outside: two days it did not happen, and no time to sort by.
        taskFor('b3', { done: i < 3 }, four),
        // Email: every day at its time.
        taskFor('b4', { done: true }, four),
      ]),
    ),
    [four],
  )
  expect(planReading(data, WEEK, AFTER).map(r => r.title)).toEqual(['Lunch', 'Deep work', 'Something outside', 'Email'])
})

test("a day stamped from a week template reads that weekday's column", () => {
  const shifts: Template = {
    id: 'w1',
    name: 'Shifts',
    color: '#c9b3f0',
    kind: 'week',
    blocks: [
      { id: 'mon', weekday: 1, time: '09:00', title: 'Monday standup' },
      { id: 'tue', weekday: 2, time: '09:00', title: 'Tuesday planning' },
    ],
  }
  const data = weekOf(
    [
      dayOf(WEEK[0], [taskFor('mon', { done: true }, shifts)], 'w1'),
      dayOf(WEEK[1], [taskFor('tue', { done: true }, shifts)], 'w1'),
    ],
    [shifts],
  )
  const readings = planReading(data, WEEK, AFTER)
  expect(readings.map(readingLine)).toEqual([
    'Monday standup 09:00 - happened at its time 1 of 1 day',
    'Tuesday planning 09:00 - happened at its time 1 of 1 day',
  ])
})

test('a task stamped before origins existed is matched by its title and time', () => {
  const data = weekOf([
    dayOf(WEEK[0], [{ id: 'old', title: 'Deep work', time: '09:00', done: true, fromTemplate: true }]),
  ])
  const readings = planReading(data, WEEK, AFTER)
  expect(lineFor(readings, 'Deep work')).toBe('Deep work 09:00 - happened at its time 1 of 1 day')
})

test('a repeat instance is not a block', () => {
  const walk: Task = { id: 'w', title: 'Walk', time: '17:30', done: true, origin: { type: 'repeat', sourceId: 'r1' } }
  // A repeat that happens to share a block's name and time does not stand for it.
  const twin: Task = { id: 'tw', title: 'Deep work', time: '09:00', done: true, origin: { type: 'repeat', sourceId: 'r2' } }
  const data = weekOf([dayOf(WEEK[0], [taskFor('b1', { done: true }), walk]), dayOf(WEEK[1], [twin])])
  const readings = planReading(data, WEEK, AFTER)
  expect(readings.map(r => r.title).sort()).toEqual(['Deep work', 'Lunch', 'Something outside'])
  expect(lineFor(readings, 'Deep work')).toBe('Deep work 09:00 - happened at its time 1 of 2 days, not done once')
})

test('an empty week - no past day with a template - reads nothing', () => {
  expect(planReading(weekOf([]), WEEK, AFTER)).toEqual([])
  const untemplated = weekOf([{ date: WEEK[0], tasks: [{ id: 'm', title: 'Call the bank', done: true }] }])
  expect(planReading(untemplated, WEEK, AFTER)).toEqual([])
})

test('the markdown groups lines under the template with the week in the heading', () => {
  const rest: Template = {
    id: 't2',
    name: 'Rest day',
    color: '#a7e3bd',
    blocks: [{ id: 'r1', time: '09:30', title: 'Long breakfast' }],
  }
  const data = weekOf(
    [
      dayOf(WEEK[0], [taskFor('b1', { done: true }), taskFor('b2', { done: true })]),
      dayOf(WEEK[1], [taskFor('b1', { done: true }), taskFor('b2', { time: '13:15', done: true })]),
      dayOf(WEEK[5], [], 't2'),
    ],
    [work, rest],
  )
  const readings = planReading(data, WEEK, AFTER)
  expect(readingMarkdown(readings, formatWeekTitle(WEEK))).toBe(
    [
      '# Where the plan and the week disagreed, 7 - 13 September 2026',
      '',
      '## Work day',
      '',
      '- Something outside - happened 0 of 2 days, not done twice',
      '- Lunch 12:30 - happened at its time 1 of 2 days, moved later once (+45 min)',
      '- Deep work 09:00 - happened at its time 2 of 2 days',
      '',
      '## Rest day',
      '',
      '- Long breakfast 09:30 - happened at its time 0 of 1 day, not done once',
      '',
    ].join('\n'),
  )
})

test('a template deleted after the week reads nothing for it rather than crashing', () => {
  const gone = weekOf([dayOf(WEEK[0], [taskFor('b1', { done: true })], 't-gone')], [])
  expect(planReading(gone, WEEK, AFTER)).toEqual([])
  // The other template's days still read.
  const mixed = weekOf([dayOf(WEEK[0], [taskFor('b1', { done: true })]), dayOf(WEEK[1], [], 't-gone')])
  expect(planReading(mixed, WEEK, AFTER).map(r => r.templateId)).toEqual(['t1', 't1', 't1'])
})

test('a week stamped through applyStamps and then lived reads the same as one built by hand', () => {
  const stamped = applyStamps({}, [work], Object.fromEntries(WORKDAYS.map(date => [date, 't1'])))
  for (const [i, date] of WORKDAYS.entries()) {
    const tasks = stamped[date].tasks
    tasks.find(t => t.title === 'Deep work')!.done = i !== 4
    if (i === 3) tasks.find(t => t.title === 'Lunch')!.time = '13:00'
  }
  const readings = planReading({ ...defaultData(), templates: [work], days: stamped }, WEEK, AFTER)
  expect(lineFor(readings, 'Deep work')).toBe('Deep work 09:00 - happened at its time 4 of 5 days, not done once')
  expect(lineFor(readings, 'Lunch')).toBe(
    'Lunch 12:30 - happened at its time 0 of 5 days, moved later once (+30 min), not done 4 times',
  )
})

// How long it actually took, in the reading that already says when things
// happened - from v2.15. The line is about length rather than about time, so
// it is counted apart from the four outcomes: a block can be moved and still
// be measured.

test('a measured block says what it took, against what it was planned at', () => {
  // Two of the five days measured, at ninety and a hundred minutes, against
  // the two hours the block is planned at.
  const data = weekOf(
    WORKDAYS.map((date, i) =>
      dayOf(date, [taskFor('b1', { done: true, ...(i < 2 ? { actualMinutes: i === 0 ? 90 : 100 } : {}) })]),
    ),
  )
  const reading = planReading(data, WEEK, AFTER).find(r => r.title === 'Deep work')!

  expect(reading.timed).toBe(2)
  expect(reading.avgActual).toBe(95)
  const line = readingLine(reading)
  expect(line).toContain('took on average 1h 35 min')
  expect(line).toContain('against 2h planned')
  expect(line).toContain('twice measured')
})

test('one measurement says took rather than took on average', () => {
  const data = weekOf(WORKDAYS.map((date, i) => dayOf(date, [taskFor('b1', { done: true, ...(i === 0 ? { actualMinutes: 90 } : {}) })])))
  const line = readingLine(planReading(data, WEEK, AFTER).find(r => r.title === 'Deep work')!)
  expect(line).toContain('took 1h 30 min')
  expect(line).not.toContain('on average')
})

test('a block nobody measured says nothing about how long it took', () => {
  const data = weekOf(WORKDAYS.map(date => dayOf(date, [taskFor('b1', { done: true })])))
  const reading = planReading(data, WEEK, AFTER).find(r => r.title === 'Deep work')!
  expect(reading.timed).toBe(0)
  expect(reading.avgActual).toBeUndefined()
  // Nothing measures anything on its own, so this is the ordinary case.
  expect(readingLine(reading)).not.toContain('took')
})

test('a measurement is counted even on a day the block moved', () => {
  // A block can be moved and still be measured: one is a fact about when, the
  // other about how long, and they are tallied apart.
  const data = weekOf(WORKDAYS.map(date => dayOf(date, [taskFor('b1', { done: true, time: '11:00', actualMinutes: 80 })])))
  const reading = planReading(data, WEEK, AFTER).find(r => r.title === 'Deep work')!
  expect(reading.movedLater).toBe(5)
  expect(reading.timed).toBe(5)
  expect(readingLine(reading)).toContain('took on average 1h 20 min')
})
