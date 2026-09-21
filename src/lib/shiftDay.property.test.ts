import fc from 'fast-check'
import { expect, test } from 'vitest'
import { addDays } from './dates'
import { kindOnDate } from './dayKinds'
import { leftByHand } from './routines'
import { applyRoster, busyOn, type KindOf } from './shiftDay'
import { defaultData, exportJson, importJson } from './storage'
import { identityOf, originFor } from './taskIdentity'
import type { AppData, DayPlan, DayType, Task, Template } from './types'
import { clockTimeExists, realMinutes, wallInstant } from './wallClock'
import { minutesToTime } from '../widgets/day-plan/capacity'

// Lithuania's clock - docs/RESEARCH-SHIFTS.md section 4.4. The first test
// checks it took.
process.env.TZ = 'Europe/Vilnius'

/**
 * Rotating shifts' composition held to its invariants over long stretches -
 * docs/RESEARCH-SHIFTS.md section 8.2. Each run builds four to six kinds with
 * random blocks (some past midnight, some untimed, some with no length, some
 * a night's hours on the date after - section 10),
 * random sleep schedules (overnight, daytime, equal times), random routines,
 * and lays two rosters from random cycles over a 400-day stretch starting
 * anywhere in 2026 to 2028, with hand edits between them - so a run crosses
 * both clock changes, a year's end and, often enough, 29 February 2028.
 *
 * A failure prints its seed and its shrunk case; a case found here becomes a
 * unit test in shiftDay.test.ts before it is fixed. `SHIFT_RUNS` asks for more
 * runs than the suite's default.
 */

const RUNS = Number(process.env.SHIFT_RUNS ?? 25)
const STRETCH = 400
const MINUTE = 60_000

// --- the generators ----------------------------------------------------------------------

/** Minutes on the clock, leaning towards the hours the clocks change in and the late evening. */
const clockMinutes = fc.oneof(
  fc.integer({ min: 0, max: 1439 }),
  fc.integer({ min: 120, max: 240 }),
  fc.integer({ min: 1260, max: 1439 }),
)
const clock = clockMinutes.map(minutesToTime)

const sleepWindow = fc.oneof(
  { weight: 4, arbitrary: fc.record({ start: clock, end: clock }) },
  { weight: 1, arbitrary: clock.map(time => ({ start: time, end: time })) },
)

const blockShape = fc.record({
  time: fc.option(clock, { nil: undefined }),
  night: fc.oneof({ weight: 3, arbitrary: fc.constant(false) }, { weight: 1, arbitrary: fc.constant(true) }),
  minutes: fc.option(fc.oneof(fc.integer({ min: 0, max: 720 }), fc.integer({ min: 300, max: 1440 })), { nil: undefined }),
})

const kindShape = fc.record({
  // An index into the schedules; past the end names a schedule that was deleted.
  sleep: fc.option(fc.nat(3), { nil: undefined }),
  blocks: fc.array(blockShape, { maxLength: 4 }),
  type: fc.constantFrom<DayType | undefined>(undefined, 'shift', 'night', 'rest'),
})

const routineShape = fc.record({
  minutes: fc.integer({ min: 1, max: 720 }),
  weekdays: fc.uniqueArray(fc.integer({ min: 0, max: 6 }), { minLength: 1, maxLength: 7 }),
  times: fc.array(fc.option(clock, { nil: undefined }), { minLength: 6, maxLength: 6 }),
  category: fc.constantFrom(undefined, 'health', 'work'),
})

/** A cycle of kind indexes; null is no kind, and an index past the kinds names one deleted since. */
const cycle = fc.array(fc.option(fc.nat(6), { nil: null }), { minLength: 1, maxLength: 10 })

const handEdit = fc.record({
  at: fc.integer({ min: 0, max: STRETCH - 1 }),
  what: fc.constantFrom('write', 'tick', 'move-routine', 'delete-routine', 'move-block'),
  time: fc.option(clock, { nil: undefined }),
})

/** The first date: anywhere in 2026 to 2028, or just before a clock change, a year's end or 29 February. */
const startDate = fc.oneof(
  fc.integer({ min: 0, max: 1095 }).map(n => addDays('2026-01-01', n)),
  fc.constantFrom('2026-03-27', '2026-10-23', '2026-12-30', '2027-03-26', '2027-10-29', '2028-02-27', '2028-10-27'),
)

