import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { actions, getData } from './store'
import { defaultData } from './storage'
import { readTemplatesJson, templatesJson } from './templateJson'
import { routineNotes } from './shiftDay'
import { dayKinds, isNightKind, kindOnDate, resolveAfterNight } from './dayKinds'
import { addDays } from './dates'
import type { AppData, Template } from './types'

/**
 * The owner's own templates file, read against a fresh app - the overnight
 * brief of 2026-09-23, stage 2.
 *
 * The file lives outside the repo, on the owner's machine, and only there:
 * the repo is public and carries none of the owner's words
 * (docs/OPEN-QUESTIONS.md has the reasoning). So this file's tests read it
 * where it is and are skipped anywhere it is not - on the deploy's runner,
 * on another machine. What they hold is the file's shape - kinds of day,
 * some of them standing in for another on a date after a night; gym
 * routines a different length and time on each kind; a roster written the
 * way the shifts are worked - and nothing here names what the file says.
 * The file changes with the owner's weeks, so nothing here counts it either:
 * how many templates, routines and dates there are is read out of it, and
 * so is the kind each date is read as.
 */

/**
 * Where the file is: a line in owners-file.local at the repo's root, which git
 * ignores, or DIENIUS_OWNERS_FILE in the environment. The path names the
 * owner's own machine, so it is never written here.
 */
function ownersFilePath(): string | undefined {
  const fromEnv = process.env.DIENIUS_OWNERS_FILE
  if (fromEnv) return fromEnv
  // __dirname, as the other tests that read a file do: under jsdom import.meta.url is the page's, not this file's.
  const pointer = join(__dirname, '../../owners-file.local')
  return existsSync(pointer) ? readFileSync(pointer, 'utf8').trim() : undefined
}

const OWNERS_FILE = ownersFilePath() ?? ''
const here = OWNERS_FILE !== '' && existsSync(OWNERS_FILE)

const TODAY = '2026-09-23'

function ownersText(): string {
  return readFileSync(OWNERS_FILE, 'utf8')
}

/** What these tests read of the file. */
interface OwnersFile {
  templates: unknown[]
  routines: { title: string; minutes: Record<string, number>; times: Record<string, string>; weekdays: number[] }[]
  roster: Record<string, string>
}

function ownersFile(): OwnersFile {
  return JSON.parse(ownersText()) as OwnersFile
}

/**
 * The kind each date of the roster is read as, in a plan that holds the
 * file's templates: the kind written on it, read against the kind the date
 * before it is read as (`resolveAfterNight`) - so a date after a night is
 * the kind its own kind's afterNight names, and a second night written as
 * a night like the first is the night after a night. A fresh app has no
 * kind on any other date, so a date whose day before is not in the roster
 * follows no night.
 */
function kindsAsRead(data: AppData, roster: Record<string, string>): Map<string, Template> {
  const byLetter = new Map(dayKinds(data.templates).map(k => [k.dayKind!.letter, k]))
  const read = new Map<string, Template>()
  for (const date of Object.keys(roster).sort()) {
    read.set(date, resolveAfterNight(data.templates, byLetter.get(roster[date])!, read.get(addDays(date, -1))))
  }
  return read
}

