import { expect, test } from 'vitest'
import { applyRoster, busyOn, handEdits, type KindOf } from './shiftDay'
import { rosterPreview } from './rosterPreview'
import { ensuredDay } from './ensureDay'
import { kindOnDate } from './dayKinds'
import { defaultData } from './storage'
import { weekdayOf } from './repeats'
import { wallInstant } from './wallClock'
import type { AppData, DayPlan, Routine, Task, Template } from './types'

// Lithuania's clock, as the other composition tests run on.
process.env.TZ = 'Europe/Vilnius'

/**
 * The night's own hours and the dates around a change of kind, composed -
 * docs/RESEARCH-SHIFTS.md sections 10.2 and 10.2a. A date given a kind puts
 * its night on the date after, every door composes that, and the dates around
 * a date whose kind changes follow it: only a routine's task still as its rule
 * left it moves. The stamp's own rules are in nightHours.test.ts. Every name
 * here is a generic one.
 */

const KIND = (id: string, name: string, letter: string, order: number, blocks: Template['blocks'], sleepProfileId?: string): Template =>
  ({ id, name, color: '#a7c4f5', blocks, dayKind: { letter, order }, sleepProfileId }) as Template

const NIGHT = KIND('night', 'Night shift', 'N', 0, [
  { id: 'shift', time: '22:00', title: 'On shift', minutes: 540 },
  { id: 'meal', time: '01:00', title: 'Night meal', minutes: 30, afterMidnight: true },
  { id: 'home', time: '07:00', title: 'Drive home', minutes: 30, afterMidnight: true },
])
const DAY = KIND('day', 'Day shift', 'D', 1, [{ id: 'work', time: '07:00', title: 'At work', minutes: 480 }], 'early')
const REST = KIND('rest', 'Rest day', 'R', 2, [])

const ROUTINE = (over: Partial<Routine>): Routine =>
  ({ id: 'gym', title: 'Training', minutes: 45, weekdays: [0, 1, 2, 3, 4, 5, 6], times: {}, ...over }) as Routine

// A plain Sunday to Wednesday in November, the clocks settled.
const TODAY = '2026-11-01'
const SUN = '2026-11-01'
const MON = '2026-11-02'
const TUE = '2026-11-03'
const WED = '2026-11-04'
const THU = '2026-11-05'

function plan(routines: Routine[] = []): AppData {
  const data = defaultData()
  data.settings = {
    ...data.settings,
    sleepProfiles: [
      { id: 'default', name: 'Nights', window: { start: '23:30', end: '07:00' } },
      { id: 'early', name: 'Early', window: { start: '21:00', end: '05:00' } },
      { id: 'late', name: 'Late', window: { start: '03:00', end: '11:00' } },
    ],
  }
  data.templates = [NIGHT, DAY, REST]
  data.routines = routines
  return data
}

const task = (data: AppData, date: string, title: string): Task | undefined => data.days[date]?.tasks.find(t => t.title === title)
const onDate = (data: AppData, date: string) => (data.days[date]?.tasks ?? []).map(t => t.title).sort()
const kindsOf = (data: AppData): KindOf => on => kindOnDate(data, on)

function edit(data: AppData, date: string, title: string, patch: Partial<Task>): AppData {
  const day = data.days[date]
  return { ...data, days: { ...data.days, [date]: { ...day, tasks: day.tasks.map(t => (t.title === title ? { ...t, ...patch } : t)) } } }
}

// --- busy time -------------------------------------------------------------------------------

test("a night's hours are busy time on the date after, read from the template for a date the draft is about to give its kind", () => {
  const data = plan()
  const drafted: KindOf = on => (on === MON ? NIGHT : undefined)
  const home = busyOn(data, TUE, drafted, TODAY).filter(b => b.reason.kind === 'block' && b.reason.title === 'Drive home')
  expect(home).toEqual([{ start: wallInstant(TUE, 420), end: wallInstant(TUE, 450), reason: { kind: 'block', title: 'Drive home' } }])
})

