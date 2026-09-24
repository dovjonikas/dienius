import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { archiveNow, archivedThrough, dayPath, dayRecord, getArchiveStatus, recordText, resetArchiveForTests, weekPath } from './archive'
import { fromBase64, resetCloudBackupForTests, setCloudBackupConfig, toBase64 } from './cloudBackup'
import { actions, getData } from './store'
import { defaultData } from './storage'
import type { AppData, DayPlan, Task } from './types'

/**
 * The archive on GitHub - the owner's shift brief of 2026-09-25, stage 3,
 * and docs/ARCHIVE-FORMAT.md. Beside the backup, in the same private repo and
 * through the same token: a file for every lived day, written when the day is
 * over and again only if it changes, and a full backup a week that is never
 * written over. Nothing is deleted. Every title here is invented.
 */

/** What the repo holds, by path: the text and the version it is at. */
let stored: Map<string, { sha: string; content: string }>
let puts: string[]
let gets: string[]
/** Statuses to answer the next requests with, in order; then the ordinary answer. */
let failures: number[]
let version = 0

function respond(url: string, init: RequestInit = {}): Promise<Response> {
  const method = init.method ?? 'GET'
  const path = decodeURIComponent(url.replace(/^https:\/\/api\.github\.com\/repos\/[^/]+\/[^/]+\/contents\//, ''))
  const failure = failures.shift()
  if (failure) return Promise.resolve(new Response('{"message":"no"}', { status: failure }))
  if (method === 'GET') {
    gets.push(path)
    const file = stored.get(path)
    if (!file) return Promise.resolve(new Response('{"message":"Not Found"}', { status: 404 }))
    return Promise.resolve(new Response(JSON.stringify({ sha: file.sha, content: toBase64(file.content) }), { status: 200 }))
  }
  const body = JSON.parse(String(init.body)) as { content: string; sha?: string }
  const file = stored.get(path)
  // GitHub's lock: a write names the version it read, and a stale one is refused.
  if (file ? body.sha !== file.sha : body.sha !== undefined) return Promise.resolve(new Response('{"message":"does not match"}', { status: 409 }))
  puts.push(path)
  const sha = `v${++version}`
  stored.set(path, { sha, content: fromBase64(body.content) })
  return Promise.resolve(new Response(JSON.stringify({ content: { sha } }), { status: 201 }))
}

const TODAY = '2030-01-09'

function task(t: Partial<Task> & { title: string }): Task {
  return { id: crypto.randomUUID(), done: false, ...t }
}

/** Two lived days and today, with a kind, a meal, a routine, a night's hour and a note. */
function plan(): AppData {
  const data = defaultData()
  data.recipes = [{ id: 'soup', title: 'A lentil soup', text: '', kcal: 450, protein: 30 }]
  data.templates = [{ id: 'day', name: 'Day shift', color: '#a7c4f5', type: 'shift', blocks: [], dayKind: { letter: 'D', order: 0 } }]
  data.routines = [{ id: 'walk', title: 'Walk', minutes: 30, weekdays: [1, 2, 3], times: {} }]
  data.library = [{ id: 'shelf', name: 'Main', unit: 'chapter', items: [{ id: 'b1', title: 'A first book' }] }]
  const lived: DayPlan = {
    date: '2030-01-07',
    templateId: 'day',
    dayType: 'shift',
    journal: 'A quiet one.',
    updatedAt: '2030-01-07T20:00:00.000Z',
    tasks: [
      task({ title: 'Shift', time: '07:00', minutes: 720, core: true, done: true, doneAt: '2030-01-07T17:00:00.000Z', origin: { type: 'template', sourceId: 'day', blockId: 'b1' }, fromTemplate: true, updatedAt: '2030-01-07T17:00:00.000Z' }),
      task({ title: 'Lunch', time: '12:00', minutes: 30, category: 'meal', recipeId: 'soup', core: true, origin: { type: 'template', sourceId: 'day', blockId: 'b2' }, fromTemplate: true, updatedAt: '2030-01-07T08:00:00.000Z' }),
      task({ title: 'Walk', time: '19:45', minutes: 30, routineId: 'walk', done: true, doneAt: '2030-01-07T18:20:00.000Z', updatedAt: '2030-01-07T18:20:00.000Z' }),
      task({ title: 'A first book', time: '21:00', minutes: 30, libraryRef: { listId: 'shelf', itemId: 'b1' }, note: 'Chapter three.', updatedAt: '2030-01-07T08:00:00.000Z' }),
      task({ title: 'Call the bank', updatedAt: '2030-01-07T09:00:00.000Z' }),
    ],
  }
  data.days = {
    '2030-01-07': lived,
    '2030-01-08': { date: '2030-01-08', tasks: [task({ title: 'Travel home', time: '07:15', nightOf: '2030-01-07', done: true, updatedAt: '2030-01-08T07:00:00.000Z' })], updatedAt: '2030-01-08T07:00:00.000Z' },
    '2030-01-09': { date: '2030-01-09', tasks: [task({ title: 'Today, not archived', time: '10:00' })] },
  }
  data.scratch = [{ id: 'n1', text: 'A thing to remember.', createdAt: '2030-01-07T10:00:00.000Z', date: '2030-01-07', updatedAt: '2030-01-07T10:00:00.000Z' }]
  return data
}

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2030, 0, 9, 8, 0))
  stored = new Map()
  puts = []
  gets = []
  failures = []
  version = 0
  vi.stubGlobal('fetch', vi.fn(respond))
  resetCloudBackupForTests()
  resetArchiveForTests()
  actions.resetForTests(plan())
  setCloudBackupConfig({ repo: 'someone/plans', token: 'test-token' })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('a lived day, as a record', () => {
  test('its kind, its blocks, what was ticked and when, the meal with its recipe, kcal and protein, the routine, the book, the notes and the score', () => {
    const record = dayRecord(getData(), '2030-01-07')!
    expect(record).toMatchObject({
      format: 'dienius-day',
      version: 1,
      date: '2030-01-07',
      kind: { letter: 'D', name: 'Day shift' },
      template: 'Day shift',
      dayType: 'shift',
      score: { done: 1, of: 2, counts: 'core' },
      journal: 'A quiet one.',
      notes: [{ at: '2030-01-07T10:00:00.000Z', text: 'A thing to remember.' }],
    })
    // In the order of the day: timed by their time, the untimed after.
    expect(record.tasks).toEqual([
      { title: 'Shift', time: '07:00', minutes: 720, from: 'template', done: true, doneAt: '2030-01-07T17:00:00.000Z', core: true },
      { title: 'Lunch', time: '12:00', minutes: 30, category: 'Meals', from: 'template', done: false, core: true, recipe: { title: 'A lentil soup', kcal: 450, protein: 30 } },
      { title: 'Walk', time: '19:45', minutes: 30, from: 'routine', done: true, doneAt: '2030-01-07T18:20:00.000Z' },
      { title: 'A first book', time: '21:00', minutes: 30, from: 'hand', done: false, library: { list: 'Main', item: 'A first book' }, note: 'Chapter three.' },
      { title: 'Call the bank', from: 'hand', done: false },
    ])
    expect(record.changedAt).toBe('2030-01-07T20:00:00.000Z')
  })

  test("a night's hours are the morning's, and say which night they came with", () => {
    expect(dayRecord(getData(), '2030-01-08')!.tasks).toEqual([{ title: 'Travel home', time: '07:15', from: 'night', night: '2030-01-07', done: true }])
  })

  test('a date with nothing on it has no record', () => {
    expect(dayRecord(getData(), '2030-01-05')).toBeNull()
  })

  test('a day with a kind and nothing on it is still archived, as the kind it was; a recipe with no numbers is named alone', () => {
    const data = getData()
    data.days['2030-01-06'] = { date: '2030-01-06', templateId: 'day', dayType: 'shift', tasks: [] }
    expect(dayRecord(data, '2030-01-06')).toMatchObject({ kind: { letter: 'D', name: 'Day shift' }, tasks: [] })
    expect(dayRecord(data, '2030-01-06')!.score).toBeUndefined()
    const bare = { ...data, recipes: [{ id: 'soup', title: 'A lentil soup', text: '' }] }
    expect(dayRecord(bare, '2030-01-07')!.tasks.find(t => t.title === 'Lunch')!.recipe).toEqual({ title: 'A lentil soup' })
  })
})

