import { beforeEach, expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { JournalLine } from './JournalLine'
import { actions, getData } from '../../lib/store'
import { defaultData } from '../../lib/storage'

const DATE = '2026-09-07'
const OTHER = '2026-09-08'

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
})

const line = () => screen.getByRole('textbox', { name: 'Today, in one line' })

/**
 * One line, optional, kept on the day. It saves when the person is done
 * typing rather than on every keystroke, and it is allowed to say nothing:
 * a day never written on never gets a journal at all.
 */
test('a line typed and left is kept on the day, trimmed', async () => {
  const user = userEvent.setup()
  render(<JournalLine date={DATE} />)
  await user.type(line(), '  Ship the pricing page ')
  expect(getData().days[DATE]).toBeUndefined()
  await user.tab()
  expect(getData().days[DATE].journal).toEqual({ intent: 'Ship the pricing page' })
})

test('Enter keeps it too, and Escape puts the saved line back', async () => {
  const user = userEvent.setup()
  render(<JournalLine date={DATE} />)
  await user.type(line(), 'Ship it{Enter}')
  expect(getData().days[DATE].journal?.intent).toBe('Ship it')

  await user.click(line())
  await user.type(line(), ' and more{Escape}')
  expect(line()).toHaveValue('Ship it')
  expect(getData().days[DATE].journal?.intent).toBe('Ship it')
})

test('clearing the line takes the journal off the day, and looking without typing writes nothing', async () => {
  const user = userEvent.setup()
  actions.setJournal(DATE, { intent: 'Ship it' })
  render(<JournalLine date={DATE} />)
  expect(line()).toHaveValue('Ship it')
  await user.clear(line())
  await user.tab()
  expect('journal' in getData().days[DATE]).toBe(false)

  await user.click(line())
  await user.tab()
  expect('journal' in getData().days[DATE]).toBe(false)
})

test('leaving the day mid-sentence writes the sentence to the day it was typed on', async () => {
  const user = userEvent.setup()
  const { rerender } = render(<JournalLine date={DATE} />)
  await user.type(line(), 'Half a line')
  rerender(<JournalLine date={OTHER} />)
  expect(getData().days[DATE].journal).toEqual({ intent: 'Half a line' })
  expect(getData().days[OTHER]).toBeUndefined()
  expect(line()).toHaveValue('')
})
