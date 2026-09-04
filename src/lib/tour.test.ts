import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { expect, test } from 'vitest'
import {
  DESKTOP_STEPS,
  MOBILE_STEPS,
  TOUR_EVENTS,
  discardTourCreated,
  keepTourCreated,
  markTourCreated,
  resolveText,
  tourTask,
  tourWordTotal,
  wordCount,
  type TourContext,
} from './tour'
import { defaultData } from './storage'
import type { AppData, Task } from './types'

const TODAY = '2026-09-03'

function task(id: string, patch: Partial<Task> = {}): Task {
  return { id, title: id, done: false, ...patch }
}

function withTasks(tasks: Task[], base = defaultData()): AppData {
  return { ...base, days: { ...base.days, [TODAY]: { date: TODAY, tasks } } }
}

function ctx(before: AppData, now: AppData, focusRunning = false): TourContext {
  return { before, now, today: TODAY, focusRunning }
}

// --- the budget -------------------------------------------------------------
//
// A tour is read while the eye is on the thing being pointed at. Every word
// past the first line is a word between the person and the control, so the
// budget is a contract, not a guideline: under 120 words in total, five in a
// title, fifteen in a line. Both platforms, because a phone gets its own copy.

for (const [name, steps] of [['desktop', DESKTOP_STEPS], ['mobile', MOBILE_STEPS]] as const) {
  test(`the ${name} tour is under 120 words in total`, () => {
    expect(tourWordTotal(steps)).toBeLessThan(120)
  })

  test(`every ${name} title is five words or fewer, every line fifteen or fewer`, () => {
    for (const step of steps) {
      expect(wordCount(step.title), step.id).toBeLessThanOrEqual(5)
      expect(wordCount(step.text), step.id).toBeLessThanOrEqual(15)
    }
  })

  test(`the ${name} tour is nine steps, starting with a welcome and ending with a choice`, () => {
    expect(steps).toHaveLength(9)
    expect(steps[0].event).toBe('start')
    expect(steps[steps.length - 1].event).toBe('finish')
  })

  test(`no ${name} step in the middle ends on a button - each waits for something real`, () => {
    for (const step of steps.slice(1, -1)) {
      expect(step.event, step.id).not.toBe('start')
      expect(step.event, step.id).not.toBe('finish')
      expect(step.targets.length, step.id).toBeGreaterThan(0)
    }
  })

  test(`nothing in the ${name} tour uses a dash that is not a hyphen`, () => {
    for (const step of steps) {
      const lines = [step.title, step.text, step.absent ?? '', step.outcome?.text ?? '', ...step.targets.flatMap(t => [t.text ?? '', t.typed ?? ''])]
      expect(lines.join(' '), step.id).not.toMatch(/[–—]/)
    }
  })

  /**
   * The lines a target carries are read at the moment the person reaches
   * that target - after the menu opened, once the box has something in it -
   * so they are instructions and are held to the same fifteen words as the
   * step's own line. The typed variant is the shortest thing on the card by
   * design: "Now press Enter." is the whole of what somebody with a word in
   * the box needs to hear.
   */
  test(`every ${name} target line is fifteen words or fewer, and a typed line is five`, () => {
    for (const step of steps) {
      for (const target of step.targets) {
        if (target.text) expect(wordCount(target.text), `${step.id} ${target.selector}`).toBeLessThanOrEqual(15)
        if (target.typed) expect(wordCount(target.typed), `${step.id} ${target.selector}`).toBeLessThanOrEqual(5)
      }
    }
  })
}

/**
 * Every line a phone reads, not only the instruction: the caption after the
 * stamp said "from one click" on a phone through one whole walk before
 * anybody noticed, because only `text` was being rewritten.
 */
/** Below the wide breakpoint the timeline is behind a button, not beside the list. */
test('the phone caption after stamping does not claim a timeline beside the list', () => {
  const stamp = MOBILE_STEPS.find(s => s.id === 'stamp')!
  expect(stamp.outcome!.text).not.toMatch(/beside/)
  expect(stamp.outcome!.text).toMatch(/Show timeline/)
  expect(DESKTOP_STEPS.find(s => s.id === 'stamp')!.outcome!.text).toMatch(/beside/)
})

test('nothing the phone tour says talks about clicking', () => {
  for (const step of MOBILE_STEPS) {
    const lines = [step.text, step.absent ?? '', step.outcome?.text ?? '', ...step.targets.flatMap(t => [t.text ?? '', t.typed ?? ''])]
    expect(lines.join(' '), step.id).not.toMatch(/click/i)
  }
})

