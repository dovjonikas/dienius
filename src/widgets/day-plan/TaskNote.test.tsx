import { beforeEach, expect, test } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DayView } from './DayView'
import { actions, getData } from '../../lib/store'
import { defaultData } from '../../lib/storage'

// The note a template block carries onto every day it stamps, read on the
// day it lands. Until v2.11 the mark was a label: it said "note" and could
// not be pressed, so the only way to what it named was the actions menu and
// then Details.

const DATE = '2026-09-01'

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  actions.resetForTests(defaultData())
})

/** A template whose one block has something to say, stamped onto the day. */
function stampWithNote(note: string) {
  const data = getData()
  actions.resetForTests({
    ...data,
    templates: [
      {
        id: 't-note',
        name: 'Meals',
        color: '#8ab6f9',
        blocks: [{ id: 'nb1', time: '12:00', title: 'Meal', note }],
      },
    ],
  })
  actions.stamp({ [DATE]: 't-note' })
}

test("a note the template brought shows the card's mark, and one press opens it", async () => {
  const user = userEvent.setup()
  stampWithNote('Rice, chicken, whatever green is in the fridge.')
  const { container } = render(<DayView date={DATE} onDateChange={() => {}} onOpenNorth={() => {}} />)
  const list = within(container.querySelector('.task-list')!)

  const mark = list.getByRole('button', { name: /Read the note on Meal/ })
  expect(list.queryByText(/Rice, chicken/)).not.toBeInTheDocument()

  await user.click(mark)
  expect(list.getByText(/Rice, chicken/)).toBeInTheDocument()
  // The day is still the day: opening a note is not a trip to another
  // screen, so the task list it was read from is still on it.
  expect(container.querySelector('.task-list')).toBeInTheDocument()

  await user.click(list.getByRole('button', { name: /Hide the note on Meal/ }))
  expect(list.queryByText(/Rice, chicken/)).not.toBeInTheDocument()
})

test('a note keeps its line breaks, and an indented line is drawn fixed-width', async () => {
  const user = userEvent.setup()
  stampWithNote('Chicken and rice\n  200 g rice\n  300 g chicken')
  const { container } = render(<DayView date={DATE} onDateChange={() => {}} onOpenNorth={() => {}} />)
  await user.click(screen.getByRole('button', { name: /Read the note on Meal/ }))

  const lines = container.querySelectorAll('.note-lines .note-line')
  expect([...lines].map(l => l.textContent)).toEqual(['Chicken and rice', '  200 g rice', '  300 g chicken'])
  // Shape, not meaning: a line that starts indented keeps its columns, and
  // nothing else in the text is read at all.
  expect(lines[0].className).toBe('note-line')
  expect(lines[1].className).toBe('note-line is-fixed')
})

test('a block with nothing to say leaves the card exactly as it was', () => {
  const data = getData()
  actions.resetForTests({
    ...data,
    templates: [
      { id: 't-plain', name: 'Plain', color: '#8ab6f9', blocks: [{ id: 'pb1', time: '12:00', title: 'Meal' }] },
    ],
  })
  actions.stamp({ [DATE]: 't-plain' })
  render(<DayView date={DATE} onDateChange={() => {}} onOpenNorth={() => {}} />)
  expect(screen.queryByRole('button', { name: /the note on Meal/ })).not.toBeInTheDocument()
})

/** The same block, told to show its note without anybody pressing anything. */
function stampExpanded(note: string) {
  const data = getData()
  actions.resetForTests({
    ...data,
    templates: [
      {
        id: 't-note',
        name: 'Meals',
        color: '#8ab6f9',
        blocks: [{ id: 'nb1', time: '12:00', title: 'Meal', note, noteExpanded: true }],
      },
    ],
  })
  actions.stamp({ [DATE]: 't-note' })
}

test('an open note has no mark beside it, and a closed one does', () => {
  stampExpanded('Rice, chicken, whatever green is in the fridge.')
  const { container } = render(<DayView date={DATE} onDateChange={() => {}} onOpenNorth={() => {}} />)
  const list = within(container.querySelector('.task-list')!)

  // The text is on the row with nothing pressed, so the mark that reveals it
  // would be a second way to a thing already showing - CONVENTIONS 23.
  expect(list.getByText(/Rice, chicken/)).toBeInTheDocument()
  expect(list.queryByRole('button', { name: /Read the note on Meal/ })).not.toBeInTheDocument()
})

test('a forty-line note costs the card four lines and a way in', async () => {
  const user = userEvent.setup()
  stampExpanded(Array.from({ length: 40 }, (_, i) => `Step ${i + 1}`).join('\n'))
  const { container } = render(<DayView date={DATE} onDateChange={() => {}} onOpenNorth={() => {}} />)
  const list = within(container.querySelector('.task-list')!)

  expect(container.querySelectorAll('.task-list .note-lines .note-line')).toHaveLength(4)
  expect(list.queryByText('Step 5')).not.toBeInTheDocument()

  await user.click(list.getByRole('button', { name: 'Read the whole note on Meal' }))
  expect(within(screen.getByRole('dialog')).getByText('Step 40')).toBeInTheDocument()
})
