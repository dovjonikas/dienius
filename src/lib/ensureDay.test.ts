import { expect, test } from 'vitest'
import { ensuredDay } from './ensureDay'
import { defaultData } from './storage'
import { addDays } from './dates'
import type { AppData, Template } from './types'

// 2026-09-10 is a Thursday. Which day is "today" is given to the function
// rather than read off the clock inside it, so these dates mean the same
// thing whenever the suite is run.
const THURSDAY = '2026-09-10'
const THE_DAY_BEFORE = addDays(THURSDAY, -1)
const THE_DAY_AFTER = addDays(THURSDAY, 1)

const WORKDAY: Template = {
  id: 'work',
  name: 'Workday',
  color: '#a7c4f5',
  blocks: [
    { id: 'b1', title: 'Commute', time: '08:00', minutes: 30 },
    { id: 'b2', title: 'Deep work', time: '09:00', minutes: 120 },
  ],
}

function withThursdayMapped(): AppData {
  const data = defaultData()
  data.templates = [WORKDAY]
  data.settings.weekdayTemplates = { 4: 'work' }
  return data
}

/**
 * Everything a day gets on its own, worked out without writing it. This is
 * what `actions.ensureDay` commits and what the replan sheet shows for a day
 * nobody has opened: the two have to agree, so they are one function.
 */
test('a day whose weekday names a template is stamped from it, and marked as having been through this', () => {
  const data = withThursdayMapped()
  const ensured = ensuredDay(data, THURSDAY, THURSDAY)
  expect(ensured?.changed).toBe(true)
  expect(ensured?.days[THURSDAY].templateId).toBe('work')
  expect(ensured?.days[THURSDAY].autoApplied).toBe(true)
  expect(ensured?.days[THURSDAY].tasks.map(t => t.title)).toEqual(['Commute', 'Deep work'])
})

test('a day still ahead is stamped the same way, so a week can be looked at before it starts', () => {
  const ensured = ensuredDay(withThursdayMapped(), THURSDAY, THE_DAY_BEFORE)
  expect(ensured?.days[THURSDAY].templateId).toBe('work')
})

/**
 * The map does not reach backwards, which is the same rule "Stamp week"
 * keeps. Scrolling back to look at a Thursday nobody opened is not a reason
 * to fill it in: a plan stamped onto a day that was already over is a plan
 * nobody made, and the month grid draws it a ratio and Review counts it in
 * "where the plan and the week disagreed" as though it had been real. The day
 * is still marked as having been through this, because it has - it was
 * opened, and it was owed nothing.
 */
test('opening a past day that the weekday map names does not stamp it', () => {
  const ensured = ensuredDay(withThursdayMapped(), THURSDAY, THE_DAY_AFTER)
  expect(ensured?.changed).toBe(false)
  expect(ensured?.days[THURSDAY].templateId).toBeUndefined()
  expect(ensured?.days[THURSDAY].tasks).toEqual([])
  expect(ensured?.days[THURSDAY].autoApplied).toBe(true)
})

test('a repeat still lands on a day already past - a series that was running was running, which is a fact rather than an invention', () => {
  const data = withThursdayMapped()
  data.days['2026-09-08'] = {
    date: '2026-09-08',
    tasks: [{ id: 'pills', title: 'Take the pills', time: '08:00', done: false, repeat: 'daily' }],
  }
  const ensured = ensuredDay(data, THURSDAY, THE_DAY_AFTER)
  expect(ensured?.changed).toBe(true)
  expect(ensured?.days[THURSDAY].tasks.map(t => t.title)).toEqual(['Take the pills'])
  expect(ensured?.days[THURSDAY].templateId).toBeUndefined()
})

test('a day already stamped by hand keeps its own template - a deliberate choice outranks a standing rule', () => {
  const data = withThursdayMapped()
  data.templates.push({ id: 'off', name: 'Day off', color: '#cde39e', blocks: [{ id: 'x', title: 'Long walk', time: '10:00' }] })
  data.days[THURSDAY] = { date: THURSDAY, templateId: 'off', tasks: [{ id: 't', title: 'Long walk', time: '10:00', done: false, fromTemplate: true }] }
  const ensured = ensuredDay(data, THURSDAY, THURSDAY)
  expect(ensured?.days[THURSDAY].templateId).toBe('off')
  expect(ensured?.days[THURSDAY].tasks.map(t => t.title)).toEqual(['Long walk'])
  expect(ensured?.changed).toBe(false)
})

