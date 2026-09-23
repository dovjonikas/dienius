import { afterEach, describe, expect, test, vi } from 'vitest'
import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The freeze's point 2: six things a plan can hold that no screen may fall
 * over - a store that cannot be read, a field nobody expected, an empty
 * template, a date without a kind, a roster without days, a recipe without
 * a name. Each is opened the way the app opens: written into this browser's
 * storage, and the app's modules loaded fresh, so the store and everything
 * else that reads a key on import reads it as it would on a real open. Then
 * every page is walked. On every one, no page says it could not be shown -
 * the boundaries of ScreenBoundary.tsx are the net, and none of these may
 * need it - and what the case is about is shown for what it is.
 */

const PAGES = ['Today', 'Calendar', 'Templates', 'Library', 'Review', 'North', 'Kitchen', 'Settings']
const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const addDays = (key: string, n: number) => {
  const [y, m, d] = key.split('-').map(Number)
  const next = new Date(y, m - 1, d + n)
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  localStorage.clear()
})

/** The app, opened on what this browser holds. */
async function openWith(stored: Record<string, string>) {
  localStorage.clear()
  for (const [key, value] of Object.entries(stored)) localStorage.setItem(key, value)
  vi.resetModules()
  // A page that did fail would say so on console.error too; the walk below
  // is what reports it.
  vi.spyOn(console, 'error').mockImplementation(() => {})
  const { App } = await import('./App')
  const view = render(<App />)
  await act(async () => {})
  return { user: userEvent.setup(), main: () => view.container.querySelector('main') as HTMLElement }
}

/** Every page, by the rail; the names of those that said they could not be shown. */
async function walk(opened: Awaited<ReturnType<typeof openWith>>): Promise<string[]> {
  const failed: string[] = []
  for (const page of PAGES) {
    await opened.user.click(within(screen.getByRole('navigation', { name: 'Views' })).getByRole('button', { name: page }))
    await act(async () => {})
    if (within(opened.main()).queryByRole('alert')) failed.push(page)
  }
  return failed
}

/** A plan as the app writes one, with `over` laid on it. */
function plan(over: Record<string, unknown> = {}): string {
  return JSON.stringify({
    templates: [],
    days: {},
    settings: { theme: { presetId: 'dark', overrides: {}, mode: 'dark' }, sleepProfiles: [{ id: 'default', name: 'Sleep schedule', window: { start: '23:00', end: '07:00' } }] },
    ...over,
  })
}

/** Every key the app keeps in this browser, read out of its own source so a new one is walked too. */
function keysInSource(): string[] {
  const keys = new Set<string>()
  const read = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name)
      if (statSync(full).isDirectory()) read(full)
      else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) {
        for (const m of readFileSync(full, 'utf8').matchAll(/'(dienius:[a-z][a-z-]*)'/g)) keys.add(m[1])
      }
    }
  }
  read(join(__dirname))
  return [...keys].sort()
}

describe('1. a store that cannot be read', () => {
  test.each([
    ['not JSON', '{"templates": [ a byte went wrong'],
    ['null', 'null'],
    ['a list', '[]'],
    ['a string', '"my plan"'],
    ['a plan the guard refuses', JSON.stringify({ templates: 'not a list', days: {}, settings: {} })],
  ])('the plan held as %s: the app opens without it, says so over every page, and every page draws', async (_what, stored) => {
    const opened = await openWith({ 'dienius:data': stored })
    expect(screen.getByText(/could not be read/)).toBeInTheDocument()
    expect(await walk(opened)).toEqual([])
    expect(JSON.parse(localStorage.getItem('dienius:unreadable') ?? '{}').text).toBe(stored)
  })

  test.each([
    ['not JSON', '{not json'],
    ['a string', '"text"'],
    ['a number', '42'],
    ['an object of the wrong shape', '{"weird":true}'],
    ['a list', '[]'],
    ['null', 'null'],
  ])('every other key the app keeps, holding %s: every page still draws', async (_what, garbage) => {
    const keys = keysInSource().filter(key => key !== 'dienius:data' && key !== 'dienius:demo' && key !== 'dienius:tour')
    expect(keys.length).toBeGreaterThan(20)
    const opened = await openWith(Object.fromEntries([['dienius:data', plan()], ...keys.map(key => [key, garbage])]))
    expect(await walk(opened)).toEqual([])
  })
})