test('the two ends never resolve by themselves', () => {
  const data = defaultData()
  expect(TOUR_EVENTS.start(ctx(data, data))).toBe(false)
  expect(TOUR_EVENTS.finish(ctx(data, data))).toBe(false)
})

// --- what ends a step ---------------------------------------------------------

test('stamping ends the stamp step, and only a stamp that happened during it', () => {
  const empty = defaultData()
  const stamped = { ...empty, days: { [TODAY]: { date: TODAY, tasks: [], templateId: 'work' } } }
  expect(TOUR_EVENTS.stamped(ctx(empty, stamped))).toBe(true)
  // A day that already had a template when the step began is not the tour's doing.
  expect(TOUR_EVENTS.stamped(ctx(stamped, stamped))).toBe(false)
})

test('a task added today ends the add step; one added yesterday does not', () => {
  const before = withTasks([task('a')])
  expect(TOUR_EVENTS['task-added'](ctx(before, withTasks([task('a'), task('b')])))).toBe(true)
  const elsewhere = { ...before, days: { ...before.days, '2026-09-02': { date: '2026-09-02', tasks: [task('z')] } } }
  expect(TOUR_EVENTS['task-added'](ctx(before, elsewhere))).toBe(false)
})

test('marking a task key, ticking one off, starting focus, adding a list, adding a goal', () => {
  const before = withTasks([task('a')])
  expect(TOUR_EVENTS['key-marked'](ctx(before, withTasks([task('a', { highlight: true })])))).toBe(true)
  expect(TOUR_EVENTS['task-done'](ctx(before, withTasks([task('a', { done: true })])))).toBe(true)
  expect(TOUR_EVENTS['focus-started'](ctx(before, before, true))).toBe(true)
  expect(TOUR_EVENTS['focus-started'](ctx(before, before, false))).toBe(false)
  // A list on its own does not end the library step - the tick used to land
  // on an empty heading. Something has to be in it.
  const list = { ...before, library: [{ id: 'l', name: 'Books', unit: 'chapter', items: [] }] }
  expect(TOUR_EVENTS['item-added'](ctx(before, list))).toBe(false)
  const book = { ...before, library: [{ id: 'l', name: 'Books', unit: 'chapter', items: [{ id: 'd', title: 'Dune', total: 20 }] }] }
  expect(TOUR_EVENTS['item-added'](ctx(before, book))).toBe(true)
  const goal = { ...before, goals: [{ id: 'g', title: 'Be strong', createdAt: TODAY }] }
  expect(TOUR_EVENTS['goal-added'](ctx(before, goal))).toBe(true)
})

/**
 * Found on the awkward walk: a stray tick on the card above Walk ended the
 * tick-off step, and the caption said Walk had moved into Done while Walk
 * sat there unticked. The two steps that name Walk end on Walk.
 */
test('ticking or key-marking some other task does not end a step that names Walk', () => {
  const before = withTasks([task('other'), task('walk', { tourCreated: true })])
  const otherDone = withTasks([task('other', { done: true }), task('walk', { tourCreated: true })])
  const walkDone = withTasks([task('other'), task('walk', { tourCreated: true, done: true })])
  expect(TOUR_EVENTS['task-done'](ctx(before, otherDone))).toBe(false)
  expect(TOUR_EVENTS['task-done'](ctx(before, walkDone))).toBe(true)
  const otherKey = withTasks([task('other', { highlight: true }), task('walk', { tourCreated: true })])
  const walkKey = withTasks([task('other'), task('walk', { tourCreated: true, highlight: true })])
  expect(TOUR_EVENTS['key-marked'](ctx(before, otherKey))).toBe(false)
  expect(TOUR_EVENTS['key-marked'](ctx(before, walkKey))).toBe(true)
  // Already done when the step began: not the step's doing.
  expect(TOUR_EVENTS['task-done'](ctx(walkDone, walkDone))).toBe(false)
})

test('the clock is written into the add step so the task it asks for is the running one', () => {
  expect(resolveText('Type {now} Lunch 30 min, then Enter.', new Date(2026, 8, 3, 9, 5))).toBe(
    'Type 09:05 Lunch 30 min, then Enter.',
  )
})

test('the tour task is the newest hand-made one it flagged, never a template block', () => {
  const data = withTasks([
    task('block', { tourCreated: true, fromTemplate: true }),
    task('lunch', { tourCreated: true }),
    task('mine'),
  ])
  expect(tourTask(data, TODAY)?.id).toBe('lunch')
})