test('a day that has been through this once answers null, so the caller can tell nothing-to-do from did-nothing', () => {
  const data = withThursdayMapped()
  data.days[THURSDAY] = { date: THURSDAY, tasks: [], autoApplied: true }
  expect(ensuredDay(data, THURSDAY, THURSDAY)).toBeNull()
})

test('repeats owed to the day are generated onto it, and a series the day skipped stays skipped', () => {
  const data = defaultData()
  data.days['2026-09-08'] = {
    date: '2026-09-08',
    tasks: [
      { id: 'pills', title: 'Take the pills', time: '08:00', done: false, repeat: 'daily' },
      { id: 'stretch', title: 'Stretch', done: false, repeat: 'daily' },
    ],
  }
  data.days[THURSDAY] = { date: THURSDAY, tasks: [], repeatSkips: ['stretch'] }
  const ensured = ensuredDay(data, THURSDAY, THURSDAY)
  expect(ensured?.changed).toBe(true)
  expect(ensured?.days[THURSDAY].tasks.map(t => [t.title, t.repeatOf])).toEqual([['Take the pills', 'pills']])
})

test('it is pure: the state it was given is untouched', () => {
  const data = withThursdayMapped()
  const before = JSON.stringify(data)
  ensuredDay(data, THURSDAY, THURSDAY)
  expect(JSON.stringify(data)).toBe(before)
  expect(data.days[THURSDAY]).toBeUndefined()
})

test('a day with nothing owed to it is still marked as seen, and is empty rather than absent', () => {
  const ensured = ensuredDay(defaultData(), THURSDAY, THURSDAY)
  expect(ensured?.changed).toBe(false)
  expect(ensured?.days[THURSDAY]).toEqual({ date: THURSDAY, tasks: [], autoApplied: true })
})

// --- a library binding is asked again every time the day is opened ---------
//
// The one thing on this function that does not happen once. Everything else
// is gated on `autoApplied`, which is what stops a day being re-stamped every
// time somebody looks at it; a binding cannot work that way, because it
// resolves to whatever is next in a list and a list changes after the stamp
// far more often than before it. See refreshFromTemplate.

const READING: Template = {
  id: 'read',
  name: 'Evening',
  color: '#a7c4f5',
  blocks: [{ id: 'r1', title: 'Read: MIND', time: '20:00', minutes: 30, libraryListId: 'mind' }],
}

function stampedWithReading(items: { id: string; title: string; finished?: string }[]): AppData {
  const data = defaultData()
  data.templates = [READING]
  data.library = [{ id: 'mind', name: 'Books: MIND', unit: 'page', items }]
  data.days = {
    [THE_DAY_AFTER]: {
      date: THE_DAY_AFTER,
      templateId: 'read',
      autoApplied: true,
      tasks: [
        {
          id: 't1',
          title: 'Read: MIND',
          done: false,
          time: '20:00',
          minutes: 30,
          fromTemplate: true,
          origin: { type: 'template', sourceId: 'read', blockId: 'r1' },
        },
      ],
    },
  }
  return data
}

/**
 * The owner's report, in their words: the template was already on the
 * calendar, the books went into the list afterwards, and the days did not
 * change. The list was empty when the stamp happened, so the block's own
 * title stood and nothing ever asked again.
 */
test('a day stamped before the list had anything in it picks the book up when it is opened', () => {
  const data = stampedWithReading([{ id: 'i1', title: 'The War of Art' }])
  const ensured = ensuredDay(data, THE_DAY_AFTER, THURSDAY)

  expect(ensured?.changed).toBe(true)
  const task = ensured!.days[THE_DAY_AFTER].tasks[0]
  expect(task.title).toBe('The War of Art')
  expect(task.libraryRef).toEqual({ listId: 'mind', itemId: 'i1' })
})

