import { beforeEach, expect, test } from 'vitest'
import { defaultData } from './storage'
import { clockTimeExists, realMinutes, wallInstant } from './wallClock'
import { applyRoster, busyOn, carriedInto, composeDay, handEdits, placeRoutines, sleepOn, sleepWindowOn, wakingDayOn } from './shiftDay'
import type { AppData, Routine, SleepProfile, Template } from './types'
import { wakingWindow } from '../widgets/day-plan/capacity'

// Every rule here is measured on Lithuania's clock: docs/RESEARCH-SHIFTS.md
// section 4.4. The first test checks the zone took, so a file that silently
// ran in UTC fails instead of passing for the wrong reason.
process.env.TZ = 'Europe/Vilnius'

/**
 * Rotating shifts' composition, stage 3 - docs/RESEARCH-SHIFTS.md sections 2.4,
 * 3, 4, 5 and 6.3: a date's busy time, where each routine goes, what applying a
 * roster makes of a day, and what counts as a day changed by hand. One rule per
 * test; the property tests beside this file hold the rules together over long
 * stretches. Generic names and times only.
 */

const HOUR = 60 * 60 * 1000

let data: AppData

const PROFILES: SleepProfile[] = [
  { id: 'default', name: 'Nights', window: { start: '23:00', end: '07:00' } },
  { id: 'early', name: 'Early', window: { start: '21:30', end: '05:00' } },
  { id: 'daytime', name: 'Daytime', window: { start: '08:00', end: '15:00' } },
]

function kindTemplate(id: string, letter: string, order: number, over: Partial<Template> = {}): Template {
  return { id, name: `Kind ${letter}`, color: '#a7c4f5', blocks: [], dayKind: { letter, order }, ...over }
}

const REST = kindTemplate('rest', 'R', 0, { type: 'rest', sleepProfileId: 'default' })
const DAY = kindTemplate('day', 'D', 1, {
  type: 'shift',
  sleepProfileId: 'early',
  blocks: [{ id: 'day-shift', time: '06:00', title: 'Day shift', minutes: 720 }],
})
const NIGHT = kindTemplate('night', 'N', 2, {
  type: 'night',
  sleepProfileId: 'daytime',
  blocks: [{ id: 'night-shift', time: '22:00', title: 'Night shift', minutes: 480 }],
})
const AFTER = kindTemplate('after', 'A', 3, { type: 'rest', sleepProfileId: 'daytime' })

function routine(over: Partial<Routine> = {}): Routine {
  return {
    id: 'gym',
    title: 'Training',
    category: 'health',
    minutes: 60,
    weekdays: [0, 1, 2, 3, 4, 5, 6],
    times: { rest: '10:00', day: '19:00', night: '17:00', after: '18:00' },
    ...over,
  }
}

beforeEach(() => {
  data = defaultData()
  data.settings = { ...data.settings, sleepProfiles: PROFILES }
  data.templates = [REST, DAY, NIGHT, AFTER]
  data.routines = [routine()]
})

/** A roster over the given dates, applied from the first of them as today. */
function roster(draft: Record<string, string | null>): AppData {
  const today = Object.keys(draft).sort()[0]
  return { ...data, days: applyRoster(data, draft, today).days }
}

// --- the clock --------------------------------------------------------------------------

test('these tests run on Lithuania\'s clock: 25 October 2026 has twenty-five hours and 29 March twenty-three', () => {
  expect((wallInstant('2026-10-26', 0) - wallInstant('2026-10-25', 0)) / HOUR).toBe(25)
  expect((wallInstant('2026-03-30', 0) - wallInstant('2026-03-29', 0)) / HOUR).toBe(23)
})

test('a night from 22:00 for eight hours on the clock lasts nine on the long night, seven on the short one, and eight otherwise', () => {
  expect(realMinutes('2026-10-24', 22 * 60, 480)).toBe(540)
  expect(realMinutes('2026-03-28', 22 * 60, 480)).toBe(420)
  expect(realMinutes('2026-10-23', 22 * 60, 480)).toBe(480)
  expect(realMinutes('2027-10-30', 22 * 60, 480)).toBe(540)
  expect(realMinutes('2028-03-25', 22 * 60, 480)).toBe(420)
})

