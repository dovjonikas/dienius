import { beforeEach, expect, test } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from './App'
import { actions, getData } from './lib/store'
import { clockTools } from './lib/clockTools'
import { defaultData } from './lib/storage'
import { todayKey } from './lib/dates'
import { PRESETS } from './lib/themes'
import { WIDGETS } from './widgets/registry'
import { SHORTCUTS } from './lib/shortcuts'
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

// The registry is the seam a second day-view widget would slot into, and
// the day tab renders whatever is in it. It held a stored list of ids until
// v2.5 - see REMOVED_SETTINGS in storage.ts for why a list nothing could
// change is not a setting.
test('the day tab renders every widget in the registry', () => {
  actions.resetForTests(defaultData())
  render(<App />)
  expect(WIDGETS).toHaveLength(1)
  expect(screen.getByPlaceholderText(/add a task/i)).toBeInTheDocument()
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

// Genuinely heavy, not artificially slow: two years of stamped days ending
// today sit in the store, so the month on screen is a full one, and the
// month grid - every cell of it resolving a template and a stat - is
// re-rendered through every one of 11 presets and their modes in turn. Comfortably under 2s on its own, but full-suite runs have every test
// file's own worker rendering at once - the same contention that has pushed
// other render-heavy tests over the default 5s timeout (see
// CalendarView.test.tsx's own comment on the same class of test). An
// explicit timeout here is the honest fix: the work itself is real and worth
// doing, not something to trim down just to fit inside a budget meant for
// ordinary tests. It ran on the year view until v2.7 took that view out; the
// month is now the heaviest calendar there is.
test('every theme preset and mode applies cleanly on the month view with roughly two years of stamped days loaded, with no crash', async () => {
  const user = userEvent.setup({ delay: null })
  const work = actions.addTemplate({ name: 'Work', color: '#8ab6f9', blocks: [] })
  const rest = actions.addTemplate({ name: 'Rest', color: '#cde39e', blocks: [] })
  const stamps: Record<string, string> = {}
  // Seven hundred days that end today, not two fixed years from 2024: the
  // grid App opens on is this month's, and a fixture that ends the year
  // before last would leave every cell on screen empty.
  const start = new Date()
  start.setDate(start.getDate() - 699)
  let d = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  for (let i = 0; i < 700; i++) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    stamps[key] = i % 2 === 0 ? work.id : rest.id
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
  }
  actions.stamp(stamps)

  render(<App />)
  await user.click(screen.getByRole('button', { name: 'Calendar' }))
  await user.click(screen.getByRole('button', { name: 'Month' }))

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
  const card = screen.getByRole('dialog', { name: 'Keyboard shortcuts' })
  // Scoped to the card: Settings offers the same words on its own row, and
  // both doors saying the same thing is the point - CONVENTIONS section 1.
  await user.click(within(card).getByRole('button', { name: 'Take the tour' }))
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

/**
 * The same one press, one layer rule as the actions menu above, on the small
 * panels that were still letting Escape through to the shell. Notes stands
 * for the group - the header popovers, the gap picker, the gap offers, the
 * time picker and the size box all run the one branch this checks.
 */
test('Escape closes a header popover and leaves the tour running underneath it', async () => {
  const user = userEvent.setup()
  render(<App />)
  act(() => startTour('desktop', 2))
  await user.click(screen.getByRole('button', { name: 'Notes' }))
  expect(screen.getByRole('dialog', { name: 'Notes' })).toBeInTheDocument()
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('dialog', { name: 'Notes' })).toBeNull()
  expect(getTourState().active).toBe(true)
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
 * Notes has had three homes and this is the argument each move settled.
 *
 * A pen in the header on a desktop and a draggable floating button on a
 * phone: two ways in for one feature, because there was nowhere a control
 * could live on both. Then one pen in the rail, on both - which is what
 * CONVENTIONS section 17 was asking for all along. Then a tab of the clock
 * panel, for the shortest path from a thought to a line.
 *
 * Now a button of its own in the header, on both, beside the journal. The
 * clock tab was short and mislabelled: a note is not a clock, and finding
 * the box meant reading four labels to see which one was not about time.
 * The rail was honest but filed a thing that is not a view among the six
 * that are.
 *
 * What has not changed through any of it: one visible way in, the same on
 * every platform, and the key said out loud beside it.
 */
test('the way into notes is one button in the header, the same on both platforms', async () => {
  for (const wide of [true, false]) {
    const restore = pretendViewport(wide)
    try {
      const { unmount } = render(<App />)
      const notes = screen.getByRole('button', { name: 'Notes' })
      expect(notes, String(wide)).toBeInTheDocument()
      // And no leftover from either of the two homes before it.
      expect(screen.queryByRole('button', { name: 'Scratch' })).toBeNull()
      expect(screen.queryByRole('button', { name: 'Scratch: write something down' })).toBeNull()

      await userEvent.click(notes)
      expect(screen.getByRole('dialog', { name: 'Notes' })).toBeInTheDocument()
      unmount()
    } finally {
      restore()
    }
  }
})

/**
 * The header's two tools, held to the same rule the rail is held to.
 *
 * CONVENTIONS 17: the visible control is where a shortcut is learned. The
 * rail has named its keys on its icons since v2.0; these two never did, so Q
 * and J lived in the "?" card and nowhere a hand would meet them. The names
 * are read out of SHORTCUTS, and this is what stops the two drifting.
 */
test('the header tools name the keys that also reach them', () => {
  render(<App />)
  const notes = screen.getByRole('button', { name: 'Notes' })
  const journal = screen.getByRole('button', { name: 'Journal' })

  const q = SHORTCUTS.find(s => s.key === 'q')
  const j = SHORTCUTS.find(s => s.key === 'j')
  expect(q, 'Q is still the key for a quick note').toBeDefined()
  expect(j, 'J is still the key for the journal').toBeDefined()

  expect(notes).toHaveAttribute('data-tip', `Notes · ${q!.label}`)
  expect(journal).toHaveAttribute('data-tip', `Journal · ${j!.label}`)
})

test('the rail names every view and the key that also reaches it', () => {
  const restore = pretendViewport(true)
  try {
    render(<App />)
    const nav = screen.getByRole('navigation', { name: 'Views' })
    expect(within(nav).getByRole('button', { name: 'Today' })).toHaveAttribute('data-tip', 'Today · 1')
    expect(within(nav).getByRole('button', { name: 'North' })).toHaveAttribute('data-tip', 'North · 6')
    expect(within(nav).getByRole('button', { name: 'Settings' })).toHaveAttribute('data-tip', 'Settings · comma')
    expect(within(nav).getByRole('button', { name: 'Today' })).toHaveAttribute('aria-current', 'page')
  } finally {
    restore()
  }
})

/**
 * The tooltip above promises the button's behaviour, and the button opens
 * today. The key used to switch to the day tab and leave whichever day was
 * on screen there, so "Today · 1" was a lie for anybody who had arrowed a
 * week ahead and pressed 1 to get back.
 */
test("pressing 1 opens today, as the rail's button does", async () => {
  const user = userEvent.setup()
  render(<App />)
  await user.keyboard('{ArrowRight}')
  expect(screen.queryByRole('heading', { name: 'Today', level: 2 })).toBeNull()
  await user.keyboard('1')
  expect(screen.getByRole('heading', { name: 'Today', level: 2 })).toBeInTheDocument()
})

/**
 * Focus is a thing happening now. The key read the day being looked at, so F
 * from next Tuesday started a session on that day pointing at a task id from
 * today - a session FocusBar then ended by itself, having found nothing
 * behind it. The Focus button on screen only ever exists on today's running
 * card, and the key now does what the button does.
 */
test("F starts Focus on today's running task, whatever day is being looked at", async () => {
  const user = userEvent.setup()
  clockTools.resetForTests()
  // Five minutes ago, an hour long, so the clock is inside it whenever this
  // runs. Clamped at midnight rather than reaching back into yesterday.
  const now = new Date()
  const start = Math.max(0, now.getHours() * 60 + now.getMinutes() - 5)
  const time = `${String(Math.floor(start / 60)).padStart(2, '0')}:${String(start % 60).padStart(2, '0')}`
  const data = defaultData()
  data.days[todayKey()] = {
    date: todayKey(),
    tasks: [{ id: 'sitting', title: 'Sit with the book', time, minutes: 60, done: false }],
  }
  actions.resetForTests(data)

  render(<App />)
  await user.keyboard('{ArrowRight}')
  expect(screen.queryByRole('heading', { name: 'Today', level: 2 })).toBeNull()

  await user.keyboard('f')
  expect(screen.getByRole('region', { name: 'Focus' })).toHaveTextContent('Sit with the book')
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

// --- three doors in the header, not one with four rooms ------------------

/**
 * Notes and the journal were the third and fourth tabs of the clock panel
 * when they were built, on the reasoning that the clock button is the one
 * control on screen from every tab. The reasoning held; the shape did not.
 *
 * A timer and a stopwatch are the same kind of thing at different moments,
 * which is what tabs are for. A note and a journal entry are not that, and
 * neither is either of them a clock - so reaching a line you want to write
 * meant pressing a picture of a clock and then reading four labels to find
 * the one that was not about time. The owner asked for them separately and
 * they are separate: three buttons, each opening the one thing it names.
 *
 * The rail lost its pen with the change. It was there because Scratch had
 * no visible way in on a desktop; it has one now, in the header, next to
 * the journal it is most often confused with - which is also the clearest
 * place to see that they are two different boxes.
 */
test('the header carries a button each for notes, the journal and the clock', () => {
  render(<App />)
  expect(screen.getByRole('button', { name: 'Notes' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Journal' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Timer and stopwatch' })).toBeInTheDocument()
})

test('the clock panel is a timer and a stopwatch, and says nothing about notes', async () => {
  const user = userEvent.setup()
  render(<App />)
  await user.click(screen.getByRole('button', { name: 'Timer and stopwatch' }))

  const tools = within(screen.getByRole('dialog'))
  expect(tools.getByRole('button', { name: 'Timer' })).toBeInTheDocument()
  expect(tools.getByRole('button', { name: 'Stopwatch' })).toBeInTheDocument()
  expect(tools.queryByRole('button', { name: 'Notes' })).toBeNull()
  expect(tools.queryByRole('button', { name: 'Journal' })).toBeNull()
})

test('the notes button opens the one-line note, and the journal button the day', async () => {
  const user = userEvent.setup()
  render(<App />)

  await user.click(screen.getByRole('button', { name: 'Notes' }))
  expect(screen.getByRole('textbox', { name: 'A quick note' })).toBeInTheDocument()
  await user.keyboard('{Escape}')

  await user.click(screen.getByRole('button', { name: 'Journal' }))
  expect(screen.getByRole('textbox', { name: /^Journal for / })).toBeInTheDocument()
})

test('the rail no longer carries a pen, because the header does', () => {
  render(<App />)
  const rail = screen.getByRole('navigation', { name: 'Views' })
  expect(within(rail).queryByRole('button', { name: /Scratch/ })).toBeNull()
})
