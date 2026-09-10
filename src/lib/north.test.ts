import { beforeEach, expect, test } from 'vitest'
import { actions, getData, subscribe } from './store'
import { defaultData } from './storage'
import {
  activeGoals,
  archivedGoals,
  canAddGoal,
  cleanAvoid,
  cleanDeserve,
  deserveForWeek,
  goalAge,
  goalForDay,
  hasStuckTask,
  northPrompt,
  wasSlowDay,
} from './north'
import { MAX_ACTIVE_GOALS, MAX_DESERVE_LINES, type AppData, type Goal, type Task } from './types'

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

/**
 * The one question the v2.18 brief asked about this number: can it fall?
 *
 * A number that falls is a streak under another name, and the app is built on
 * a missed day not being damage - DECISIONS, "Review says facts, and no
 * longer a streak". So this walks a goal through everything a person can do
 * to one and holds the age against it. `createdAt` is written once, at
 * creation, and nothing else in the store touches it; this is what says so
 * out loud, so that a later edit to `updateGoal` or `restoreGoal` that starts
 * stamping the date has somewhere to fail.
 */
test('nothing a person does to a goal can make its age smaller', () => {
  actions.addGoal({ title: 'A direction', why: 'A reason' }, MON)
  const id = getData().goals[0].id
  const at = (date: string) => goalAge(getData().goals[0], date)

  expect(at(WED)).toBe(3)

  actions.updateGoal(id, { why: 'A better reason', deserve: ['walk after lunch'] })
  expect(at(WED)).toBe(3)

  actions.archiveGoal(id, TUE)
  expect(at(WED)).toBe(3)

  actions.restoreGoal(id)
  expect(at(WED)).toBe(3)

  // And no day between is a day it can be lost on: an empty Tuesday, a
  // Tuesday with everything done, and a Tuesday nobody opened the app on all
  // read the same, because the number is arithmetic on two dates and reads
  // nothing else.
  expect(at(MON)).toBe(1)
  expect(at(TUE)).toBe(2)
  expect(at('2026-12-25')).toBeGreaterThan(at(WED))
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

/**
 * One switch, not two. Until v2.5 the Monday card and the slow-day card had
 * a switch each, and nobody has ever wanted one without the other: a person
 * who does not want a goal brought forward does not want it brought forward
 * on a Monday either. Turning it off takes both cards with it.
 */
test('the switch off means it never comes forward on its own, Monday included', () => {
  const base = dataWithGoal()
  const data = withDay(MON, [task({ highlight: true }), task(), task()], {
    ...base,
    settings: { ...base.settings, north: { afterASlowDay: false } },
  })
  expect(northPrompt(data, TUE, null)).toBeUndefined()
  expect(northPrompt(data, MON, null)).toBeUndefined()
})

test('the switch on carries both cards, the slow day and the Monday', () => {
  const base = dataWithGoal()
  const data = withDay(MON, [task({ highlight: true }), task(), task()], {
    ...base,
    settings: { ...base.settings, north: { afterASlowDay: true } },
  })
  expect(northPrompt(data, TUE, null)?.kind).toBe('slack')
  expect(northPrompt(data, MON, null)?.kind).toBe('monday')
})

// --- it survives a backup ------------------------------------------------

test('goals and their settings survive export and re-import', async () => {
  const { exportJson, importJson } = await import('./storage')
  const data = dataWithGoal()
  data.goals[0].why = 'Because they will remember.'
  data.goals[0].identity = 'I am someone who shows up.'
  data.goals[0].deserve = ['train four times a week', 'sleep by eleven']
  data.picture = { text: 'I wake before the house does.' }
  data.settings.north = { afterASlowDay: false }

  const back = importJson(exportJson(data))
  expect(back.goals).toEqual(data.goals)
  expect(back.picture).toEqual({ text: 'I wake before the house does.' })
  expect(back.settings.north).toEqual({ afterASlowDay: false })
})

// --- what you do to deserve it -------------------------------------------

/**
 * "What I do to deserve this" is the bridge between a goal and a day: two to
 * four concrete things done most days, not wishes. Four at most, because a
 * list of ten things done every day is a routine pretending to be a reason.
 */
test('a goal carries what you do to deserve it, trimmed, empty lines dropped, four at most', () => {
  actions.addGoal(
    {
      title: 'Be strong at fifty',
      deserve: ['  train four times a week ', '', 'walk after lunch', 'sleep by eleven', 'stretch', 'a fifth thing'],
    },
    MON,
  )
  expect(getData().goals[0].deserve).toEqual(['train four times a week', 'walk after lunch', 'sleep by eleven', 'stretch'])
})

test('a goal written with nothing to deserve carries no list at all', () => {
  actions.addGoal({ title: 'Be strong at fifty', deserve: ['', '  '] }, MON)
  expect(getData().goals[0].deserve).toBeUndefined()
})

test('editing the deserve lines replaces them, and clearing them removes the list', () => {
  const g = actions.addGoal({ title: 'Be strong', deserve: ['train'] }, MON)!
  actions.updateGoal(g.id, { deserve: ['train', 'walk'] })
  expect(getData().goals[0].deserve).toEqual(['train', 'walk'])
  actions.updateGoal(g.id, { deserve: [] })
  expect(getData().goals[0].deserve).toBeUndefined()
})

/**
 * The Monday card shows one deserve line for the week. Chosen from the date
 * the way the goal and the rule are - the same line all week, a different one
 * next week - so a Monday and the Friday after it agree about what this week
 * was for.
 */
test('the line for the week holds from Monday to Sunday, and moves on the next Monday', () => {
  const g = goal({ deserve: ['train four times', 'walk after lunch', 'sleep by eleven'] })
  const monday = deserveForWeek(g, MON)
  expect(monday).toBeDefined()
  // The Sunday of the same week, then the Monday after it.
  expect(deserveForWeek(g, '2026-09-06')).toBe(monday)
  expect(deserveForWeek(g, '2026-09-07')).not.toBe(monday)
  expect(deserveForWeek(goal(), MON)).toBeUndefined()
})

// --- the picture ----------------------------------------------------------

/**
 * The picture is one text about the person you are becoming, and the heading
 * over everything else in North. One entity, because it is one thing: there
 * is no second picture for two devices to fight over.
 */
test('the picture is kept trimmed, and emptying it removes it rather than leaving a blank', () => {
  actions.setPicture('  I wake before the house does.  ')
  expect(getData().picture?.text).toBe('I wake before the house does.')
  actions.setPicture('   ')
  expect(getData().picture).toBeUndefined()
})

// --- compose: the whole window in one press --------------------------------

/**
 * Compose edits every layer at once and Save is one commit: the picture, each
 * goal's fields, what to archive, what to add. One commit means one sync
 * stamp per thing that changed and nothing half-saved if the tab closes
 * between two of them.
 */
test('compose writes the picture and every goal in one commit', () => {
  const keep = actions.addGoal({ title: 'Ship something', why: 'Because rented is not mine' }, MON)!
  const going = actions.addGoal({ title: 'Old direction' }, MON)!
  let commits = 0
  const stop = subscribe(() => {
    commits++
  })

  actions.composeNorth(
    {
      picture: 'I wake before the house does.',
      goals: [
        {
          id: keep.id,
          title: 'Ship something people keep using',
          why: '',
          identity: 'Someone who finishes.',
          deserve: ['open the editor before the inbox', ''],
        },
        { id: going.id, title: 'Old direction', archive: true },
        { title: 'Be strong at fifty', deserve: ['train four times a week'] },
        { title: '   ' },
      ],
    },
    WED,
  )
  stop()

  expect(commits).toBe(1)
  expect(getData().picture?.text).toBe('I wake before the house does.')
  const kept = getData().goals.find(g => g.id === keep.id)!
  expect(kept).toMatchObject({
    title: 'Ship something people keep using',
    identity: 'Someone who finishes.',
    deserve: ['open the editor before the inbox'],
  })
  expect(kept.why).toBeUndefined()
  expect(getData().goals.find(g => g.id === going.id)?.archivedAt).toBe(WED)
  const added = getData().goals.find(g => g.title === 'Be strong at fifty')!
  expect(added).toMatchObject({ createdAt: WED, deserve: ['train four times a week'] })
  // The blank row was never a goal.
  expect(activeGoals(getData().goals).map(g => g.title)).toEqual(['Ship something people keep using', 'Be strong at fifty'])
})

test('compose refuses a fifth goal rather than evicting, and an archive in the same press makes room', () => {
  for (let i = 0; i < MAX_ACTIVE_GOALS; i++) actions.addGoal({ title: `Goal ${i}` }, MON)
  const [first] = getData().goals
  actions.composeNorth({ picture: '', goals: [{ title: 'One too many' }] }, WED)
  expect(activeGoals(getData().goals)).toHaveLength(MAX_ACTIVE_GOALS)
  expect(getData().goals.some(g => g.title === 'One too many')).toBe(false)

  actions.composeNorth(
    { picture: '', goals: [{ id: first.id, title: first.title, archive: true }, { title: 'Now there is room' }] },
    WED,
  )
  expect(activeGoals(getData().goals).map(g => g.title)).toEqual(['Goal 1', 'Goal 2', 'Goal 3', 'Now there is room'])
})

test('a goal whose title was emptied in compose keeps its old title rather than vanishing', () => {
  const g = actions.addGoal({ title: 'Ship something' }, MON)!
  actions.composeNorth({ picture: '', goals: [{ id: g.id, title: '', why: 'Because' }] }, WED)
  expect(getData().goals[0]).toMatchObject({ title: 'Ship something', why: 'Because' })
})

test('compose with nothing changed writes nothing new', () => {
  const g = actions.addGoal({ title: 'Ship something', why: 'Because' }, MON)!
  actions.setPicture('I wake early.')
  const before = getData()
  actions.composeNorth({ picture: 'I wake early.', goals: [{ id: g.id, title: 'Ship something', why: 'Because' }] }, WED)
  expect(getData().goals).toEqual(before.goals)
  expect(getData().picture).toEqual(before.picture)
})

/**
 * The other half of a goal: what the man it makes you does not do.
 *
 * Why it is here at all, and why in this exact shape, is
 * docs/RESEARCH-NORTH.md. The short version: an expected self predicts
 * behaviour far better when it is paired with a feared self **in the same
 * domain** - unpaired is the case that predicts the worse outcome - and a
 * feared self with no strategy beside it is not a motivator but a worry.
 *
 * So this is stored on the goal, beside `deserve`, cleaned by the same rules
 * and capped at the same four. It is a contrast held inside an approach
 * goal, never a goal of its own: avoidance goals are their own well
 * replicated literature and they cost wellbeing.
 */
test('the lines a goal avoids are cleaned exactly as the ones it deserves are', () => {
  expect(cleanAvoid(['  makes a face  ', '', '   ', 'goes quiet for a day'])).toEqual([
    'makes a face',
    'goes quiet for a day',
  ])
})

test('nothing left means no list at all, the way absent means unwritten everywhere else here', () => {
  expect(cleanAvoid([])).toBeUndefined()
  expect(cleanAvoid(['   ', ''])).toBeUndefined()
  expect(cleanAvoid(undefined)).toBeUndefined()
})

test('it holds the same four the doing half does, so neither side of the pair can outgrow the other', () => {
  const many = ['one', 'two', 'three', 'four', 'five', 'six']
  expect(cleanAvoid(many)).toHaveLength(MAX_DESERVE_LINES)
  expect(cleanAvoid(many)).toEqual(cleanDeserve(many))
})