test('03:30 does not exist on 29 March 2026, and exists - first as summer time - on 25 October 2026', () => {
  expect(clockTimeExists('2026-03-29', '03:30')).toBe(false)
  expect(clockTimeExists('2026-03-29', '04:30')).toBe(true)
  expect(clockTimeExists('2026-10-25', '03:30')).toBe(true)
  expect(new Date(wallInstant('2026-10-25', 3 * 60 + 30)).getTimezoneOffset()).toBe(-180)
})

// --- sleep: a date owns the sleep it wakes from ----------------------------------------------

test("a date's sleep comes from its own kind, a day's own schedule wins over its kind's, and a date with no kind reads its template or the default", () => {
  const rostered = roster({ '2026-09-07': 'day', '2026-09-08': 'night' })
  expect(sleepWindowOn(rostered, '2026-09-07', kindOf(rostered))).toEqual({ start: '21:30', end: '05:00' })
  expect(sleepWindowOn(rostered, '2026-09-08', kindOf(rostered))).toEqual({ start: '08:00', end: '15:00' })
  rostered.days['2026-09-08'] = { ...rostered.days['2026-09-08'], sleepProfileId: 'default' }
  expect(sleepWindowOn(rostered, '2026-09-08', kindOf(rostered))).toEqual({ start: '23:00', end: '07:00' })
  expect(sleepWindowOn(rostered, '2026-09-20', kindOf(rostered))).toEqual({ start: '23:00', end: '07:00' })
})

// --- busy time -------------------------------------------------------------------------------------

function kindOf(plan: AppData) {
  return (date: string) => {
    const id = plan.days[date]?.templateId
    return plan.templates.find(t => t.id === id && t.dayKind)
  }
}

test("a night shift is its start date's, and after midnight it is busy time on the next date without being a task there", () => {
  const plan = roster({ '2026-09-08': 'night', '2026-09-09': 'after' })
  expect(plan.days['2026-09-08'].tasks.map(t => t.title)).toContain('Night shift')
  expect(plan.days['2026-09-09'].tasks.map(t => t.title)).not.toContain('Night shift')
  const busy = busyOn(plan, '2026-09-09', kindOf(plan))
  const shift = busy.find(b => b.reason.kind === 'block')!
  expect(shift.reason).toEqual({ kind: 'block', title: 'Night shift' })
  expect(new Date(shift.start).getDate()).toBe(8)
  expect(new Date(shift.end).getHours()).toBe(6)
})

test('busy time holds the sleep the date wakes from and the sleep that starts on its evening, from the next date\'s kind', () => {
  // A rest day before a day shift: the night between them is the day shift's, to bed at 21:30.
  const plan = roster({ '2026-09-12': 'rest', '2026-09-13': 'day' })
  const sleeps = busyOn(plan, '2026-09-12', kindOf(plan)).filter(b => b.reason.kind === 'sleep')
  const hoursOf = (ms: number) => new Date(ms).getHours() + new Date(ms).getMinutes() / 60
  expect(sleeps.map(s => [new Date(s.start).getDate(), hoursOf(s.start), new Date(s.end).getDate(), hoursOf(s.end)])).toEqual([
    [11, 23, 12, 7],
    [12, 21.5, 13, 5],
  ])
})

test('a date the draft takes a kind off wakes from the default, not from the kind it had', () => {
  const plan = roster({ '2026-09-08': 'night' })
  const cleared = (date: string) => (date === '2026-09-08' ? undefined : kindOf(plan)(date))
  expect(sleepWindowOn(plan, '2026-09-08', cleared)).toEqual({ start: '23:00', end: '07:00' })
})

