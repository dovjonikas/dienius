import { addDays } from './dates'
import { isDayKind, kindOnDate } from './dayKinds'
import { weekdayOf } from './repeats'
import { applyStamps, columnFor } from './stamping'
import { originFor } from './taskIdentity'
import { ROUTINE_LIMITS, type AppData, type DayPlan, type Routine, type SleepWindow, type Task, type Template, type TemplateBlock } from './types'
import { ownedSleep, type WakingDay } from './wakingDay'
import { clockTimeExists, wallInstant } from './wallClock'
import { activeTask, isAnchor, minutesLeft, sleepProfileWindow, timeToMinutes, wakingDayFor, type Interval, type SleepSettings } from '../widgets/day-plan/capacity'

/**
 * A date's composition - rotating shifts, since v2.29, and
 * docs/RESEARCH-SHIFTS.md sections 2.4, 3, 4, 5 and 6.3. What a date is made
 * of when it has a kind: the kind's template, the routines on its weekday each
 * at its kind's time or saying why not, the sleep it wakes from and the sleep
 * its evening ends in, and everything the day already had that was not the
 * kind's or a routine's.
 *
 * Pure, and the one place a date is composed: applying a roster, previewing
 * one and the property tests all come through `composeDay`, so no second way
 * of making a day can disagree with it.
 *
 * Every question about which kind a date is goes through a `KindOf`, never
 * straight to the day, because a draft is asked before it is applied: while a
 * preview is on screen, tomorrow's kind is the draft's and not yet the plan's.
 */

/** Which kind each date is: the plan's stamps, or a draft laid over them. */
export type KindOf = (date: string) => Template | undefined

/** Why a stretch of time is not free for a routine. */
export type BusyReason = { kind: 'block'; title: string } | { kind: 'sleep' }

/** A stretch of real time, in instants, that a routine may not run into. */
export interface Busy {
  start: number
  end: number
  reason: BusyReason
}

/** Where a routine goes on a date: at a time, or with none and the reason. */
export type Placement =
  | { routine: Routine; time: string }
  | { routine: Routine; reason: 'needs-time' | 'clock-skips' }
  | { routine: Routine; reason: 'runs-into'; into: BusyReason }

/** What a date was composed into, and where each of its routines went. */
export interface Composition {
  day: DayPlan
  placements: Placement[]
}

/** What on a date was changed by hand, counted the way the question about it names them - section 6.3. */
export interface HandEdits {
  done: number
  moved: number
  deleted: number
}

const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/
const DAY_MINUTES = 24 * 60
const MINUTE = 60_000

/**
 * The template a date's sleep comes from, as far as the plan can know it.
 *
 * Its kind first. Then the ordinary template stamped on it - not a kind the
 * draft takes off, which will not be there, and not an id naming a template
 * deleted since, which reads as none. Then, for a date today or ahead that
 * nobody has opened, the template its weekday will stamp the moment it is
 * (`ensuredDay`): otherwise Friday's evening would change the moment Saturday
 * was opened. Like opening, the weekday map never argues with a stamp and
 * never reaches back; without a `today` it is not asked at all.
 */
function templateOn(data: AppData, date: string, kindOf: KindOf, today: string | undefined): Template | undefined {
  const kind = kindOf(date)
  if (kind) return kind
  const day = data.days[date]
  const stamped = day?.templateId ? data.templates.find(t => t.id === day.templateId) : undefined
  const takenOff = !!stamped && isDayKind(stamped)
  if (day?.templateId && !takenOff) return stamped
  if (today === undefined || date < today || day?.autoApplied) return undefined
  const mapped = data.settings.weekdayTemplates[weekdayOf(date)]
  return mapped ? data.templates.find(t => t.id === mapped) : undefined
}

/**
 * The id of the sleep schedule a date wakes from, or undefined for the default.
 *
 * A day's own choice wins, as it does in the day view: it is set by hand, and
 * the day you had is the one that knows how you slept. Then its template's,
 * through its column on a week template - see `templateOn`.
 */
function sleepProfileIdOn(data: AppData, date: string, kindOf: KindOf, today: string | undefined): string | undefined {
  const day = data.days[date]
  const template = templateOn(data, date, kindOf, today)
  return day?.sleepProfileId ?? (template ? columnFor(template, date).sleepProfileId : undefined)
}

/** The sleep schedule a date wakes from - see `sleepProfileIdOn` - the default when it names none. */
export function sleepWindowOn(data: AppData, date: string, kindOf: KindOf, today?: string): SleepWindow {
  return sleepProfileWindow(sleepProfileIdOn(data, date, kindOf, today), { profiles: data.settings.sleepProfiles })
}