const scenario = fc.record({
  profiles: fc.array(sleepWindow, { minLength: 1, maxLength: 3 }),
  kinds: fc.array(kindShape, { minLength: 4, maxLength: 6 }),
  routines: fc.array(routineShape, { maxLength: 4 }),
  start: startDate,
  todayAt: fc.oneof(fc.constant(0), fc.integer({ min: 0, max: STRETCH - 1 })),
  first: cycle,
  second: cycle,
  hand: fc.array(handEdit, { maxLength: 16 }),
  routinesChange: fc.boolean(),
})

type Scenario = typeof scenario extends fc.Arbitrary<infer S> ? S : never

// --- building a plan from a scenario --------------------------------------------------------

function build(s: Scenario): AppData {
  const data = defaultData()
  const profiles = s.profiles.map((window, i) => ({ id: i === 0 ? 'default' : `schedule-${i}`, name: `Schedule ${i}`, window }))
  data.settings = { ...data.settings, sleepProfiles: profiles }
  data.templates = s.kinds.map(
    (kind, i): Template => ({
      id: `kind-${i}`,
      name: `Kind ${i}`,
      color: '#a7c4f5',
      type: kind.type,
      sleepProfileId: kind.sleep === undefined ? undefined : (profiles[kind.sleep]?.id ?? 'deleted-schedule'),
      dayKind: { letter: String.fromCharCode(65 + i), order: i },
      blocks: kind.blocks.map((b, j) => ({
        id: `kind-${i}-block-${j}`,
        title: `Block ${i}.${j}`,
        time: b.time,
        minutes: b.minutes,
        ...(b.night ? { afterMidnight: true } : {}),
      })),
    }),
  )
  data.routines = s.routines.map((r, i) => ({
    id: `routine-${i}`,
    title: `Routine ${i}`,
    category: r.category,
    minutes: r.minutes,
    weekdays: [...r.weekdays].sort((a, b) => a - b),
    times: Object.fromEntries(r.times.slice(0, s.kinds.length).flatMap((time, k) => (time === undefined ? [] : [[`kind-${k}`, time]]))),
  }))
  return data
}

function stretchOf(s: Scenario): string[] {
  return Array.from({ length: STRETCH }, (_, k) => addDays(s.start, k))
}

function draftOf(c: (number | null)[], dates: string[]): Record<string, string | null> {
  return Object.fromEntries(dates.map((date, k) => [date, c[k % c.length] === null ? null : `kind-${c[k % c.length]}`]))
}

/** What a person does between two rosters: writes a task, ticks one, moves or deletes one. */
function editByHand(data: AppData, s: Scenario, dates: string[]): AppData {
  const days = { ...data.days }
  s.hand.forEach((edit, n) => {
    const date = dates[edit.at]
    const day: DayPlan = days[date] ?? { date, tasks: [] }
    const routineTask = day.tasks.find(t => t.routineId)
    const blockTask = day.tasks.find(t => originFor(t).type === 'template')
    const change = (target: Task | undefined, patch: Partial<Task>) =>
      target ? { ...day, tasks: day.tasks.map(t => (t.id === target.id ? { ...t, ...patch } : t)) } : day
    switch (edit.what) {
      case 'write':
        days[date] = { ...day, tasks: [...day.tasks, { id: `hand-${n}`, title: `Written ${n}`, done: false, time: edit.time }] }
        break
      case 'tick':
        days[date] = change(routineTask ?? blockTask, { done: true })
        break
      case 'move-routine':
        days[date] = change(routineTask, { time: edit.time })
        break
      case 'move-block':
        days[date] = change(blockTask, { time: edit.time })
        break
      case 'delete-routine':
        days[date] = routineTask ? leftByHand({ ...day, tasks: day.tasks.filter(t => t.id !== routineTask.id) }, [routineTask]) : day
        break
    }
  })
  const routines = s.routinesChange
    ? data.routines.map(r => ({
        ...r,
        minutes: Math.min(720, r.minutes + 15),
        times: Object.fromEntries(Object.entries(r.times).map(([kind, time]) => [kind, minutesToTime((Number(time.slice(0, 2)) * 60 + Number(time.slice(3)) + 45) % 1440)])),
      }))
    : data.routines
  return { ...data, days, routines }
}

/** Whether a routine's task is still exactly as its rule left it - the only ones the rule answers for. */
function ruleLeft(task: Task): boolean {
  const echo = task.fromRoutine
  return !!task.routineId && !task.done && !!echo && echo.title === task.title && echo.time === task.time && echo.minutes === task.minutes && echo.category === task.category
}

interface Run {
  dates: string[]
  today: string
  draft: Record<string, string | null>
  before: AppData
  after: AppData
}