test('two dates sharing a schedule leave exactly the waking hours that schedule has always given a day', () => {
  const plan = roster({ '2026-09-12': 'rest', '2026-09-13': 'rest' })
  const sleeps = busyOn(plan, '2026-09-12', kindOf(plan)).filter(b => b.reason.kind === 'sleep')
  const minutesInto = (instant: number) => Math.round((instant - wallInstant('2026-09-12', 0)) / 60_000)
  expect({ start: minutesInto(sleeps[0].end), end: minutesInto(sleeps[1].start) }).toEqual(wakingWindow({ start: '23:00', end: '07:00' }))
})

// --- the calendar's edges and the clock changes ----------------------------------------------------------

test('the night shift across a clock change lasts nine hours in autumn and seven in spring, and ends at 06:00 on the clock both times', () => {
  for (const [night, next, hours] of [
    ['2026-10-24', '2026-10-25', 9],
    ['2026-03-28', '2026-03-29', 7],
    ['2027-10-30', '2027-10-31', 9],
    ['2028-03-25', '2028-03-26', 7],
  ] as const) {
    const plan = roster({ [night]: 'night', [next]: 'after' })
    const shift = busyOn(plan, next, kindOf(plan)).find(b => b.reason.kind === 'block')!
    expect((shift.end - shift.start) / HOUR, night).toBe(hours)
    expect(new Date(shift.end).getHours(), night).toBe(6)
  }
})

test('a night shift on 31 December is busy time on 1 January of the next year', () => {
  const plan = roster({ '2026-12-31': 'night', '2027-01-01': 'after' })
  const shift = busyOn(plan, '2027-01-01', kindOf(plan)).find(b => b.reason.kind === 'block')!
  expect([new Date(shift.start).getFullYear(), new Date(shift.end).getFullYear(), new Date(shift.end).getHours()]).toEqual([2026, 2027, 6])
})

test('night shifts on 28 and 29 February 2028 run into 29 February and 1 March, and 29 February is a Tuesday for a routine', () => {
  data.routines = [routine({ weekdays: [2], times: { night: '17:00', after: '17:00' } })]
  const plan = roster({ '2028-02-28': 'night', '2028-02-29': 'night', '2028-03-01': 'after' })
  const carried = (date: string) =>
    busyOn(plan, date, kindOf(plan))
      .filter(b => b.reason.kind === 'block' && b.start < wallInstant(date, 0))
      .map(b => [new Date(b.start).getDate(), new Date(b.end).getMonth() + 1, new Date(b.end).getDate()])
  expect(carried('2028-02-29')).toEqual([[28, 2, 29]])
  expect(carried('2028-03-01')).toEqual([[29, 3, 1]])
  expect(plan.days['2028-02-28'].tasks.filter(t => t.routineId)).toEqual([])
  expect(plan.days['2028-02-29'].tasks.filter(t => t.routineId).map(t => t.time)).toEqual(['17:00'])
  expect(plan.days['2028-03-01'].tasks.filter(t => t.routineId)).toEqual([])
})

test("a date's waking day ends at the bedtime of the next date's kind, and a date ahead nobody has opened reads the template its weekday will give it", () => {
  const plan = roster({ '2026-09-12': 'rest', '2026-09-13': 'day' })
  expect(wakingDayOn(plan, '2026-09-12', '2026-09-12').waking).toEqual({ start: 420, end: 1290 })

  // 19 September 2026 is a Saturday. Nobody has opened it, so opening it will
  // stamp what the weekday map says - and its sleep is tonight's for the 18th.
  const mapped = { ...plan, settings: { ...plan.settings, weekdayTemplates: { 6: 'night' } } }
  expect(wakingDayOn(mapped, '2026-09-18', '2026-09-12').tonight).toEqual({ start: 1440 + 480, end: 1440 + 900 })
  // Not once it has been opened without a template, and never for a date behind today.
  const opened = { ...mapped, days: { ...mapped.days, '2026-09-19': { date: '2026-09-19', tasks: [], autoApplied: true } } }
  expect(wakingDayOn(opened, '2026-09-18', '2026-09-12').tonight).toEqual({ start: 1440 - 60, end: 1440 + 420 })
  expect(wakingDayOn(mapped, '2026-09-18', '2026-09-20').tonight).toEqual({ start: 1440 - 60, end: 1440 + 420 })
})

