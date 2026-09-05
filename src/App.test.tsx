import { beforeEach, expect, test } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from './App'
import { actions, getData } from './lib/store'
import { defaultData } from './lib/storage'
import { todayKey } from './lib/dates'
import { PRESETS } from './lib/themes'
 import { getTourState, resetTourForTests, startTour } from './lib/tourState'
import { resetReplanForTests } from './lib/replanState'

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
  resetTourForTests()
  resetReplanForTests()
})

test('renders brand and nav tabs', () => {
  render(<App />)
  expect(screen.getByText('Dienius')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Today' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Calendar' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Templates' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument()
})

// Light and dark are themes now rather than modes within a theme, so picking
// one is picking a card in the gallery - see themes.ts. Same assertion as
// before at the level that matters: a choice in Settings resolves all the way
// through to the live token block on :root.
test('picking a theme in settings paints its whole token block', async () => {
  const user = userEvent.setup()
  render(<App />)
  await user.click(screen.getByRole('button', { name: 'Settings' }))
  await user.click(screen.getByRole('button', { name: /Light/ }))
  expect(document.documentElement.dataset.theme).toBe('light')
  expect(document.documentElement.style.getPropertyValue('--bg')).toBe('#f6f5f2')
})

test('matching the system resolves against the live OS preference, and turning it off pins the chosen theme', async () => {
  const user = userEvent.setup()
  render(<App />)
  // A fresh install already matches the system. jsdom has no real matchMedia,
  // so systemPrefersDark() falls back to false the same way it does for a
  // person whose browser lacks it - and with every theme single-mode,
  // following a light system means resolving to the Light theme rather than
  // to a light variant of the chosen one.
  expect(document.documentElement.dataset.theme).toBe('light')
  expect(document.documentElement.style.getPropertyValue('--bg')).toBe('#f6f5f2')

  await user.click(screen.getByRole('button', { name: 'Settings' }))
  await user.click(screen.getByRole('switch', { name: 'Match system appearance' }))

  // Off pins whatever theme is actually chosen - Dark, on a fresh install.
  expect(document.documentElement.dataset.theme).toBe('dark')
  expect(document.documentElement.style.getPropertyValue('--bg')).toBe('#121417')
})

test('the day tab renders widgets through the registry, driven by enabledWidgets', () => {
  const data = defaultData()
  data.settings.enabledWidgets = []
  actions.resetForTests(data)
  render(<App />)
  expect(screen.queryByPlaceholderText(/add a task/i)).not.toBeInTheDocument()
})

// --- .main-day - docs/LAYOUT-WIDE.md section 5, build step 1. Only the
// Today tab's <main> may escape .app's own max-width at the wide
// breakpoint; every other tab's wrapper is untouched by this document.

test('the Today tab wraps its content in a main carrying main-day', () => {
  const { container } = render(<App />)
  expect(container.querySelector('main.main-day')).toBeInTheDocument()
})

test('every other tab keeps a plain main with no main-day class', async () => {
  const user = userEvent.setup()
  const { container } = render(<App />)
  for (const tab of ['Calendar', 'Templates', 'Settings']) {
    await user.click(screen.getByRole('button', { name: tab }))
    const main = container.querySelector('main')
    expect(main).not.toBeNull()
    expect(main?.className).toBe('')
  }
})

// --- stress test: every theme preset, with two years of stamped data loaded

// Genuinely heavy, not artificially slow: the year strip renders roughly
// 700 cells, and this re-renders it through every one of 11 presets and
// their modes in turn. Comfortably under 2s on its own, but full-suite runs
// have every test file's own worker rendering at once - the same
// contention that already pushed two other YearStrip-adjacent tests over
// the default 5s timeout (see CalendarView.test.tsx's own comment on the
// same class of test). An explicit timeout here is the honest fix: the
// work itself is real and worth doing, not something to trim down just to
// fit inside a budget meant for ordinary tests.
test('every theme preset and mode applies cleanly on the year view with roughly two years of stamped days loaded, with no crash', async () => {
  const user = userEvent.setup({ delay: null })
  const work = actions.addTemplate({ name: 'Work', color: '#8ab6f9', blocks: [] })
  const rest = actions.addTemplate({ name: 'Rest', color: '#cde39e', blocks: [] })
  const stamps: Record<string, string> = {}
  let d = new Date(2024, 0, 1)
  for (let i = 0; i < 700; i++) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    stamps[key] = i % 2 === 0 ? work.id : rest.id
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
  }
  actions.stamp(stamps)

  render(<App />)
  await user.click(screen.getByRole('button', { name: 'Calendar' }))
  await user.click(screen.getByRole('button', { name: 'Year' }))

  for (const preset of PRESETS) {
    act(() => actions.setThemePreset(preset.id))
    for (const mode of preset.modes) {
      act(() => actions.setTheme(mode))
      // Every preset must actually resolve to a real, non-empty background
      // token - a preset missing its own mode would otherwise silently
      // paint the page with an empty custom property value.
      expect(document.documentElement.style.getPropertyValue('--bg')).not.toBe('')
    }
  }
}, 15000)

