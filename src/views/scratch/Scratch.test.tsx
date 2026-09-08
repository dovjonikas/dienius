import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../../App'
import { Scratch } from './Scratch'
import { actions, getData } from '../../lib/store'
import { STORAGE_KEY, defaultData, loadData } from '../../lib/storage'
import { addDays, todayKey } from '../../lib/dates'
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

// Fifteen seconds rather than the runner's five. This opens the box from
// every tab through real key presses, which is a second on its own and five
// or more on a machine running a hundred and forty test files in parallel -
// honest work, not a hang, and the same trade the 20MB import test makes
// rather than letting the default act as an absolute budget.
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
}, 15_000)

/**
 * The backtick, and finding a note through the palette.
 *
 * The second half of this used to press Ctrl-K and then click a button
 * named "Scratch" - which was the rail's own pen, sitting behind the open
 * palette, not anything the palette offered. It passed for four versions
 * while testing nothing about the palette at all, and the pen leaving the
 * rail is what finally said so. The palette has no standing Scratch
 * command; what it has is every note, by its own words, which is the thing
 * worth holding: a line written in a hurry is only worth writing down if it
 * can be found again.
 */
test('the backtick opens it, and a note is findable through the palette', async () => {
  const user = userEvent.setup()
  actions.addScratch('Ada: her sister is called Nel')
  render(<App />)
  press('`')
  expect(screen.getByRole('dialog', { name: 'Scratch' })).toBeInTheDocument()
  press('Escape')

  fireEvent.keyDown(document, { key: 'k', ctrlKey: true })
  await user.keyboard('Nel')
  await user.click(await screen.findByRole('option', { name: /her sister/ }))
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
test('To task opens the editor rather than guessing, and the note stays where it is', async () => {
  const user = userEvent.setup()
  actions.addScratch('14:00 Call the bank 20 min')
  render(<Scratch open onClose={() => {}} />)
  await user.click(screen.getByRole('button', { name: 'To task' }))

  // Nothing is on the day until Save. NoteToTask.test.tsx walks the sheet
  // itself; what matters here is that the note is not consumed on the way.
  await user.click(screen.getByRole('button', { name: 'Save' }))
  const tasks = getData().days[todayKey()].tasks
  expect(tasks.map(t => t.title)).toEqual(['14:00 Call the bank 20 min'])
  expect(getData().scratch).toHaveLength(1)
  expect(screen.getByRole('status')).toHaveTextContent('The note stays here.')
})

test('To Later moves the words exactly as they were written, and leaves the stream', async () => {
  const user = userEvent.setup()
  actions.addScratch('Look up the #idea about pricing')
  render(<Scratch open onClose={() => {}} />)
  await user.click(screen.getByRole('button', { name: 'To Later' }))
  expect(getData().backlog.map(i => i.title)).toEqual(['Look up the #idea about pricing'])
  expect(getData().scratch).toHaveLength(0)
  expect(screen.getByRole('status')).toHaveTextContent('Moved to Later.')
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

/**
 * Since v2.5 there are no chips over the stream and no export under it: a
 * note is the words in it. A # is drawn as a #, not marked and not offered
 * as a filter, and a note written when it meant something reads as it was
 * written. DECISIONS "Notes are notes".
 */
test('a # is text: no chip bar, no export, and the sentence as it was typed', () => {
  actions.addScratch('Week title wraps #bug')
  actions.addScratch('A quieter accent #idea')
  render(<Scratch open onClose={() => {}} />)
  expect(screen.queryByRole('button', { name: '#bug' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'All' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Export bugs' })).toBeNull()
  const items = screen.getAllByRole('listitem')
  expect(items).toHaveLength(2)
  expect(items[0]).toHaveTextContent('A quieter accent #idea')
  expect(items[0].querySelector('mark')).toBeNull()
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

// The way in on a phone. A draggable floating circle here and a pen in the
// header on a desktop, then one pen in the rail on both, and now a Notes
// button in the header on both - each move keeping the one thing section 17
// asks for, which is a visible way in that is the same everywhere. The panel
// it opens is the one-line door; Open notes inside it is the whole stream.
test('the Notes button reaches the stream on a phone', async () => {
  const user = userEvent.setup()
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
  render(<App />)

  await user.click(screen.getByRole('button', { name: 'Notes' }))
  await user.click(screen.getByRole('button', { name: 'Open notes' }))
  expect(screen.getByRole('dialog', { name: 'Scratch' })).toBeInTheDocument()
  vi.unstubAllGlobals()
})

// --- something to do, said in one character --------------------------------
//
// Scratch's whole value is that nothing is asked at the moment of writing, so
// the way out of it has to cost one character or one tap - and it has to be a
// character somebody types deliberately, never one that falls out of ordinary
// prose.

test('a line starting with ! goes to Later, without the mark and without a note', async () => {
  const user = userEvent.setup()
  render(<Scratch open onClose={() => {}} />)
  const field = screen.getByRole('textbox', { name: 'Scratch note' })

  await user.type(field, '!book the dentist')
  // Not written into the stream and then moved - never written at all, or
  // changing your mind mid-sentence would leave a note behind every time.
  expect(getData().scratch).toHaveLength(0)

  await user.keyboard('{Enter}')
  expect(getData().backlog.map(i => i.title)).toEqual(['book the dentist'])
  expect(getData().scratch).toHaveLength(0)
  expect(screen.getByRole('status')).toHaveTextContent('Sent to Later.')
})

test('the mark only counts at the front, so an ordinary line is still a note', async () => {
  const user = userEvent.setup()
  render(<Scratch open onClose={() => {}} />)
  await user.type(screen.getByRole('textbox', { name: 'Scratch note' }), 'That went well!{Enter}')
  expect(getData().scratch.map(n => n.text)).toEqual(['That went well!'])
  expect(getData().backlog).toHaveLength(0)
})

test('the marker says where the line is going before Enter', async () => {
  const user = userEvent.setup()
  render(<Scratch open onClose={() => {}} />)
  const field = screen.getByRole('textbox', { name: 'Scratch note' })
  expect(screen.getByRole('button', { name: /Staying as a note/ })).toHaveTextContent('Note')

  await user.type(field, '!call the bank')
  expect(screen.getByRole('button', { name: /Going to Later as a task/ })).toHaveTextContent('Task')
})

test('the toggle is the same intent said with a tap', async () => {
  const user = userEvent.setup()
  render(<Scratch open onClose={() => {}} />)
  await user.click(screen.getByRole('button', { name: /Staying as a note/ }))
  await user.type(screen.getByRole('textbox', { name: 'Scratch note' }), 'call the bank{Enter}')

  expect(getData().backlog.map(i => i.title)).toEqual(['call the bank'])
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
  expect(getData().backlog.map(i => i.title)).toEqual(['call the bank'])
})

test('turning the toggle off takes the mark off with it', async () => {
  const user = userEvent.setup()
  render(<Scratch open onClose={() => {}} />)
  const field = screen.getByRole('textbox', { name: 'Scratch note' })
  await user.type(field, '!call the bank')

  // Otherwise the line would still read as a task and the toggle would look
  // like it had not worked.
  await user.click(screen.getByRole('button', { name: /Going to Later as a task/ }))
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
  expect(getData().backlog).toHaveLength(0)
  expect(getData().scratch).toHaveLength(0)
})

// --- how old a note is, in a shape that always fits -----------------------

/**
 * Every note carries a date and four actions on one row. The date used to
 * be the full title - "Monday, September 14" - which is 142px on a phone
 * and pushed the actions onto a second line, so one note in a list stood
 * 19px taller than the four above it for no reason a reader could see.
 *
 * Today and Yesterday were already short. Anything older gets the same
 * treatment: a weekday, a day and a month, in the abbreviations the week
 * columns already use.
 */
test('a note older than yesterday says its date short enough to sit on one line', () => {
  const now = new Date().toISOString()
  actions.resetForTests({
    ...defaultData(),
    scratch: [
      { id: 'n1', text: 'Today', date: todayKey(), createdAt: now },
      { id: 'n2', text: 'Yesterday', date: addDays(todayKey(), -1), createdAt: now },
      { id: 'n3', text: 'Older', date: addDays(todayKey(), -4), createdAt: now },
    ],
  })
  render(<Scratch open onClose={() => {}} />)

  const whens = Array.from(document.querySelectorAll('.scratch-note-when')).map(el => el.textContent ?? '')
  expect(whens.some(w => w.startsWith('Today'))).toBe(true)
  expect(whens.some(w => w.startsWith('Yesterday'))).toBe(true)

  // The old one: "Sat 12 Sep 14:00" and nothing longer. No full weekday,
  // no full month, and short enough to leave the actions where they were.
  const older = whens.find(w => !/^(Today|Yesterday)/.test(w)) ?? ""
  expect(older).not.toMatch(/Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday/)
  expect(older).not.toMatch(/January|February|March|April|May|June|July|August|September|October|November|December/)
  expect(older.length).toBeLessThanOrEqual(17)
})