test("every reader of a date's sleep is handed the schedule it wakes from and tonight's, a week template's column included", () => {
  const plan = roster({ '2026-09-12': 'rest', '2026-09-13': 'day' })
  expect(sleepOn(plan, '2026-09-12', '2026-09-12')).toEqual({ profileId: 'default', sleep: { profiles: PROFILES, tonightProfileId: 'early' } })
  // Nothing on the next date: tonight is the default, named, so it is not read as "the same as today".
  expect(sleepOn(plan, '2026-09-13', '2026-09-12').sleep.tonightProfileId).toBe('default')

  // 16 September 2026 is a Wednesday, and this week template sleeps in the daytime on Wednesdays.
  const week: Template = { id: 'week', name: 'Week', color: '#cccccc', kind: 'week', blocks: [], weekDays: { 3: { sleepProfileId: 'daytime' } } }
  const withWeek = { ...plan, templates: [...plan.templates, week], days: { ...plan.days, '2026-09-16': { date: '2026-09-16', templateId: 'week', tasks: [] } } }
  expect(sleepOn(withWeek, '2026-09-16', '2026-09-12').profileId).toBe('daytime')
  expect(sleepOn(withWeek, '2026-09-15', '2026-09-12').sleep.tonightProfileId).toBe('daytime')
})

test("what still runs in from yesterday is yesterday's timed task on today's clock, and nothing that ended by midnight or waits aside", () => {
  const plan = roster({ '2026-09-08': 'night', '2026-09-09': 'after' })
  const yesterday = plan.days['2026-09-08']
  const withMore = {
    ...plan,
    days: {
      ...plan.days,
      '2026-09-08': {
        ...yesterday,
        tasks: [
          ...yesterday.tasks,
          { id: 'evening', title: 'Evening', done: false, time: '20:00', minutes: 240 },
          { id: 'aside', title: 'Aside', done: false, time: '23:00', minutes: 120, setAside: true },
        ],
      },
    },
  }
  expect(carriedInto(withMore, '2026-09-09').map(c => [c.task.title, c.start, c.end])).toEqual([['Night shift', -120, 360]])
})

test('a day stamped with a template that has since been deleted reads the default, and the weekday map does not argue with it', () => {
  const plan = { ...data, settings: { ...data.settings, weekdayTemplates: { 6: 'night' } }, days: { '2026-09-19': { date: '2026-09-19', templateId: 'deleted-template', tasks: [] } } }
  expect(wakingDayOn(plan, '2026-09-18', '2026-09-12').tonight).toEqual({ start: 1440 - 60, end: 1440 + 420 })
})

// --- where each routine goes -----------------------------------------------------------------------

test("a routine goes at its kind's time when that time is free", () => {
  const plan = roster({ '2026-09-12': 'rest' })
  const placed = placeRoutines(plan, '2026-09-12', REST, busyOn(plan, '2026-09-12', kindOf(plan)))
  expect(placed).toEqual([{ routine: plan.routines[0], time: '10:00' }])
})

test('a routine with no time for the kind needs a time, and is never given one', () => {
  data.routines = [routine({ times: { rest: '10:00' } })]
  const plan = roster({ '2026-09-14': 'day' })
  const placed = placeRoutines(plan, '2026-09-14', DAY, busyOn(plan, '2026-09-14', kindOf(plan)))
  expect(placed).toEqual([{ routine: plan.routines[0], reason: 'needs-time' }])
  expect(plan.days['2026-09-14'].tasks.find(t => t.routineId === 'gym')).toMatchObject({ time: undefined, fromRoutine: { minutes: 60 } })
})

test('a routine whose time runs into the shift, or into sleep, is placed with no time and says what it runs into', () => {
  data.routines = [routine({ times: { day: '17:30', night: '09:00' } })]
  const plan = roster({ '2026-09-14': 'day', '2026-09-15': 'night' })
  expect(placeRoutines(plan, '2026-09-14', DAY, busyOn(plan, '2026-09-14', kindOf(plan)))).toEqual([
    { routine: plan.routines[0], reason: 'runs-into', into: { kind: 'block', title: 'Day shift' } },
  ])
  expect(placeRoutines(plan, '2026-09-15', NIGHT, busyOn(plan, '2026-09-15', kindOf(plan)))).toEqual([
    { routine: plan.routines[0], reason: 'runs-into', into: { kind: 'sleep' } },
  ])
})

