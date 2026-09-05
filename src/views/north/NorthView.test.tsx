import { beforeEach, expect, test, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NorthView } from './NorthView'
import { actions, getData } from '../../lib/store'
import { defaultData } from '../../lib/storage'
import { activeGoals } from '../../lib/north'
import { MAX_ACTIVE_GOALS, MAX_RULES_PER_GOAL } from '../../lib/types'

const TODAY = '2026-09-05'

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date(`${TODAY}T09:00:00`))
})

function goal(title: string, more: { why?: string; identity?: string; deserve?: string[] } = {}) {
  return actions.addGoal({ title, ...more }, '2026-09-01')!
}

function picture(text = 'I wake before the house does.') {
  actions.setPicture(text)
}

/**
 * The North window is built once and read every day. These tests are about
 * the four layers reading as one piece of writing, about the one way in for
 * somebody with nothing written yet, and about Compose - the one quiet
 * control that edits every layer and saves in one press.
 *
 * Nothing on the screen measures anything, and the tests near the bottom
 * hold that: no checkbox, no percentage, no count that goes up.
 */

// --- the empty window --------------------------------------------------------

test('with nothing written, the window is one invitation to write the picture and nothing else', () => {
  render(<NorthView />)
  expect(screen.getByRole('textbox', { name: 'The picture' })).toBeInTheDocument()
  expect(screen.getAllByRole('button').map(b => b.textContent)).toEqual(['Keep it'])
  expect(screen.queryByRole('button', { name: 'Write one down' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Compose' })).toBeNull()
})

test('one line and Keep it writes the picture, and the goal offer appears under it', async () => {
  const user = userEvent.setup()
  render(<NorthView />)
  await user.type(screen.getByRole('textbox', { name: 'The picture' }), 'I wake before the house does.')
  await user.click(screen.getByRole('button', { name: 'Keep it' }))

  expect(getData().picture?.text).toBe('I wake before the house does.')
  expect(screen.getByText('I wake before the house does.')).toBeInTheDocument()
  expect(screen.queryByRole('textbox', { name: 'The picture' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Write one down' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Compose' })).toBeInTheDocument()
})

test('Enter in the picture line keeps it too, and a blank line keeps nothing', async () => {
  const user = userEvent.setup()
  render(<NorthView />)
  const line = screen.getByRole('textbox', { name: 'The picture' })
  await user.type(line, '   {Enter}')
  expect(getData().picture).toBeUndefined()
  await user.type(line, 'Someone who finishes what he starts.{Enter}')
  expect(getData().picture?.text).toBe('Someone who finishes what he starts.')
})

// The window with goals but no picture is every install from before North v2.
// The invitation sits at the top until it is answered, and the goals are
// under it exactly as they were.
test('goals from before the picture existed show under the invitation, untouched', () => {
  goal('Ship something people keep using', { why: 'Because rented is not mine.' })
  render(<NorthView />)
  expect(screen.getByRole('textbox', { name: 'The picture' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Ship something people keep using' })).toBeInTheDocument()
  expect(screen.getByText('Because rented is not mine.')).toBeInTheDocument()
})

// --- writing a goal ----------------------------------------------------------

test('Write one down opens Compose on a blank goal, and Save writes it with what you do to deserve it', async () => {
  const user = userEvent.setup()
  picture()
  render(<NorthView />)
  await user.click(screen.getByRole('button', { name: 'Write one down' }))

  expect(screen.getByLabelText('What')).toHaveFocus()
  await user.type(screen.getByLabelText('What'), 'Be strong at fifty')
  await user.type(screen.getByLabelText('Why it matters'), 'Dad could not carry his own suitcase at sixty.')
  await user.type(screen.getByLabelText('Who it makes you'), 'I am someone who trains.')
  await user.type(screen.getByLabelText('What I do to deserve this'), 'train four times a week{Enter}walk after lunch')
  await user.click(screen.getByRole('button', { name: 'Save' }))

  const [written] = getData().goals
  expect(written).toMatchObject({
    title: 'Be strong at fifty',
    why: 'Dad could not carry his own suitcase at sixty.',
    identity: 'I am someone who trains.',
    deserve: ['train four times a week', 'walk after lunch'],
    createdAt: TODAY,
  })
  // Back to reading: the goal, its lines as a plain list, and no form.
  expect(screen.getByRole('heading', { name: 'Be strong at fifty' })).toBeInTheDocument()
  const items = screen.getAllByRole('listitem').map(li => li.textContent)
  expect(items).toEqual(expect.arrayContaining(['train four times a week', 'walk after lunch']))
  expect(screen.queryByLabelText('What')).toBeNull()
})

test('the deserve field stops at four lines rather than trimming a fifth on save', async () => {
  const user = userEvent.setup()
  picture()
  render(<NorthView />)
  await user.click(screen.getByRole('button', { name: 'Write one down' }))
  const field = screen.getByLabelText('What I do to deserve this')
  await user.type(field, 'one{Enter}two{Enter}three{Enter}four{Enter}five')
  expect(field).toHaveValue('one\ntwo\nthree\nfourfive')
})

// --- Compose ----------------------------------------------------------------

test('Compose edits the picture and every goal in place, and Cancel drops the draft', async () => {
  const user = userEvent.setup()
  picture('I wake early.')
  goal('Ship something', { why: 'Because.' })
  goal('Be strong at fifty')
  render(<NorthView />)

  await user.click(screen.getByRole('button', { name: 'Compose' }))
  expect(screen.getByLabelText('The picture')).toHaveFocus()
  await user.clear(screen.getByLabelText('The picture'))
  await user.type(screen.getByLabelText('The picture'), 'I wake before the house does.')
  await user.clear(screen.getAllByLabelText('What')[1])
  await user.type(screen.getAllByLabelText('What')[1], 'Be strong at sixty')
  await user.click(screen.getByRole('button', { name: 'Cancel' }))

  expect(getData().picture?.text).toBe('I wake early.')
  expect(getData().goals.map(g => g.title)).toEqual(['Ship something', 'Be strong at fifty'])
  expect(screen.getByText('I wake early.')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Compose' }))
  await user.clear(screen.getByLabelText('The picture'))
  await user.type(screen.getByLabelText('The picture'), 'I wake before the house does.')
  await user.clear(screen.getAllByLabelText('What')[1])
  await user.type(screen.getAllByLabelText('What')[1], 'Be strong at sixty')
  await user.click(screen.getByRole('button', { name: 'Save' }))

  expect(getData().picture?.text).toBe('I wake before the house does.')
  expect(getData().goals.map(g => g.title)).toEqual(['Ship something', 'Be strong at sixty'])
  expect(getData().goals[0].why).toBe('Because.')
})

test('Escape leaves Compose without saving', async () => {
  const user = userEvent.setup()
  picture('I wake early.')
  render(<NorthView />)
  await user.click(screen.getByRole('button', { name: 'Compose' }))
  await user.type(screen.getByLabelText('The picture'), ' And again.')
  await user.keyboard('{Escape}')
  expect(screen.queryByLabelText('The picture')).toBeNull()
  expect(getData().picture?.text).toBe('I wake early.')
})

test('Compose archives a goal on Save and not before, and Undo keeps it', async () => {
  const user = userEvent.setup()
  picture()
  const g = goal('Old direction')
  render(<NorthView />)

  await user.click(screen.getByRole('button', { name: 'Compose' }))
  await user.click(screen.getByRole('button', { name: 'Archive "Old direction"' }))
  expect(screen.getByText(/will be archived when you save/)).toBeInTheDocument()
  expect(getData().goals[0].archivedAt).toBeUndefined()

  await user.click(screen.getByRole('button', { name: 'Undo' }))
  expect(screen.getByLabelText('What')).toHaveValue('Old direction')

  await user.click(screen.getByRole('button', { name: 'Archive "Old direction"' }))
  await user.click(screen.getByRole('button', { name: 'Save' }))
  expect(getData().goals.find(x => x.id === g.id)?.archivedAt).toBe(TODAY)
  expect(screen.queryByRole('heading', { name: 'Old direction' })).toBeNull()
})

test('Add another in Compose puts the cursor in a new goal, and a full window offers no fifth and says why', async () => {
  const user = userEvent.setup()
  picture()
  goal('One')
  render(<NorthView />)

  await user.click(screen.getByRole('button', { name: 'Compose' }))
  await user.click(screen.getByRole('button', { name: 'Add another' }))
  expect(screen.getAllByLabelText('What')).toHaveLength(2)
  expect(screen.getAllByLabelText('What')[1]).toHaveFocus()
  await user.type(screen.getAllByLabelText('What')[1], 'Two')
  await user.click(screen.getByRole('button', { name: 'Add another' }))
  await user.type(screen.getAllByLabelText('What')[2], 'Three')
  await user.click(screen.getByRole('button', { name: 'Add another' }))
  await user.type(screen.getAllByLabelText('What')[3], 'Four')

  expect(screen.queryByRole('button', { name: 'Add another' })).toBeNull()
  expect(screen.getByText(`${MAX_ACTIVE_GOALS} is the limit. Archive one to make room.`)).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Save' }))
  expect(activeGoals(getData().goals).map(g => g.title)).toEqual(['One', 'Two', 'Three', 'Four'])
})

test('a new goal row can be removed before it is saved, and an empty one is never written', async () => {
  const user = userEvent.setup()
  picture()
  goal('One')
  render(<NorthView />)
  await user.click(screen.getByRole('button', { name: 'Compose' }))
  await user.click(screen.getByRole('button', { name: 'Add another' }))
  await user.click(screen.getByRole('button', { name: 'Add another' }))
  await user.click(screen.getAllByRole('button', { name: 'Remove this goal' })[0])
  await user.click(screen.getByRole('button', { name: 'Save' }))
  expect(getData().goals.map(g => g.title)).toEqual(['One'])
})

test('archived goals are brought back or deleted from a fold inside Compose', async () => {
  const user = userEvent.setup()
  picture()
  const g = goal('Old direction')
  goal('Current')
  actions.archiveGoal(g.id, TODAY)
  render(<NorthView />)

  expect(screen.queryByText(/Archived \(1\)/)).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Compose' }))
  await user.click(screen.getByRole('button', { name: 'Archived (1)' }))
  await user.click(screen.getByRole('button', { name: 'Bring back' }))

  expect(getData().goals.find(x => x.id === g.id)?.archivedAt).toBeUndefined()
  expect(screen.getAllByLabelText('What').map(f => (f as HTMLInputElement).value)).toEqual(['Current', 'Old direction'])

  await user.click(screen.getByRole('button', { name: 'Archive "Old direction"' }))
  await user.click(screen.getByRole('button', { name: 'Save' }))
  await user.click(screen.getByRole('button', { name: 'Compose' }))
  await user.click(screen.getByRole('button', { name: 'Archived (1)' }))
  await user.click(screen.getByRole('button', { name: 'Delete' }))
  expect(getData().goals.find(x => x.id === g.id)).toBeUndefined()
})

test('bringing one back is refused while the window is full', async () => {
  const user = userEvent.setup()
  picture()
  const g = goal('Old direction')
  actions.archiveGoal(g.id, TODAY)
  for (let i = 0; i < MAX_ACTIVE_GOALS; i++) goal(`Goal ${i}`)
  render(<NorthView />)
  await user.click(screen.getByRole('button', { name: 'Compose' }))
  await user.click(screen.getByRole('button', { name: 'Archived (1)' }))
  expect(screen.getByRole('button', { name: 'Bring back' })).toBeDisabled()
})

// --- the four layers, read --------------------------------------------------

test('what you do to deserve a goal reads as a plain list, with nothing to tick', () => {
  goal('Be strong at fifty', { deserve: ['train four times a week', 'sleep by eleven'] })
  const { container } = render(<NorthView />)
  const card = screen.getByRole('heading', { name: 'Be strong at fifty' }).closest('article')!
  expect(within(card).getByText('What I do to deserve this')).toBeInTheDocument()
  expect(within(card).getAllByRole('listitem').map(li => li.textContent)).toEqual(['train four times a week', 'sleep by eleven'])
  expect(container.querySelector('input[type="checkbox"], progress, meter')).toBeNull()
})

test('a goal with nothing written to deserve it says so once, quietly, under the same heading', () => {
  goal('Be strong at fifty')
  render(<NorthView />)
  const card = screen.getByRole('heading', { name: 'Be strong at fifty' }).closest('article')!
  expect(within(card).getByText('What I do to deserve this')).toBeInTheDocument()
  expect(within(card).getByText(/Two to four things you do most days/)).toBeInTheDocument()
})

test('the picture reads in full above the goals', () => {
  picture('I wake before the house does.\nThe first hour is mine.')
  goal('Ship something')
  render(<NorthView />)
  const text = screen.getByText(/I wake before the house does/)
  expect(text.textContent).toBe('I wake before the house does.\nThe first hour is mine.')
  expect(text.compareDocumentPosition(screen.getByRole('heading', { name: 'Ship something' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

// --- the rules under each goal, unchanged from v2.0 -------------------------

test('a rule written under a goal appears under that goal and not under another', async () => {
  const user = userEvent.setup()
  const ship = goal('Ship something people keep using')
  goal('Be strong at forty')
  render(<NorthView />)

  const card = screen.getByRole('heading', { name: 'Ship something people keep using' }).closest('article')!
  await user.click(within(card).getByRole('button', { name: 'Write one down' }))
  await user.type(screen.getByLabelText('If'), 'I open the laptop and stall')
  await user.type(screen.getByLabelText('Then'), 'I open today and do the first unticked thing')
  await user.click(screen.getByRole('button', { name: 'Write it down' }))

  expect(getData().ifThens).toHaveLength(1)
  expect(getData().ifThens[0].goalId).toBe(ship.id)

  const other = screen.getByRole('heading', { name: 'Be strong at forty' }).closest('article')!
  expect(within(other).queryByText(/I open the laptop and stall/)).toBeNull()
  expect(within(card).getByText(/I open the laptop and stall/)).toBeTruthy()
})

/**
 * The cap refuses rather than evicting, which means it has to be visible.
 * Quietly dropping the sixth rule would be a limit nobody can see and a
 * sentence somebody thinks they wrote down.
 */
test('a goal with five rules offers no way to write a sixth, and says why', () => {
  const g = goal('Ship something')
  for (let i = 0; i < MAX_RULES_PER_GOAL; i++) {
    actions.addIfThen({ trigger: `Trigger ${i}`, action: `Action ${i}`, goalId: g.id })
  }
  render(<NorthView />)

  expect(screen.queryByRole('button', { name: 'Add another' })).toBeNull()
  expect(screen.getByText(`${MAX_RULES_PER_GOAL} is the limit here. Delete one to make room.`)).toBeTruthy()
})

test('a rule written before rules had goals waits in its own group, and one press files it', async () => {
  const user = userEvent.setup()
  const g = goal('Ship something')
  const orphan = actions.addIfThen({ trigger: 'I get home and the kitchen is a mess', action: 'I do only the sink' })!
  render(<NorthView />)

  const unfiled = screen.getByRole('region', { name: 'Rules with no goal' })
  expect(within(unfiled).getByText(/I get home and the kitchen is a mess/)).toBeTruthy()

  await user.click(within(unfiled).getByRole('button', { name: 'Ship something' }))
  expect(getData().ifThens.find(e => e.id === orphan.id)?.goalId).toBe(g.id)
  expect(screen.queryByRole('region', { name: 'Rules with no goal' })).toBeNull()
})

// A dangling id degrades everywhere in this app, and degrading here means the
// rule comes back to the waiting group rather than disappearing with the goal.
test('a rule whose goal was deleted comes back as unfiled rather than vanishing', () => {
  const g = goal('Ship something')
  actions.addIfThen({ trigger: 'I stall', action: 'I open today', goalId: g.id })
  actions.archiveGoal(g.id, TODAY)
  actions.deleteGoal(g.id)

  render(<NorthView />)
  const unfiled = screen.getByRole('region', { name: 'Rules with no goal' })
  expect(within(unfiled).getByText(/I stall/)).toBeTruthy()
})

// Archiving a direction is not deciding the things that pull you off it never
// happened, so its rules stay with it instead of coming loose.
test('an archived goal keeps its rules rather than spilling them into the waiting group', () => {
  const g = goal('Ship something')
  actions.addIfThen({ trigger: 'I stall', action: 'I open today', goalId: g.id })
  actions.archiveGoal(g.id, TODAY)

  render(<NorthView />)
  expect(screen.queryByRole('region', { name: 'Rules with no goal' })).toBeNull()
})

test('a full goal is offered but refused for an unfiled rule, so nothing looks broken when pressed', () => {
  const g = goal('Ship something')
  for (let i = 0; i < MAX_RULES_PER_GOAL; i++) {
    actions.addIfThen({ trigger: `Trigger ${i}`, action: `Action ${i}`, goalId: g.id })
  }
  actions.addIfThen({ trigger: 'Waiting', action: 'For room' })

  render(<NorthView />)
  const unfiled = screen.getByRole('region', { name: 'Rules with no goal' })
  expect(within(unfiled).getByRole('button', { name: 'Ship something' })).toBeDisabled()
})

test('deleting a rule takes two presses, and the first one says so', async () => {
  const user = userEvent.setup()
  const g = goal('Ship something')
  actions.addIfThen({ trigger: 'I stall', action: 'I open today', goalId: g.id })
  render(<NorthView />)

  await user.click(screen.getByRole('button', { name: 'Delete "I stall"' }))
  expect(getData().ifThens).toHaveLength(1)

  await user.click(screen.getByRole('button', { name: 'Confirm delete "I stall"' }))
  expect(getData().ifThens).toHaveLength(0)
})

test('editing a rule rewrites it in place rather than adding a second one', async () => {
  const user = userEvent.setup()
  const g = goal('Ship something')
  actions.addIfThen({ trigger: 'Old trigger', action: 'Old action', goalId: g.id })
  render(<NorthView />)

  await user.click(screen.getByRole('button', { name: 'Edit "Old trigger"' }))
  await user.clear(screen.getByLabelText('If'))
  await user.type(screen.getByLabelText('If'), 'New trigger')
  await user.click(screen.getByRole('button', { name: 'Save' }))

  expect(getData().ifThens).toHaveLength(1)
  expect(getData().ifThens[0].trigger).toBe('New trigger')
  expect(getData().ifThens[0].goalId).toBe(g.id)
})

/**
 * Nothing on this screen measures anything - ARCHITECTURE section 6. The one
 * number allowed near a goal is its age, which cannot be earned or lost.
 */
test('a goal shows its age and nothing else that counts', () => {
  const g = actions.addGoal({ title: 'Ship something', why: 'Because renting is not owning.', deserve: ['open the editor first'] }, '2026-09-01')!
  actions.addIfThen({ trigger: 'I stall', action: 'I open today', goalId: g.id })
  picture()
  const { container } = render(<NorthView />)

  expect(screen.getByText('5 days lived toward this')).toBeTruthy()
  expect(container.querySelector('progress, meter, input[type="checkbox"]')).toBeNull()
  expect(container.textContent).not.toMatch(/%|\b1 of \b|complete|streak/i)
})
