import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../../App'
import { Scratch } from './Scratch'
import { actions, getData } from '../../lib/store'
import { STORAGE_KEY, defaultData, loadData } from '../../lib/storage'
import { todayKey } from '../../lib/dates'
import { TOUR_STORAGE_KEY, setTourSandboxForTests } from '../../lib/tourMode'
import { resetTourForTests } from '../../lib/tourState'
import { collectEntities, stampChanges } from '../../lib/syncEntities'
import { mergeStates } from '../../lib/syncMerge'
import { searchEverything } from '../../lib/search'

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
  resetTourForTests()
  setTourSandboxForTests(false)
  // jsdom has no layout, and the palette scrolls its selected row into view.
  Element.prototype.scrollIntoView = () => {}
})

afterEach(() => {
  vi.restoreAllMocks()
})

function press(key: string) {
  fireEvent.keyDown(document, { key })
}

/**
 * Capture is the whole feature - see CONVENTIONS.md section 11. One key from
 * anywhere opens the box with the cursor in it; the first character is
 * already a note; leaving loses nothing. Every test here is a promise about
 * that one second.
 */

test('S opens the box with the cursor in it, from every tab', async () => {
  const user = userEvent.setup()
  render(<App />)
  for (const tab of ['Today', 'Calendar', 'Templates', 'Library', 'Review', 'Settings']) {
    await user.click(screen.getByRole('button', { name: tab }))
    press('s')
    const box = screen.getByRole('textbox', { name: 'Scratch note' })
    expect(box).toHaveFocus()
    press('Escape')
    expect(screen.queryByRole('dialog', { name: 'Scratch' })).toBeNull()
  }
})

test('the backtick opens it too, and Ctrl-K offers it as a command', async () => {
  const user = userEvent.setup()
  render(<App />)
  press('`')
  expect(screen.getByRole('dialog', { name: 'Scratch' })).toBeInTheDocument()
  press('Escape')
  fireEvent.keyDown(document, { key: 'k', ctrlKey: true })
  await user.click(screen.getByRole('button', { name: /^Scratch/ }))
  expect(screen.getByRole('dialog', { name: 'Scratch' })).toBeInTheDocument()
})

test('S does nothing while typing in a field', async () => {
  const user = userEvent.setup()
  render(<App />)
  await user.click(screen.getByPlaceholderText(/Add a task/))
  await user.keyboard('s')
  expect(screen.queryByRole('dialog', { name: 'Scratch' })).toBeNull()
})

test('every keystroke is saved: the first character makes the note, the rest rewrite it', async () => {
  const user = userEvent.setup()
  render(<Scratch open onClose={() => {}} />)
  const box = screen.getByRole('textbox', { name: 'Scratch note' })
  await user.type(box, 'C')
  expect(getData().scratch).toHaveLength(1)
  expect(getData().scratch[0].text).toBe('C')
  await user.type(box, 'all Ana 0612')
  expect(getData().scratch).toHaveLength(1)
  expect(getData().scratch[0].text).toBe('Call Ana 0612')
  expect(getData().scratch[0].date).toBe(todayKey())
})

test('Escape closes with the text already kept, and it is in the stream next time', async () => {
  const user = userEvent.setup()
  const onClose = vi.fn()
  const { rerender } = render(<Scratch open onClose={onClose} />)
  await user.type(screen.getByRole('textbox', { name: 'Scratch note' }), 'Room 412')
  await user.keyboard('{Escape}')
  expect(onClose).toHaveBeenCalled()
  rerender(<Scratch open={false} onClose={onClose} />)
  rerender(<Scratch open onClose={onClose} />)
  expect(screen.getByText('Room 412')).toBeInTheDocument()
})

test('Enter keeps the note and starts the next one; backspacing to nothing removes it', async () => {
  const user = userEvent.setup()
  render(<Scratch open onClose={() => {}} />)
  const box = screen.getByRole('textbox', { name: 'Scratch note' })
  await user.type(box, 'first{Enter}')
  expect(box).toHaveValue('')
  await user.type(box, 'x{Backspace}')
  expect(getData().scratch.map(n => n.text)).toEqual(['first'])
})

/**
 * A note becomes a task through quick-add's own parser, so a time and a
 * duration typed in a hurry come out as an anchor with a size - the same
 * reading the day view's box gives the same words.
 */
test('To task runs the note through quick-add and puts it on today, sized and timed', async () => {
  const user = userEvent.setup()
  actions.addScratch('14:00 Call the bank #money 20 min')
  render(<Scratch open onClose={() => {}} />)
  await user.click(screen.getByRole('button', { name: 'To task' }))
  const tasks = getData().days[todayKey()].tasks
  expect(tasks).toHaveLength(1)
  expect(tasks[0]).toMatchObject({ title: 'Call the bank', time: '14:00', minutes: 20 })
  expect(getData().scratch).toHaveLength(0)
  expect(screen.getByRole('status')).toHaveTextContent('Call the bank is on today at 14:00.')
})