test('a day pointing at a book that has been finished since moves on to the next one', () => {
  const data = stampedWithReading([
    { id: 'i1', title: 'The War of Art', finished: THURSDAY },
    { id: 'i2', title: 'Four Thousand Weeks' },
  ])
  data.days[THE_DAY_AFTER].tasks[0].title = 'The War of Art'
  data.days[THE_DAY_AFTER].tasks[0].libraryRef = { listId: 'mind', itemId: 'i1' }

  const task = ensuredDay(data, THE_DAY_AFTER, THURSDAY)!.days[THE_DAY_AFTER].tasks[0]
  expect(task.title).toBe('Four Thousand Weeks')
  expect(task.libraryRef).toEqual({ listId: 'mind', itemId: 'i2' })
})

test('a sitting that already happened keeps the book it happened with', () => {
  const data = stampedWithReading([
    { id: 'i1', title: 'The War of Art', finished: THURSDAY },
    { id: 'i2', title: 'Four Thousand Weeks' },
  ])
  data.days[THE_DAY_AFTER].tasks[0].done = true
  data.days[THE_DAY_AFTER].tasks[0].title = 'The War of Art'
  data.days[THE_DAY_AFTER].tasks[0].libraryRef = { listId: 'mind', itemId: 'i1' }

  expect(ensuredDay(data, THE_DAY_AFTER, THURSDAY)).toBeNull()
})

/**
 * A day that has been lived says what was on it. Re-pointing one would be the
 * app editing history to match a list.
 */
test('a day that has already been is left exactly as it was', () => {
  const data = stampedWithReading([{ id: 'i1', title: 'The War of Art' }])
  data.days[THE_DAY_BEFORE] = { ...data.days[THE_DAY_AFTER], date: THE_DAY_BEFORE }
  delete data.days[THE_DAY_AFTER]

  expect(ensuredDay(data, THE_DAY_BEFORE, THURSDAY)).toBeNull()
})

/**
 * A list emptied of everything unfinished has nothing to point at, and the
 * block's own title is what stands - which is what it does at stamp time in
 * the same case.
 */
test('a list with nothing left unfinished gives the block its own title back', () => {
  const data = stampedWithReading([{ id: 'i1', title: 'The War of Art', finished: THURSDAY }])
  data.days[THE_DAY_AFTER].tasks[0].title = 'The War of Art'
  data.days[THE_DAY_AFTER].tasks[0].libraryRef = { listId: 'mind', itemId: 'i1' }

  const task = ensuredDay(data, THE_DAY_AFTER, THURSDAY)!.days[THE_DAY_AFTER].tasks[0]
  expect(task.title).toBe('Read: MIND')
  expect(task.libraryRef).toBeUndefined()
})

/**
 * The second thing that went stale after a stamp, reported the same way:
 * "sudedu i kalendoriu jau savo template, tada tam template idedu note, tai
 * note neatsiranda, kol neperdedu is naujo template i kalendoriu".
 *
 * A block's note is not a copy taken at the moment of the stamp. It is what
 * that block is, in the owner's own words, and writing it is writing every
 * day it has not yet been written on.
 */
function stampedPlain(taskNote?: { note?: string; templateNote?: string }): AppData {
  const data = defaultData()
  data.templates = [{
    id: 'morning',
    name: 'Morning',
    color: '#a7c4f5',
    blocks: [{ id: 'm1', title: 'Meditation', time: '07:00', minutes: 20 }],
  }]
  data.days = {
    [THE_DAY_AFTER]: {
      date: THE_DAY_AFTER,
      templateId: 'morning',
      autoApplied: true,
      tasks: [{
        id: 't1',
        title: 'Meditation',
        done: false,
        time: '07:00',
        minutes: 20,
        fromTemplate: true,
        origin: { type: 'template', sourceId: 'morning', blockId: 'm1' },
        ...taskNote,
      }],
    },
  }
  return data
}

