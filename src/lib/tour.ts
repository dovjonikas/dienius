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
 * The whole thing is under 120 words. A tour is read while the eye is on the
 * thing being pointed at, and every word past the first line is a word
 * between the person and the control. The test in tour.test.ts holds the
 * budget: a title is five words at most, a line fifteen.
 */

export type TourPlatform = 'desktop' | 'mobile'
export type TourView = 'day' | 'calendar' | 'templates' | 'library' | 'review' | 'settings'

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
  | 'list-added'
  | 'goal-added'
  | 'finish'

export interface TourStep {
  id: string
  /** Five words at most. */
  title: string
  /** Fifteen words at most. `{now}` becomes the current clock time. */
  text: string
  /**
   * Selectors for the thing to point at, in order. The *last* one present on
   * the page wins, so a step that walks through a menu can list the button,
   * then the menu item, then the control it opens, and the spotlight follows
   * the person in. `{task}` becomes the id of the task the tour added.
   */
  targets: string[]
  /** The tab the step lives on. The engine switches to it. */
  view: TourView
  event: TourEvent
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

export const TOUR_EVENTS: Record<TourEvent, (ctx: TourContext) => boolean> = {
  start: () => false,
  finish: () => false,
  stamped: ({ before, now, today }) => !!now.days[today]?.templateId && !before.days[today]?.templateId,
  'task-added': ({ before, now, today }) => tasksOn(now, today).length > tasksOn(before, today).length,
  'key-marked': ({ before, now, today }) =>
    tasksOn(now, today).filter(t => t.highlight).length > tasksOn(before, today).filter(t => t.highlight).length,
  'focus-started': ({ focusRunning }) => focusRunning,
  'task-done': ({ before, now, today }) =>
    tasksOn(now, today).filter(t => t.done).length > tasksOn(before, today).filter(t => t.done).length,
  'list-added': ({ before, now }) => now.library.length > before.library.length,
  'goal-added': ({ before, now }) => now.goals.length > before.goals.length,
}

/**
 * The order is deliberate and differs from the obvious one (add a task first).
 * The starter templates are only offered on a day with nothing on it, which
 * is exactly what a new person has, so stamping comes first - and it is also
 * the moment the app makes its case: one click and the day is a day. The
 * task added afterwards is placed at the current minute so that it is the
 * running task, because Focus only ever offers itself on the running card.
 */
export const DESKTOP_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Two minutes, one real day',
    text: 'Each step ends when you do it. Skip any time.',
    targets: [],
    view: 'day',
    event: 'start',
  },
  {
    id: 'stamp',
    title: 'Stamp a day',
    text: 'Click Working day. Eight blocks, one click.',
    targets: ['[data-tour="starter-working-day"]'],
    view: 'day',
    event: 'stamped',
  },
  {
    id: 'add',
    title: 'Add your own',
    text: 'Type {now} Walk 30 min, then Enter.',
    targets: ['[data-quick-add]'],
    view: 'day',
    event: 'task-added',
  },
  {
    id: 'key',
    title: 'Make it key',
    text: "Open Walk's details and mark it key.",
    targets: ['[data-task-id="{task}"] [data-tour="task-menu"]', '[data-tour="task-details"]', '[data-tour="key"]'],
    view: 'day',
    event: 'key-marked',
  },
  {
    id: 'focus',
    title: 'Focus on one thing',
    text: 'Start Focus on Walk. One ring, one way out.',
    targets: ['[data-task-id="{task}"] [data-tour="focus"]'],
    view: 'day',
    event: 'focus-started',
  },
  {
    id: 'done',
    title: 'Tick it off',
    text: 'Check Walk. Done folds away, the score moves.',
    targets: ['[data-task-id="{task}"] [data-tour="task-check"]'],
    view: 'day',
    event: 'task-done',
  },
  {
    id: 'library',
    title: 'Books, courses, series',
    text: 'Start a Books list. Sessions land on days later.',
    targets: ['[data-tour="library-starter"]'],
    view: 'library',
    event: 'list-added',
  },
  {
    id: 'north',
    title: 'One direction',
    text: 'Write one goal. It never shows progress, only why.',
    targets: ['[data-tour="goal-add"]', '[data-tour="goal-save"]'],
    view: 'settings',
    event: 'goal-added',
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

/** The same nine steps in a phone's words. */
export const MOBILE_STEPS: TourStep[] = DESKTOP_STEPS.map(step => {
  switch (step.id) {
    case 'stamp':
      return { ...step, text: 'Tap Working day. Eight blocks, one tap.' }
    case 'key':
      return { ...step, text: "Tap the dots, open Details, mark it key." }
    case 'focus':
      return { ...step, text: 'Tap Focus on Walk. One ring, one way out.' }
    case 'done':
      return { ...step, text: 'Tick Walk. Done folds away, the score moves.' }
    case 'library':
      return { ...step, text: 'Tap Start a Books list. Sessions land on days.' }
    default:
      return step
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