/**
 * A date's sleep, as every reader of it is handed it - the one function in
 * front of all of them (docs/RESEARCH-SHIFTS.md section 1.3, where four readers
 * disagreed about a day on a week template). The schedule the date wakes from,
 * and settings carrying tonight's, which is the next date's: a sleep belongs to
 * the date it ends on, so the bedtime that closes a day is tomorrow's.
 *
 * Tonight's is always named, the default by its own id, so a reader never
 * mistakes "tomorrow sleeps the default" for "tomorrow sleeps like today".
 * `today` is what lets a date not yet opened read the template its weekday will
 * give it.
 */
export function sleepOn(data: AppData, date: string, today: string, kindOf: KindOf = on => kindOnDate(data, on)): { profileId: string | undefined; sleep: SleepSettings } {
  const profiles = data.settings.sleepProfiles
  const tonight = sleepProfileIdOn(data, addDays(date, 1), kindOf, today)
  const named = profiles.find(p => p.id === tonight) ?? profiles[0]
  return { profileId: sleepProfileIdOn(data, date, kindOf, today), sleep: { profiles, tonightProfileId: named?.id } }
}

/**
 * A date's waking day: the sleep it wakes from, tonight's, and the hours
 * between - `sleepOn` read through `wakingDayFor`, so the grey bands, the
 * free-time figure and "Sleep in" agree about when a day ends. `kindOf` is the
 * plan's kinds unless a draft is being read.
 */
export function wakingDayOn(data: AppData, date: string, today: string, kindOf: KindOf = on => kindOnDate(data, on)): WakingDay {
  const { profileId, sleep } = sleepOn(data, date, today, kindOf)
  return wakingDayFor(profileId, sleep)
}

/**
 * What still runs in from the day before, on this date's clock: yesterday's
 * timed tasks with a length that takes them past midnight, from below zero to
 * where they end today. Still yesterday's tasks - a block is its start date's
 * (section 3) - so this is only the time they take here: the morning's free
 * time, and what is running at one in the morning. A task waiting aside is not
 * on the clock and does not run in.
 */
export function carriedInto(data: AppData, date: string): { task: Task; start: number; end: number }[] {
  return (data.days[addDays(date, -1)]?.tasks ?? [])
    .filter((t): t is Task & { time: string; minutes: number } => isAnchor(t) && CLOCK.test(t.time!) && t.minutes !== undefined)
    .map(task => {
      const start = timeToMinutes(task.time) - DAY_MINUTES
      return { task, start, end: start + task.minutes }
    })
    .filter(carried => carried.end > 0)
}

/**
 * The part of today's clock that last night's blocks still take - from
 * midnight to where each ends, within the day. Busy time for a slot quick-add or
 * Later suggests and an hour the time picker shows as taken, the way somebody
 * else's calendar is.
 */
export function carriedIntervals(data: AppData, date: string): Interval[] {
  return carriedInto(data, date).map(({ end }) => ({ start: 0, end: Math.min(end, DAY_MINUTES) }))
}

/**
 * What is running at `nowMinutes` on `date`'s clock, the date it belongs to,
 * and its real minutes left: today's own block, or one of last night's still
 * running in. Where both are, today's wins - it started later, which is the
 * rule `activeTask` keeps for any two - and a ticked block is not running,
 * whatever the clock says.
 */
export function runningOn(data: AppData, date: string, nowMinutes: number): { task: Task; date: string; left: number } | undefined {
  const own = activeTask(data.days[date]?.tasks ?? [], nowMinutes)
  if (own) return { task: own, date, left: minutesLeft(own, nowMinutes, date)! }
  const yesterday = addDays(date, -1)
  const carried = carriedInto(data, date).find(c => !c.task.done && c.start <= nowMinutes && nowMinutes < c.end)
  if (!carried) return undefined
  return { task: carried.task, date: yesterday, left: minutesLeft(carried.task, nowMinutes + DAY_MINUTES, yesterday)! }
}

/**
 * The timed blocks a date's kind puts on its clock.
 *
 * A date that already carries its kind is read from what is on it, because
 * that is what will happen: a shift moved by hand is where it was moved, and
 * one deleted or set aside is not on the clock. A date the draft is about to
 * give a kind is read from the kind's template, which is exactly what the
 * stamp will write - so a preview and the plan after Apply read the same.
 */
