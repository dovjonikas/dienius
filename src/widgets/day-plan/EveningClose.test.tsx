import { beforeEach, expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EveningClose } from './EveningClose'
import { actions, getData } from '../../lib/store'
import { defaultData } from '../../lib/storage'
import { todayKey } from '../../lib/dates'
import { DEFAULT_EVENING_CLOSE } from '../../lib/eveningClose'

const TODAY = todayKey()

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
})

/** A day whose last task has just been ticked off - the trigger that needs no clock. */
function finishedDay(count = 2) {
  for (let i = 0; i < count; i++) actions.addTask(TODAY, `Task ${i}`)
  for (const task of getData().days[TODAY].tasks) actions.toggleTask(TODAY, task.id)
}

/**
 * The tone is the feature - see lib/eveningClose.ts. These are mostly about
 * what is not on the card.
 */

test('a finished day closes itself the moment the last task is ticked, whatever the hour', () => {
  finishedDay()
  render(<EveningClose date={TODAY} />)
  expect(screen.getByRole('complementary', { name: 'Closing the day' })).toHaveTextContent(
    '2 of 2 done - enough.',
  )
})

test('nothing appears on a day that was never planned', () => {
  const { container } = render(<EveningClose date={TODAY} />)
  expect(container).toBeEmptyDOMElement()
})

test('nothing appears on a day that is not today', () => {
  finishedDay()
  const { container } = render(<EveningClose date="2026-01-01" />)
  expect(container).toBeEmptyDOMElement()
})

test('nothing appears when it is switched off', () => {
  finishedDay()
  actions.setEveningClose({ ...DEFAULT_EVENING_CLOSE, enabled: false })
  const { container } = render(<EveningClose date={TODAY} />)
  expect(container).toBeEmptyDOMElement()
})

test('the card says nothing anywhere about what was not done', () => {
  actions.addTask(TODAY, 'One')
  actions.addTask(TODAY, 'Two')
  actions.addTask(TODAY, 'Three')
  actions.toggleTask(TODAY, getData().days[TODAY].tasks[0].id)
  // Half nine, so the clock trigger fires on a day that is far from finished.
  actions.setEveningClose({ ...DEFAULT_EVENING_CLOSE, at: '00:00' })
  render(<EveningClose date={TODAY} />)

  const card = screen.getByRole('complementary', { name: 'Closing the day' })
  expect(card).toHaveTextContent('1 of 3 - the day gave what it gave.')
  // The offer to push names a number, which is a fact about a button, not a
  // verdict - but none of these words may appear anywhere on the card.
  expect(card.textContent).not.toMatch(/missed|fail|behind|only|should|%/i)
})

test('closing it puts it away for the day, and the best moment is kept with the day', async () => {
  const user = userEvent.setup()
  finishedDay()
  const { unmount } = render(<EveningClose date={TODAY} />)

  await user.type(screen.getByRole('textbox', { name: 'Best moment today?' }), 'walked home the long way')
  await user.click(screen.getByRole('button', { name: 'Close the day' }))

  expect(screen.queryByRole('complementary', { name: 'Closing the day' })).toBeNull()
  expect(getData().days[TODAY].bestMoment).toBe('walked home the long way')

  // And it stays away: a fresh mount, as after switching tabs and back.
  unmount()
  const { container } = render(<EveningClose date={TODAY} />)
  expect(container).toBeEmptyDOMElement()
})

test('a day that already carries a line shows it rather than asking again', () => {
  finishedDay()
  actions.setBestMoment(TODAY, 'the coffee was good')
  render(<EveningClose date={TODAY} />)
  expect(screen.getByRole('textbox', { name: 'Best moment today?' })).toHaveValue('the coffee was good')
})

test('the question can be switched off without switching off the ending', () => {
  finishedDay()
  actions.setEveningClose({ ...DEFAULT_EVENING_CLOSE, askBestMoment: false })
  render(<EveningClose date={TODAY} />)
  expect(screen.getByRole('complementary', { name: 'Closing the day' })).toBeInTheDocument()
  expect(screen.queryByRole('textbox', { name: 'Best moment today?' })).toBeNull()
})

/**
 * Offered, never urged. The card does not say that leaving three things is a
 * problem, because it is not one.
 */
test('unfinished work is one offer that can be ignored, and gone once taken', async () => {
  const user = userEvent.setup()
  actions.addTask(TODAY, 'One')
  actions.addTask(TODAY, 'Two')
  actions.addTask(TODAY, 'Three')
  actions.toggleTask(TODAY, getData().days[TODAY].tasks[0].id)
  actions.setEveningClose({ ...DEFAULT_EVENING_CLOSE, at: '00:00' })
  render(<EveningClose date={TODAY} />)

  await user.click(screen.getByRole('button', { name: '2 unfinished - push to tomorrow?' }))
  expect(screen.queryByRole('button', { name: /push to tomorrow/ })).toBeNull()
  expect(getData().days[TODAY].tasks.filter(t => !t.done)).toHaveLength(0)
})

test('a finished day is not offered a push it does not need', () => {
  finishedDay()
  render(<EveningClose date={TODAY} />)
  expect(screen.queryByRole('button', { name: /push to tomorrow/ })).toBeNull()
})

test('a goal is repeated back at the end, where the morning card would say why', () => {
  finishedDay()
  actions.addGoal({ title: 'Be someone who finishes things', why: 'Because starting was never the hard part' }, TODAY)
  render(<EveningClose date={TODAY} />)
  expect(screen.getByRole('complementary', { name: 'Closing the day' })).toHaveTextContent(
    'Be someone who finishes things',
  )
})

test('a line already there can be cleared, not only replaced', async () => {
  const user = userEvent.setup()
  finishedDay()
  actions.setBestMoment(TODAY, 'the coffee was good')
  render(<EveningClose date={TODAY} />)

  // With one piece of state for both "untouched" and "empty", clearing the
  // field fell straight back to showing the stored line again, so a line
  // typed and thought better of could not be removed.
  await user.clear(screen.getByRole('textbox', { name: 'Best moment today?' }))
  expect(screen.getByRole('textbox', { name: 'Best moment today?' })).toHaveValue('')
  await user.click(screen.getByRole('button', { name: 'Close the day' }))
  expect(getData().days[TODAY].bestMoment).toBeUndefined()
})

test('closing without touching the field leaves whatever was already there', async () => {
  const user = userEvent.setup()
  finishedDay()
  actions.setBestMoment(TODAY, 'the coffee was good')
  render(<EveningClose date={TODAY} />)
  await user.click(screen.getByRole('button', { name: 'Close the day' }))
  expect(getData().days[TODAY].bestMoment).toBe('the coffee was good')
})
