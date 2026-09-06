import { beforeEach, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReviewView } from './ReviewView'
import { actions } from '../lib/store'
import { defaultData } from '../lib/storage'
import { formatWeekTitle, todayKey, weekOf } from '../lib/dates'

const TODAY = todayKey()

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
})

function stubClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
  return writeText
}

/**
 * The journal for the stretch being reviewed, as markdown, for somewhere
 * else. The week and the month each copy their own dates under their own
 * heading; with nothing written the button is there, greyed, and does
 * nothing - a control that only appears once the feature has been used is
 * a control nobody finds.
 */
test('the week being reviewed copies as markdown under its own heading', async () => {
  const user = userEvent.setup()
  const writeText = stubClipboard()
  actions.addTask(TODAY, 'One')
  actions.setJournal(TODAY, 'Ship the pricing page\nStart with the walk')
  render(<ReviewView />)

  await user.click(screen.getByRole('button', { name: 'Copy week journal' }))
  expect(writeText).toHaveBeenCalledTimes(1)
  const text = writeText.mock.calls[0][0] as string
  expect(text.startsWith(`# Journal, ${formatWeekTitle(weekOf(TODAY))}`)).toBe(true)
  expect(text).toContain('Ship the pricing page\nStart with the walk')
  expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument()
})

test('the month copies the month, named as the month', async () => {
  const user = userEvent.setup()
  const writeText = stubClipboard()
  actions.addTask(TODAY, 'One')
  actions.setJournal(TODAY, 'Dad called')
  render(<ReviewView />)

  await user.click(screen.getByRole('button', { name: 'Month' }))
  await user.click(screen.getByRole('button', { name: 'Copy month journal' }))
  const text = writeText.mock.calls[0][0] as string
  const month = new Date(`${TODAY}T00:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  expect(text.startsWith(`# Journal, ${month}`)).toBe(true)
  expect(text).toContain('Dad called')
})

test('with nothing written the button is greyed and says why, and never says what was skipped', () => {
  actions.addTask(TODAY, 'One')
  render(<ReviewView />)
  const button = screen.getByRole('button', { name: 'Copy week journal' })
  expect(button).toBeDisabled()
  expect(button).toHaveAttribute('title', 'No journal lines in this week')
  expect(document.body.textContent).not.toMatch(/skipped|missed|streak of/i)
})