function kindBlocksOn(data: AppData, date: string, kind: Template): { title: string; time: string; minutes?: number }[] {
  const blocks = columnFor(kind, date).blocks
  const day = data.days[date]
  if (day?.templateId !== kind.id) {
    return blocks.filter((b): b is TemplateBlock & { time: string } => b.time !== undefined && CLOCK.test(b.time))
  }
  const ids = new Set(blocks.map(b => b.id))
  return day.tasks
    .filter(t => {
      const origin = originFor(t)
      return origin.type === 'template' && origin.sourceId === kind.id && !!origin.blockId && ids.has(origin.blockId)
    })
    .filter((t): t is Task & { time: string } => isAnchor(t) && CLOCK.test(t.time!))
}

/**
 * The busy time a routine on `date` is measured against, in real instants and
 * in order - section 5.
 *
 * - The blocks of the date's kind, from their start to their end on the wall
 *   clock. A block with a time and no length takes its start minute.
 * - What is still running of the blocks of the two dates before: a night
 *   shift is its start date's, and after midnight it is busy time here without
 *   being a task here.
 * - The sleep the date wakes from, and the sleep its evening ends in, which is
 *   the next date's kind's.
 * - And what a routine late in the evening can reach past midnight: the next
 *   date's blocks and the sleep after it. A routine is at most twelve hours
 *   long, so nothing past noon tomorrow is asked about.
 *
 * Tasks written by hand and repeats are not busy time: they are the person's,
 * and a routine is refused only where the day's own kind or sleep leaves no
 * room. A block whose date has no kind is not the roster's and is not read.
 */
export function busyOn(data: AppData, date: string, kindOf: KindOf, today?: string): Busy[] {
  const from = wallInstant(date, 0)
  const to = wallInstant(date, DAY_MINUTES + ROUTINE_LIMITS.minutes)
  const busy: Busy[] = []
  for (let offset = -2; offset <= 1; offset++) {
    const on = addDays(date, offset)
    const kind = kindOf(on)
    if (!kind) continue
    for (const block of kindBlocksOn(data, on, kind)) {
      const start = timeToMinutes(block.time)
      busy.push({
        start: wallInstant(on, start),
        end: wallInstant(on, start + Math.max(1, block.minutes ?? 1)),
        reason: { kind: 'block', title: block.title },
      })
    }
  }
  for (let offset = 0; offset <= 2; offset++) {
    const on = addDays(date, offset)
    const sleep = ownedSleep(sleepWindowOn(data, on, kindOf, today))
    if (sleep) busy.push({ start: wallInstant(on, sleep.start), end: wallInstant(on, sleep.end), reason: { kind: 'sleep' } })
  }
  return busy.filter(b => b.end > from && b.start < to).sort((a, b) => a.start - b.start || a.end - b.end)
}

/**
 * Where one routine goes on a date of a kind - section 2.3.
 *
 * - No time written for the kind: it needs one, and is never given one - not
 *   another kind's, not the nearest gap.
 * - A time the clock skips that night: the same, and not moved an hour on.
 * - A time that runs into busy time by a minute or more: no time, and what it
 *   runs into - the earliest thing it meets. Touching is not running into.
 * - Otherwise its time.
 */
function place(routine: Routine, date: string, kind: Template, busy: Busy[]): Placement {
  const time = Object.entries(routine.times).find(([id]) => id === kind.id)?.[1]
  if (time === undefined || !CLOCK.test(time)) return { routine, reason: 'needs-time' }
  if (!clockTimeExists(date, time)) return { routine, reason: 'clock-skips' }
  const minutes = timeToMinutes(time)
  const start = wallInstant(date, minutes)
  const end = wallInstant(date, minutes + routine.minutes)
  const hit = busy.find(b => Math.min(end, b.end) - Math.max(start, b.start) >= MINUTE)
  return hit ? { routine, reason: 'runs-into', into: hit.reason } : { routine, time }
}

/**
 * Where each routine goes on a date of a kind, in the order the routines are
 * kept. Only the routines on the date's weekday, and not one deleted from this
 * date by hand (`routineSkips`). A date with no kind has none: the roster is
 * what routines follow.
 */
export function placeRoutines(data: AppData, date: string, kind: Template | undefined, busy: Busy[]): Placement[] {
  if (!kind) return []
  const weekday = weekdayOf(date)
  const skipped = new Set(data.days[date]?.routineSkips ?? [])
  return data.routines.filter(r => r.weekdays.includes(weekday) && !skipped.has(r.id)).map(r => place(r, date, kind, busy))
}

type RoutineEcho = NonNullable<Task['fromRoutine']>

const ECHOED = ['title', 'time', 'minutes', 'category'] as const