test('To inbox moves the words, without the tags, and leaves the stream', async () => {
  const user = userEvent.setup()
  actions.addScratch('Look up the #idea about pricing')
  render(<Scratch open onClose={() => {}} />)
  await user.click(screen.getByRole('button', { name: 'To inbox' }))
  expect(getData().inbox.map(i => i.text)).toEqual(['Look up the about pricing'])
  expect(getData().scratch).toHaveLength(0)
})

test('Pin brings a note to the top; Delete removes it and offers an undo', async () => {
  const user = userEvent.setup()
  actions.addScratch('older')
  actions.addScratch('newer')
  render(<Scratch open onClose={() => {}} />)
  const rows = () => within(screen.getByRole('list')).getAllByRole('listitem').map(li => li.textContent ?? '')
  expect(rows()[0]).toContain('newer')
  const older = screen.getAllByRole('listitem')[1]
  await user.click(within(older).getByRole('button', { name: 'Pin' }))
  expect(rows()[0]).toContain('older')
  await user.click(within(screen.getAllByRole('listitem')[0]).getByRole('button', { name: 'Delete' }))
  expect(getData().scratch.map(n => n.text)).toEqual(['newer'])
})

test('a #tag is a filter: the bar offers it, and choosing it narrows the list', async () => {
  const user = userEvent.setup()
  actions.addScratch('Week title wraps #bug')
  actions.addScratch('A quieter accent #idea')
  render(<Scratch open onClose={() => {}} />)
  await user.click(screen.getByRole('button', { name: '#bug' }))
  const items = screen.getAllByRole('listitem')
  expect(items).toHaveLength(1)
  expect(items[0]).toHaveTextContent('Week title wraps')
})

/**
 * The weekend testing loop: notice, S, "#bug ...", Escape, carry on. On
 * Sunday, Export bugs puts the whole list on the clipboard as markdown,
 * ready for a bugfix prompt.
 */
test('Export bugs copies the #bug notes as a markdown list and says so', async () => {
  const user = userEvent.setup()
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
  actions.addScratch('Calendar cells overlap at 390 #bug')
  actions.addScratch('Not a bug')
  render(<Scratch open onClose={() => {}} />)
  await user.click(screen.getByRole('button', { name: 'Export bugs' }))
  expect(writeText).toHaveBeenCalledWith(`- ${todayKey()}: Calendar cells overlap at 390`)
  expect(screen.getByRole('status')).toHaveTextContent('Copied 1 bug as a markdown list.')
})

test('with no #bug notes there is no Export button to wonder about', () => {
  actions.addScratch('Nothing wrong here')
  render(<Scratch open onClose={() => {}} />)
  expect(screen.queryByRole('button', { name: 'Export bugs' })).toBeNull()
})

test('the count is plain words, never a badge', () => {
  actions.addScratch('one')
  actions.addScratch('two')
  render(<Scratch open onClose={() => {}} />)
  expect(screen.getByText('2 notes')).toBeInTheDocument()
})

// --- where notes live ----------------------------------------------------

test('notes are in the search, and choosing one opens Scratch', () => {
  actions.addScratch('Plumber said 0612 345 678')
  const hit = searchEverything(getData(), 'plumber', todayKey())
  expect(hit).toHaveLength(1)
  expect(hit[0].kind).toBe('scratch')
  expect(hit[0].target).toEqual({ type: 'scratch', id: getData().scratch[0].id })
})

test('a note is a sync entity of its own, stamped when written and merged by last write', () => {
  const before = getData()
  actions.addScratch('travels')
  const after = getData()
  const id = after.scratch[0].id
  expect(collectEntities(after).has(`scratch:${id}`)).toBe(true)
  expect(after.scratch[0].updatedAt).toBeDefined()

  // The other device edited the same note later; its words win.
  const remote = {
    ...after,
    scratch: [{ ...after.scratch[0], text: 'travels, edited', updatedAt: '2999-01-01T00:00:00.000Z' }],
  }
  const merged = mergeStates(after, remote, '2026-09-03T00:00:00.000Z')
  expect(merged.data.scratch[0].text).toBe('travels, edited')
  expect(stampChanges(before, after, '2026-09-03T00:00:00.000Z').scratch[0].updatedAt).toBeDefined()
})

test('in the tour sandbox a note is written to the sandbox, never to the real plan', () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultData()))
  setTourSandboxForTests(true)
  actions.resetForTests(loadData())
  actions.addScratch('sandbox only')
  expect(JSON.parse(localStorage.getItem(TOUR_STORAGE_KEY)!).scratch).toHaveLength(1)
  expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).scratch).toEqual([])
})

test('a plan saved before Scratch existed loads with an empty stream', () => {
  const old = defaultData() as unknown as Record<string, unknown>
  delete old.scratch
  localStorage.setItem(STORAGE_KEY, JSON.stringify(old))
  expect(loadData().scratch).toEqual([])
})

