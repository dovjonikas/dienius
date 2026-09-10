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
test('after a slow day the card comes forward, and closing it is remembered in settings for today', async () => {
  render(<NorthCard />)
  expect(screen.getByRole('dialog', { name: 'Why this matters' })).toHaveTextContent('Finish things')
  await userEvent.click(screen.getByRole('button', { name: 'Close' }))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(getData().settings.northDismissedOn).toBe(TODAY)
  expect(localStorage.getItem('dienius:north-dismissed')).toBeNull()
})

// A sheet since v2.6 - see NorthCard. Escape and the backdrop are the same
// read as Close: there is nothing else leaving this card could mean, and a way
// out that left it for tomorrow to ask again would be the card nagging.
test('Escape reads the card for the day, and so does the backdrop', async () => {
  const user = userEvent.setup()
  const { unmount } = render(<NorthCard />)
  expect(screen.getByRole('dialog', { name: 'Why this matters' })).toHaveFocus()
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(getData().settings.northDismissedOn).toBe(TODAY)
  unmount()

  actions.dismissNorth(addDays(TODAY, -1))
  const { container } = render(<NorthCard />)
  expect(screen.getByRole('dialog', { name: 'Why this matters' })).toBeInTheDocument()
  await user.click(container.querySelector('.north-scrim')!)
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('a dismissal that arrived from another device is honoured here', () => {
  actions.dismissNorth(TODAY)
  const { container } = render(<NorthCard />)
  expect(container).toBeEmptyDOMElement()
})

test('yesterday\'s dismissal does not carry into a new morning', () => {
  actions.dismissNorth(addDays(TODAY, -1))
  render(<NorthCard />)
  expect(screen.getByRole('dialog', { name: 'Why this matters' })).toBeInTheDocument()
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
  const card = screen.getByRole('dialog', { name: 'Why this matters' })
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
  expect(screen.getByRole('dialog', { name: 'Why this matters' })).not.toHaveTextContent(
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
  const card = screen.getByRole('dialog', { name: 'Why this matters' })
  expect(card).toHaveTextContent('New week')
  expect(card).toHaveTextContent('This week')
  expect(card.textContent).toMatch(/train four times|sleep by eleven/)
  expect(card.querySelectorAll('.north-card-deserve')).toHaveLength(1)
  expect(card.textContent).not.toMatch(/missed|last week|did not|%/i)
  // The lead over a rule stays on the slack card. It is there to say the
  // sentence is the person's own rather than the app's advice, and a Monday
  // has nothing to defend against - so on a Monday the sentence stands on
  // its own, which the test below is about.
  expect(card).not.toHaveTextContent('Here is what you wrote yourself')
})

/**
 * A rule is rehearsed on a Monday, not only repaired after a bad day.
 *
 * It was the slack card's alone until the wave after v2.19. That is right
 * about repair and wrong about what a rule is: an implementation intention
 * works by loading the if-then link before the moment, and Gollwitzer and
 * Sheeran's finding is that a plan rehearsed at least once does more than one
 * written once. Without this, a person whose days do not get away saw the
 * card only on Mondays and their rules exactly nowhere outside North.
 */
test('the Monday card carries the rule too, without the slack card lead over it', () => {
  vi.setSystemTime(new Date('2026-09-07T09:00:00'))
  const [g] = getData().goals
  actions.addIfThen({ trigger: 'I open the laptop and stall', action: 'I open today and do the first thing', goalId: g.id })
  render(<NorthCard />)
  const card = screen.getByRole('dialog', { name: 'Why this matters' })

  expect(card).toHaveTextContent('I open the laptop and stall')
  expect(card).toHaveTextContent('I open today and do the first thing')
  expect(card).not.toHaveTextContent('Here is what you wrote yourself')
})

/**
 * One sentence, drawn by one hand. It was written out here as well as in
 * RuleText until that wave, and the two had already drifted - v2.19 turned
 * the arrow between the halves into the word it stood for on the North page
 * and this card still drew an arrow. CONVENTIONS 23.
 */
test('a rule reads the same on the card as it does on the North page', () => {
  const [g] = getData().goals
  actions.addIfThen({ trigger: 'I open the laptop and stall', action: 'I open today', goalId: g.id })
  render(<NorthCard />)
  const line = screen.getByRole('dialog', { name: 'Why this matters' }).querySelector('.north-rule-line')!

  expect(line).toBeTruthy()
  expect(line.textContent).toBe('If I open the laptop and stall then I open today')
})

test('a Monday card for a goal with nothing written to deserve it shows the why and stops there', () => {
  vi.setSystemTime(new Date('2026-09-07T09:00:00'))
  render(<NorthCard />)
  const card = screen.getByRole('dialog', { name: 'Why this matters' })
  expect(card).toHaveTextContent('New week')
  expect(card).not.toHaveTextContent('This week')
})