/** What a placement gives a routine's task. */
function gaveBy(placement: Placement): RoutineEcho & { title: string } {
  const { routine } = placement
  return { title: routine.title, time: 'time' in placement ? placement.time : undefined, minutes: routine.minutes, category: routine.category }
}

/**
 * Whether a routine's task is still exactly what its rule last gave it. A task
 * with no echo arrived by hand - moved or pushed from another date - and is
 * not the rule's.
 */
function asTheRuleLeftIt(task: Task): boolean {
  const echo = task.fromRoutine
  return !!echo && ECHOED.every(key => task[key] === echo[key])
}

/**
 * A routine's task brought up to where its rule puts it now, field by field,
 * and only the fields still carrying what the rule gave last time: a time moved
 * by hand stays where it was moved while the length follows. A ticked task is a
 * record and is not touched, nor is one with no echo.
 */
function followRule(task: Task, placement: Placement): Task {
  const echo = task.fromRoutine
  if (task.done || !echo) return task
  const gave = gaveBy(placement)
  const moved: Partial<Task> = {}
  for (const key of ECHOED) {
    if (task[key] === echo[key] && gave[key] !== echo[key]) Object.assign(moved, { [key]: gave[key] })
  }
  if (Object.keys(moved).length === 0) return task
  return { ...task, ...moved, fromRoutine: gave }
}

function routineTask(placement: Placement): Task {
  const gave = gaveBy(placement)
  return {
    id: crypto.randomUUID(),
    title: gave.title,
    done: false,
    time: gave.time,
    minutes: gave.minutes,
    category: gave.category,
    routineId: placement.routine.id,
    fromRoutine: gave,
  }
}

/**
 * A day's routine tasks made to agree with where its routines go: each routine
 * placed once, a task still as its rule left it following the rule, a new one
 * where the day has none, and one whose routine is not on the date any more -
 * deleted, off this weekday, the date no longer a kind - taken away unless it
 * was ticked, moved or put there by hand. The day itself when nothing changes.
 */
function withRoutineTasks(day: DayPlan, placements: Placement[]): DayPlan {
  const byRoutine = new Map(placements.map(p => [p.routine.id, p]))
  const seen = new Set<string>()
  const tasks: Task[] = []
  let changed = false
  for (const task of day.tasks) {
    const placement = task.routineId ? byRoutine.get(task.routineId) : undefined
    if (!task.routineId) {
      tasks.push(task)
    } else if (!placement || seen.has(task.routineId)) {
      if (!task.done && asTheRuleLeftIt(task)) changed = true
      else tasks.push(task)
    } else {
      seen.add(task.routineId)
      const next = followRule(task, placement)
      if (next !== task) changed = true
      tasks.push(next)
    }
  }
  for (const placement of placements) {
    if (seen.has(placement.routine.id)) continue
    tasks.push(routineTask(placement))
    changed = true
  }
  return changed ? { ...day, tasks } : day
}

/**
 * Composes one date as `kind`, or as no kind with undefined - section 2.4.
 *
 * - **A different kind** is stamped the way every template is (`applyStamps`):
 *   the old kind's tasks go, the new kind's blocks come, and everything that
 *   was not the old kind's - hand-written tasks, repeats, tasks moved in, what
 *   was written on the day, its sleep - stays.
 * - **The same kind** is not stamped again. A stamp puts every block back at
 *   its template's time, so a shift moved or deleted by hand would come back;
 *   the kind's template edits reach the day the way any template's do
 *   (`refreshFromTemplate`).
 * - **No kind** takes a kind off and nothing else. A date whose template is not
 *   a kind has no kind to take off, and is left as it is.
 *
 * Then the routines, measured against busy time with this date as `kind` and
 * every other date as `kindOf` says. The day comes back as the same object when
 * nothing about it changes, which is how Apply knows to leave it alone.
 */
export function composeDay(data: AppData, date: string, kind: Template | undefined, kindOf: KindOf, today?: string): Composition {
  const existing = data.days[date] ?? { date, tasks: [] }
  const stamped = data.templates.find(t => t.id === existing.templateId)
  let day = existing
  if (kind && existing.templateId !== kind.id) {
    day = applyStamps({ [date]: existing }, data.templates, { [date]: kind.id }, data.library)[date]
  } else if (!kind && stamped && isDayKind(stamped)) {
    day = applyStamps({ [date]: existing }, data.templates, { [date]: null }, data.library)[date]
  }
  const composing = { ...data, days: { ...data.days, [date]: day } }
  const asDrafted: KindOf = on => (on === date ? kind : kindOf(on))
  const placements = placeRoutines(composing, date, kind, busyOn(composing, date, asDrafted, today))
  return { day: withRoutineTasks(day, placements), placements }
}