test('touching is not running into: a routine that ends as the shift starts is free', () => {
  data.routines = [routine({ times: { night: '21:00' } })]
  const plan = roster({ '2026-09-15': 'night', '2026-09-16': 'after' })
  expect(placeRoutines(plan, '2026-09-15', NIGHT, busyOn(plan, '2026-09-15', kindOf(plan)))).toEqual([{ routine: plan.routines[0], time: '21:00' }])
})

test('a block with a time and no length takes its start minute only', () => {
  data.templates = [kindTemplate('mark', 'M', 0, { sleepProfileId: 'default', blocks: [{ id: 'pin', time: '12:00', title: 'A fixed minute' }] })]
  data.routines = [routine({ id: 'over', times: { mark: '11:30' } }), routine({ id: 'beside', times: { mark: '12:01' } })]
  const plan = roster({ '2026-09-16': 'mark' })
  const placed = placeRoutines(plan, '2026-09-16', data.templates[0], busyOn(plan, '2026-09-16', kindOf(plan)))
  expect(placed.map(p => [p.routine.id, 'time' in p ? p.time : p.reason])).toEqual([
    ['over', 'runs-into'],
    ['beside', '12:01'],
  ])
})

test('a routine at a time the clock skips needs a time that day, and is not moved to one', () => {
  data.routines = [routine({ times: { rest: '03:30' } })]
  data.settings = { ...data.settings, sleepProfiles: [{ id: 'default', name: 'Nights', window: { start: '01:00', end: '02:00' } }, ...PROFILES.slice(1)] }
  const plan = roster({ '2026-03-29': 'rest' })
  expect(placeRoutines(plan, '2026-03-29', REST, busyOn(plan, '2026-03-29', kindOf(plan)))).toEqual([
    { routine: plan.routines[0], reason: 'clock-skips' },
  ])
})

test("a routine late in the evening that runs past midnight into the next date's first block runs into it", () => {
  data.templates = [
    REST,
    kindTemplate('early', 'E', 1, { sleepProfileId: 'daytime', blocks: [{ id: 'early-start', time: '00:30', title: 'Early start', minutes: 240 }] }),
  ]
  data.routines = [routine({ times: { rest: '23:30' }, minutes: 90 })]
  const plan = roster({ '2026-09-12': 'rest', '2026-09-13': 'early' })
  expect(placeRoutines(plan, '2026-09-12', REST, busyOn(plan, '2026-09-12', kindOf(plan)))).toEqual([
    { routine: plan.routines[0], reason: 'runs-into', into: { kind: 'block', title: 'Early start' } },
  ])
})

test('a block longer than a day is still busy time on the date after next', () => {
  data.templates = [REST, kindTemplate('long', 'L', 1, { sleepProfileId: 'daytime', blocks: [{ id: 'long-watch', time: '22:00', title: 'Long watch', minutes: 1800 }] })]
  data.routines = [routine({ times: { rest: '03:00' } })]
  data.settings = { ...data.settings, sleepProfiles: [{ id: 'default', name: 'Nights', window: { start: '09:00', end: '15:00' } }, ...PROFILES.slice(1)] }
  const plan = roster({ '2026-09-12': 'long', '2026-09-13': 'rest', '2026-09-14': 'rest' })
  expect(placeRoutines(plan, '2026-09-14', REST, busyOn(plan, '2026-09-14', kindOf(plan)))).toEqual([
    { routine: plan.routines[0], reason: 'runs-into', into: { kind: 'block', title: 'Long watch' } },
  ])
})