test("once the night is on the plan, its hours are read from the date after, and a moved one is where it was moved", () => {
  const applied = edit(applyRoster(plan(), { [MON]: 'night' }, TODAY), TUE, 'Drive home', { time: '08:00' })
  const home = busyOn(applied, TUE, kindsOf(applied), TODAY).filter(b => b.reason.kind === 'block' && b.reason.title === 'Drive home')
  expect(home.map(b => b.start)).toEqual([wallInstant(TUE, 480)])
})

test("last night's tasks are the night's busy time once, and not the date's own blocks as well", () => {
  const applied = applyRoster(plan(), { [MON]: 'night', [TUE]: 'night' }, TODAY)
  const meals = busyOn(applied, TUE, kindsOf(applied), TODAY).filter(b => b.reason.kind === 'block' && b.reason.title === 'Night meal')
  // Monday's night meal on Tuesday's clock, and Tuesday's own on Wednesday's,
  // which a late routine on Tuesday can reach.
  expect(meals.map(b => b.start)).toEqual([wallInstant(TUE, 60), wallInstant(WED, 60)])
})

// --- composition, and the dates around a change of kind ----------------------------------------

test("a night applied to a date lands its hours on the date after, and a routine there that runs into them loses its time and says so", () => {
  const data = applyRoster(plan([ROUTINE({ times: { rest: '07:15', night: '15:00' } })]), { [TUE]: 'rest' }, TODAY)
  expect(task(data, TUE, 'Training')?.time).toBe('07:15')

  // One tap on the Monday, and the Tuesday follows it.
  const applied = applyRoster(data, { [MON]: 'night' }, TODAY)
  expect(onDate(applied, TUE)).toEqual(['Drive home', 'Night meal', 'Training'])
  expect(task(applied, TUE, 'Night meal')?.nightOf).toBe(MON)
  expect(task(applied, TUE, 'Training')?.time).toBeUndefined()
  expect(applied.days[TUE].templateId).toBe('rest')
})

test('a routine on a date around the change that was moved or ticked by hand stays where it was put', () => {
  const data = applyRoster(plan([ROUTINE({ times: { rest: '07:15' } })]), { [TUE]: 'rest', [WED]: 'rest' }, TODAY)
  const moved = edit(edit(data, TUE, 'Training', { time: '07:10' }), WED, 'Training', { done: true })
  const applied = applyRoster(moved, { [MON]: 'night', [TUE]: 'night' }, TODAY)
  // Tuesday was drafted and changed kind: its routine was composed as a
  // night's. Wednesday follows Tuesday, and its routine was ticked.
  expect(task(applied, WED, 'Training')).toEqual(task(moved, WED, 'Training'))
  const tuesday = applyRoster(edit(data, TUE, 'Training', { time: '07:10' }), { [MON]: 'night' }, TODAY)
  expect(task(tuesday, TUE, 'Training')?.time).toBe('07:10')
})

test("the day before follows a change: its evening ends in the new kind's sleep, and a late routine that now runs into it says so", () => {
  const data = applyRoster(plan([ROUTINE({ title: 'Stretching', times: { rest: '21:30' } })]), { [SUN]: 'rest' }, TODAY)
  expect(task(data, SUN, 'Stretching')?.time).toBe('21:30')
  // Monday becomes a day shift, whose sleep starts at nine on Sunday evening.
  const applied = applyRoster(data, { [MON]: 'day' }, TODAY)
  expect(task(applied, SUN, 'Stretching')?.time).toBeUndefined()
})

test('the second date after a change follows it too, where a night reaches that far', () => {
  const long = KIND('long', 'Long night', 'L', 3, [{ id: 'late', time: '23:00', title: 'Late run', minutes: 180, afterMidnight: true }])
  // A day off that sleeps from three, so one in the morning is awake.
  const owl = KIND('owl', 'Late rest', 'O', 4, [], 'late')
  const data = plan([ROUTINE({ times: { owl: '01:00' } })])
  data.templates = [...data.templates, long, owl]
  const rested = applyRoster(data, { [WED]: 'owl' }, TODAY)
  expect(task(rested, WED, 'Training')?.time).toBe('01:00')
  // Monday's night block is at eleven on Tuesday evening and runs to two on
  // Wednesday morning.
  const applied = applyRoster(rested, { [MON]: 'long' }, TODAY)
  expect(task(applied, TUE, 'Late run')?.nightOf).toBe(MON)
  expect(task(applied, WED, 'Training')?.time).toBeUndefined()
})

