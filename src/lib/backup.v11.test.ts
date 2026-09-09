import { expect, test } from 'vitest'
import { defaultData, exportJson, importJson, validate } from './storage'
import { foldLegacySteps } from './stepsToNote'
import type { AppData } from './types'

/**
 * The round trip for everything v1.1 added.
 *
 * A backup is the only copy of anything in this app - there is no server to
 * fall back on - so a field that survives being written and not being read
 * back is silent data loss. Each of these fields went in one at a time, and
 * this is the test that says they all come out.
 */
function full(): AppData {
  const data = defaultData()

  data.library = [
    {
      id: 'books',
      name: 'Books',
      unit: 'chapter',
      unitShort: 'ch',
      unitPlural: 'chapters',
      items: [
        { id: 'b1', title: 'Daring Greatly', total: 12, progress: 4 },
        { id: 'b2', title: 'A podcast', progress: 40 },
        { id: 'b3', title: 'Deep Work', total: 8, progress: 8, finished: '2026-08-20' },
      ],
    },
  ]

  data.settings.sleepProfiles = [
    { id: 'default', name: 'Sleep schedule', window: { start: '23:00', end: '07:00' } },
    { id: 'shift', name: 'Shift', window: { start: '09:00', end: '17:00' } },
  ]

  data.templates = [
    {
      id: 't1',
      name: 'Working day',
      color: '#a7c4f5',
      type: 'full',
      sleepProfileId: 'shift',
      blocks: [
        {
          id: 'blk1',
          time: '19:00',
          title: 'Reading',
          minutes: 45,
          core: true,
          unbounded: true,
          category: 'personal',
          libraryListId: 'books',
        },
      ],
    },
  ]

  data.days['2026-09-01'] = {
    date: '2026-09-01',
    templateId: 't1',
    dayType: 'full',
    sleepProfileId: 'shift',
    tasks: [
      {
        id: 'k1',
        title: 'Daring Greatly',
        done: false,
        time: '19:00',
        minutes: 45,
        category: 'personal',
        core: true,
        unbounded: true,
        pushCount: 2,
        note: 'chapter on shame',
        highlight: true,
        repeat: 'weekdays',
        libraryRef: { listId: 'books', itemId: 'b1' },
        // A v1.1 list, written loosely because the type no longer has the
        // field - which is exactly what this file is here to prove about it.
        ...({
          subtasks: [
            { id: 's1', title: 'Find where I left off', done: true },
            { id: 's2', title: 'Read one chapter', done: false },
          ],
        } as object),
      },
    ],
  }

  return data
}

/** The same payload with the one v1.1 field that no longer survives as itself. */
function withInbox(): AppData {
  const data = full()
  data.inbox = [{ id: 'i1', text: 'Book the dentist', captured: '2026-09-01T08:00:00.000Z' }]
  return data
}

test('a payload carrying every v1.1 field validates', () => {
  expect(validate(JSON.parse(exportJson(withInbox())))).toBe(true)
})

test('every v1.1 field survives export and re-import', () => {
  const before = full()
  // Field for field the same, with one migration applied on the way in:
  // a task's steps fold into its note - see lib/stepsToNote.ts, and the
  // detail test below for what that looks like. Everything else, including
  // every field this test was written for, comes back as itself.
  expect(importJson(exportJson(before))).toEqual(foldLegacySteps(before))
})

// The inbox is the one v1.1 field that does not come back as itself: since
// v2.7 it is folded into Later on the way in, with the line's own id and a
// tombstone under its old name - see lib/later.ts. The words survive, which
// is the promise; the shelf they sat on does not, which is the decision.
test('a v1.1 inbox line comes back as the first thing in Later, not as an inbox line', () => {
  const after = importJson(exportJson(withInbox()))
  expect(after.inbox).toEqual([])
  expect(after.backlog[0]).toEqual({ id: 'i1', title: 'Book the dentist' })
  expect(after.tombstones?.['inbox:i1']).toEqual(expect.any(String))
})

test('the task detail fields in particular come back whole', () => {
  const task = importJson(exportJson(full())).days['2026-09-01'].tasks[0]
  expect(task.note).toContain('chapter on shame')
  expect(task.highlight).toBe(true)
  expect(task.repeat).toBe('weekdays')
  expect(task.libraryRef).toEqual({ listId: 'books', itemId: 'b1' })
  // A v1.1 backup still carries its steps, and importing one folds them into
  // the note rather than dropping them - see lib/stepsToNote.ts. The words
  // are what had to survive; the list they sat in did not.
  expect(task.note).toContain('- Find where I left off')
  expect(task.note).toContain('- Read one chapter')
  expect('subtasks' in task).toBe(false)
})