test('a routine the morning after a night shift the same roster puts there runs into that shift before either date is applied', () => {
  data.routines = [routine({ times: { after: '05:00' } })]
  const plan = roster({ '2026-09-08': 'night', '2026-09-09': 'after' })
  expect(plan.days['2026-09-09'].tasks.find(t => t.routineId === 'gym')).toMatchObject({ time: undefined })
  const drafted: Record<string, Template> = { '2026-09-08': NIGHT, '2026-09-09': AFTER }
  expect(composeDay(data, '2026-09-09', AFTER, date => drafted[date]).placements).toEqual([
    { routine: data.routines[0], reason: 'runs-into', into: { kind: 'block', title: 'Night shift' } },
  ])
})

test('a routine keeps to its weekdays, a date with no kind gets none, and a routine deleted from a day by hand stays deleted', () => {
  data.routines = [routine({ weekdays: [1] })]
  // 14 September 2026 is a Monday.
  const plan = roster({ '2026-09-14': 'rest', '2026-09-15': 'rest', '2026-09-16': null })
  expect(plan.days['2026-09-14'].tasks.filter(t => t.routineId)).toHaveLength(1)
  expect(plan.days['2026-09-15'].tasks.filter(t => t.routineId)).toHaveLength(0)
  expect(plan.days['2026-09-16']?.tasks.filter(t => t.routineId) ?? []).toHaveLength(0)

  const skipped = { ...plan, days: { ...plan.days, '2026-09-14': { ...plan.days['2026-09-14'], tasks: plan.days['2026-09-14'].tasks.filter(t => !t.routineId), routineSkips: ['gym'] } } }
  const again = applyRoster(skipped, { '2026-09-14': 'rest' }, '2026-09-14').days
  expect(again['2026-09-14'].tasks.filter(t => t.routineId)).toHaveLength(0)
})

// --- what applying makes of a day ------------------------------------------------------------------

test('applying keeps what was written by hand, a routine task somebody moved, and a done tick', () => {
  const plan = roster({ '2026-09-12': 'rest' })
  const day = plan.days['2026-09-12']
  const gym = day.tasks.find(t => t.routineId === 'gym')!
  const edited = {
    ...plan,
    days: {
      ...plan.days,
      '2026-09-12': {
        ...day,
        journal: 'A line written on the day.',
        tasks: [...day.tasks.map(t => (t.id === gym.id ? { ...t, time: '11:15', done: true } : t)), { id: 'mine', title: 'Mine', done: false }],
      },
    },
  }
  data.routines = [routine({ times: { rest: '09:00' } })]
  const changed = applyRoster({ ...edited, routines: data.routines }, { '2026-09-12': 'rest' }, '2026-09-12').days['2026-09-12']
  expect(changed.journal).toBe('A line written on the day.')
  expect(changed.tasks.find(t => t.id === 'mine')).toBeDefined()
  expect(changed.tasks.find(t => t.id === gym.id)).toMatchObject({ time: '11:15', done: true })
})

test("a routine task still as the rule left it follows the rule, and one whose routine is gone leaves unless it was ticked or moved", () => {
  const plan = roster({ '2026-09-12': 'rest' })
  data.routines = [routine({ times: { rest: '09:00' }, minutes: 45 })]
  const moved = applyRoster({ ...plan, routines: data.routines }, { '2026-09-12': 'rest' }, '2026-09-12').days['2026-09-12']
  expect(moved.tasks.find(t => t.routineId === 'gym')).toMatchObject({ time: '09:00', minutes: 45, fromRoutine: { time: '09:00', minutes: 45 } })

  const gone = applyRoster({ ...plan, routines: [] }, { '2026-09-12': 'rest' }, '2026-09-12').days['2026-09-12']
  expect(gone.tasks.filter(t => t.routineId)).toHaveLength(0)
  const ticked = { ...plan, routines: [], days: { ...plan.days, '2026-09-12': { ...plan.days['2026-09-12'], tasks: plan.days['2026-09-12'].tasks.map(t => (t.routineId ? { ...t, done: true } : t)) } } }
  expect(applyRoster(ticked, { '2026-09-12': 'rest' }, '2026-09-12').days['2026-09-12'].tasks.filter(t => t.routineId)).toHaveLength(1)
})