describe.skipIf(!here)('the owner\'s templates file', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 8, 23, 7, 0))
    actions.resetForTests(defaultData())
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('the preview names every template, every routine and every date, and reads with nothing skipped', () => {
    const read = readTemplatesJson(ownersText(), getData(), TODAY)
    expect(read.error).toBeUndefined()
    const file = ownersFile()
    expect(read.templates.map(r => r.action)).toEqual(file.templates.map(() => 'create'))
    expect(read.routines.map(r => r.action)).toEqual(file.routines.map(() => 'create'))
    // Every date set, each named as the kind it is read as.
    const kinds = kindsAsRead(read.data, file.roster)
    expect(read.roster.map(r => [r.date, r.action, r.letter])).toEqual([...kinds].map(([date, kind]) => [date, 'set', kind.dayKind!.letter]))
    // Recipes Kitchen has not got yet wait on their blocks rather than
    // stopping anything: every note about one says so, and no note says
    // anything else. Whether the file names recipes at all is the file's
    // business, and changes with it.
    const notes = read.templates.flatMap(r => r.notes)
    for (const note of notes) expect(note).toMatch(/in Kitchen yet - the block waits for it/)
    expect(read.routines.flatMap(r => r.notes)).toEqual([])
    expect(read.notes).toEqual([])
  })

  test('applied, the week is laid: each date the kind it is read as, the gym at that kind\'s time and length, core, and none on a Sunday', () => {
    const { read } = actions.importTemplatesJson(ownersText())
    expect(read.error).toBeUndefined()
    const data = getData()
    const file = ownersFile()

    for (const [date, kind] of kindsAsRead(data, file.roster)) {
      expect(kindOnDate(data, date)?.id, date).toBe(kind.id)
      // The gym's length and time are those of the kind the date is read
      // as, which after a night is not the letter written on it.
      const letter = kind.dayKind!.letter
      const tasks = data.days[date].tasks
      const weekday = new Date(`${date}T12:00:00`).getDay()
      const gyms = tasks.filter(t => t.routineId)
      const due = file.routines.filter(r => r.weekdays.map(d => (d === 7 ? 0 : d)).includes(weekday))
      expect(gyms.map(t => t.title).sort(), date).toEqual(due.map(r => r.title).sort())
      for (const gym of gyms) {
        const routine = due.find(r => r.title === gym.title)!
        expect(gym.minutes, `${date} ${gym.title}`).toBe(routine.minutes[letter])
        expect(gym.core, `${date} ${gym.title}`).toBe(true)
        // At its time for the kind, or said why not - never guessed.
        const note = routineNotes(data, date, TODAY).get(gym.routineId!)
        if (gym.time !== undefined) expect(gym.time).toBe(routine.times[letter])
        else expect(note).toMatch(/Runs into|Needs a time|skips/)
      }
    }
    // A Sunday in the roster has no gym: the routines are on six days.
    const sunday = Object.keys(file.roster).find(date => new Date(`${date}T12:00:00`).getDay() === 0)!
    expect(data.days[sunday].tasks.filter(t => t.routineId)).toEqual([])
  })

  test('the night\'s hours after midnight land on the morning after, once', () => {
    actions.importTemplatesJson(ownersText())
    const data = getData()
    // Every date read as a night: the second of two in a row as well.
    const nights = [...kindsAsRead(data, ownersFile().roster)].filter(([, kind]) => isNightKind(kind)).map(([date]) => date)
    expect(nights.length).toBeGreaterThan(0)
    for (const night of nights) {
      const key = addDays(night, 1)
      const carried = (data.days[key]?.tasks ?? []).filter(t => t.nightOf === night)
      expect(carried.length, `${night} into ${key}`).toBeGreaterThan(0)
      const titles = carried.map(t => t.title)
      expect(new Set(titles).size).toBe(titles.length)
      // And nothing on the night's own date is marked as this night's: a
      // second night in a row holds the first night's hours, not its own.
      expect(data.days[night].tasks.filter(t => t.nightOf === night)).toEqual([])
    }
  })

  test('exported and imported again, nothing changes: every template, routine and date unchanged', () => {
    actions.importTemplatesJson(ownersText())
    const text = templatesJson(getData(), TODAY)
    const again = readTemplatesJson(text, getData(), TODAY)
    expect(again.error).toBeUndefined()
    expect(new Set(again.templates.map(r => r.action))).toEqual(new Set(['unchanged']))
    expect(new Set(again.routines.map(r => r.action))).toEqual(new Set(['unchanged']))
    expect(new Set(again.roster.map(r => r.action))).toEqual(new Set(['unchanged']))
    expect(again.data).toBe(getData())
    // And the same text comes out again.
    expect(templatesJson(again.data, TODAY)).toBe(text)
  })

  test('the file imported twice changes nothing the second time', () => {
    actions.importTemplatesJson(ownersText())
    const before = getData()
    const { read } = actions.importTemplatesJson(ownersText())
    expect(new Set(read.templates.map(r => r.action))).toEqual(new Set(['unchanged']))
    expect(new Set(read.routines.map(r => r.action))).toEqual(new Set(['unchanged']))
    expect(getData()).toBe(before)
  })
})

/**
 * Bad lines in a file of the owner's shape, each said with a note and none
 * of them stopping the rest - stage 2's second half. Generic names.
 */
describe('a file with bad entries', () => {
  const TEMPLATES = [
    { name: 'Day shift', type: 'shift', kind: 'D', blocks: [{ time: '07:00', title: 'Shift', minutes: 720, core: true, ongoing: true }] },
    { name: 'Free day', type: 'full', kind: 'L', blocks: [{ time: '09:00', title: 'Long breakfast', minutes: 45 }] },
  ]

  function read(routines: unknown[], roster: Record<string, unknown> = {}) {
    return readTemplatesJson(JSON.stringify({ templates: TEMPLATES, routines, roster }), defaultData(), TODAY)
  }

  test('a letter no kind has, a time that is not HH:MM, weekdays 0 and 8, an empty title and a title said twice - each with its note, nothing broken', () => {
    const got = read(
      [
        { title: 'Gym', minutes: 45, weekdays: [1, 0, 8], times: { D: '20:10', Q: '11:00', L: '11h30' } },
        { title: '', minutes: 45, weekdays: [1], times: {} },
        { title: 'Walk', minutes: 30, weekdays: [2], times: { L: '10:00' } },
        { title: 'walk', minutes: 40, weekdays: [3], times: { L: '10:30' } },
      ],
      { '2026-09-24': 'Q', '2026-09-25': 'D', 'not a date': 'D' },
    )
    expect(got.error).toBeUndefined()
    expect(got.routines.map(r => [r.title, r.action])).toEqual([
      ['Gym', 'create'],
      ['Routine 2', 'skip'],
      ['Walk', 'skip'],
      ['walk', 'create'],
    ])
    expect(got.routines[0].notes).toEqual([
      'Gym: weekday 0 is not 1 to 7, Monday first - left out.',
      'Gym: weekday 8 is not 1 to 7, Monday first - left out.',
      'Gym: no kind of day has the letter "Q" - its time is left out.',
      'Gym: time "11h30" for "L" is not HH:MM - left out.',
    ])
    expect(got.routines[1].notes).toEqual(['It has no title - skipped.'])
    expect(got.routines[2].notes).toEqual(['The title comes again further down, and that one is read - skipped.'])
    expect(got.data.routines).toHaveLength(2)
    expect(got.data.routines[0]).toMatchObject({ title: 'Gym', weekdays: [1] })
    expect(got.roster.map(r => [r.date, r.action])).toEqual([
      ['2026-09-24', 'skip'],
      ['2026-09-25', 'set'],
      ['not a date', 'skip'],
    ])
  })
})
