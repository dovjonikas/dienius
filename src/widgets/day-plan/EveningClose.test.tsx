import { beforeEach, expect, test } from 'vitest'
import { render, screen, within } from '@testing-library/react'
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

  await user.click(screen.getByRole('button', { name: 'Push 2 to tomorrow' }))
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

/**
 * Nothing is asked here any more.
 *
 * There were three questions on this card until v2.5 - the best moment,
 * what was real today, what to tell yourself tomorrow - and the owner
 * called the lot of it too much. A card that appears every evening with
 * three empty boxes is a card somebody starts closing without reading, and
 * then starts dreading. Writing has its own place now and no schedule -
 * see widgets/clock/JournalPanel and DECISIONS "A journal, not a form".
 *
 * What is left is the mechanics the card was always for, which is what
 * these last two hold.
 */
test('the card asks nothing at all: no fields, no questions, no prompts', () => {
  finishedDay()
  render(<EveningClose date={TODAY} />)

  const card = screen.getByRole('complementary', { name: 'Closing the day' })
  expect(within(card).queryAllByRole('textbox')).toEqual([])
  expect(card.textContent).not.toMatch(/[?]/)
})

test('closing it puts it away for the day, and it stays away', async () => {
  const user = userEvent.setup()
  finishedDay()
  const { unmount } = render(<EveningClose date={TODAY} />)

  await user.click(screen.getByRole('button', { name: 'Close the day' }))
  expect(screen.queryByRole('complementary', { name: 'Closing the day' })).toBeNull()

  // And it stays away: a fresh mount, as after switching tabs and back.
  unmount()
  const { container } = render(<EveningClose date={TODAY} />)
  expect(container).toBeEmptyDOMElement()
})