test('a date behind today does not follow', () => {
  const data = applyRoster(plan([ROUTINE({ title: 'Stretching', times: { rest: '21:30' } })]), { [SUN]: 'rest' }, TODAY)
  const applied = applyRoster(data, { [MON]: 'day' }, MON)
  expect(applied.days[SUN]).toBe(data.days[SUN])
})

test('a date around the change with no kind is left as it is, and so is one whose kind did not change', () => {
  const data = applyRoster(plan([ROUTINE({ times: { rest: '07:15' } })]), { [TUE]: 'rest' }, TODAY)
  // Tuesday is a rest day already: its kind does not change, so nothing around it is asked again.
  const again = applyRoster(data, { [TUE]: 'rest' }, TODAY)
  expect(again).toBe(data)
  // Wednesday has no kind and gets nothing from Tuesday's.
  expect(again.days[WED]).toBeUndefined()
})

test('applying the same roster twice is applying it once, with nights and the dates around them', () => {
  const data = applyRoster(plan([ROUTINE({ times: { rest: '07:15', night: '15:00' } })]), { [TUE]: 'rest', [SUN]: 'rest' }, TODAY)
  const once = applyRoster(data, { [MON]: 'night', [WED]: 'night' }, TODAY)
  expect(applyRoster(once, { [MON]: 'night', [WED]: 'night' }, TODAY)).toBe(once)
})

// --- what was changed by hand -------------------------------------------------------------------

test("a night's task ticked, moved or deleted on the date after is a hand edit of its night's date, and not of the date it is on", () => {
  const applied = applyRoster(plan(), { [MON]: 'night', [TUE]: 'night' }, TODAY)
  expect(handEdits(applied, MON)).toEqual({ done: 0, moved: 0, deleted: 0 })
  const ticked = edit(applied, TUE, 'Night meal', { done: true })
  // Monday's night meal is the one on Tuesday; Tuesday's own is on Wednesday.
  const mondays = ticked.days[TUE].tasks.find(t => t.title === 'Night meal')!
  expect(mondays.nightOf).toBe(MON)
  expect(handEdits(ticked, MON)).toEqual({ done: 1, moved: 0, deleted: 0 })
  expect(handEdits(ticked, TUE)).toEqual({ done: 0, moved: 0, deleted: 0 })

  const moved = edit(applied, TUE, 'Drive home', { time: '07:30' })
  expect(handEdits(moved, MON)).toEqual({ done: 0, moved: 1, deleted: 0 })
  const gone: AppData = { ...applied, days: { ...applied.days, [TUE]: { ...applied.days[TUE], tasks: applied.days[TUE].tasks.filter(t => t.title !== 'Drive home') } } }
  expect(handEdits(gone, MON)).toEqual({ done: 0, moved: 0, deleted: 1 })
})

// --- the preview ---------------------------------------------------------------------------------

test('the preview names the days next to the change that follow it, and after which', () => {
  const data = applyRoster(plan([ROUTINE({ times: { rest: '07:15' } })]), { [TUE]: 'rest', [THU]: 'rest' }, TODAY)
  const preview = rosterPreview(data, { [MON]: 'night' }, TODAY)
  expect(preview.changing).toBe(1)
  expect(preview.following).toEqual([{ date: TUE, after: [MON] }])
})

test('a date that follows one of two changes in the draft names that one', () => {
  const FRI = '2026-11-06'
  const SAT = '2026-11-07'
  const data = applyRoster(plan([ROUTINE({ times: { rest: '07:15' } })]), { [TUE]: 'rest', [SUN]: 'rest' }, TODAY)
  const preview = rosterPreview(data, { [MON]: 'night', [FRI]: 'night' }, TODAY)
  // Each morning after takes its own night's hours, and follows that night alone.
  expect(preview.following).toEqual([
    { date: TUE, after: [MON] },
    { date: SAT, after: [FRI] },
  ])
})