test('the template block keeps its category and its library binding', () => {
  const block = importJson(exportJson(full())).templates[0].blocks[0]
  expect(block.category).toBe('personal')
  expect(block.libraryListId).toBe('books')
})

test('a library item with no total is not turned into one with a zero', () => {
  const item = importJson(exportJson(full())).library[0].items[1]
  expect(item.total).toBeUndefined()
  expect(item.progress).toBe(40)
})

// --- what a crafted or corrupt file is refused ---------------------------

function withLibrary(library: unknown) {
  return { ...JSON.parse(exportJson(defaultData())), library }
}

test('a library that is not a list is refused', () => {
  expect(validate(withLibrary({ books: [] }))).toBe(false)
})

test('a list with no unit is refused - every count would have nothing to be in', () => {
  expect(validate(withLibrary([{ id: 'l', name: 'Books', items: [] }]))).toBe(false)
})

test('a fractional or negative progress count is refused rather than rounded silently', () => {
  const list = (progress: unknown) => [{ id: 'l', name: 'B', unit: 'ch', items: [{ id: 'i', title: 'T', progress }] }]
  expect(validate(withLibrary(list(4.5)))).toBe(false)
  expect(validate(withLibrary(list(-1)))).toBe(false)
  expect(validate(withLibrary(list('4')))).toBe(false)
  expect(validate(withLibrary(list(4)))).toBe(true)
})

test('an absurd count is refused - it would break every label that renders it', () => {
  const list = [{ id: 'l', name: 'B', unit: 'ch', items: [{ id: 'i', title: 'T', total: 1e9 }] }]
  expect(validate(withLibrary(list))).toBe(false)
})

// Still refused at the gate. A v1.1 backup may carry one, and a
// half-written list is a file this app cannot vouch for - the migration runs
// after validation, never instead of it.
test('a subtask missing its done flag is refused', () => {
  const payload = JSON.parse(exportJson(defaultData()))
  payload.days['2026-09-01'] = {
    date: '2026-09-01',
    tasks: [{ id: 't', title: 'T', done: false, subtasks: [{ id: 's', title: 'S' }] }],
  }
  expect(validate(payload)).toBe(false)
})

test('a repeat this app does not have is refused', () => {
  const payload = JSON.parse(exportJson(defaultData()))
  payload.days['2026-09-01'] = {
    date: '2026-09-01',
    tasks: [{ id: 't', title: 'T', done: false, repeat: 'fortnightly' }],
  }
  expect(validate(payload)).toBe(false)
})

test('a library ref missing half of itself is refused', () => {
  const payload = JSON.parse(exportJson(defaultData()))
  payload.days['2026-09-01'] = {
    date: '2026-09-01',
    tasks: [{ id: 't', title: 'T', done: false, libraryRef: { listId: 'books' } }],
  }
  expect(validate(payload)).toBe(false)
})

// A payload written before any of this existed still has to load - that is
// the entire promise a local-first app makes about its own backups.
test('a backup from before the library existed still loads, with an empty one', () => {
  const old = JSON.parse(exportJson(defaultData()))
  delete old.library
  delete old.inbox
  expect(validate(old)).toBe(true)
  expect(importJson(JSON.stringify(old)).library).toEqual([])
})

// --- the settings that stopped earning their place -----------------------

/**
 * v2.5 removed four settings: the nudge before a timed task, the nudge
 * during focus work, a second switch for the Monday goal card, and the
 * widget list nothing could ever change. See DECISIONS "A setting has to
 * earn its place".
 *
 * A backup written before that still has all four in it, and every install
 * that upgrades still has them in localStorage. Loading has to drop them
 * rather than carry them: settings normalise by spreading what was stored
 * and then correcting it, so anything unknown rides along untouched, gets
 * written back out on the next save, and would sit in everybody's data
 * forever. Nothing else the payload carries may be touched.
 */
test('a backup carrying the removed settings loads without them, and loses nothing else', () => {
  const old = JSON.parse(exportJson(defaultData()))
  old.settings.reminder = { enabled: true, everyMinutes: 20, text: 'Stand up, drink water' }
  old.settings.taskReminder = { enabled: true, minutesBefore: 5 }
  old.settings.north = { afterASlowDay: true, onMonday: false }
  old.settings.enabledWidgets = ['day-plan', 'if-then']
  old.settings.textScale = 'l'
  old.settings.density = 'compact'

  expect(validate(old)).toBe(true)
  const back = importJson(JSON.stringify(old))

  expect(back.settings).not.toHaveProperty('reminder')
  expect(back.settings).not.toHaveProperty('taskReminder')
  expect(back.settings).not.toHaveProperty('enabledWidgets')
  expect(back.settings.north).toEqual({ afterASlowDay: true })

  // Everything beside them is exactly as it was written.
  expect(back.settings.textScale).toBe('l')
  expect(back.settings.density).toBe('compact')
})
