import { addDays } from './dates'
import { isDayKind, kindOnDate } from './dayKinds'
import { weekdayOf } from './repeats'
import { applyStamps, columnFor, isNightBlock } from './stamping'
import { originFor } from './taskIdentity'
import { routineMinutes } from './routines'
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
  | { routine: Routine; time: string; minutes: number }
  | { routine: Routine; reason: 'needs-time' | 'clock-skips' }
  | { routine: Routine; reason: 'runs-into'; into: BusyReason }

/** What a date was composed into, and where each of its routines went. */
export interface Composition {
  day: DayPlan
  placements: Placement[]
  /**
   * The date after, as this date's night leaves it, where a change of kind
   * took a night's hours off it or put them on - section 10. Absent where the
   * date after is not touched.
   */
  nextDay?: DayPlan
}

/** A date changed by what the dates around it changed, and which of them - section 10.2a. */
export interface Following {
  date: string
  after: string[]
}

/** What applying a roster does, date by date: the plan it makes, and how each date in it came to change. */
export interface RosterApplied {
  plan: AppData
  /** The dates of the draft whose own composition changed, in order, each with where its routines went. */
  composed: { date: string; kind: Template | undefined; placements: Placement[] }[]
  /**
   * Every other date that changed: the date after a night that changed, and the
   * dates around a changed kind whose routines moved. A date of the draft that
   * was already what the draft says and took a changed night's hours is one.
   */
  following: Following[]
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
 * The timed blocks a date's kind puts on the clock, each with its start in
 * minutes from the date's own midnight: its night's blocks are on the date
 * after's clock, a day on (section 10).
 *
 * A date that already carries its kind is read from what is on it, and its
 * night from what is on the date after, because that is what will happen: a
 * shift moved by hand is where it was moved, and one deleted or set aside is
 * not on the clock. Last night's tasks on the date are the night before's and
 * not its own. A date the draft is about to give a kind is read from the
 * kind's template, which is exactly what the stamp will write - so a preview
 * and the plan after Apply read the same.
 */
function kindBlocksOn(data: AppData, date: string, kind: Template): { title: string; start: number; minutes?: number }[] {
  const blocks = columnFor(kind, date).blocks
  const day = data.days[date]
  if (day?.templateId !== kind.id) {
    return blocks
      .filter((b): b is TemplateBlock & { time: string } => b.time !== undefined && CLOCK.test(b.time))
      .map(b => ({ title: b.title, start: timeToMinutes(b.time) + (isNightBlock(b) ? DAY_MINUTES : 0), minutes: b.minutes }))
  }
  const ids = new Set(blocks.map(b => b.id))
  const timed = (t: Task): t is Task & { time: string } => {
    const origin = originFor(t)
    if (origin.type !== 'template' || origin.sourceId !== kind.id || !origin.blockId || !ids.has(origin.blockId)) return false
    return isAnchor(t) && CLOCK.test(t.time!)
  }
  const own = day.tasks.filter(t => !t.nightOf).filter(timed)
  const night = (data.days[addDays(date, 1)]?.tasks ?? []).filter(t => t.nightOf === date).filter(timed)
  return [
    ...own.map(t => ({ title: t.title, start: timeToMinutes(t.time), minutes: t.minutes })),
    ...night.map(t => ({ title: t.title, start: timeToMinutes(t.time) + DAY_MINUTES, minutes: t.minutes })),
  ]
}

/**
 * The busy time a routine on `date` is measured against, in real instants and
 * in order - section 5.
 *
 * - The blocks of the date's kind, from their start to their end on the wall
 *   clock, its night's on the date after's (section 10). A block with a time
 *   and no length takes its start minute.
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
      busy.push({
        start: wallInstant(on, block.start),
        end: wallInstant(on, block.start + Math.max(1, block.minutes ?? 1)),
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
  // Its length on this kind of day - see Routine.kindMinutes.
  const long = routineMinutes(routine, kind.id)
  const start = wallInstant(date, minutes)
  const end = wallInstant(date, minutes + long)
  const hit = busy.find(b => Math.min(end, b.end) - Math.max(start, b.start) >= MINUTE)
  return hit ? { routine, reason: 'runs-into', into: hit.reason } : { routine, time, minutes: long }
}

/**
 * Where each routine goes on a date of a kind, in the order the routines are
 * kept. Only the routines on the date's weekday, and not one deleted from this
 * date by hand (`routineSkips`). A date with no kind has none: the roster is
 * what routines follow.
 */
/**
 * Why each routine on a date has no time there, in the words the day says it -
 * rotating shifts, v2.29 stage 9, and section 2.3. The app never guesses a
 * time, so a routine that landed without one has to say why: its kind has no
 * time for it, its time runs into something, or the clock skips its time that
 * night. Keyed by routine id; a routine at its time has no entry, and a date
 * with no kind has none at all. Read the way composition placed them - the
 * date's kind and the busy time around it - so the day says what the rule did.
 */
export function routineNotes(data: AppData, date: string, today?: string): Map<string, string> {
  const notes = new Map<string, string>()
  const kind = kindOnDate(data, date)
  if (!kind) return notes
  const kindOf: KindOf = on => kindOnDate(data, on)
  for (const placement of placeRoutines(data, date, kind, busyOn(data, date, kindOf, today))) {
    if (!('reason' in placement)) continue
    if ('into' in placement) {
      notes.set(placement.routine.id, `Runs into ${placement.into.kind === 'sleep' ? 'sleep' : placement.into.title}`)
    } else if (placement.reason === 'clock-skips') {
      notes.set(placement.routine.id, `The clock skips ${placement.routine.times[kind.id]} that night`)
    } else {
      notes.set(placement.routine.id, `Needs a time on ${kind.name}`)
    }
  }
  return notes
}

export function placeRoutines(data: AppData, date: string, kind: Template | undefined, busy: Busy[]): Placement[] {
  if (!kind) return []
  const weekday = weekdayOf(date)
  const skipped = new Set(data.days[date]?.routineSkips ?? [])
  return data.routines.filter(r => r.weekdays.includes(weekday) && !skipped.has(r.id)).map(r => place(r, date, kind, busy))
}

type RoutineEcho = NonNullable<Task['fromRoutine']>

const ECHOED = ['title', 'time', 'minutes', 'category', 'core'] as const

/** What a placement gives a routine's task. */
function gaveBy(placement: Placement): RoutineEcho & { title: string } {
  const { routine } = placement
  return {
    title: routine.title,
    time: 'time' in placement ? placement.time : undefined,
    minutes: 'minutes' in placement ? placement.minutes : routine.minutes,
    category: routine.category,
    ...(routine.core ? { core: true } : {}),
  }
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
    ...(gave.core ? { core: true } : {}),
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
 *
 * A stamp reaches the date after as well, where the kind taken off or given
 * has hours after its midnight (section 10): that date comes back as
 * `nextDay`, for the caller to write with the day.
 */
export function composeDay(data: AppData, date: string, kind: Template | undefined, kindOf: KindOf, today?: string): Composition {
  const existing = data.days[date] ?? { date, tasks: [] }
  const stamped = data.templates.find(t => t.id === existing.templateId)
  const after = addDays(date, 1)
  let days = data.days
  if (kind && existing.templateId !== kind.id) {
    days = applyStamps({ ...data.days, [date]: existing }, data.templates, { [date]: kind.id }, data.library, data.recipes)
  } else if (!kind && stamped && isDayKind(stamped)) {
    days = applyStamps({ ...data.days, [date]: existing }, data.templates, { [date]: null }, data.library, data.recipes)
  }
  const day = days === data.days ? existing : days[date]
  const nextDay = days[after] !== data.days[after] ? days[after] : undefined
  const composing = { ...data, days: { ...days, [date]: day } }
  const asDrafted: KindOf = on => (on === date ? kind : kindOf(on))
  const placements = placeRoutines(composing, date, kind, busyOn(composing, date, asDrafted, today))
  return { day: withRoutineTasks(day, placements), placements, ...(nextDay ? { nextDay } : {}) }
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
 * - The dates are composed in order, each against the plan as the ones before
 *   it left it, so a date takes the night before it and a night is never
 *   written over.
 * - A date whose kind changes puts its night on the date after, and the dates
 *   around it follow it (`followNeighbours`, section 10.2a).
 */
export function applyRoster(
  data: AppData,
  draft: Record<string, string | null>,
  today: string,
  opts: { reach?: 'ahead' | 'any' } = {},
): AppData {
  return rosterApplied(data, draft, today, opts).plan
}

/**
 * `applyRoster`, saying what it did - the one function behind both Apply and
 * its preview, so the preview says what Apply writes (section 10.2a).
 */
export function rosterApplied(
  data: AppData,
  draft: Record<string, string | null>,
  today: string,
  opts: { reach?: 'ahead' | 'any' } = {},
): RosterApplied {
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
  const put = (date: string, day: DayPlan) => {
    if (days === data.days) days = { ...data.days }
    days[date] = day
  }
  const composed: RosterApplied['composed'] = []
  const turned: string[] = []
  for (const [date, kind] of drafted) {
    const plan = days === data.days ? data : { ...data, days }
    const before = days[date]
    const { day, placements, nextDay } = composeDay(plan, date, kind, kindOf, today)
    const unchanged = before ? day === before : !day.templateId && day.tasks.length === 0
    if (!unchanged) {
      put(date, day)
      composed.push({ date, kind, placements })
    }
    if (nextDay) put(addDays(date, 1), nextDay)
    if (kindOnDate(data, date)?.id !== kind?.id) turned.push(date)
  }
  const plan = followNeighbours(days === data.days ? data : { ...data, days }, turned, today, new Set(drafted.keys()))

  // Every other date the plan changed, and the changed kinds next to it.
  const own = new Set(composed.map(c => c.date))
  const following: Following[] = []
  for (const date of Object.keys(plan.days).sort()) {
    if (own.has(date) || plan.days[date] === data.days[date]) continue
    following.push({ date, after: turned.filter(on => [-2, -1, 1].includes(daysBetween(date, on))) })
  }
  return { plan, composed, following }
}

/**
 * The dates around those whose kind changed, made to agree with it - section
 * 10.2a. The day before, whose evening ends in a changed date's sleep and
 * whose late routines reach into its blocks, and the two after, whose
 * mornings its blocks and its night run into. Each that has a kind and is
 * today or ahead is composed again with the kind it has, which stamps nothing
 * and moves only a routine's task still as its rule left it. `skip` holds
 * dates a caller composes itself. The plan itself where nothing changes.
 */
export function followNeighbours(data: AppData, changed: string[], today: string, skip: Set<string> = new Set()): AppData {
  const around = new Set<string>()
  for (const date of changed) {
    for (const offset of [-1, 1, 2]) {
      const on = addDays(date, offset)
      if (on >= today && !skip.has(on) && !changed.includes(on)) around.add(on)
    }
  }
  let plan = data
  for (const date of [...around].sort()) {
    const kind = kindOnDate(plan, date)
    if (!kind) continue
    const reading = plan
    const { day } = composeDay(reading, date, kind, on => kindOnDate(reading, on), today)
    if (day !== plan.days[date]) plan = { ...plan, days: { ...plan.days, [date]: day } }
  }
  return plan
}

/** Whole days from `from` to `to`, on the calendar. */
function daysBetween(from: string, to: string): number {
  const [a, b] = [from, to].map(date => {
    const [y, m, d] = date.split('-').map(Number)
    return Date.UTC(y, m - 1, d)
  })
  return Math.round((b - a) / 86_400_000)
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
 * The kind's night is the date's, on the date after (section 10): its tasks
 * there are counted here, and not as the date after's.
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
    const ofKind = (t: Task) => {
      const origin = originFor(t)
      return origin.type === 'template' && origin.sourceId === kind.id
    }
    // The date's own, without last night's; and its night's, on the date
    // after - section 10.
    const own = day.tasks.filter(t => !t.nightOf && ofKind(t))
    const night = (data.days[addDays(date, 1)]?.tasks ?? []).filter(t => t.nightOf === date && ofKind(t))
    for (const task of [...own, ...night]) {
      const block = blocks.find(b => b.id === originFor(task).blockId)
      if (task.done) edits.done++
      else if (movedFromBlock(task, block)) edits.moved++
    }
    for (const block of blocks) {
      const standing = isNightBlock(block) ? night : own
      if (!standing.some(t => originFor(t).blockId === block.id)) edits.deleted++
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