function run(s: Scenario): Run {
  const dates = stretchOf(s)
  const built = build(s)
  const first = applyRoster(built, draftOf(s.first, dates), dates[0])
  const before = editByHand(first, s, dates)
  const today = dates[s.todayAt]
  const draft = draftOf(s.second, dates)
  return { dates, today, draft, before, after: applyRoster(before, draft, today) }
}

/** The dates the second roster composed: in reach, and naming a kind that exists or none. */
function composed({ dates, today, draft, before }: Run): string[] {
  return dates.filter(date => date >= today && (draft[date] === null || before.templates.some(t => t.id === draft[date])))
}

/**
 * The dates around a date the second roster changed the kind of, which follow
 * it - section 10.2a: the day before and the two after, in reach, with a kind,
 * and not composed themselves.
 */
function followers(plan: Run): string[] {
  const own = new Set(composed(plan))
  const around = new Set<string>()
  for (const date of turned(plan)) {
    for (const offset of [-1, 1, 2]) {
      const on = addDays(date, offset)
      if (on >= plan.today && !own.has(on) && kindOnDate(plan.after, on)) around.add(on)
    }
  }
  return [...around].sort()
}

/** The dates the second roster composed whose kind it changed. */
function turned(plan: Run): string[] {
  return composed(plan).filter(date => kindOnDate(plan.before, date)?.id !== kindOnDate(plan.after, date)?.id)
}

/**
 * A day without what its neighbours may give it: last night's tasks, and the
 * routine's tasks composing a date may touch - not ticked, and carrying what
 * their rule gave, so they follow it in the fields still as it left them.
 * What is left is what the roster had no business changing on a date it was
 * not asked about: everything written by hand, and every tick.
 */
function ownPart(day: DayPlan | undefined, date: string): unknown {
  // A date a night made, with nothing else on it, is the date as it was.
  const { tasks, ...rest } = day ?? { date, tasks: [] }
  return { ...rest, tasks: tasks.filter(t => !t.nightOf && !(t.routineId && !t.done && t.fromRoutine)) }
}

// --- the clock this file runs on ----------------------------------------------------------

test("this file runs on Lithuania's clock: 25 October 2026 has twenty-five hours", () => {
  expect((wallInstant('2026-10-26', 0) - wallInstant('2026-10-25', 0)) / 3_600_000).toBe(25)
})

// --- the invariants ---------------------------------------------------------------------------

test("1. every date in reach is exactly the kind the roster says, nothing behind today is touched, and a date the roster was not asked about changes only by what its neighbours give it", () => {
  fc.assert(
    fc.property(scenario, s => {
      const plan = run(s)
      const { dates, today, draft, before, after } = plan
      const reach = new Set(dates.filter(d => d >= today))
      // What may change on a date the roster was not asked about: the date
      // after a changed kind takes its night, and the dates around follow it.
      const given = new Set([...followers(plan), ...turned(plan).map(date => addDays(date, 1))])
      const unasked = (date: string) => {
        if (given.has(date)) expect(ownPart(after.days[date], date), date).toEqual(ownPart(before.days[date], date))
        else expect(after.days[date], date).toBe(before.days[date])
      }
      for (const date of dates) {
        const id = draft[date]
        const exists = id === null || before.templates.some(t => t.id === id)
        if (!reach.has(date)) {
          expect(after.days[date]).toBe(before.days[date])
        } else if (!exists) {
          expect(kindOnDate(after, date)?.id).toBe(kindOnDate(before, date)?.id)
          unasked(date)
        } else {
          expect(kindOnDate(after, date)?.id).toBe(id ?? undefined)
        }
      }
      for (const date of Object.keys(after.days)) {
        if (date < today) expect(after.days[date]).toBe(before.days[date])
        else if (!reach.has(date)) unasked(date)
      }
    }),
    { numRuns: RUNS },
  )
}, 300_000)

test("2. no routine task still as its rule left it runs into busy time, each is at its kind's time or none, and a date with no kind keeps none", () => {
  fc.assert(
    fc.property(scenario, s => {
      const plan = run(s)
      const { after } = plan
      const kindOf: KindOf = date => kindOnDate(after, date)
      for (const date of [...composed(plan), ...followers(plan)]) {
        const kind = kindOf(date)
        const tasks = (after.days[date]?.tasks ?? []).filter(ruleLeft)
        if (!kind) {
          expect(tasks).toEqual([])
          continue
        }
        const busy = busyOn(after, date, kindOf, plan.today)
        for (const task of tasks) {
          const routine = after.routines.find(r => r.id === task.routineId)!
          if (task.time === undefined) continue
          expect(task.time).toBe(routine.times[kind.id])
          const start = Number(task.time.slice(0, 2)) * 60 + Number(task.time.slice(3))
          const from = wallInstant(date, start)
          const to = wallInstant(date, start + task.minutes!)
          const hit = busy.find(b => Math.min(to, b.end) - Math.max(from, b.start) >= MINUTE)
          expect(hit, `${date} ${task.title} at ${task.time}`).toBeUndefined()
        }
      }
    }),
    { numRuns: RUNS },
  )
}, 300_000)

