import { beforeEach, expect, test } from 'vitest'
import { actions, getData } from './store'
import { defaultData } from './storage'
import {
  activeGoals,
  archivedGoals,
  canAddGoal,
  goalAge,
  goalForDay,
  hasStuckTask,
  northPrompt,
  wasSlowDay,
} from './north'
import { MAX_ACTIVE_GOALS, type AppData, type Goal, type Task } from './types'

// 2026-08-31 is a Monday.
const MON = '2026-08-31'
const TUE = '2026-09-01'
const WED = '2026-09-02'

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
})

function goal(over: Partial<Goal> = {}): Goal {
  return { id: crypto.randomUUID(), title: 'A direction', createdAt: MON, ...over }
}

function task(over: Partial<Task> = {}): Task {
  return { id: crypto.randomUUID(), title: 'A task', done: false, ...over }
}

function withDay(date: string, tasks: Task[], base = defaultData()): AppData {
  return { ...base, days: { ...base.days, [date]: { date, tasks } } }
}

// --- writing them down ---------------------------------------------------

test('a goal is what, and optionally why and who it makes you', () => {
  actions.addGoal(
    { title: '  Become the dad worth looking up to  ', why: '  Because they will remember.  ', identity: '' },
    MON,
  )
  expect(getData().goals[0]).toMatchObject({
    title: 'Become the dad worth looking up to',
    why: 'Because they will remember.',
    createdAt: MON,
  })
  // An empty optional is absent, not an empty string sitting in the store.
  expect(getData().goals[0].identity).toBeUndefined()
})

test('a goal with no title is not written down', () => {
  actions.addGoal({ title: '   ' }, MON)
  expect(getData().goals).toEqual([])
})

// Four is a decision about how many directions fit in a life. Quietly
// evicting one would make the cap invisible.
test('the cap refuses rather than dropping the oldest', () => {
  for (let i = 0; i < MAX_ACTIVE_GOALS; i++) actions.addGoal({ title: `Goal ${i}` }, MON)
  expect(canAddGoal(getData().goals)).toBe(false)

  actions.addGoal({ title: 'One too many' }, MON)
  expect(getData().goals).toHaveLength(MAX_ACTIVE_GOALS)
  expect(getData().goals.map(g => g.title)).not.toContain('One too many')
})

test('archiving frees a slot and keeps the goal', () => {
  for (let i = 0; i < MAX_ACTIVE_GOALS; i++) actions.addGoal({ title: `Goal ${i}` }, MON)
  actions.archiveGoal(getData().goals[0].id, WED)

  expect(activeGoals(getData().goals)).toHaveLength(MAX_ACTIVE_GOALS - 1)
  expect(archivedGoals(getData().goals)).toHaveLength(1)
  expect(getData().goals[0].archivedAt).toBe(WED)
  // Nothing records why. "Achieved" and "abandoned" is exactly the scoring
  // this feature exists without.
  expect(Object.keys(getData().goals[0])).not.toContain('outcome')
})

test('a goal brought back keeps the day it was written, not the day it returned', () => {
  actions.addGoal({ title: 'A direction' }, MON)
  const id = getData().goals[0].id
  actions.archiveGoal(id, TUE)
  actions.restoreGoal(id)
  expect(getData().goals[0].archivedAt).toBeUndefined()
  expect(getData().goals[0].createdAt).toBe(MON)
})

test('a goal cannot be brought back into a full list', () => {
  actions.addGoal({ title: 'Archived one' }, MON)
  const id = getData().goals[0].id
  actions.archiveGoal(id, TUE)
  for (let i = 0; i < MAX_ACTIVE_GOALS; i++) actions.addGoal({ title: `Goal ${i}` }, MON)

  actions.restoreGoal(id)
  expect(getData().goals.find(g => g.id === id)?.archivedAt).toBe(TUE)
})

test('editing changes only what was given', () => {
  actions.addGoal({ title: 'A direction', why: 'A reason', identity: 'Someone' }, MON)
  const id = getData().goals[0].id
  actions.updateGoal(id, { why: 'A better reason' })
  expect(getData().goals[0]).toMatchObject({ title: 'A direction', why: 'A better reason', identity: 'Someone' })
})

// --- age is not progress -------------------------------------------------

test('the day a goal was written is its first day', () => {
  expect(goalAge(goal({ createdAt: MON }), MON)).toBe(1)
  expect(goalAge(goal({ createdAt: MON }), TUE)).toBe(2)
  expect(goalAge(goal({ createdAt: MON }), '2026-09-30')).toBe(31)
})

test('a goal written in the future has no age yet rather than a negative one', () => {
  expect(goalAge(goal({ createdAt: WED }), MON)).toBe(0)
})

// --- the rotation --------------------------------------------------------

test('no goals means no line at all', () => {
  expect(goalForDay([], MON)).toBeUndefined()
})

// Random per render would re-roll on every refresh, which turns a steady
// thing into a slot machine.
test('the same date always picks the same goal', () => {
  const goals = [goal({ id: 'a' }), goal({ id: 'b' }), goal({ id: 'c' })]
  expect(goalForDay(goals, WED)?.id).toBe(goalForDay(goals, WED)?.id)
  expect(goalForDay(goals, WED)?.id).toBe(goalForDay(goals, WED)?.id)
})