// --- ways into the tour ------------------------------------------------------
//
// The tour had exactly one door: an offer on a day with nothing on it, which
// is a screen somebody sees once. Anyone who dismissed it, or who arrived
// after their first day was already planned, could not find it again -
// Settings replays it in a sandbox, which is a different thing and is filed
// under General. Both of these are where a person goes when they are already
// looking for help, which is exactly when a two-minute walkthrough is a help
// rather than an interruption.

test('the shortcut card offers the tour, and taking it starts one', async () => {
  const user = userEvent.setup()
  render(<App />)
  await user.keyboard('?')
  expect(screen.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Take the tour' }))
  expect(getTourState().active).toBe(true)
  // The card gets out of the way: a spotlight behind a modal points at
  // nothing anybody can reach.
  expect(screen.queryByRole('dialog', { name: 'Keyboard shortcuts' })).toBeNull()
})

test('the command palette can start the tour', async () => {
  const user = userEvent.setup()
  render(<App />)
  await user.keyboard('{Control>}k{/Control}')
  await user.click(screen.getByRole('option', { name: /Take the tour/ }))
  expect(getTourState().active).toBe(true)
})

/**
 * The reading plan used to arrive by itself on first open, which meant it
 * arrived for anybody who opened the live demo - a stranger handed the
 * owner's actual bookshelf. It is a command now, and nothing else puts it
 * in. The first test is the one that matters: an ordinary open writes no
 * library at all.
 */
test('opening the app never puts the reading plan in on its own', () => {
  render(<App />)
  expect(getData().library).toEqual([])
})

test('the palette command loads the reading plan and opens the library on it', async () => {
  const user = userEvent.setup()
  render(<App />)
  await user.keyboard('{Control>}k{/Control}')
  await user.click(screen.getByRole('option', { name: /Load my reading plan/ }))
  // Three lanes since v2.0, each advancing on its own - see librarySeed.ts.
  expect(getData().library.map(l => l.name)).toEqual(['MIND', 'CRAFT', 'LIGHT'])
  expect(getData().library.map(l => l.items.length)).toEqual([10, 5, 6])
  expect(screen.getByRole('heading', { name: 'Library' })).toBeInTheDocument()
})

/**
 * Found on the deliberately awkward walk-through. The actions menu closed
 * itself on Escape and let the key carry on to the shell, which closed the
 * loudest thing it knew about - the tour. One press, two things gone, and
 * the person who had just been told to click Details was back on an
 * ordinary day with no idea why.
 */
test('Escape with the actions menu open closes the menu and leaves the tour running', async () => {
  const user = userEvent.setup()
  actions.addTask(todayKey(), 'Walk', '12:00')
  render(<App />)
  act(() => startTour('desktop', 3))
  await user.click(screen.getByRole('button', { name: 'More actions for Walk' }))
  expect(screen.getByRole('dialog', { name: /Walk/ })).toBeInTheDocument()
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('dialog', { name: /Walk/ })).toBeNull()
  expect(getTourState().active).toBe(true)
  await user.keyboard('{Escape}')
  expect(getTourState().active).toBe(false)
})

/**
 * Escape is the last link in the chain App already walks - the palette, then
 * the shortcut card, then Focus, then the clock - so anything sitting over
 * the tour closes first and a second press leaves the tour. It keeps what was
 * built, because leaving is not undoing.
 */
test('Escape leaves a running tour, after everything sitting over it', async () => {
  const user = userEvent.setup()
  render(<App />)
  act(() => startTour('desktop', 2))
  await user.keyboard('{Control>}k{/Control}')
  await user.keyboard('{Escape}')
  expect(getTourState().active).toBe(true)
  await user.keyboard('{Escape}')
  expect(getTourState().active).toBe(false)
})

// --- a visible way into Scratch, on both platforms - CONVENTIONS section 17

/**
 * Answers the wide-breakpoint query one way and every other query (the
 * system theme, the pointer) the other, so the shell mounts the chrome of
 * one platform. jsdom has no real matchMedia; restored after each test.
 */