test("the preview's dates are exactly the dates Apply changes: the ones it lists, and the ones that follow", () => {
  const data = applyRoster(plan([ROUTINE({ times: { rest: '07:15', night: '15:00', day: '17:00' } })]), { [SUN]: 'rest', [TUE]: 'rest', [WED]: 'rest', [THU]: 'rest' }, TODAY)
  const draft = { [MON]: 'night', [WED]: 'day' }
  const applied = applyRoster(data, draft, TODAY)
  const changed = Object.keys(applied.days).filter(date => applied.days[date] !== data.days[date])
  const preview = rosterPreview(data, draft, TODAY)
  const listed = preview.weeks.flatMap(week => week.dates.map(d => d.date))
  expect([...listed, ...preview.following.map(f => f.date)].sort()).toEqual(changed.sort())
  expect(listed.filter(date => preview.following.some(f => f.date === date))).toEqual([])
})

test('a date of the draft already what it says, taking a changed night, follows rather than counting as unchanged', () => {
  const data = applyRoster(plan(), { [TUE]: 'night' }, TODAY)
  const preview = rosterPreview(data, { [MON]: 'night', [TUE]: 'night' }, TODAY)
  expect(preview.changing).toBe(1)
  expect(preview.unchanged).toBe(0)
  expect(preview.following).toEqual([{ date: TUE, after: [MON] }])
})

// --- the weekday map ------------------------------------------------------------------------------

function mapped(weekday: number, templateId: string): AppData {
  const data = plan([ROUTINE({ times: { rest: '07:15' } })])
  data.settings = { ...data.settings, weekdayTemplates: { [weekday]: templateId } }
  return data
}

test("a kind the weekday map gives a date puts its night on the date after when the date is opened", () => {
  const data = mapped(weekdayOf(MON), 'night')
  const ensured = ensuredDay(data, MON, TODAY)!
  expect(ensured.days[MON].templateId).toBe('night')
  expect(ensured.days[TUE].tasks.filter(t => t.nightOf === MON).map(t => t.title).sort()).toEqual(['Drive home', 'Night meal'])
})

test('opening the date after first gives it the night too, by opening the night first', () => {
  const data = mapped(weekdayOf(MON), 'night')
  const ensured = ensuredDay(data, TUE, TODAY)!
  expect(ensured.days[MON]).toMatchObject({ templateId: 'night', autoApplied: true })
  expect(ensured.days[TUE].tasks.filter(t => t.nightOf === MON)).toHaveLength(2)
  expect(ensured.changed).toBe(true)
  // Opening the night afterwards finds it done, and adds nothing.
  const again = ensuredDay({ ...data, days: ensured.days }, MON, TODAY)
  expect(again).toBeNull()
})

test('only the one date before is opened for its night, only today or ahead, and only for a template with a night', () => {
  const night = mapped(weekdayOf(MON), 'night')
  expect(ensuredDay(night, WED, TODAY)?.days[MON]).toBeUndefined()
  expect(ensuredDay(night, TUE, TUE)?.days[MON]).toBeUndefined()
  const day = mapped(weekdayOf(MON), 'day')
  expect(ensuredDay(day, TUE, TODAY)?.days[MON]).toBeUndefined()
})

test("a kind the weekday map gives a date is followed by the dates around it that have a kind", () => {
  const data = applyRoster(mapped(weekdayOf(MON), 'night'), { [TUE]: 'rest' }, TODAY)
  expect(task(data, TUE, 'Training')?.time).toBe('07:15')
  const ensured = ensuredDay(data, MON, TODAY)!
  const tuesday: DayPlan = ensured.days[TUE]
  expect(tuesday.tasks.find(t => t.title === 'Training')?.time).toBeUndefined()
})
