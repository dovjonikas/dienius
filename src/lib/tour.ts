import type { AppData, DayPlan } from './types'

/**
 * The tour: what it says, where it points, and what ends each step.
 *
 * Every step ends on a real action rather than a Next button. Somebody who
 * has typed a task, ticked it off and started Focus has used the app; somebody
 * who has clicked Next nine times has read about it. The engine in
 * views/tour/Tour.tsx is generic - it walks whichever array it is given and
 * asks the predicate here whether the step is done - so the tour is data, and
 * changing what it teaches means editing this file and nothing else.
 *
 * Two arrays, one per platform, because a phone and a desktop are taught the
 * same things in different words ("tap" is not "click") and, when they
 * differ, through different controls.
 *
 * The instructional lines are under 120 words. A tour is read while the eye
 * is on the thing being pointed at, and every word past the first line is a
 * word between the person and the control. The test in tour.test.ts holds
 * the budget: a title is five words at most, a line fifteen.
 */

export type TourPlatform = 'desktop' | 'mobile'
export type TourView = 'day' | 'calendar' | 'templates' | 'library' | 'review' | 'north' | 'settings'

/**
 * What a step waits for. `start` and `finish` never resolve on their own -
 * they are the two ends of the tour and end on a button, which is the one
 * place a button is honest: there is nothing to do yet, or nothing left.
 */
export type TourEvent =
  | 'start'
  | 'stamped'
  | 'task-added'
  | 'key-marked'
  | 'focus-started'
  | 'task-done'
  | 'item-added'
  | 'goal-added'
  | 'finish'

/**
 * One thing a step can point at.
 *
 * A step lists several, in order, and the *last* one present on the page
 * wins - so a step that walks through a menu lists the button, then the menu
 * item, then the control it opens, and the spotlight follows the person in.
 * `{task}` in a selector becomes the id of the task the tour added.
 *
 * Each target may carry its own line. The step's own `text` is what the card
 * says while the first target is lit; a later target usually needs different
 * words ("Click Details" once the menu is open), and a box needs two: what to
 * type while it is empty, and "now press Enter" once something is in it.
 * The owner watched somebody type Walk and wait, because nothing had told
 * them the field wanted Enter - the card was still saying "type Walk".
 */
export interface TourTarget {
  selector: string
  /** Said instead of the step's line while this target is the one lit. */
  text?: string
  /** Said once the box this points at has something typed into it. */
  typed?: string
}

/**
 * What the card says once a step has ended, and where it looks while saying
 * it.
 *
 * Every real step has one now, because a step that ends with a tick and
 * moves on inside a second reads as the tour skipping by itself: the thing
 * happened somewhere else on the page, the eye was on the control, and the
 * card had already moved to the next instruction. So each step holds the
 * tick, names in one line what just happened and why it matters, and only
 * then goes on - by itself after a beat long enough to read the line, or on
 * Next for the three steps where what appeared deserves a proper look.
 *
 * `view` and `target` move the spotlight for the caption. The goal step is
 * written in the North window and lives under the day's title; without
 * the relocation the person is told it "never shows progress" while looking
 * at a form, and never sees where it went.
 *
 * Deliberately outside the 120-word instructional budget the titles and
 * lines share, and bounded separately - see tour.test.ts. A caption for
 * something that has already happened is read with the eye free, not while
 * hunting for a control.
 */
export interface TourOutcome {
  text: string
  /** Wait for Next rather than moving on after a beat. */
  wait?: boolean
  /** Switch the shell to this tab for the caption. */
  view?: TourView
  /** Point at this for the caption instead of the step's own targets. */
  target?: string
}

export interface TourStep {
  id: string
  /** Five words at most. */
  title: string
  /** Fifteen words at most. `{now}` becomes the current clock time. */
  text: string
  targets: TourTarget[]
  /** The tab the step lives on. The engine switches to it. */
  view: TourView
  event: TourEvent
  outcome?: TourOutcome
  /**
   * Said when none of the targets is on the page at all, beside the offer to
   * do the step or skip it. The engine never moves on by itself from here -
   * that used to happen after twelve seconds, and it was the "random
   * skipping" the owner reported. A step with a good reason to be absent
   * says the reason: Focus only exists on the card that is running this
   * minute, and between two blocks there is none.
   */
  absent?: string
}

