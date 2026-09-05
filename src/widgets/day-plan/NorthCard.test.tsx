import { beforeEach, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NorthCard } from './NorthCard'
import { actions, getData } from '../../lib/store'
import { defaultData } from '../../lib/storage'
import { addDays } from '../../lib/dates'

// A Wednesday, pinned. These tests read the real clock until v2.1, and the
// card has a Monday version that says something different: the slack-card
// tests below passed six days a week and would have failed on the seventh.
const TODAY = '2026-09-02'

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date(`${TODAY}T09:00:00`))
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

/**
 * One rule under the why, and it has to be one of *this* goal's.
 *
 * The card is the only place outside the North window where a rule ever
 * appears - DECISIONS, "A rule with no goal is noise; under a goal it is
 * armour" - and the whole reason it is allowed here is that it is the
 * person's own sentence about this direction, restated. A rule belonging to
 * a different goal would be advice, which is the one thing this card must
 * never be.
 */
test('the slack card shows one rule, from the goal it is about', () => {
  const [first] = getData().goals
  const second = actions.addGoal({ title: 'Be strong at forty' }, TODAY)!
  actions.addIfThen({ trigger: 'I stall at the laptop', action: 'I open today', goalId: first.id })
  actions.addIfThen({ trigger: 'the alarm goes twice', action: 'feet on the floor', goalId: first.id })
  actions.addIfThen({ trigger: 'the gym bag is by the door', action: 'it goes in the car', goalId: second.id })

  render(<NorthCard />)
  const card = screen.getByRole('complementary', { name: 'Why this matters' })
  expect(card).toHaveTextContent('Here is what you wrote yourself.')
  expect(card.querySelectorAll('.north-card-rule')).toHaveLength(1)

  // Which goal today shows is the rotation's business, not this test's - so
  // read it off the card and check the rule against it. That is the contract:
  // whatever goal comes forward, the sentence under it is one of its own.
  const shown = getData().goals.find(g => card.textContent!.includes(g.title))!
  const rule = getData().ifThens.find(r => card.textContent!.includes(r.trigger))!
  expect(rule.goalId).toBe(shown.id)
})

test('a goal with no rules under it shows the why and stops there', () => {
  render(<NorthCard />)
  expect(screen.getByRole('complementary', { name: 'Why this matters' })).not.toHaveTextContent(
    'Here is what you wrote yourself',
  )
})
/**
 * The Monday card carries one line of what you do to deserve the goal - the
 * bridge between the direction and the week that is starting. One line, the
 * same one all week, and never a question about whether last week's was done.
 */
test('on a Monday the card says one thing you do for this, and nothing about last week', () => {
  vi.setSystemTime(new Date('2026-09-07T09:00:00'))
  const [g] = getData().goals
  actions.updateGoal(g.id, { deserve: ['train four times', 'sleep by eleven'] })
  render(<NorthCard />)
  const card = screen.getByRole('complementary', { name: 'Why this matters' })
  expect(card).toHaveTextContent('New week.')
  expect(card).toHaveTextContent('This week.')
  expect(card.textContent).toMatch(/train four times|sleep by eleven/)
  expect(card.querySelectorAll('.north-card-deserve')).toHaveLength(1)
  expect(card.textContent).not.toMatch(/missed|last week|did not|%/i)
  // And the rule stays on the slack card: a Monday is a morning with nothing
  // behind it yet.
  expect(card).not.toHaveTextContent('Here is what you wrote yourself')
})

test('a Monday card for a goal with nothing written to deserve it shows the why and stops there', () => {
  vi.setSystemTime(new Date('2026-09-07T09:00:00'))
  render(<NorthCard />)
  const card = screen.getByRole('complementary', { name: 'Why this matters' })
  expect(card).toHaveTextContent('New week.')
  expect(card).not.toHaveTextContent('This week.')
})
