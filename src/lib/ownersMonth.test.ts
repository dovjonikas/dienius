import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { actions, getData } from './store'
import { defaultData } from './storage'
import { dayKinds, isNightKind, kindOnDate } from './dayKinds'
import { addDays } from './dates'
import { routineNotes, wakingDayOn } from './shiftDay'
import { recipeForDate } from './kitchen'
import { weekdayOf } from './repeats'
import { originFor } from './taskIdentity'
import type { AppData, Task, Template } from './types'

/**
 * Six weeks of the owner's own rota, lived in a test - the owner's shift
 * brief of 2026-09-25, stage 4. The templates and the routines are the
 * owner's file, read where it lives (ownersFile.test.ts says why, and is
 * skipped where it is not); the roster is made here, the way the shifts are
 * worked: two days, two nights, four free days, over and over, from Wednesday
 * 30 September 2026 - across the night the clocks go back. Nothing here names
 * what the file says: which kind is the day shift, which the first night and
 * which the free day is read from the file's own shape.
 */

function ownersFilePath(): string | undefined {
  const fromEnv = process.env.DIENIUS_OWNERS_FILE
  if (fromEnv) return fromEnv
  const pointer = join(__dirname, '../../owners-file.local')
  return existsSync(pointer) ? readFileSync(pointer, 'utf8').trim() : undefined
}

const OWNERS_FILE = ownersFilePath() ?? ''
const here = OWNERS_FILE !== '' && existsSync(OWNERS_FILE)

const START = '2026-09-30'
const DAYS = 42

interface FileBlock {
  title: string
  time?: string
  afterMidnight?: boolean
  mealType?: string
  recipes?: string[]
}
interface FileTemplate {
  name: string
  kind?: string
  type?: string
  afterNight?: string
  blocks?: FileBlock[]
}
interface OwnersFile {
  templates: FileTemplate[]
  routines: { title: string; weekdays: number[]; times: Record<string, string> }[]
  roster?: Record<string, string>
}

/** Three recipes every meal block of the file walks here - invented, the owner's own stay in their Kitchen. */
const MEALS = ['A first meal', 'A second meal', 'A third meal']

/**
 * The letters of the rota, read from the file's shape: the day shift is the
 * kind of type shift; the first night is the night whose afterNight is
 * another night, and the second that one; the free day is the kind whose
 * afterNight is a rest day, and the day after nights that one.
 */
function lettersOf(file: OwnersFile) {
  const byLetter = new Map(file.templates.filter(t => t.kind).map(t => [t.kind!, t]))
  const day = file.templates.find(t => t.kind && t.type === 'shift')
  const night = file.templates.find(t => t.kind && t.type === 'night' && t.afterNight && byLetter.get(t.afterNight)?.type === 'night')
  const free = file.templates.find(t => t.kind && t.type !== 'night' && t.afterNight && byLetter.get(t.afterNight)?.type === 'rest')
  if (!day || !night || !free) throw new Error('the file no longer has a day shift, a first night naming a second, and a free day naming the day after nights')
  return { D: day.kind!, N: night.kind!, N2: night.afterNight!, L: free.kind!, P: free.afterNight! }
}

/** The owner's file, its meal blocks given the three invented recipes, and a roster of six weeks. */
function sixWeeks(): { text: string; file: OwnersFile; letters: ReturnType<typeof lettersOf> } {
  const file = JSON.parse(readFileSync(OWNERS_FILE, 'utf8')) as OwnersFile
  const letters = lettersOf(file)
  const cycle = [letters.D, letters.D, letters.N, letters.N, letters.L, letters.L, letters.L, letters.L]
  const roster: Record<string, string> = {}
  for (let i = 0; i < DAYS; i++) roster[addDays(START, i)] = cycle[i % cycle.length]
  const templates = file.templates.map(t => ({ ...t, blocks: (t.blocks ?? []).map(b => (b.mealType ? { ...b, recipes: MEALS } : b)) }))
  return { text: JSON.stringify({ ...file, templates, roster }), file: { ...file, templates, roster }, letters }
}

const dates = Array.from({ length: DAYS }, (_, i) => addDays(START, i))
const letterOn = (data: AppData, date: string) => kindOnDate(data, date)?.dayKind?.letter
const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3))

/** A task's identity on its date: its block and the night it came with, or its routine. */
function identity(t: Task): string | undefined {
  if (t.routineId) return `routine:${t.routineId}`
  const origin = originFor(t)
  return origin.type === 'template' ? `block:${origin.sourceId}:${origin.blockId}:${t.nightOf ?? ''}` : undefined
}