test("a routine task moved by hand keeps its time while its length follows the rule, and a ticked one is left exactly as it was", () => {
  const plan = roster({ '2026-09-12': 'rest', '2026-09-19': 'rest' })
  const gymOn = (date: string) => plan.days[date].tasks.find(t => t.routineId === 'gym')!
  const edited = {
    ...plan,
    days: {
      ...plan.days,
      '2026-09-12': { ...plan.days['2026-09-12'], tasks: plan.days['2026-09-12'].tasks.map(t => (t.routineId ? { ...t, time: '11:15' } : t)) },
      '2026-09-19': { ...plan.days['2026-09-19'], tasks: plan.days['2026-09-19'].tasks.map(t => (t.routineId ? { ...t, done: true } : t)) },
    },
    routines: [routine({ title: 'Training, longer', times: { rest: '09:00' }, minutes: 90 })],
  }
  const after = applyRoster(edited, { '2026-09-12': 'rest', '2026-09-19': 'rest' }, '2026-09-12').days
  expect(after['2026-09-12'].tasks.find(t => t.routineId === 'gym')).toMatchObject({ time: '11:15', minutes: 90, title: 'Training, longer' })
  expect(after['2026-09-19'].tasks.find(t => t.routineId === 'gym')).toEqual({ ...gymOn('2026-09-19'), done: true })
})

test("a routine's task that arrived by hand is left where it was put, is not taken away, and counts as moved", () => {
  data.routines = [routine({ weekdays: [1] })]
  // 15 September 2026 is a Tuesday, not one of the routine's weekdays.
  const plan = roster({ '2026-09-15': 'rest' })
  const arrived = { id: 'arrived', title: 'Training', done: false, time: '16:00', minutes: 60, routineId: 'gym' }
  const withArrived = { ...plan, days: { ...plan.days, '2026-09-15': { ...plan.days['2026-09-15'], tasks: [...plan.days['2026-09-15'].tasks, arrived] } } }
  expect(applyRoster(withArrived, { '2026-09-15': 'rest' }, '2026-09-15')).toBe(withArrived)
  expect(handEdits(withArrived, '2026-09-15').moved).toBe(1)
})

test('a shift moved by hand stays moved when its date is composed again, and a routine it now runs into loses its time', () => {
  data.routines = [routine({ times: { day: '18:30' } })]
  const plan = roster({ '2026-09-14': 'day' })
  expect(plan.days['2026-09-14'].tasks.find(t => t.routineId === 'gym')?.time).toBe('18:30')
  const day = plan.days['2026-09-14']
  const moved = { ...plan, days: { ...plan.days, '2026-09-14': { ...day, tasks: day.tasks.map(t => (t.title === 'Day shift' ? { ...t, time: '08:00' } : t)) } } }
  const again = applyRoster(moved, { '2026-09-14': 'day' }, '2026-09-14').days['2026-09-14']
  expect(again.tasks.find(t => t.title === 'Day shift')?.time).toBe('08:00')
  expect(again.tasks.find(t => t.routineId === 'gym')).toMatchObject({ time: undefined, fromRoutine: { time: undefined } })
})

test('a kind deleted since the draft was made leaves its date alone, and no kind on a date whose template is not a kind changes nothing', () => {
  data.templates = [...data.templates, { id: 'plain', name: 'Plain', color: '#cccccc', blocks: [{ id: 'walk', time: '12:00', title: 'Walk', minutes: 30 }] }]
  const plain = applyRoster(data, { '2026-09-14': 'day' }, '2026-09-14')
  const withPlain = { ...plain, days: { ...plain.days, '2026-09-15': { date: '2026-09-15', templateId: 'plain', tasks: [] } } }
  expect(applyRoster(withPlain, { '2026-09-14': 'gone-kind', '2026-09-15': null }, '2026-09-14')).toBe(withPlain)
})

