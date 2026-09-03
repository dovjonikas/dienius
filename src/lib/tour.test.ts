import { expect, test } from 'vitest'
import {
  DESKTOP_STEPS,
  MOBILE_STEPS,
  TOUR_EVENTS,
  discardTourCreated,
  keepTourCreated,
  markTourCreated,
  resolveText,
  tourTask,
  tourWordTotal,
  wordCount,
  type TourContext,
} from './tour'
import { defaultData } from './storage'
import type { AppData, Task } from './types'

const TODAY = '2026-09-03'

function task(id: string, patch: Partial<Task> = {}): Task {
  return { id, title: id, done: false, ...patch }
}

function withTasks(tasks: Task[], base = defaultData()): AppData {
  return { ...base, days: { ...base.days, [TODAY]: { date: TODAY, tasks } } }
}

function ctx(before: AppData, now: AppData, focusRunning = false): TourContext {
  return { before, now, today: TODAY, focusRunning }
}

// --- the budget -------------------------------------------------------------
//
// A tour is read while the eye is on the thing being pointed at. Every word
// past the first line is a word between the person and the control, so the
// budget is a contract, not a guideline: under 120 words in total, five in a
// title, fifteen in a line. Both platforms, because a phone gets its own copy.

for (const [name, steps] of [['desktop', DESKTOP_STEPS], ['mobile', MOBILE_STEPS]] as const) {
  test(`the ${name} tour is under 120 words in total`, () => {
    expect(tourWordTotal(steps)).toBeLessThan(120)
  })

  test(`every ${name} title is five words or fewer, every line fifteen or fewer`, () => {
    for (const step of steps) {
      expect(wordCount(step.title), step.id).toBeLessThanOrEqual(5)
      expect(wordCount(step.text), step.id).toBeLessThanOrEqual(15)
    }
  })

  test(`the ${name} tour is nine steps, starting with a welcome and ending with a choice`, () => {
    expect(steps).toHaveLength(9)
    expect(steps[0].event).toBe('start')
    expect(steps[steps.length - 1].event).toBe('finish')
  })

  test(`no ${name} step in the middle ends on a button - each waits for something real`, () => {
    for (const step of steps.slice(1, -1)) {
      expect(step.event, step.id).not.toBe('start')
      expect(step.event, step.id).not.toBe('finish')
      expect(step.targets.length, step.id).toBeGreaterThan(0)
    }
  })

  test(`nothing in the ${name} tour uses a dash that is not a hyphen`, () => {
    for (const step of steps) {
      expect(step.title + step.text).not.toMatch(/[–—]/)
    }
  })
}

test('the two ends never resolve by themselves', () => {
  const data = defaultData()
  expect(TOUR_EVENTS.start(ctx(data, data))).toBe(false)
  expect(TOUR_EVENTS.finish(ctx(data, data))).toBe(false)
})

// --- what ends a step ---------------------------------------------------------

test('stamping ends the stamp step, and only a stamp that happened during it', () => {
  const empty = defaultData()
  const stamped = { ...empty, days: { [TODAY]: { date: TODAY, tasks: [], templateId: 'work' } } }
  expect(TOUR_EVENTS.stamped(ctx(empty, stamped))).toBe(true)
  // A day that already had a template when the step began is not the tour's doing.
  expect(TOUR_EVENTS.stamped(ctx(stamped, stamped))).toBe(false)
})

test('a task added today ends the add step; one added yesterday does not', () => {
  const before = withTasks([task('a')])
  expect(TOUR_EVENTS['task-added'](ctx(before, withTasks([task('a'), task('b')])))).toBe(true)
  const elsewhere = { ...before, days: { ...before.days, '2026-09-02': { date: '2026-09-02', tasks: [task('z')] } } }
  expect(TOUR_EVENTS['task-added'](ctx(before, elsewhere))).toBe(false)
})

test('marking a task key, ticking one off, starting focus, adding a list, adding a goal', () => {
  const before = withTasks([task('a')])
  expect(TOUR_EVENTS['key-marked'](ctx(before, withTasks([task('a', { highlight: true })])))).toBe(true)
  expect(TOUR_EVENTS['task-done'](ctx(before, withTasks([task('a', { done: true })])))).toBe(true)
  expect(TOUR_EVENTS['focus-started'](ctx(before, before, true))).toBe(true)
  expect(TOUR_EVENTS['focus-started'](ctx(before, before, false))).toBe(false)
  const list = { ...before, library: [{ id: 'l', name: 'Books', unit: 'chapter', items: [] }] }
  expect(TOUR_EVENTS['list-added'](ctx(before, list))).toBe(true)
  const goal = { ...before, goals: [{ id: 'g', title: 'Be strong', createdAt: TODAY }] }
  expect(TOUR_EVENTS['goal-added'](ctx(before, goal))).toBe(true)
})