describe.skipIf(!here)("the owner's month, lived", () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 8, 30, 6, 0))
    const data = defaultData()
    data.recipes = MEALS.map((title, i) => ({ id: `meal-${i}`, title, text: '' }))
    actions.resetForTests(data)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('six weeks of two days, two nights and four free days: the first night, the second, the day after nights and the free days, each on its date', () => {
    const { text, letters } = sixWeeks()
    const { read } = actions.importTemplatesJson(text)
    expect(read.error).toBeUndefined()
    const expected = [letters.D, letters.D, letters.N, letters.N2, letters.P, letters.L, letters.L, letters.L]
    expect(dates.map(date => letterOn(getData(), date))).toEqual(dates.map((_, i) => expected[i % expected.length]))
  })

  test('every routine has its time - none needing one, none refused for running into something - and no block stands in a sleep', () => {
    const { text } = sixWeeks()
    actions.importTemplatesJson(text)
    const data = getData()
    for (const date of dates) {
      const day = wakingDayOn(data, date, START)
      const sleeps = [day.woke, day.tonight].filter(s => s !== null)
      for (const task of data.days[date].tasks.filter(t => t.time && t.minutes)) {
        const start = minutes(task.time!)
        const end = start + task.minutes!
        // Nothing in a sleep: a routine is placed only where the day has
        // room, and the file keeps its blocks out of every sleep - the free
        // day's evening before a day shift too, since the owner moved it on
        // 2026-09-25 (DECISIONS "Four questions answered before the freeze").
        const into = sleeps.some(sleep => Math.min(end, sleep.end) - Math.max(start, sleep.start) > 0)
        expect(into, `${date} ${letterOn(data, date)} ${task.title} in a sleep`).toBe(false)
      }
      expect([...routineNotes(data, date, START).values()], date).toEqual([])
      for (const task of data.days[date].tasks.filter(t => t.routineId)) {
        const routine = data.routines.find(r => r.id === task.routineId)!
        expect(task.time, `${date} ${routine.title}`).toBe(routine.times[kindOnDate(data, date)!.id])
      }
    }
  })

  test("a night's hours land on the morning after, once, and nothing on any date is there twice", () => {
    const { text } = sixWeeks()
    actions.importTemplatesJson(text)
    const data = getData()
    for (const date of dates) {
      const kind = kindOnDate(data, date)!
      const ids = data.days[date].tasks.map(identity).filter(Boolean)
      expect(new Set(ids).size, `${date} twice`).toBe(ids.length)
      if (!isNightKind(kind)) continue
      const after = addDays(date, 1)
      const carried = (data.days[after]?.tasks ?? []).filter(t => t.nightOf === date).map(t => t.title).sort()
      expect(carried, `${date} into ${after}`).toEqual(kind.blocks.filter(b => b.afterMidnight).map(b => b.title).sort())
      expect(data.days[date].tasks.filter(t => t.nightOf === date), `${date} keeps its own night`).toEqual([])
    }
  })

  test('a meal block walks its recipes one a date, and round again', () => {
    const { text } = sixWeeks()
    actions.importTemplatesJson(text)
    const data = getData()
    const ids = MEALS.map((_, i) => `meal-${i}`)
    const seen = new Set<string>()
    for (const date of dates) {
      for (const task of data.days[date].tasks.filter(t => t.recipeId)) {
        // A night's meal walks by its night's date.
        expect(task.recipeId, `${date} ${task.title}`).toBe(recipeForDate(ids, task.nightOf ?? date))
        seen.add(task.recipeId!)
      }
    }
    expect([...seen].sort()).toEqual(ids)
  })

  test('no gym on a Sunday, and on every other day the routines of its weekday, each once', () => {
    const { text, file } = sixWeeks()
    actions.importTemplatesJson(text)
    const data = getData()
    for (const date of dates) {
      const weekday = weekdayOf(date)
      const due = file.routines.filter(r => r.weekdays.map(d => (d === 7 ? 0 : d)).includes(weekday)).map(r => r.title).sort()
      const there = data.days[date].tasks.filter(t => t.routineId).map(t => t.title).sort()
      expect(there, date).toEqual(due)
      if (weekday === 0) expect(there, `${date} is a Sunday`).toEqual([])
    }
  })

  test('changed by hand in the middle: a night added, a night taken off, a day shift made a night - the dates after follow, and nothing ticked is lost', () => {
    const { text, letters } = sixWeeks()
    actions.importTemplatesJson(text)
    const kind = (letter: string) => dayKinds(getData().templates).find(k => k.dayKind!.letter === letter) as Template
    const tickAll = (date: string) => {
      for (const task of getData().days[date].tasks.filter(t => !t.done)) actions.toggleTask(date, task.id)
    }
    const ticked = (date: string) => getData().days[date].tasks.filter(t => t.done).map(t => t.id).sort()

    // The third block of the rota starts on the 16th of October: D D N N2 P L L L.
    const block = addDays(START, 16)
    const at = (n: number) => addDays(block, n)

    // A night added on the third free day: the fourth is the day after nights.
    tickAll(at(6))
    tickAll(at(7))
    const before = [ticked(at(6)), ticked(at(7))]
    actions.stamp({ [at(6)]: kind(letters.N).id })
    expect([at(5), at(6), at(7)].map(date => letterOn(getData(), date))).toEqual([letters.L, letters.N, letters.P])
    for (const [i, date] of [at(6), at(7)].entries()) for (const id of before[i]) expect(ticked(date), `${date} keeps what was ticked`).toContain(id)

    // The added night taken off again: the day after nights goes back to a free day.
    actions.stamp({ [at(6)]: kind(letters.L).id })
    expect([at(6), at(7)].map(date => letterOn(getData(), date))).toEqual([letters.L, letters.L])

    // The first night of the block taken off: the second is the first now.
    tickAll(at(2))
    const nightTicked = ticked(at(2))
    actions.stamp({ [at(2)]: kind(letters.L).id })
    expect([at(2), at(3), at(4)].map(date => letterOn(getData(), date))).toEqual([letters.L, letters.N, letters.P])
    for (const id of nightTicked) expect(ticked(at(2))).toContain(id)

    // The next block's second day shift made a night: the nights after it are nights after a night.
    const next = addDays(block, 8)
    actions.stamp({ [addDays(next, 1)]: kind(letters.N).id })
    expect([0, 1, 2, 3, 4].map(n => letterOn(getData(), addDays(next, n)))).toEqual([letters.D, letters.N, letters.N2, letters.N2, letters.P])
  })
})