/** What a predicate sees: the plan when the step began, the plan now, and the clock tools. */
export interface TourContext {
  before: AppData
  now: AppData
  today: string
  focusRunning: boolean
}

function tasksOn(data: AppData, today: string) {
  return data.days[today]?.tasks ?? []
}

function libraryItems(data: AppData) {
  return data.library.reduce((sum, list) => sum + list.items.length, 0)
}

/**
 * The two steps that name Walk end on Walk. Counting any key mark or any
 * tick was enough while nobody strayed; on the deliberately awkward walk a
 * tick on the card above ended the step and the caption said Walk had moved
 * into Done while Walk sat there unticked. When the tour has no task of its
 * own - a resumed tour after Keep stripped the flags - any task will do,
 * which is the old rule and still the honest one then.
 */
function tourTaskChanged(ctx: TourContext, what: (t: { highlight?: boolean; done?: boolean }) => boolean): boolean {
  const mine = tourTask(ctx.now, ctx.today)
  if (mine) {
    const was = tasksOn(ctx.before, ctx.today).find(t => t.id === mine.id)
    return what(mine) && !(was && what(was))
  }
  return tasksOn(ctx.now, ctx.today).filter(what).length > tasksOn(ctx.before, ctx.today).filter(what).length
}

export const TOUR_EVENTS: Record<TourEvent, (ctx: TourContext) => boolean> = {
  start: () => false,
  finish: () => false,
  stamped: ({ before, now, today }) => !!now.days[today]?.templateId && !before.days[today]?.templateId,
  'task-added': ({ before, now, today }) => tasksOn(now, today).length > tasksOn(before, today).length,
  'key-marked': ctx => tourTaskChanged(ctx, t => !!t.highlight),
  'focus-started': ({ focusRunning }) => focusRunning,
  'task-done': ctx => tourTaskChanged(ctx, t => !!t.done),
  // A list with something in it, not merely a list. Starting a Books list
  // used to end the step on its own, before the person had seen the field
  // that makes a list worth having - and the tick landed on an empty
  // heading.
  'item-added': ({ before, now }) => libraryItems(now) > libraryItems(before),
  'goal-added': ({ before, now }) => now.goals.length > before.goals.length,
}

/**
 * The order is deliberate and differs from the obvious one (add a task first).
 * The starter templates are only offered on a day with nothing on it, which
 * is exactly what a new person has, so stamping comes first - and it is also
 * the moment the app makes its case: one click and the day is a day.
 *
 * Focus is taught on whichever card is running, not on Walk. Quick-add opens
 * on the first *free* slot, and once a working day is stamped the current
 * minute is rarely free, so Walk lands an hour or two ahead and is not the
 * running card - the first version of this step pointed at a Focus button
 * that was not there, offered a way through, and then skipped itself.
 */