describe('the archive in the repo', () => {
  test('each lived day is written once, under its year and month, and not again while it stays the same; today is not', async () => {
    expect(await archiveNow()).toBe(true)
    expect(puts.filter(p => p.startsWith('archive/days/'))).toEqual(['archive/days/2030/01/2030-01-07.json', 'archive/days/2030/01/2030-01-08.json'])
    expect(dayPath('2030-01-07')).toBe('archive/days/2030/01/2030-01-07.json')
    expect(JSON.parse(stored.get('archive/days/2030/01/2030-01-07.json')!.content)).toEqual(dayRecord(getData(), '2030-01-07'))

    puts = []
    await archiveNow()
    expect(puts.filter(p => p.startsWith('archive/days/'))).toEqual([])
    expect(getArchiveStatus()).toMatchObject({ phase: 'idle', through: '2030-01-08', message: null })
  })

  test('a day changed afterwards by hand is written again, and only that day', async () => {
    await archiveNow()
    puts = []
    const lunch = getData().days['2030-01-07'].tasks.find(t => t.title === 'Lunch')!
    actions.toggleTask('2030-01-07', lunch.id)
    await archiveNow()
    expect(puts.filter(p => p.startsWith('archive/days/'))).toEqual(['archive/days/2030/01/2030-01-07.json'])
    expect(JSON.parse(stored.get('archive/days/2030/01/2030-01-07.json')!.content).score).toEqual({ done: 2, of: 2, counts: 'core' })
  })

  test('a recipe retold afterwards, or a category renamed, leaves the days that had them as they were written', async () => {
    await archiveNow()
    const written = stored.get('archive/days/2030/01/2030-01-07.json')!
    const soup = getData().recipes[0]
    actions.resetForTests({ ...getData(), recipes: [{ ...soup, kcal: 500 }], categories: getData().categories.map(c => (c.id === 'meal' ? { ...c, label: 'Food' } : c)) })
    puts = []
    await archiveNow()
    expect(puts.filter(p => p.startsWith('archive/days/'))).toEqual([])
    expect(stored.get('archive/days/2030/01/2030-01-07.json')).toBe(written)
    // And another device, holding the retold recipe, finds the same day there and leaves it.
    resetArchiveForTests()
    await archiveNow()
    expect(stored.get('archive/days/2030/01/2030-01-07.json')).toBe(written)
  })

  test("the week's whole backup is written once, under its Monday, and never written over", async () => {
    await archiveNow()
    expect(weekPath('2030-01-07')).toBe('archive/weekly/2030-01-07.json')
    expect(puts).toContain('archive/weekly/2030-01-07.json')
    const week = stored.get('archive/weekly/2030-01-07.json')!
    expect(JSON.parse(week.content).days['2030-01-07'].journal).toBe('A quiet one.')

    // Later in the same week, with the plan changed: the file stays as it was.
    actions.addTask(TODAY, 'Another thing')
    vi.setSystemTime(new Date(2030, 0, 11, 9, 0))
    puts = []
    await archiveNow()
    expect(puts).not.toContain('archive/weekly/2030-01-07.json')
    expect(stored.get('archive/weekly/2030-01-07.json')).toBe(week)

    // And a device that has not seen it finds it there, and leaves it.
    resetArchiveForTests()
    await archiveNow()
    expect(stored.get('archive/weekly/2030-01-07.json')).toBe(week)

    // The next week has its own.
    vi.setSystemTime(new Date(2030, 0, 14, 9, 0))
    await archiveNow()
    expect(puts).toContain('archive/weekly/2030-01-14.json')
  })

  test('with no connection nothing is written and nothing is taken as done; the next run writes what waited', async () => {
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    expect(await archiveNow()).toBe(false)
    expect(puts).toEqual([])
    expect(getArchiveStatus()).toMatchObject({ phase: 'offline', through: null })
    expect(getArchiveStatus().message).toMatch(/No connection/)
    online.mockReturnValue(true)
    expect(await archiveNow()).toBe(true)
    expect(puts.filter(p => p.startsWith('archive/days/'))).toHaveLength(2)
  })

  test('a failure is said on the line, names what to check, and marks nothing', async () => {
    failures = [401]
    expect(await archiveNow()).toBe(false)
    expect(getArchiveStatus()).toMatchObject({ phase: 'error' })
    expect(getArchiveStatus().message).toMatch(/refused the token/)
    expect(await archiveNow()).toBe(true)
    expect(puts.filter(p => p.startsWith('archive/days/'))).toHaveLength(2)
  })

  test('archived until names the last lived day with every day before it archived', async () => {
    expect(archivedThrough(getData(), TODAY)).toBeNull()
    await archiveNow()
    expect(archivedThrough(getData(), TODAY)).toBe('2030-01-08')
  })
})