function pretendViewport(wide: boolean): () => void {
  const original = window.matchMedia
  window.matchMedia = ((query: string) => ({
    matches: query.includes('min-width') ? wide : false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
  return () => {
    window.matchMedia = original
  }
}

/**
 * Scratch used to have two different ways in, one per platform: a pen in the
 * header on a desktop and a draggable floating button on a phone. The rail
 * replaced both with one pen in the same place on both, which is what
 * CONVENTIONS section 17 was asking for all along - it only ever needed two
 * because there was nowhere a control could live on both platforms.
 *
 * These two tests replace "the header carries a pen" and "on a phone the
 * floating button is the way in", which asserted exactly the split that is
 * gone.
 */
test('the rail carries a pen on both platforms, and says which key does the same', async () => {
  for (const wide of [true, false]) {
    const restore = pretendViewport(wide)
    try {
      const { unmount } = render(<App />)
      const pen = screen.getByRole('button', { name: 'Scratch' })
      expect(pen, String(wide)).toHaveAttribute('title', 'Scratch - S')
      expect(screen.queryByRole('button', { name: 'Scratch: write something down' })).toBeNull()

      await userEvent.click(pen)
      expect(screen.getByRole('dialog', { name: 'Scratch' })).toBeInTheDocument()
      unmount()
    } finally {
      restore()
    }
  }
})

test('the rail names every view and the key that also reaches it', () => {
  const restore = pretendViewport(true)
  try {
    render(<App />)
    const nav = screen.getByRole('navigation', { name: 'Views' })
    expect(within(nav).getByRole('button', { name: 'Today' })).toHaveAttribute('title', 'Today - 1')
    expect(within(nav).getByRole('button', { name: 'North' })).toHaveAttribute('title', 'North - 6')
    expect(within(nav).getByRole('button', { name: 'Settings' })).toHaveAttribute('title', 'Settings - comma')
    expect(within(nav).getByRole('button', { name: 'Today' })).toHaveAttribute('aria-current', 'page')
  } finally {
    restore()
  }
})

// --- something came up, from anywhere ----------------------------------------

/**
 * The replan sheet is mounted at the root and opened by a request, so the
 * palette, the R key, the week and the calendar all reach the same one
 * without leaving the screen they are on. The phone rings about Thursday
 * while the week is what is on screen; the week should still be there when
 * the sheet closes.
 */
test('the palette opens Something came up over the screen that is showing, and leaves it there', async () => {
  const user = userEvent.setup()
  render(<App />)
  await user.click(within(screen.getByRole('navigation', { name: 'Views' })).getByRole('button', { name: 'Calendar' }))
  expect(screen.getByRole('group', { name: 'Calendar view' })).toBeInTheDocument()

  await user.keyboard('{Control>}k{/Control}')
  await user.click(screen.getByRole('option', { name: /Something came up/ }))
  const sheet = screen.getByRole('dialog', { name: 'Replan' })
  expect(within(sheet).getByRole('heading', { name: 'Something came up' })).toBeInTheDocument()
  expect(within(sheet).getByRole('button', { name: 'Today' })).toHaveAttribute('aria-pressed', 'true')
  // The calendar is still underneath.
  expect(screen.getByRole('group', { name: 'Calendar view' })).toBeInTheDocument()

  await user.keyboard('{Escape}')
  expect(screen.queryByRole('dialog', { name: 'Replan' })).toBeNull()
  expect(screen.getByRole('group', { name: 'Calendar view' })).toBeInTheDocument()
})

test('R opens it, on the day being looked at when that day is still ahead', async () => {
  const user = userEvent.setup()
  render(<App />)
  await user.keyboard('{ArrowRight}')
  await user.keyboard('r')
  const sheet = screen.getByRole('dialog', { name: 'Replan' })
  expect(within(sheet).getByRole('button', { name: 'Tomorrow' })).toHaveAttribute('aria-pressed', 'true')
})

test('a later day\'s header opens the sheet on that day', async () => {
  const user = userEvent.setup()
  render(<App />)
  await user.keyboard('{ArrowRight}')
  await user.click(screen.getByRole('button', { name: 'Something came up' }))
  const sheet = screen.getByRole('dialog', { name: 'Replan' })
  expect(within(sheet).getByRole('button', { name: 'Tomorrow' })).toHaveAttribute('aria-pressed', 'true')
})

test('the week\'s bar has the door too, on the day the week is centred on', async () => {
  const user = userEvent.setup()
  render(<App />)
  await user.click(within(screen.getByRole('navigation', { name: 'Views' })).getByRole('button', { name: 'Calendar' }))
  await user.click(within(screen.getByRole('group', { name: 'Calendar view' })).getByRole('button', { name: 'Week' }))
  await user.click(screen.getByRole('button', { name: 'Something came up' }))
  const sheet = screen.getByRole('dialog', { name: 'Replan' })
  expect(within(sheet).getByRole('button', { name: 'Today' })).toHaveAttribute('aria-pressed', 'true')
})