// --- what the tour made ------------------------------------------------------
//
// "Start clean" has to remove exactly what the tour made and nothing else, on
// a plan that may already hold a year of somebody's days. The flag is written
// by diffing in commit(), so the test is of the diff.

test('whatever appears while the tour runs is flagged; what was already there is not', () => {
  const before = withTasks([task('old')])
  before.templates.push({ id: 't-old', name: 'Old', color: '#fff', blocks: [] })
  const after = withTasks([task('old'), task('new')], before)
  after.templates = [...before.templates, { id: 't-new', name: 'New', color: '#fff', blocks: [] }]
  after.library = [{ id: 'l', name: 'Books', unit: 'chapter', items: [] }]
  after.goals = [{ id: 'g', title: 'Be strong', createdAt: TODAY }]

  const marked = markTourCreated(before, after)
  const tasks = marked.days[TODAY].tasks
  expect(tasks.find(t => t.id === 'old')?.tourCreated).toBeUndefined()
  expect(tasks.find(t => t.id === 'new')?.tourCreated).toBe(true)
  expect(marked.templates.find(t => t.id === 't-old')?.tourCreated).toBeUndefined()
  expect(marked.templates.find(t => t.id === 't-new')?.tourCreated).toBe(true)
  expect(marked.library[0].tourCreated).toBe(true)
  expect(marked.goals[0].tourCreated).toBe(true)
})

test('a commit that adds nothing new comes back as the same object', () => {
  const data = withTasks([task('a')])
  const same = withTasks([task('a', { done: true })], data)
  expect(markTourCreated(data, same)).toBe(same)
})

test('Start clean removes the flagged entities and the day reference to a flagged template, nothing else', () => {
  const data = withTasks([task('old'), task('new', { tourCreated: true })])
  data.templates = [
    { id: 't-old', name: 'Old', color: '#fff', blocks: [] },
    { id: 't-new', name: 'New', color: '#fff', blocks: [], tourCreated: true },
  ]
  data.days[TODAY].templateId = 't-new'
  data.days['2026-09-01'] = { date: '2026-09-01', tasks: [task('kept')], templateId: 't-old' }
  data.library = [{ id: 'l', name: 'Books', unit: 'chapter', items: [], tourCreated: true }]
  data.goals = [
    { id: 'g-old', title: 'Old', createdAt: TODAY },
    { id: 'g-new', title: 'New', createdAt: TODAY, tourCreated: true },
  ]

  const clean = discardTourCreated(data)
  expect(clean.days[TODAY].tasks.map(t => t.id)).toEqual(['old'])
  expect(clean.days[TODAY].templateId).toBeUndefined()
  expect(clean.days['2026-09-01'].tasks.map(t => t.id)).toEqual(['kept'])
  expect(clean.days['2026-09-01'].templateId).toBe('t-old')
  expect(clean.templates.map(t => t.id)).toEqual(['t-old'])
  expect(clean.library).toEqual([])
  expect(clean.goals.map(g => g.id)).toEqual(['g-old'])
})

test('Keep what I built strips the flags and leaves everything in place', () => {
  const data = withTasks([task('new', { tourCreated: true })])
  data.templates = [{ id: 't', name: 'New', color: '#fff', blocks: [], tourCreated: true }]
  data.goals = [{ id: 'g', title: 'New', createdAt: TODAY, tourCreated: true }]
  const kept = keepTourCreated(data)
  expect(kept.days[TODAY].tasks[0]).toEqual(task('new'))
  expect(kept.templates[0].tourCreated).toBeUndefined()
  expect(kept.goals[0].tourCreated).toBeUndefined()
  expect(kept.goals).toHaveLength(1)
})

// --- the targets are real ----------------------------------------------------
//
// CONVENTIONS.md section 13: the tour points at real controls with real
// selectors, which makes it the one thing here that goes stale silently. A
// rename compiles, renders, and points at nothing. This is the mechanical
// half of that check - every name a step asks for exists in the source. The
// other half, that the control is actually on screen in the state the step
// reaches it in, only a browser can answer.

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(full)
    return /\.tsx?$/.test(entry.name) && !entry.name.includes('.test.') ? [full] : []
  })
}