export const DESKTOP_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Two minutes, one real day',
    text: 'Each step ends when you do it. Skip whenever.',
    targets: [],
    view: 'day',
    event: 'start',
  },
  {
    id: 'stamp',
    title: 'Stamp a day',
    text: 'Click Use this template under Working day. Nine blocks, one click.',
    targets: [{ selector: '[data-tour="starter-working-day"]' }],
    view: 'day',
    event: 'stamped',
    outcome: { text: 'Your whole day, from one click. That is the timeline beside it.', wait: true },
  },
  {
    id: 'add',
    title: 'Add your own',
    text: 'Type Walk in the box. The time is already picked.',
    // The field, not the controls beside it: the whole point of the step is
    // that the two controls are already answered and nobody has to touch
    // them. Pointing at one would teach the opposite of what it says.
    targets: [{ selector: '[data-quick-add]', typed: 'Now press Enter.' }],
    view: 'day',
    event: 'task-added',
    outcome: { text: 'Walk is on the day, in the first free slot, sized already.' },
  },
  {
    id: 'key',
    title: 'Make it key',
    text: 'Click the dots on the Walk card.',
    targets: [
      { selector: '[data-task-id="{task}"] [data-tour="task-menu"]' },
      { selector: '[data-tour="task-details"]', text: 'Click Details.' },
      { selector: '[data-tour="key"]', text: 'Click Mark as key.' },
    ],
    view: 'day',
    event: 'key-marked',
    outcome: { text: 'Walk is key now. Three a day at most, and the calendar notes them.' },
  },
  {
    id: 'focus',
    title: 'Focus on one thing',
    text: 'Click Focus on the card running now. One ring, one way out.',
    targets: [{ selector: '[data-tour="focus"]' }],
    view: 'day',
    event: 'focus-started',
    absent: 'Nothing is running this minute, so there is no Focus button. Let the tour start it.',
    outcome: { text: 'That bar along the bottom is Focus. Leave it whenever you like.', wait: true },
  },
  {
    id: 'done',
    title: 'Tick it off',
    text: 'Click the checkbox on Walk.',
    targets: [{ selector: '[data-task-id="{task}"] [data-tour="task-check"]' }],
    view: 'day',
    event: 'task-done',
    outcome: { text: 'Walk moved into Done, and the score moved with it.' },
  },
  {
    id: 'library',
    title: 'Books and series',
    text: 'Click Start a Books list. Its sessions land on days.',
    // Three, and the last one present wins. The starter offers only exist
    // while the library is empty; somebody who already has a list gets New
    // list pointed at instead of an empty rectangle; and once any list is
    // there, its own field is the thing to point at, because the step ends
    // on something being put in it.
    targets: [
      { selector: '[data-tour="library-new"]', text: 'Click New list and call it Books.' },
      { selector: '[data-tour="library-starter"]' },
      { selector: '[data-tour="library-add"]', text: 'Type: Dune, 20 chapters', typed: 'Now press Enter.' },
    ],
    view: 'library',
    event: 'item-added',
    outcome: { text: 'A session can now land on any day. Ticking it off moves the book along.' },
  },
  {
    id: 'north',
    title: 'One direction',
    text: 'Type one line of who you are becoming.',
    // Four, and the last one present wins. The picture's line is the whole
    // of an empty North window; Keep it is disabled until a line is typed
    // and takes over the moment it is not, so the ring lands on the button
    // rather than the card landing on it. Once the picture is kept, the
    // goal offer appears under it; once that is pressed, Compose opens on a
    // blank goal and the step ends on Save. Somebody who already has a
    // picture starts at the offer, which is the same walk with one step
    // fewer.
    targets: [
      { selector: '[data-tour="picture-field"]', typed: 'Now click Keep it.' },
      { selector: '[data-tour="picture-keep"]', text: 'Now click Keep it.' },
      { selector: '[data-tour="goal-add"]', text: 'Click Write one down. A goal never shows progress, only why.' },
      { selector: '[data-tour="goal-save"]', text: 'Name it, then click Save.' },
    ],
    view: 'north',
    event: 'goal-added',
    outcome: {
      text: 'It sits under the day now. Press that line for North, never a bar.',
      view: 'day',
      target: '[data-tour="north-line"]',
      wait: true,
    },
  },
  {
    id: 'finish',
    title: "That's the app",
    text: 'Keep what you made, or start clean.',
    targets: [],
    view: 'day',
    event: 'finish',
  },
]

/**
 * The same nine steps in a phone's words. "Tap" for "click" everywhere,
 * and one caption of its own: below the wide breakpoint the timeline is
 * folded behind a button rather than drawn beside the list, so "that is the
 * timeline beside it" points at nothing a phone can see.
 */
export const MOBILE_STEPS: TourStep[] = DESKTOP_STEPS.map(step => {
  const tap = (s: string) => s.replace(/\bClick\b/g, 'Tap').replace(/\bclick\b/g, 'tap')
  const outcome =
    step.id === 'stamp'
      ? { ...step.outcome!, text: 'Your whole day, from one tap. Show timeline draws it out.' }
      : step.outcome && { ...step.outcome, text: tap(step.outcome.text) }
  return {
    ...step,
    text: tap(step.text),
    // Both lines a target can carry: what to do, and what to do once
    // something is typed. "Now click Keep it" on a phone is the same
    // mistake as "click" anywhere else.
    targets: step.targets.map(target => ({
      ...target,
      ...(target.text ? { text: tap(target.text) } : {}),
      ...(target.typed ? { typed: tap(target.typed) } : {}),
    })),
    outcome,
    absent: step.absent && tap(step.absent),
  }
})