describe('two devices, one archive', () => {
  test('the same day from both is one file, and an older copy never goes over a newer one', async () => {
    await archiveNow()
    const first = stored.get('archive/days/2030/01/2030-01-07.json')!

    // Another device, which has never archived, with the same day: it finds
    // the file there, as it would write it, and writes nothing.
    resetArchiveForTests()
    puts = []
    await archiveNow()
    expect(puts.filter(p => p.startsWith('archive/days/'))).toEqual([])

    // Another device again, holding the day as it was before a change made
    // since: the file is newer, and stays.
    resetArchiveForTests()
    const older = plan()
    older.days['2030-01-07'] = { ...older.days['2030-01-07'], journal: 'An older word.', updatedAt: '2030-01-07T19:00:00.000Z' }
    actions.resetForTests(older)
    await archiveNow()
    expect(stored.get('archive/days/2030/01/2030-01-07.json')).toBe(first)

    // And one holding a later change writes it.
    resetArchiveForTests()
    const later = plan()
    later.days['2030-01-07'] = { ...later.days['2030-01-07'], journal: 'A later word.', updatedAt: '2030-01-08T09:00:00.000Z' }
    actions.resetForTests(later)
    await archiveNow()
    expect(JSON.parse(stored.get('archive/days/2030/01/2030-01-07.json')!.content).journal).toBe('A later word.')
  })
})