test('a note written on the block after the stamp reaches the day already on the calendar', () => {
  const data = stampedPlain()
  data.templates[0].blocks[0].note = 'Ten minutes sitting, ten walking.'

  const task = ensuredDay(data, THE_DAY_AFTER, THURSDAY)!.days[THE_DAY_AFTER].tasks[0]
  expect(task.note).toBe('Ten minutes sitting, ten walking.')
  // And the record of what the block gave, so the next edit can tell this
  // apart from something the day wrote for itself.
  expect(task.templateNote).toBe('Ten minutes sitting, ten walking.')
})

test('a note the block changes its mind about follows, on a day that kept it', () => {
  const data = stampedPlain({ note: 'The first words', templateNote: 'The first words' })
  data.templates[0].blocks[0].note = 'The words after thinking about it'

  const task = ensuredDay(data, THE_DAY_AFTER, THURSDAY)!.days[THE_DAY_AFTER].tasks[0]
  expect(task.note).toBe('The words after thinking about it')
})

test('a note the day wrote for itself is never overwritten by the block', () => {
  const data = stampedPlain({ note: 'What I actually did this morning', templateNote: 'The first words' })
  data.templates[0].blocks[0].note = 'The words after thinking about it'

  expect(ensuredDay(data, THE_DAY_AFTER, THURSDAY)).toBeNull()
})

test('showing the note on the card without opening it follows the block as well', () => {
  const data = stampedPlain({ note: 'Ten minutes', templateNote: 'Ten minutes' })
  data.templates[0].blocks[0].note = 'Ten minutes'
  data.templates[0].blocks[0].noteExpanded = true

  const task = ensuredDay(data, THE_DAY_AFTER, THURSDAY)!.days[THE_DAY_AFTER].tasks[0]
  expect(task.noteExpanded).toBe(true)
})

test('a day that is already the template is left exactly as it is', () => {
  const data = stampedPlain({ note: 'Ten minutes', templateNote: 'Ten minutes' })
  data.templates[0].blocks[0].note = 'Ten minutes'

  expect(ensuredDay(data, THE_DAY_AFTER, THURSDAY)).toBeNull()
})

test('a day already lived keeps the note it had, whatever the block says now', () => {
  const data = stampedPlain()
  data.templates[0].blocks[0].note = 'Written this evening, about tomorrow'
  data.days[THE_DAY_BEFORE] = { ...data.days[THE_DAY_AFTER], date: THE_DAY_BEFORE }
  delete data.days[THE_DAY_AFTER]

  expect(ensuredDay(data, THE_DAY_BEFORE, THURSDAY)).toBeNull()
})

test('a task already done keeps the note it was done with', () => {
  const data = stampedPlain()
  data.days[THE_DAY_AFTER].tasks[0].done = true
  data.templates[0].blocks[0].note = 'Written after it was ticked'

  expect(ensuredDay(data, THE_DAY_AFTER, THURSDAY)).toBeNull()
})

/**
 * The one shape that must not be read as "this day has no note of its own".
 *
 * A note the owner deleted leaves `note` absent with `templateNote` still
 * beside it, which is exactly the shape of a deletion. `ownNote` - the test
 * the stamp uses - reads it as "has none" and hands the block's note back,
 * which is defensible for a stamp, because stamping is a person saying "make
 * this day the template again". Opening a day is not that, and a note that
 * came back every time the day was looked at would be one that cannot be
 * deleted.
 */
test('a note the day deleted is not handed back when the day is opened', () => {
  const data = stampedPlain({ templateNote: 'Ten minutes sitting, ten walking.' })
  data.templates[0].blocks[0].note = 'Ten minutes sitting, ten walking.'

  expect(ensuredDay(data, THE_DAY_AFTER, THURSDAY)).toBeNull()
})

test('a deleted note is not replaced by the block changing its mind either', () => {
  const data = stampedPlain({ templateNote: 'The first words' })
  data.templates[0].blocks[0].note = 'The words after thinking about it'

  expect(ensuredDay(data, THE_DAY_AFTER, THURSDAY)).toBeNull()
})

/**
 * The rest of what a block hands over, on the same rule as the note.
 *
 * The owner hit this family twice in a morning - a list bound to a block,
 * then a note written on one - and the next one along is a block renamed,
 * moved, resized or recoloured. Telling "the block changed its mind" from
 * "somebody moved this" needs what the block gave last time, because the
 * moment after a stamp the day's title *is* the block's title. See
 * `Task.fromBlock`.
 */