test('two tasks of one routine on a date - from two devices - become one, and a second one somebody moved is kept', () => {
  const plan = roster({ '2026-09-12': 'rest' })
  const day = plan.days['2026-09-12']
  const gym = day.tasks.find(t => t.routineId === 'gym')!
  const twice = (second: typeof gym) =>
    applyRoster({ ...plan, days: { ...plan.days, '2026-09-12': { ...day, tasks: [...day.tasks, second] } } }, { '2026-09-12': 'rest' }, '2026-09-12').days['2026-09-12']
  expect(twice({ ...gym, id: 'copy' }).tasks.filter(t => t.routineId === 'gym').map(t => t.id)).toEqual([gym.id])
  expect(twice({ ...gym, id: 'copy', time: '15:00' }).tasks.filter(t => t.routineId === 'gym').map(t => t.id)).toEqual([gym.id, 'copy'])
})

test('applying never reaches a date before today, and applying twice is applying once', () => {
  const once = applyRoster(data, { '2026-09-10': 'rest', '2026-09-11': 'day' }, '2026-09-11').days
  expect(once['2026-09-10']).toBeUndefined()
  const twice = applyRoster({ ...data, days: once }, { '2026-09-10': 'rest', '2026-09-11': 'day' }, '2026-09-11').days
  expect(twice).toEqual(once)
})

// --- a day changed by hand ---------------------------------------------------------------------

test('each of a done tick, a moved block, a deleted block, a moved routine and a deleted routine makes a day changed by hand, and a task written by hand alone does not', () => {
  const plan = roster({ '2026-09-14': 'day' })
  const day = plan.days['2026-09-14']
  const shift = day.tasks.find(t => t.title === 'Day shift')!
  const gym = day.tasks.find(t => t.routineId === 'gym')!
  const withTasks = (tasks: typeof day.tasks) => ({ ...plan, days: { ...plan.days, '2026-09-14': { ...day, tasks } } })

  expect(handEdits(plan, '2026-09-14')).toEqual({ done: 0, moved: 0, deleted: 0 })
  expect(handEdits(withTasks([...day.tasks, { id: 'mine', title: 'Mine', done: false }]), '2026-09-14')).toEqual({ done: 0, moved: 0, deleted: 0 })
  expect(handEdits(withTasks(day.tasks.map(t => (t.id === shift.id ? { ...t, done: true } : t))), '2026-09-14').done).toBe(1)
  expect(handEdits(withTasks(day.tasks.map(t => (t.id === shift.id ? { ...t, time: '06:30' } : t))), '2026-09-14').moved).toBe(1)
  expect(handEdits(withTasks(day.tasks.filter(t => t.id !== shift.id)), '2026-09-14').deleted).toBe(1)
  expect(handEdits(withTasks(day.tasks.map(t => (t.id === gym.id ? { ...t, time: '20:00' } : t))), '2026-09-14').moved).toBe(1)
  expect(handEdits(withTasks(day.tasks.filter(t => t.id !== gym.id)), '2026-09-14').deleted).toBe(1)
})

test('a block task stamped before echoes were kept is not counted as moved, nor is a title a library list changed', () => {
  data.templates = data.templates.map(t => (t.id === 'day' ? { ...t, blocks: [...t.blocks, { id: 'read', title: 'Reading', minutes: 30, libraryListId: 'books' }] } : t))
  const plan = roster({ '2026-09-14': 'day' })
  const day = plan.days['2026-09-14']
  const tasks = day.tasks.map(t => {
    if (t.title === 'Day shift') return { ...t, time: '07:00', fromBlock: undefined }
    if (t.title === 'Reading') return { ...t, title: 'A book from the list' }
    return t
  })
  expect(handEdits({ ...plan, days: { ...plan.days, '2026-09-14': { ...day, tasks } } }, '2026-09-14')).toEqual({ done: 0, moved: 0, deleted: 0 })
})

test('composing one date is the same whether it is asked for alone or inside a roster', () => {
  const plan = roster({ '2026-09-12': 'rest', '2026-09-13': 'day' })
  const alone = composeDay(plan, '2026-09-12', REST, kindOf(plan)).day
  expect(alone).toEqual(plan.days['2026-09-12'])
})