describe('2. a field nobody expected', () => {
  test('on every kind of thing in the plan: every page draws, and the field rides along through a save', async () => {
    const unknown = { fromAFutureVersion: { still: 'here' } }
    const date = today()
    const opened = await openWith({
      'dienius:data': plan({
        ...unknown,
        settings: { theme: { presetId: 'dark', overrides: {}, mode: 'dark' }, ...unknown },
        templates: [{ id: 'work', name: 'Working day', color: '#a7c4f5', ...unknown, blocks: [{ id: 'b1', title: 'Deep work', time: '09:00', minutes: 90, ...unknown }] }],
        days: { [date]: { date, ...unknown, tasks: [{ id: 't1', title: 'Water the plants', done: false, ...unknown }] } },
        recipes: [{ id: 'r1', title: 'Lentil soup', text: 'Lentils.', ...unknown }],
        library: [{ id: 'l1', name: 'Books', unit: 'page', ...unknown, items: [{ id: 'i1', title: 'A book', ...unknown }] }],
        categories: [{ id: 'core', label: 'Core', ...unknown }],
        routines: [{ id: 'rt1', title: 'Stretch', minutes: 20, weekdays: [1, 2, 3], times: {}, ...unknown }],
        backlog: [{ id: 'lt1', title: 'Fix the shelf', ...unknown }],
        scratch: [{ id: 'n1', text: 'A note', createdAt: '2026-09-01T10:00:00.000Z', date, ...unknown }],
      }),
    })
    expect(await walk(opened)).toEqual([])

    await opened.user.click(within(screen.getByRole('navigation', { name: 'Views' })).getByRole('button', { name: 'Today' }))
    await opened.user.click(screen.getByRole('checkbox', { name: 'Water the plants' }))
    const saved = JSON.parse(localStorage.getItem('dienius:data') ?? '{}')
    expect(saved.fromAFutureVersion).toEqual(unknown.fromAFutureVersion)
    expect(saved.settings.fromAFutureVersion).toEqual(unknown.fromAFutureVersion)
    expect(saved.templates[0].fromAFutureVersion).toEqual(unknown.fromAFutureVersion)
    expect(saved.templates[0].blocks[0].fromAFutureVersion).toEqual(unknown.fromAFutureVersion)
    expect(saved.days[date].tasks[0]).toMatchObject({ done: true, ...unknown })
    expect(saved.recipes[0].fromAFutureVersion).toEqual(unknown.fromAFutureVersion)
  })
})

describe('3. an empty template', () => {
  test('a template with no name and no blocks, a week of none and a kind of none: every page draws, and each opens in the editor', async () => {
    const date = today()
    const opened = await openWith({
      'dienius:data': plan({
        templates: [
          { id: 'empty', name: '', color: '#8a8f98', blocks: [] },
          { id: 'empty-week', name: '', color: '#8a8f98', kind: 'week', blocks: [] },
          { id: 'empty-kind', name: '', color: '#8a8f98', blocks: [], dayKind: { letter: 'E', order: 0 } },
        ],
        days: { [date]: { date, templateId: 'empty', tasks: [] }, [addDays(date, 1)]: { date: addDays(date, 1), templateId: 'empty-kind', tasks: [] } },
      }),
    })
    expect(await walk(opened)).toEqual([])

    await opened.user.click(within(screen.getByRole('navigation', { name: 'Views' })).getByRole('button', { name: 'Templates' }))
    // A name is the person's to give, so the plan keeps it empty; on the
    // screen it is called what it is, never a blank row.
    const edits = screen.getAllByRole('button', { name: 'Edit Untitled template' })
    expect(edits).toHaveLength(3)
    for (let i = 0; i < edits.length; i++) {
      await opened.user.click(screen.getAllByRole('button', { name: 'Edit Untitled template' })[i])
      expect(within(opened.main()).queryByRole('alert')).not.toBeInTheDocument()
      await opened.user.click(within(screen.getByRole('navigation', { name: 'Views' })).getByRole('button', { name: 'Templates' }))
    }
  })
})

describe('4. a date without a kind', () => {
  test('dates stamped by no kind, by a template that is gone, and by a type alone: every page and the roster draw', async () => {
    const date = today()
    const opened = await openWith({
      'dienius:data': plan({
        templates: [
          { id: 'day', name: 'Day shift', color: '#a7c4f5', blocks: [{ id: 'b1', title: 'On shift', time: '07:00', minutes: 600 }], dayKind: { letter: 'D', order: 0 } },
          { id: 'plain', name: 'Working day', color: '#a7e3bd', blocks: [] },
        ],
        days: {
          [date]: { date, templateId: 'plain', tasks: [] },
          [addDays(date, 1)]: { date: addDays(date, 1), templateId: 'gone', tasks: [{ id: 't1', title: 'Left by a template that is gone', done: false, fromTemplate: true, origin: { type: 'template', sourceId: 'gone', blockId: 'x' } }] },
          [addDays(date, 2)]: { date: addDays(date, 2), dayType: 'night', tasks: [] },
          [addDays(date, 3)]: { date: addDays(date, 3), templateId: 'day', tasks: [] },
        },
      }),
    })
    expect(await walk(opened)).toEqual([])

    await opened.user.click(within(screen.getByRole('navigation', { name: 'Views' })).getByRole('button', { name: 'Calendar' }))
    await opened.user.click(screen.getByRole('button', { name: 'Roster' }))
    expect(within(opened.main()).queryByRole('alert')).not.toBeInTheDocument()

    await opened.user.click(within(screen.getByRole('navigation', { name: 'Views' })).getByRole('button', { name: 'Today' }))
    for (let i = 0; i < 4; i++) {
      await opened.user.keyboard('{ArrowRight}')
      expect(within(opened.main()).queryByRole('alert')).not.toBeInTheDocument()
    }
  })
})