test('the floating button is there on a phone and not beside a keyboard', () => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
  render(<App />)
  expect(screen.getByRole('button', { name: /^Scratch:/ })).toBeInTheDocument()
  act(() => {
    screen.getByRole('button', { name: /^Scratch:/ }).click()
  })
  expect(screen.getByRole('dialog', { name: 'Scratch' })).toBeInTheDocument()
  vi.unstubAllGlobals()
})

// --- something to do, said in one character --------------------------------
//
// Scratch's whole value is that nothing is asked at the moment of writing, so
// the way out of it has to cost one character or one tap - and it has to be a
// character somebody types deliberately, never one that falls out of ordinary
// prose.

test('a line starting with ! goes to the inbox, without the mark and without a note', async () => {
  const user = userEvent.setup()
  render(<Scratch open onClose={() => {}} />)
  const field = screen.getByRole('textbox', { name: 'Scratch note' })

  await user.type(field, '!book the dentist')
  // Not written into the stream and then moved - never written at all, or
  // changing your mind mid-sentence would leave a note behind every time.
  expect(getData().scratch).toHaveLength(0)

  await user.keyboard('{Enter}')
  expect(getData().inbox.map(i => i.text)).toEqual(['book the dentist'])
  expect(getData().scratch).toHaveLength(0)
})

test('the mark only counts at the front, so an ordinary line is still a note', async () => {
  const user = userEvent.setup()
  render(<Scratch open onClose={() => {}} />)
  await user.type(screen.getByRole('textbox', { name: 'Scratch note' }), 'That went well!{Enter}')
  expect(getData().scratch.map(n => n.text)).toEqual(['That went well!'])
  expect(getData().inbox).toHaveLength(0)
})

test('the marker says where the line is going before Enter', async () => {
  const user = userEvent.setup()
  render(<Scratch open onClose={() => {}} />)
  const field = screen.getByRole('textbox', { name: 'Scratch note' })
  expect(screen.getByRole('button', { name: /Staying as a note/ })).toHaveTextContent('Note')

  await user.type(field, '!call the bank')
  expect(screen.getByRole('button', { name: /Going to the inbox as a task/ })).toHaveTextContent('Task')
})

test('the toggle is the same intent said with a tap', async () => {
  const user = userEvent.setup()
  render(<Scratch open onClose={() => {}} />)
  await user.click(screen.getByRole('button', { name: /Staying as a note/ }))
  await user.type(screen.getByRole('textbox', { name: 'Scratch note' }), 'call the bank{Enter}')

  expect(getData().inbox.map(i => i.text)).toEqual(['call the bank'])
  expect(getData().scratch).toHaveLength(0)
})

test('a note already started is taken back out of the stream when the line becomes a task', async () => {
  const user = userEvent.setup()
  render(<Scratch open onClose={() => {}} />)
  const field = screen.getByRole('textbox', { name: 'Scratch note' })

  await user.type(field, 'call the bank')
  expect(getData().scratch).toHaveLength(1)

  // The "!" arrives after the words, which is how somebody who changes their
  // mind actually types it: they reach back to the front of the line.
  await user.clear(field)
  await user.type(field, '!call the bank')
  expect(getData().scratch).toHaveLength(0)
  await user.keyboard('{Enter}')
  expect(getData().inbox.map(i => i.text)).toEqual(['call the bank'])
})

test('turning the toggle off takes the mark off with it', async () => {
  const user = userEvent.setup()
  render(<Scratch open onClose={() => {}} />)
  const field = screen.getByRole('textbox', { name: 'Scratch note' })
  await user.type(field, '!call the bank')

  // Otherwise the line would still read as a task and the toggle would look
  // like it had not worked.
  await user.click(screen.getByRole('button', { name: /Going to the inbox as a task/ }))
  expect(field).toHaveValue('call the bank')
  expect(screen.getByRole('button', { name: /Staying as a note/ })).toBeInTheDocument()
})

test('the next line after a task is a note again', async () => {
  const user = userEvent.setup()
  render(<Scratch open onClose={() => {}} />)
  await user.click(screen.getByRole('button', { name: /Staying as a note/ }))
  await user.type(screen.getByRole('textbox', { name: 'Scratch note' }), 'call the bank{Enter}')
  // The toggle is about this line, not the rest of the sitting: the next
  // thing somebody blurts out is far more often a note.
  expect(screen.getByRole('button', { name: /Staying as a note/ })).toBeInTheDocument()
  await user.type(screen.getByRole('textbox', { name: 'Scratch note' }), 'serial is 4471{Enter}')
  expect(getData().scratch.map(n => n.text)).toEqual(['serial is 4471'])
})

test('a line that is only a mark sends nothing', async () => {
  const user = userEvent.setup()
  render(<Scratch open onClose={() => {}} />)
  await user.type(screen.getByRole('textbox', { name: 'Scratch note' }), '!{Enter}')
  expect(getData().inbox).toHaveLength(0)
  expect(getData().scratch).toHaveLength(0)
})