/**
 * Lays a roster over the plan - a date's kind id, or null for no kind - and
 * returns the plan it makes. Pure; the store commits it once.
 *
 * - A date before `today` is not in reach: a lived day says what it was. A
 *   stamp made by hand may reach one - somebody is looking at that date and
 *   pressing a kind onto it - and says so with `reach: 'any'`.
 * - An id that names no kind any more - deleted since the draft was made -
 *   leaves its date as it is rather than guessing.
 * - Each date is composed against the draft's kinds for every date the draft
 *   holds and the plan's for the rest, so a date reads tomorrow as it will be.
 * - A date whose composition changes nothing keeps its own object, and a
 *   roster that changes nothing returns the plan itself: applying the same
 *   roster twice is applying it once.
 */
export function applyRoster(
  data: AppData,
  draft: Record<string, string | null>,
  today: string,
  opts: { reach?: 'ahead' | 'any' } = {},
): AppData {
  const drafted = new Map<string, Template | undefined>()
  for (const date of Object.keys(draft).sort()) {
    if (date < today && opts.reach !== 'any') continue
    const id = draft[date]
    if (id === null) {
      drafted.set(date, undefined)
      continue
    }
    const kind = data.templates.find(t => t.id === id)
    if (kind && isDayKind(kind)) drafted.set(date, kind)
  }
  const kindOf: KindOf = date => (drafted.has(date) ? drafted.get(date) : kindOnDate(data, date))

  let days = data.days
  for (const [date, kind] of drafted) {
    const before = data.days[date]
    const { day } = composeDay(data, date, kind, kindOf, today)
    const unchanged = before ? day === before : !day.templateId && day.tasks.length === 0
    if (unchanged) continue
    if (days === data.days) days = { ...data.days }
    days[date] = day
  }
  return days === data.days ? data : { ...data, days }
}

/**
 * What on a date was changed by hand - section 6.3 - so changing its kind can
 * ask first. Counted over the tasks of the date's own kind and its routines,
 * each task once:
 *
 * - **done**: ticked;
 * - **moved**: its time, length, title or category is not what its block or
 *   rule gave, or it is a routine's task that arrived by hand;
 * - **deleted**: a block of the kind, or a routine on this weekday, with no
 *   task on the day and no skip.
 *
 * A task written by hand is not counted: it stays through any change of kind.
 * A block added to the kind after the date was stamped reads as deleted from
 * it, since nothing records which blocks a stamp placed; the question then
 * names one too many, and Apply gives the date the whole new kind, which is
 * what was asked.
 */
export function handEdits(data: AppData, date: string): HandEdits {
  const edits: HandEdits = { done: 0, moved: 0, deleted: 0 }
  const day = data.days[date]
  if (!day) return edits
  const kind = kindOnDate(data, date)

  if (kind) {
    const blocks = columnFor(kind, date).blocks
    const own = day.tasks.filter(t => {
      const origin = originFor(t)
      return origin.type === 'template' && origin.sourceId === kind.id
    })
    for (const task of own) {
      const block = blocks.find(b => b.id === originFor(task).blockId)
      if (task.done) edits.done++
      else if (movedFromBlock(task, block)) edits.moved++
    }
    for (const block of blocks) {
      if (!own.some(t => originFor(t).blockId === block.id)) edits.deleted++
    }
    const weekday = weekdayOf(date)
    const skipped = new Set(day.routineSkips ?? [])
    for (const routine of data.routines) {
      if (!routine.weekdays.includes(weekday) || skipped.has(routine.id)) continue
      if (!day.tasks.some(t => t.routineId === routine.id)) edits.deleted++
    }
  }

  for (const task of day.tasks) {
    if (!task.routineId) continue
    if (task.done) edits.done++
    else if (!asTheRuleLeftIt(task)) edits.moved++
  }
  return edits
}

/**
 * Whether a block's task differs from what its block gave it. A task with no
 * echo was stamped before echoes were kept and cannot be told apart, so it is
 * not counted. A title bound to a library list is the list's to change, not a
 * person's.
 */
function movedFromBlock(task: Task, block: TemplateBlock | undefined): boolean {
  const echo = task.fromBlock
  if (!echo) return false
  if (task.time !== echo.time || task.minutes !== echo.minutes || task.category !== echo.category) return true
  return !block?.libraryListId && task.title !== echo.title
}