test('the clock is written into the add step so the task it asks for is the running one', () => {
  expect(resolveText('Type {now} Lunch 30 min, then Enter.', new Date(2026, 8, 3, 9, 5))).toBe(
    'Type 09:05 Lunch 30 min, then Enter.',
  )
})

test('the tour task is the newest hand-made one it flagged, never a template block', () => {
  const data = withTasks([
    task('block', { tourCreated: true, fromTemplate: true }),
    task('lunch', { tourCreated: true }),
    task('mine'),
  ])
  expect(tourTask(data, TODAY)?.id).toBe('lunch')
})

// --- what the tour made ------------------------------------------------------
//
// "Start clean" has to remove exactly what the tour made and nothing else, on
// a plan that may already hold a year of somebody's days. The flag is written
// by diffing in commit(), so the test is of the diff.

test('whatever appears while the tour runs is flagged; what was already there is not', () => {
  const before = withTasks([task('old')])
  before.templates.push({ id: 't-old', name: 'Old', color: '#fff', blocks: [] })
  const after = withTasks([task('old'), task('new')], before)
  after.templates = [...before.templates, { id: 't-new', name: 'New', color: '#fff', blocks: [] }]
  after.library = [{ id: 'l', name: 'Books', unit: 'chapter', items: [] }]
  after.goals = [{ id: 'g', title: 'Be strong', createdAt: TODAY }]

  const marked = markTourCreated(before, after)
  const tasks = marked.days[TODAY].tasks
  expect(tasks.find(t => t.id === 'old')?.tourCreated).toBeUndefined()
  expect(tasks.find(t => t.id === 'new')?.tourCreated).toBe(true)
  expect(marked.templates.find(t => t.id === 't-old')?.tourCreated).toBeUndefined()
  expect(marked.templates.find(t => t.id === 't-new')?.tourCreated).toBe(true)
  expect(marked.library[0].tourCreated).toBe(true)
  expect(marked.goals[0].tourCreated).toBe(true)
})

test('a commit that adds nothing new comes back as the same object', () => {
  const data = withTasks([task('a')])
  const same = withTasks([task('a', { done: true })], data)
  expect(markTourCreated(data, same)).toBe(same)
})

test('Start clean removes the flagged entities and the day reference to a flagged template, nothing else', () => {
  const data = withTasks([task('old'), task('new', { tourCreated: true })])
  data.templates = [
    { id: 't-old', name: 'Old', color: '#fff', blocks: [] },
    { id: 't-new', name: 'New', color: '#fff', blocks: [], tourCreated: true },
  ]
  data.days[TODAY].templateId = 't-new'
  data.days['2026-09-01'] = { date: '2026-09-01', tasks: [task('kept')], templateId: 't-old' }
  data.library = [{ id: 'l', name: 'Books', unit: 'chapter', items: [], tourCreated: true }]
  data.goals = [
    { id: 'g-old', title: 'Old', createdAt: TODAY },
    { id: 'g-new', title: 'New', createdAt: TODAY, tourCreated: true },
  ]

  const clean = discardTourCreated(data)
  expect(clean.days[TODAY].tasks.map(t => t.id)).toEqual(['old'])
  expect(clean.days[TODAY].templateId).toBeUndefined()
  expect(clean.days['2026-09-01'].tasks.map(t => t.id)).toEqual(['kept'])
  expect(clean.days['2026-09-01'].templateId).toBe('t-old')
  expect(clean.templates.map(t => t.id)).toEqual(['t-old'])
  expect(clean.library).toEqual([])
  expect(clean.goals.map(g => g.id)).toEqual(['g-old'])
})

test('Keep what I built strips the flags and leaves everything in place', () => {
  const data = withTasks([task('new', { tourCreated: true })])
  data.templates = [{ id: 't', name: 'New', color: '#fff', blocks: [], tourCreated: true }]
  data.goals = [{ id: 'g', title: 'New', createdAt: TODAY, tourCreated: true }]
  const kept = keepTourCreated(data)
  expect(kept.days[TODAY].tasks[0]).toEqual(task('new'))
  expect(kept.templates[0].tourCreated).toBeUndefined()
  expect(kept.goals[0].tourCreated).toBeUndefined()
  expect(kept.goals).toHaveLength(1)
})
