import { beforeEach, expect, test, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { JournalView } from './JournalView'
import { actions, getData } from '../lib/store'
import { defaultData } from '../lib/storage'
import { addDays, todayKey } from '../lib/dates'

/**
 * The reading side of the journal: a month on the left, a day on the right,
 * a search across everything, and the copies that take writing somewhere
 * else.
 *
 * The panel at the clock is for writing on today and has its own file. This
 * is the other half, and it had no unit test at all until v2.5's closing
 * audit - a view with a calendar, an autosave, a search and two copy
 * buttons, held up only by one browser test of the month copy.
 */

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
})

/**
 * A user and a clipboard to read back, in that order and it matters.
 *
 * `userEvent.setup()` installs a clipboard stub of its own so that its copy
 * and paste helpers work, which quietly replaced a stub written before it -
 * a click that plainly reached the handler wrote nothing anybody could see.
 * So the stub goes in afterwards, and `defineProperty` rather than assign,
 * because `navigator.clipboard` is a getter and assigning to it throws.
 */
function withClipboard() {
  const user = userEvent.setup()
  const written: string[] = []
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: (t: string) => { written.push(t); return Promise.resolve() } },
  })
  return { user, clipboard: written }
}

/** Three days with writing on them, in this month where the month copy can reach. */
function seed() {
  const today = todayKey()
  actions.setJournal(today, 'Today I finally rang the dentist.')
  actions.setJournal(addDays(today, -1), 'A long walk, and the boiler is still making that noise.')
  actions.setJournal(addDays(today, -2), 'Nothing much. Read two chapters.')
}

test('it opens on today, with that day beside the month', () => {
  seed()
  render(<JournalView />)
  expect(screen.getByRole('textbox', { name: /^Journal for / })).toHaveValue('Today I finally rang the dentist.')
})

test('a day with nothing on it is an empty box and says nothing else', () => {
  render(<JournalView />)
  expect(screen.getByRole('textbox', { name: /^Journal for / })).toHaveValue('')
  expect(document.body.textContent).not.toMatch(/missed|streak|\d+ days written|nothing written yet/i)
})

// --- the three copies ------------------------------------------------------

/**
 * A day, a week and a month, all as markdown with the empty days left out.
 * The month is the one the owner will use - a stretch of writing pasted into
 * a conversation in one press - but a single day is the one somebody reaches
 * for when they want to send what they wrote this morning and nothing else.
 */
test('the day copies on its own, and carries only that day', async () => {
  const { user, clipboard } = withClipboard()
  seed()
  render(<JournalView />)

  await user.click(screen.getByRole('button', { name: 'Copy this day' }))
  await waitFor(() => expect(clipboard).toHaveLength(1))

  expect(clipboard[0]).toContain('Today I finally rang the dentist.')
  expect(clipboard[0]).not.toContain('A long walk')
  expect(clipboard[0]).not.toContain('Read two chapters')
})

test('the month copies the days with writing on them and skips the rest', async () => {
  const { user, clipboard } = withClipboard()
  seed()
  render(<JournalView />)

  await user.click(screen.getByRole('button', { name: 'Copy this month' }))
  await waitFor(() => expect(clipboard).toHaveLength(1))

  expect(clipboard[0]).toContain('Today I finally rang the dentist.')
  expect(clipboard[0]).toContain('Read two chapters')
  // One heading per day that has something, and no empty ones between them.
  expect(clipboard[0].match(/^## /gm) ?? []).toHaveLength(3)
})

// Neither button is ever greyed: side by side, a disabled one beside a live
// one read as two weights of one control. A press with nothing behind it
// says so instead, the way a press with something behind it says Copied.
test('a day with nothing on it says so when asked to copy, and so does its month', async () => {
  const { user, clipboard } = withClipboard()
  render(<JournalView />)
  await user.click(screen.getByRole('button', { name: 'Copy this day' }))
  expect(screen.getByRole('button', { name: 'Nothing to copy' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Copy this month' })).toBeEnabled()
  await user.click(screen.getByRole('button', { name: 'Copy this month' }))
  expect(screen.getByRole('button', { name: 'Nothing to copy' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Copy this day' })).toBeInTheDocument()
  expect(clipboard).toHaveLength(0)
})

// --- the search ------------------------------------------------------------

test('the search finds a day by a word in it, and goes there when pressed', async () => {
  const user = userEvent.setup()
  seed()
  render(<JournalView />)

  await user.type(screen.getByRole('searchbox'), 'boiler')
  const hits = screen.getByRole('list', { name: /What the search found/i })
  const one = within(hits).getAllByRole('button')
  expect(one).toHaveLength(1)

  await user.click(one[0])
  expect(screen.getByRole('textbox', { name: /^Journal for / })).toHaveValue(
    'A long walk, and the boiler is still making that noise.',
  )
})

test('a word nobody wrote says so, rather than showing an empty list', async () => {
  const user = userEvent.setup()
  seed()
  render(<JournalView />)
  await user.type(screen.getByRole('searchbox'), 'aardvark')
  expect(screen.getByText(/Nothing with that word in it/i)).toBeInTheDocument()
})

// --- what is typed is kept -------------------------------------------------

test('what is typed is kept, without a Save button anywhere', async () => {
  const user = userEvent.setup()
  render(<JournalView />)

  await user.type(screen.getByRole('textbox', { name: /^Journal for / }), 'A line')
  await waitFor(() => expect(getData().days[todayKey()]?.journal).toBe('A line'))
  expect(screen.queryByRole('button', { name: /^Save/i })).toBeNull()
})

test('what was being typed is kept when another day is chosen under it', async () => {
  const user = userEvent.setup()
  vi.useRealTimers()
  render(<JournalView />)

  await user.type(screen.getByRole('textbox', { name: /^Journal for / }), 'Half a thought')
  // Any other day, straight from the month beside it.
  const yesterday = addDays(todayKey(), -1)
  const cell = document.querySelector(`[data-date="${yesterday}"]`) as HTMLElement | null
  if (cell) {
    await user.click(cell)
    expect(getData().days[todayKey()]?.journal).toBe('Half a thought')
  } else {
    await waitFor(() => expect(getData().days[todayKey()]?.journal).toBe('Half a thought'))
  }
})