describe('5. a roster without days', () => {
  const kinds = [
    { id: 'day', name: 'Day shift', color: '#a7c4f5', blocks: [], dayKind: { letter: 'D', order: 0 } },
    { id: 'night', name: 'Night shift', color: '#44507a', type: 'night', blocks: [], dayKind: { letter: 'N', order: 1 } },
  ]

  test('a draft of no dates and a cycle of no kinds on this device: the roster and its cycle draw', async () => {
    const opened = await openWith({
      'dienius:data': plan({ templates: kinds }),
      'dienius:roster-draft': JSON.stringify({ dates: {} }),
      'dienius:roster-cycle': JSON.stringify({ kinds: [], from: today() }),
    })
    expect(await walk(opened)).toEqual([])
    await opened.user.click(within(screen.getByRole('navigation', { name: 'Views' })).getByRole('button', { name: 'Calendar' }))
    await opened.user.click(screen.getByRole('button', { name: 'Roster' }))
    await opened.user.click(screen.getByRole('button', { name: 'Cycle' }))
    expect(within(opened.main()).queryByRole('alert')).not.toBeInTheDocument()
  })

  test.each([
    ['an empty roster', '{}'],
    ['a roster that is null', 'null'],
    ['a roster that is a list', '[]'],
  ])('a templates file with %s: read, previewed and applied, and every page draws after', async (_what, roster) => {
    const opened = await openWith({ 'dienius:data': plan({ templates: kinds }) })
    await opened.user.click(within(screen.getByRole('navigation', { name: 'Views' })).getByRole('button', { name: 'Settings' }))
    const file = `{"templates": [{"name": "Rest day", "kind": "R", "blocks": []}], "roster": ${roster}}`
    await opened.user.click(screen.getByRole('textbox', { name: 'Templates and roster as JSON' }))
    await opened.user.paste(file)
    await opened.user.click(screen.getByRole('button', { name: 'Preview' }))
    const apply = screen.getByRole('button', { name: 'Apply' })
    expect(apply).toBeEnabled()
    await opened.user.click(apply)
    expect(screen.getByText(/^Applied./)).toBeInTheDocument()
    expect(within(opened.main()).queryByRole('alert')).not.toBeInTheDocument()
    expect(await walk(opened)).toEqual([])
  })
})

describe('6. a recipe without a name', () => {
  test('recipes named nothing and named only spaces, on a meal block and on the day: every page draws, and each opens', async () => {
    const date = today()
    const opened = await openWith({
      'dienius:data': plan({
        recipes: [
          { id: 'nameless', title: '', text: '' },
          { id: 'spaces', title: '   ', text: 'Beans, rice.', mealTypes: ['dinner'] },
        ],
        templates: [{ id: 'meals', name: 'Meals', color: '#b07a4f', blocks: [{ id: 'm1', title: 'Dinner', time: '19:00', minutes: 30, category: 'meal', recipeId: 'nameless', recipeIds: ['nameless', 'spaces'], mealType: 'dinner' }] }],
        days: { [date]: { date, templateId: 'meals', tasks: [{ id: 't1', title: 'Dinner', done: false, time: '19:00', minutes: 30, category: 'meal', recipeId: 'nameless', mealType: 'dinner' }] } },
      }),
    })
    expect(await walk(opened)).toEqual([])

    // On the day: the meal names its recipe for what it is.
    await opened.user.click(within(screen.getByRole('navigation', { name: 'Views' })).getByRole('button', { name: 'Today' }))
    expect(within(opened.main()).getByText('Untitled recipe')).toBeInTheDocument()

    // In Kitchen: a row to read and to press, which opens.
    await opened.user.click(within(screen.getByRole('navigation', { name: 'Views' })).getByRole('button', { name: 'Kitchen' }))
    const rows = within(opened.main()).getAllByRole('button', { name: 'Untitled recipe' })
    expect(rows).toHaveLength(2)
    await opened.user.click(rows[0])
    expect(within(opened.main()).getByRole('heading', { name: 'Untitled recipe' })).toBeInTheDocument()
    expect(within(opened.main()).queryByRole('alert')).not.toBeInTheDocument()

    await opened.user.click(within(screen.getByRole('navigation', { name: 'Views' })).getByRole('button', { name: 'Templates' }))
    await opened.user.click(screen.getByRole('button', { name: /^Edit Meals/ }))
    expect(within(opened.main()).queryByRole('alert')).not.toBeInTheDocument()
  })
})
