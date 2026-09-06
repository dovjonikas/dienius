import { beforeEach, expect, test, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { JournalPanel } from './JournalPanel'
import { actions, getData } from '../../lib/store'
import { defaultData } from '../../lib/storage'
import { addDays, todayKey } from '../../lib/dates'

/**
 * A journal, not a form: a date, arrows, and one box that saves itself.
 *
 * What is worth holding here is mostly what is absent. No questions, no
 * Save, no count of the days with nothing on them, and nothing anywhere
 * that reads as a report card - see DECISIONS "A journal, not a form".
 */

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
})

const user = () => userEvent.setup()
const open = () => render(<JournalPanel onOpenFull={() => {}} />)
const journalOn = (date: string) => getData().days[date]?.journal

test('what is typed is kept, without a Save button anywhere', async () => {
  const u = user()
  open()
  await u.type(screen.getByRole('textbox'), 'It rained all afternoon.')
  await waitFor(() => expect(journalOn(todayKey())).toBe('It rained all afternoon.'))
  expect(screen.queryByRole('button', { name: /save/i })).toBeNull()
})

test('it opens on today, and the arrows walk the days', async () => {
  const u = user()
  actions.setJournal(addDays(todayKey(), -1), 'Yesterday happened')
  open()
  expect(screen.getByText('Today')).toBeInTheDocument()

  await u.click(screen.getByRole('button', { name: 'The day before' }))
  expect(screen.getByRole('textbox')).toHaveValue('Yesterday happened')
})

test('what was being typed is kept when the day changes under it', async () => {
  const u = user()
  open()
  await u.type(screen.getByRole('textbox'), 'Half a thought')
  await u.click(screen.getByRole('button', { name: 'The day before' }))

  expect(journalOn(todayKey())).toBe('Half a thought')
  expect(screen.getByRole('textbox')).toHaveValue('')
})

test('there is no walking into tomorrow, because tomorrow has not happened', () => {
  open()
  expect(screen.getByRole('button', { name: 'The day after' })).toBeDisabled()
})

test('a day with nothing on it is an empty box and says nothing else', () => {
  open()
  const box = screen.getByRole('textbox')
  expect(box).toHaveValue('')
  expect(box).toHaveAttribute('placeholder', '...')
  expect(document.body.textContent).not.toMatch(/missed|streak|empty|nothing written|\d+ days/i)
})

test('a day left blank carries no key at all, so it costs nothing anywhere', async () => {
  const u = user()
  actions.setJournal(todayKey(), 'Something')
  open()
  await u.clear(screen.getByRole('textbox'))
  await waitFor(() => expect(journalOn(todayKey())).toBeUndefined())
  expect('journal' in getData().days[todayKey()]).toBe(false)
})

test('Open full hands over to the whole thing', async () => {
  const u = user()
  const onOpenFull = vi.fn()
  render(<JournalPanel onOpenFull={onOpenFull} />)
  await u.click(screen.getByRole('button', { name: 'Open full' }))
  expect(onOpenFull).toHaveBeenCalled()
})

test('nothing is asked: there are no questions on it at all', () => {
  open()
  expect(document.body.textContent).not.toMatch(/\?/)
})

// --- it is not Notes, and an empty day says which ------------------------

/**
 * Notes and the journal are one press apart on the same popover, both a box
 * you type into, and there is nothing in either shape that says which is
 * which. Two boxes doing the same thing in two places is how one of them
 * stops being used, so the difference is said out loud - once, on the empty
 * day, where somebody is deciding which one they wanted.
 *
 * It says nothing at all once there is writing on the day: a line that
 * explains itself over your own words is the app talking during a sentence.
 */
test('an empty day says how this differs from Notes, in the words the app itself uses', () => {
  open()
  const said = screen.getByText(/Notes is for doing/i)
  expect(said).toBeInTheDocument()
  expect(said.textContent).toMatch(/remember/i)
})

test('the difference is said once, and goes as soon as there is writing on the day', async () => {
  const u = user()
  open()
  expect(screen.getByText(/Notes is for doing/i)).toBeInTheDocument()
  await u.type(screen.getByRole('textbox'), 'A line')
  expect(screen.queryByText(/Notes is for doing/i)).not.toBeInTheDocument()
})