function stampedWithEcho(over: Partial<AppData['days'][string]['tasks'][number]> = {}): AppData {
  const data = defaultData()
  data.templates = [{
    id: 'morning',
    name: 'Morning',
    color: '#a7c4f5',
    blocks: [{ id: 'm1', title: 'Meditation', time: '07:00', minutes: 20, category: 'routine' }],
  }]
  data.days = {
    [THE_DAY_AFTER]: {
      date: THE_DAY_AFTER,
      templateId: 'morning',
      autoApplied: true,
      tasks: [{
        id: 't1',
        title: 'Meditation',
        done: false,
        time: '07:00',
        minutes: 20,
        category: 'routine',
        fromTemplate: true,
        origin: { type: 'template', sourceId: 'morning', blockId: 'm1' },
        fromBlock: { title: 'Meditation', time: '07:00', minutes: 20, category: 'routine' },
        ...over,
      }],
    },
  }
  return data
}

test('a block renamed after the stamp renames the day that is waiting', () => {
  const data = stampedWithEcho()
  data.templates[0].blocks[0].title = 'Sit and breathe'

  const task = ensuredDay(data, THE_DAY_AFTER, THURSDAY)!.days[THE_DAY_AFTER].tasks[0]
  expect(task.title).toBe('Sit and breathe')
  expect(task.fromBlock?.title).toBe('Sit and breathe')
})

test('a block moved, lengthened or recoloured moves the day with it', () => {
  const data = stampedWithEcho()
  data.templates[0].blocks[0].time = '06:30'
  data.templates[0].blocks[0].minutes = 30
  data.templates[0].blocks[0].category = 'health'

  const task = ensuredDay(data, THE_DAY_AFTER, THURSDAY)!.days[THE_DAY_AFTER].tasks[0]
  expect(task.time).toBe('06:30')
  expect(task.minutes).toBe(30)
  expect(task.category).toBe('health')
})

test('a task somebody moved by hand is not moved back by a template edit', () => {
  // The whole reason the echo exists. The day says 08:15 because a person
  // put it there; the block saying 06:30 now is not permission to undo that.
  const data = stampedWithEcho({ time: '08:15' })
  data.templates[0].blocks[0].time = '06:30'

  const task = ensuredDay(data, THE_DAY_AFTER, THURSDAY)
  expect(task).toBeNull()
})

test('one field edited by hand does not freeze the others', () => {
  const data = stampedWithEcho({ time: '08:15' })
  data.templates[0].blocks[0].time = '06:30'
  data.templates[0].blocks[0].title = 'Sit and breathe'

  const task = ensuredDay(data, THE_DAY_AFTER, THURSDAY)!.days[THE_DAY_AFTER].tasks[0]
  expect(task.title).toBe('Sit and breathe')
  expect(task.time).toBe('08:15')
})

test('a task stamped before any of this was recorded is left entirely alone', () => {
  const data = stampedWithEcho({ fromBlock: undefined })
  data.templates[0].blocks[0].title = 'Sit and breathe'
  data.templates[0].blocks[0].time = '06:30'

  expect(ensuredDay(data, THE_DAY_AFTER, THURSDAY)).toBeNull()
})

test('a day already lived is not re-shaped by a template edit', () => {
  const data = stampedWithEcho()
  data.templates[0].blocks[0].title = 'Sit and breathe'
  data.days[THE_DAY_BEFORE] = { ...data.days[THE_DAY_AFTER], date: THE_DAY_BEFORE }
  delete data.days[THE_DAY_AFTER]

  expect(ensuredDay(data, THE_DAY_BEFORE, THURSDAY)).toBeNull()
})

test('a task already done keeps the shape it was done in', () => {
  const data = stampedWithEcho({ done: true })
  data.templates[0].blocks[0].title = 'Sit and breathe'

  expect(ensuredDay(data, THE_DAY_AFTER, THURSDAY)).toBeNull()
})