describe('when a block was ticked', () => {
  test('a tick by hand keeps when it was made, and taking it off takes the time away', () => {
    const lunch = getData().days['2030-01-07'].tasks.find(t => t.title === 'Lunch')!
    actions.toggleTask('2030-01-07', lunch.id)
    expect(getData().days['2030-01-07'].tasks.find(t => t.id === lunch.id)!.doneAt).toBe(new Date(2030, 0, 9, 8, 0).toISOString())
    actions.toggleTask('2030-01-07', lunch.id)
    expect(getData().days['2030-01-07'].tasks.find(t => t.id === lunch.id)!.doneAt).toBeUndefined()
  })

  test('a block that ends by itself is done at its end', () => {
    actions.resetForTests({ ...defaultData(), days: { [TODAY]: { date: TODAY, tasks: [task({ title: 'Shift', time: '06:00', minutes: 60, unbounded: true })] } } })
    vi.setSystemTime(new Date(2030, 0, 9, 9, 30))
    actions.endSelfEndingBlocks(new Date(2030, 0, 9, 9, 30))
    expect(getData().days[TODAY].tasks[0]).toMatchObject({ done: true, doneAt: new Date(2030, 0, 9, 7, 0).toISOString() })
  })
})

describe('the contract', () => {
  test("docs/ARCHIVE-FORMAT.md's example is, character for character, what the app writes for that day", () => {
    const doc = readFileSync(resolve(__dirname, '../../docs/ARCHIVE-FORMAT.md'), 'utf8').replace(/\r\n/g, '\n')
    const example = /```json\n([\s\S]*?)\n```/.exec(doc)![1] + '\n'
    const data = plan()
    const lived = data.days['2030-01-07']
    // The example's day: the shift, the lunch and the walk, and its journal.
    data.days = { '2030-01-07': { ...lived, tasks: lived.tasks.filter(t => ['Shift', 'Lunch', 'Walk'].includes(t.title)) } }
    data.scratch = []
    expect(recordText(dayRecord(data, '2030-01-07')!)).toBe(example)
  })
})
