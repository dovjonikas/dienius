import { beforeEach, expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NorthCard } from './NorthCard'
import { actions, getData } from '../../lib/store'
import { defaultData } from '../../lib/storage'
import { addDays, todayKey } from '../../lib/dates'

const TODAY = todayKey()

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
  actions.addGoal({ title: 'Finish things', why: 'Because rented is not mine.' }, TODAY)
  // Yesterday got away: a plan, and none of it done.
  actions.addTask(addDays(TODAY, -1), 'Deep work')
  actions.addTask(addDays(TODAY, -1), 'Call the bank')
})

/**
 * "I have read this morning's card" is a fact about the person, so it lives
 * in settings and syncs. From v1.4 to v1.11 the field existed, was in the
 * sync list, and was never written: the card kept a local key of its own,
 * and the phone asked again after the laptop had already answered. Found by
 * reading ARCHITECTURE against the code.
 */
test('after a slow day the card comes forward, and Ok is remembered in settings for today', async () => {
  render(<NorthCard />)
  expect(screen.getByRole('complementary', { name: 'Why this matters' })).toHaveTextContent('Finish things')
  await userEvent.click(screen.getByRole('button', { name: 'Ok' }))
  expect(screen.queryByRole('complementary')).toBeNull()
  expect(getData().settings.northDismissedOn).toBe(TODAY)
  expect(localStorage.getItem('dienius:north-dismissed')).toBeNull()
})

test('a dismissal that arrived from another device is honoured here', () => {
  actions.dismissNorth(TODAY)
  const { container } = render(<NorthCard />)
  expect(container).toBeEmptyDOMElement()
})

test('yesterday\'s dismissal does not carry into a new morning', () => {
  actions.dismissNorth(addDays(TODAY, -1))
  render(<NorthCard />)
  expect(screen.getByRole('complementary', { name: 'Why this matters' })).toBeInTheDocument()
})