test('consecutive days walk through the list rather than repeating', () => {
  const goals = [goal({ id: 'a' }), goal({ id: 'b' }), goal({ id: 'c' })]
  const picked = [MON, TUE, WED].map(d => goalForDay(goals, d)?.id)
  expect(new Set(picked).size).toBe(3)
})

test('the rotation comes back round, so every goal is shown', () => {
  const goals = [goal({ id: 'a' }), goal({ id: 'b' })]
  expect(goalForDay(goals, MON)?.id).toBe(goalForDay(goals, WED)?.id)
})

test('an archived goal is never the one shown', () => {
  const goals = [goal({ id: 'a', archivedAt: TUE }), goal({ id: 'b' })]
  for (const date of [MON, TUE, WED]) expect(goalForDay(goals, date)?.id).toBe('b')
})

// --- what counts as a day that got away ----------------------------------

test('a day with no plan is not a slow day - nothing was intended', () => {
  expect(wasSlowDay(undefined)).toBe(false)
  expect(wasSlowDay({ date: MON, tasks: [] })).toBe(false)
})

test('a day where most of it happened is not a slow day', () => {
  expect(wasSlowDay({ date: MON, tasks: [task({ done: true }), task({ done: true }), task()] })).toBe(false)
})

// Both conditions have to hold. A day where two of nine ordinary tasks
// happened but the one key thing did is a good day with a long list on it.
test('a low rate with the key task done is not a slow day', () => {
  const tasks = [task({ highlight: true, done: true }), task(), task(), task(), task()]
  expect(wasSlowDay({ date: MON, tasks })).toBe(false)
})

test('a low rate with nothing that mattered finished is a slow day', () => {
  const tasks = [task({ highlight: true }), task(), task(), task(), task({ done: true })]
  expect(wasSlowDay({ date: MON, tasks })).toBe(true)
})

test('a task carried three days running counts as stuck', () => {
  expect(hasStuckTask({ date: MON, tasks: [task({ pushCount: 3 })] })).toBe(true)
  expect(hasStuckTask({ date: MON, tasks: [task({ pushCount: 2 })] })).toBe(false)
  // Finished is finished, however long it took to get there.
  expect(hasStuckTask({ date: MON, tasks: [task({ pushCount: 9, done: true })] })).toBe(false)
})

// --- when the card appears -----------------------------------------------

function dataWithGoal(): AppData {
  const base = defaultData()
  return { ...base, goals: [goal({ id: 'g' })] }
}

test('no goals means no card, however the week went', () => {
  const data = withDay(MON, [task(), task(), task()], defaultData())
  expect(northPrompt(data, TUE, null)).toBeUndefined()
})

test('an ordinary Tuesday after an ordinary Monday shows nothing', () => {
  const data = withDay(MON, [task({ done: true }), task({ done: true })], dataWithGoal())
  expect(northPrompt(data, TUE, null)).toBeUndefined()
})

test('a Monday shows the week card', () => {
  expect(northPrompt(dataWithGoal(), MON, null)?.kind).toBe('monday')
})

// A week that begins by being told the last one went badly is a week that
// begins with an apology.
test('Monday wins over a slow Sunday', () => {
  const data = withDay('2026-08-30', [task(), task(), task()], dataWithGoal())
  expect(northPrompt(data, MON, null)?.kind).toBe('monday')
})

test('a slow yesterday shows the reminder', () => {
  const data = withDay(MON, [task({ highlight: true }), task(), task()], dataWithGoal())
  expect(northPrompt(data, TUE, null)?.kind).toBe('slack')
})

test('a task stuck for three days shows it too, however yesterday went', () => {
  const data = withDay(TUE, [task({ pushCount: 3 })], dataWithGoal())
  expect(northPrompt(data, TUE, null)?.kind).toBe('slack')
})

test('dismissing holds for the day and no longer', () => {
  const data = withDay(MON, [task({ highlight: true }), task(), task()], dataWithGoal())
  expect(northPrompt(data, TUE, TUE)).toBeUndefined()
  expect(northPrompt(data, TUE, MON)?.kind).toBe('slack')
})

test('both switches off means it never comes forward on its own', () => {
  const base = dataWithGoal()
  const data = withDay(MON, [task({ highlight: true }), task(), task()], {
    ...base,
    settings: { ...base.settings, north: { afterASlowDay: false, onMonday: false } },
  })
  expect(northPrompt(data, TUE, null)).toBeUndefined()
  expect(northPrompt(data, MON, null)).toBeUndefined()
})

test('the Monday switch alone does not silence the slow-day card', () => {
  const base = dataWithGoal()
  const data = withDay(MON, [task({ highlight: true }), task(), task()], {
    ...base,
    settings: { ...base.settings, north: { afterASlowDay: true, onMonday: false } },
  })
  expect(northPrompt(data, TUE, null)?.kind).toBe('slack')
})

// --- it survives a backup ------------------------------------------------

test('goals and their settings survive export and re-import', async () => {
  const { exportJson, importJson } = await import('./storage')
  const data = dataWithGoal()
  data.goals[0].why = 'Because they will remember.'
  data.goals[0].identity = 'I am someone who shows up.'
  data.settings.north = { afterASlowDay: false, onMonday: true }

  const back = importJson(exportJson(data))
  expect(back.goals).toEqual(data.goals)
  expect(back.settings.north).toEqual({ afterASlowDay: false, onMonday: true })
})