test('every data-tour name a step points at exists in the source', () => {
  const source = sourceFiles(resolve(process.cwd(), 'src'))
    .map(file => readFileSync(file, 'utf-8'))
    .join('\n')
  const asked = new Set<string>()
  for (const step of [...DESKTOP_STEPS, ...MOBILE_STEPS]) {
    const selectors = [...step.targets.map(t => t.selector), step.outcome?.target ?? '']
    for (const selector of selectors) {
      for (const match of selector.matchAll(/data-tour="([^"]+)"/g)) asked.add(match[1])
    }
  }
  const missing = [...asked].filter(name => !source.includes(`data-tour="${name}"`))
  expect(missing).toEqual([])
})

/**
 * The library step is the one whose control disappears with use: the starter
 * offers are only rendered while the library is empty. It carries a fallback,
 * and the engine takes the last target present on the page - so the field of
 * an existing list, which is where the step actually ends, comes last.
 */
test('the library step falls back to New list, and ends on the field of whatever list is there', () => {
  const step = DESKTOP_STEPS.find(s => s.id === 'library')!
  const selectors = step.targets.map(t => t.selector)
  expect(selectors.indexOf('[data-tour="library-new"]')).toBeLessThan(selectors.indexOf('[data-tour="library-starter"]'))
  expect(selectors.at(-1)).toBe('[data-tour="library-add"]')
  expect(step.targets.at(-1)?.typed).toBe('Now press Enter.')
})

/**
 * The two-state box. The owner watched somebody type Walk and wait, because
 * the card was still saying "type Walk" and nothing had told them the field
 * wanted Enter. Every box the tour asks somebody to type into carries the
 * second line.
 */
test('every box the tour points at says what to do once something is typed', () => {
  for (const step of DESKTOP_STEPS) {
    for (const target of step.targets) {
      if (target.selector.includes('quick-add') || target.selector.includes('library-add')) {
        expect(target.typed, `${step.id} ${target.selector}`).toBe('Now press Enter.')
      }
    }
  }
})

/**
 * Focus is taught on whichever card is running, and between two blocks there
 * is none. The step says why the button is missing rather than sitting at an
 * empty spotlight - and rather than skipping itself, which is what the first
 * version did after twelve seconds.
 */
test('the focus step points at the running card and explains its own absence', () => {
  const step = DESKTOP_STEPS.find(s => s.id === 'focus')!
  expect(step.targets.map(t => t.selector)).toEqual(['[data-tour="focus"]'])
  expect(step.absent).toMatch(/running/)
})

/** The goal is written in Settings and lives under the day's title; the caption goes there to show it. */
test('the north step relocates its caption to the day, onto the North line', () => {
  const step = DESKTOP_STEPS.find(s => s.id === 'north')!
  expect(step.outcome).toMatchObject({ view: 'day', target: '[data-tour="north-line"]', wait: true })
})

/**
 * The outcome lines - what the card says after each step, once the thing has
 * happened. They sit outside the 120-word instructional budget on purpose: a
 * caption for something that has already happened is read with the eye
 * free, not while somebody is hunting for a control. That exemption is only
 * honest while each one stays a line, which is what this bounds.
 *
 * Every real step has one. Two used to, and the other five ended on a tick
 * and a jump that read, to the person watching the control rather than the
 * card, as the tour skipping by itself. Three wait for Next - the day
 * filling, the focus bar appearing, the goal landing under the title - and
 * the rest hold the line for a beat and go on.
 */
for (const [name, steps] of [['desktop', DESKTOP_STEPS], ['mobile', MOBILE_STEPS]] as const) {
  test(`every real ${name} step names its outcome in fifteen words or fewer`, () => {
    for (const step of steps.slice(1, -1)) {
      expect(step.outcome, step.id).toBeDefined()
      expect(wordCount(step.outcome!.text), step.id).toBeLessThanOrEqual(15)
    }
    expect(steps.filter(s => s.outcome?.wait).map(s => s.id)).toEqual(['stamp', 'focus', 'north'])
  })

  test(`every ${name} step that waits for something real names a concrete thing to press`, () => {
    // The three-second test: somebody seeing this app for the first time has
    // to know what to do without reading twice. That means naming the control
    // - "the blue Working day card", "the dots on the Walk card" - rather
    // than describing the idea behind it. Mechanically: an instruction on a
    // step with a target starts with a verb somebody can act on.
    for (const step of steps.slice(1, -1)) {
      expect(step.text, step.id).toMatch(/^(Click|Tap|Type|Tick|Start|Write|Open|Check|Drag)\b/)
    }
  })
}