export function stepsFor(platform: TourPlatform): TourStep[] {
  return platform === 'mobile' ? MOBILE_STEPS : DESKTOP_STEPS
}

/** `{now}` becomes the clock, so the task the tour asks for is the running one. */
export function resolveText(text: string, now: Date): string {
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  return text.replace('{now}', `${hh}:${mm}`)
}

/** The task the tour added by hand today - the newest flagged one that did not come from a template. */
export function tourTask(data: AppData, today: string) {
  const tasks = data.days[today]?.tasks ?? []
  return [...tasks].reverse().find(t => t.tourCreated && !t.fromTemplate)
}

export function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length
}

export function tourWordTotal(steps: TourStep[]): number {
  return steps.reduce((sum, s) => sum + wordCount(s.title) + wordCount(s.text), 0)
}

// --- what the tour made ------------------------------------------------------

/**
 * Flags whatever `next` holds that `previous` did not, so "Start clean" at
 * the end can remove exactly what the tour made and nothing else.
 *
 * Done by diffing in commit() while the tour runs, the same way sync
 * timestamps are, and for the same reason: the alternative is every action
 * the tour might touch remembering to flag its own output, which is a list
 * that is wrong the first time somebody adds a step.
 */
export function markTourCreated(previous: AppData, next: AppData): AppData {
  let changed = false
  const flag = <T extends { id: string; tourCreated?: boolean }>(items: T[], had: Set<string>): T[] =>
    items.map(item => {
      if (had.has(item.id) || item.tourCreated) return item
      changed = true
      return { ...item, tourCreated: true }
    })

  const days: Record<string, DayPlan> = {}
  for (const [date, day] of Object.entries(next.days)) {
    const had = new Set((previous.days[date]?.tasks ?? []).map(t => t.id))
    const tasks = flag(day.tasks, had)
    days[date] = tasks === day.tasks ? day : { ...day, tasks }
  }
  const templates = flag(next.templates, new Set(previous.templates.map(t => t.id)))
  const library = flag(next.library, new Set(previous.library.map(l => l.id)))
  const goals = flag(next.goals, new Set(previous.goals.map(g => g.id)))

  return changed ? { ...next, days, templates, library, goals } : next
}

/**
 * "Start clean": everything the tour made goes, everything else stays. A day
 * whose template was a tour template loses the reference too, so it does not
 * dangle - a dangling id degrades rather than crashes, but there is no reason
 * to leave one behind on purpose.
 */
export function discardTourCreated(data: AppData): AppData {
  const templates = data.templates.filter(t => !t.tourCreated)
  const gone = new Set(data.templates.filter(t => t.tourCreated).map(t => t.id))
  const days: Record<string, DayPlan> = {}
  for (const [date, day] of Object.entries(data.days)) {
    const tasks = day.tasks.filter(t => !t.tourCreated)
    const next: DayPlan = { ...day, tasks }
    if (next.templateId && gone.has(next.templateId)) delete next.templateId
    days[date] = next
  }
  return {
    ...data,
    days,
    templates,
    library: data.library.filter(l => !l.tourCreated),
    goals: data.goals.filter(g => !g.tourCreated),
  }
}

/** "Keep what I built": the flags come off, so nothing ever treats these differently again. */
export function keepTourCreated(data: AppData): AppData {
  const strip = <T extends { tourCreated?: boolean }>(item: T): T => {
    if (!item.tourCreated) return item
    const { tourCreated: _dropped, ...rest } = item
    return rest as T
  }
  const days: Record<string, DayPlan> = {}
  for (const [date, day] of Object.entries(data.days)) {
    days[date] = { ...day, tasks: day.tasks.map(strip) }
  }
  return {
    ...data,
    days,
    templates: data.templates.map(strip),
    library: data.library.map(strip),
    goals: data.goals.map(strip),
  }
}