test('3. applying the same roster twice is applying it once: the plan comes back as the same object', () => {
  fc.assert(
    fc.property(scenario, s => {
      const { today, draft, after } = run(s)
      expect(applyRoster(after, draft, today)).toBe(after)
    }),
    { numRuns: RUNS },
  )
}, 300_000)

test('4. the plan after a roster exports, imports and exports again to the same file, byte for byte', () => {
  fc.assert(
    fc.property(scenario, s => {
      const { after } = run(s)
      const text = exportJson(after)
      expect(exportJson(importJson(text))).toBe(text)
    }),
    { numRuns: RUNS },
  )
}, 300_000)

test('5. nothing is duplicated: each block and each routine at most once on a date', () => {
  fc.assert(
    fc.property(scenario, s => {
      const { dates, after } = run(s)
      for (const date of dates) {
        const identities = (after.days[date]?.tasks ?? []).map(identityOf).filter((k): k is string => k !== null)
        expect(new Set(identities).size, date).toBe(identities.length)
      }
    }),
    { numRuns: RUNS },
  )
}, 300_000)

test('6. nothing written by hand is lost, through a roster and through a change of kind', () => {
  fc.assert(
    fc.property(scenario, s => {
      const { dates, before, after } = run(s)
      for (const date of dates) {
        for (const task of before.days[date]?.tasks ?? []) {
          if (!task.id.startsWith('hand-')) continue
          expect(after.days[date]?.tasks.find(t => t.id === task.id), `${date} ${task.title}`).toEqual(task)
        }
      }
    }),
    { numRuns: RUNS },
  )
}, 300_000)

test("8. a night's task stands for a block after midnight of the template on the date before it, and each such block stands once on the date after", () => {
  fc.assert(
    fc.property(scenario, s => {
      const { dates, after } = run(s)
      for (const date of [...dates, addDays(dates[dates.length - 1], 1)]) {
        for (const task of after.days[date]?.tasks ?? []) {
          if (task.nightOf === undefined) continue
          expect(task.nightOf, `${date} ${task.title}`).toBe(addDays(date, -1))
          const night = after.days[task.nightOf]
          expect(originFor(task).sourceId).toBe(night?.templateId)
          const template = after.templates.find(t => t.id === night?.templateId)
          expect(template?.blocks.find(b => b.id === originFor(task).blockId)?.afterMidnight).toBe(true)
        }
      }
      for (const date of dates) {
        const template = after.templates.find(t => t.id === after.days[date]?.templateId)
        const next = after.days[addDays(date, 1)]?.tasks ?? []
        for (const block of template?.blocks.filter(b => b.afterMidnight) ?? []) {
          const standing = next.filter(t => t.nightOf === date && originFor(t).blockId === block.id)
          expect(standing, `${date} ${block.title}`).toHaveLength(1)
        }
      }
    }),
    { numRuns: RUNS },
  )
}, 300_000)

test('7. real minutes differ from minutes on the clock only across a clock change, and there by exactly sixty', () => {
  fc.assert(
    fc.property(
      fc.oneof(
        fc.integer({ min: 0, max: 1095 }).map(n => addDays('2026-01-01', n)),
        fc.constantFrom('2026-03-28', '2026-03-29', '2026-10-24', '2026-10-25', '2027-03-27', '2027-10-30', '2028-03-25', '2028-10-28'),
      ),
      clockMinutes,
      fc.integer({ min: 1, max: 1440 }),
      (date, start, length) => {
        const difference = realMinutes(date, start, length) - length
        if (difference === 0) return
        expect(Math.abs(difference)).toBe(60)
        const offsetAt = (minutes: number) => new Date(wallInstant(date, minutes)).getTimezoneOffset()
        const crosses = offsetAt(start) !== offsetAt(start + length) || !clockTimeExists(date, minutesToTime(start))
        expect(crosses).toBe(true)
      },
    ),
    { numRuns: 2000 },
  )
})
