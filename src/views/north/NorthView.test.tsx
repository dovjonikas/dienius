import { beforeEach, expect, test, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NorthView } from './NorthView'
import { actions, getData } from '../../lib/store'
import { defaultData } from '../../lib/storage'
import { activeGoals, deserveForWeek } from '../../lib/north'
import { MAX_ACTIVE_GOALS, MAX_RULES_PER_GOAL } from '../../lib/types'

const TODAY = '2026-09-05'

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date(`${TODAY}T09:00:00`))
})

function goal(title: string, more: { why?: string; identity?: string; deserve?: string[]; avoid?: string[] } = {}) {
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

/**
 * Compose, opened. Since v2.19 everything that writes anything is behind it -
 * the reading page is what somebody wrote and nothing that acts.
 */
async function compose(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Compose' }))
}

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

// Four fields typed one keystroke at a time under fake timers is the slowest
// interaction in this file: at a hundred and fifteen characters it crossed
// the five-second budget with a browser pass running beside it. Shorter
// words, and its own timeout - the budget is for hangs, not for typing.
test('Write one down opens Compose on a blank goal, and Save writes it with what you do to deserve it', async () => {
  const user = userEvent.setup()
  picture()
  render(<NorthView />)
  await user.click(screen.getByRole('button', { name: 'Write one down' }))

  expect(screen.getByLabelText('What')).toHaveFocus()
  await user.type(screen.getByLabelText('What'), 'Be strong at fifty')
  await user.type(screen.getByLabelText('Why it matters'), 'Dad stopped moving.')
  await user.type(screen.getByLabelText('Who it makes you'), 'Someone who trains.')
  await user.type(screen.getByLabelText('What I do to deserve this'), 'train four times{Enter}walk')
  await user.click(screen.getByRole('button', { name: 'Save' }))

  const [written] = getData().goals
  expect(written).toMatchObject({
    title: 'Be strong at fifty',
    why: 'Dad stopped moving.',
    identity: 'Someone who trains.',
    deserve: ['train four times', 'walk'],
    createdAt: TODAY,
  })
  // Back to reading: the goal, its lines as a plain list, and no form.
  expect(screen.getByRole('heading', { name: 'Be strong at fifty' })).toBeInTheDocument()
  const items = screen.getAllByRole('listitem').map(li => li.textContent)
  expect(items).toEqual(expect.arrayContaining(['train four times', 'walk']))
  expect(screen.queryByLabelText('What')).toBeNull()
}, 15_000)

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

// Fifteen seconds rather than the runner's five. Compose types a picture and
// four goals through real key presses, which is four seconds on its own and
// past five once the suite runs a hundred and forty files in parallel - the
// same trade the 20MB import test makes, for the same reason.
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
}, 15_000)

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
  expect(screen.getByText(`${MAX_ACTIVE_GOALS} is the limit - archive one to make room.`)).toBeInTheDocument()

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
  // A head that says what the list is, in the voice everything under it is
  // written in - see the whole-page voice test at the foot of this file.
  expect(within(card).getByText('What I do')).toBeInTheDocument()
  expect(within(card).getAllByRole('listitem').map(li => li.textContent)).toEqual(['train four times a week', 'sleep by eleven'])
  expect(container.querySelector('input[type="checkbox"], progress, meter')).toBeNull()
})

test('a goal with nothing written to deserve it says so once, quietly, and shows no pair at all', () => {
  goal('Be strong at fifty')
  render(<NorthView />)
  const card = screen.getByRole('heading', { name: 'Be strong at fifty' }).closest('article')!
  // No heads either: a column head over nothing is a label announcing an
  // empty section, which is the shape this window was rebuilt away from.
  expect(within(card).queryByText('What I do')).toBeNull()
  expect(within(card).queryByText(/don't do/)).toBeNull()
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

/**
 * A goal with no rules yet spent four lines saying so: a head, two sentences
 * of instruction, and a button. Four goals is that four times, which is most
 * of a window given over to nothing. The head is the control now, and the
 * instruction lives in the form it was describing.
 */
test('a goal with no rules spends one line on saying so, and the instruction lives in the form', async () => {
  const user = userEvent.setup()
  goal('Ship something people keep using')
  render(<NorthView />)
  const card = screen.getByRole('heading', { name: 'Ship something people keep using' }).closest('article')!

  // No head over nothing, and no instruction on the card.
  expect(within(card).queryByRole('heading', { name: 'What pulls me off this' })).toBeNull()
  expect(within(card).queryByText(/Name one moment that takes you off this/)).toBeNull()
  const invite = within(card).getByRole('button', { name: /What pulls me off this/ })

  // And it opens the form, which is where the instruction is.
  await user.click(invite)
  expect(screen.getByText('A moment you can catch: where you are, what just happened.')).toBeInTheDocument()
  expect(within(card).getByRole('heading', { name: 'What pulls me off this' })).toBeInTheDocument()
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
  expect(screen.getByText(`${MAX_RULES_PER_GOAL} is the limit - delete one to make room.`)).toBeTruthy()
})

test('a rule written before rules had goals waits in its own group, and one press files it', async () => {
  const user = userEvent.setup()
  const g = goal('Ship something')
  const orphan = actions.addIfThen({ trigger: 'I get home and the kitchen is a mess', action: 'I do only the sink' })!
  render(<NorthView />)
  await compose(user)

  const unfiled = screen.getByRole('region', { name: 'Rules with no goal' })
  expect(within(unfiled).getByText(/I get home and the kitchen is a mess/)).toBeTruthy()

  await user.click(within(unfiled).getByRole('button', { name: 'Ship something' }))
  expect(getData().ifThens.find(e => e.id === orphan.id)?.goalId).toBe(g.id)
  expect(screen.queryByRole('region', { name: 'Rules with no goal' })).toBeNull()
})

// A dangling id degrades everywhere in this app, and degrading here means the
// rule comes back to the waiting group rather than disappearing with the goal.
test('a rule whose goal was deleted comes back as unfiled rather than vanishing', async () => {
  const user = userEvent.setup()
  const g = goal('Ship something')
  actions.addIfThen({ trigger: 'I stall', action: 'I open today', goalId: g.id })
  actions.archiveGoal(g.id, TODAY)
  actions.deleteGoal(g.id)

  render(<NorthView />)
  await compose(user)
  const unfiled = screen.getByRole('region', { name: 'Rules with no goal' })
  expect(within(unfiled).getByText(/I stall/)).toBeTruthy()
})

// Archiving a direction is not deciding the things that pull you off it never
// happened, so its rules stay with it instead of coming loose.
test('an archived goal keeps its rules rather than spilling them into the waiting group', async () => {
  const user = userEvent.setup()
  const g = goal('Ship something')
  actions.addIfThen({ trigger: 'I stall', action: 'I open today', goalId: g.id })
  actions.archiveGoal(g.id, TODAY)

  render(<NorthView />)
  // Asked where the waiting group lives, so the null means "it is not
  // waiting" rather than "this page never had one".
  await compose(user)
  expect(screen.queryByRole('region', { name: 'Rules with no goal' })).toBeNull()
})

test('a full goal is offered but refused for an unfiled rule, so nothing looks broken when pressed', async () => {
  const user = userEvent.setup()
  const g = goal('Ship something')
  for (let i = 0; i < MAX_RULES_PER_GOAL; i++) {
    actions.addIfThen({ trigger: `Trigger ${i}`, action: `Action ${i}`, goalId: g.id })
  }
  actions.addIfThen({ trigger: 'Waiting', action: 'For room' })

  render(<NorthView />)
  await compose(user)
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
test('leaving Compose puts focus back on the Compose control', async () => {
  const user = userEvent.setup()
  picture()
  render(<NorthView />)
  await user.click(screen.getByRole('button', { name: 'Compose' }))
  await user.keyboard('{Escape}')
  expect(screen.getByRole('button', { name: 'Compose' })).toHaveFocus()
})

/**
 * The pair: what he does, and what he does not, on one goal.
 *
 * docs/RESEARCH-NORTH.md is the argument. Oyserman's *balance* - an expected
 * self predicts behaviour far better when it is held against a feared self in
 * the same domain, and the unpaired case is the one that predicts the worse
 * outcome - is why they are one block about one goal rather than two sections
 * of a page. Witte's model is why the away half is never drawn alone: threat
 * without efficacy produces avoidance rather than action.
 */
test('a goal shows what I do and what I do not, together, on the same card', () => {
  goal('A dad my kid can tell anything', {
    deserve: ['10 min sitting before anyone is up', 'listen without making a face'],
    avoid: ['make a face at bad news', 'go quiet for a day'],
  })
  render(<NorthView />)
  const card = screen.getByRole('heading', { name: 'A dad my kid can tell anything' }).closest('article')!

  expect(within(card).getByText('What I do')).toBeInTheDocument()
  expect(within(card).getByText("What I don't do")).toBeInTheDocument()
  expect(within(card).getAllByRole('listitem').map(li => li.textContent)).toEqual([
    '10 min sitting before anyone is up',
    'listen without making a face',
    'make a face at bad news',
    'go quiet for a day',
  ])
})

test('the away half is never drawn without the doing half beside it', () => {
  // The shape Witte's model says backfires: a threat with no answer next to
  // it. A goal carrying only the away lines shows neither head and falls
  // back to the invitation to write the doing half.
  goal('A dad my kid can tell anything', { avoid: ['go quiet for a day'] })
  render(<NorthView />)
  const card = screen.getByRole('heading', { name: 'A dad my kid can tell anything' }).closest('article')!

  expect(within(card).queryByText("What I don't do")).toBeNull()
  expect(within(card).queryByText('go quiet for a day')).toBeNull()
  expect(within(card).getByText(/Two to four things you do most days/)).toBeInTheDocument()
})

test('a goal with only the doing half shows it alone, with no empty column beside it', () => {
  goal('A dad my kid can tell anything', { deserve: ['listen without making a face'] })
  render(<NorthView />)
  const card = screen.getByRole('heading', { name: 'A dad my kid can tell anything' }).closest('article')!

  expect(within(card).getByText('What I do')).toBeInTheDocument()
  expect(within(card).queryByText("What I don't do")).toBeNull()
})

/**
 * The page is one person's own writing, so it is written in one voice.
 *
 * v2.18 shipped the pair as "He does" and "He doesn't" over lines somebody
 * had written as "hate the waiting, not me", and the owner read the seam
 * straight away: the app had started narrating them. This holds the whole
 * rendered window against that, with every layer on screen at once, because
 * the failure was one heading and the next one will be a different heading.
 */
test('nothing on the page talks about its owner in the third person', () => {
  picture()
  goal('A dad my kid can tell anything', {
    why: 'Because I want to be told things while they are still small.',
    identity: 'I hear things without making them worse.',
    deserve: ['10 min sitting before anyone is up'],
    avoid: ['go quiet for a day'],
  })
  const { container } = render(<NorthView />)

  expect(container.textContent).not.toMatch(/\b(he|his|him|she|hers)\b/i)
})

/**
 * And the rule the whole feature hangs on - research section 5. The goal
 * stays an approach goal; the away half is a contrast inside it. Avoidance
 * goals are their own well replicated literature and they cost wellbeing, so
 * nothing outside this window reads these lines: not the day view, not the
 * Monday card, not the evening close.
 */
test('nothing the day carries reads the away half', () => {
  goal('A dad my kid can tell anything', {
    deserve: ['listens without making a face'],
    avoid: ['goes quiet for a day'],
  })
  const [written] = getData().goals
  expect(written.avoid).toEqual(['goes quiet for a day'])
  // deserveForWeek is what the Monday card takes, and it takes from deserve.
  expect(deserveForWeek(written, '2026-08-31')).toBe('listens without making a face')
})

/**
 * What pulls you off a goal is written where everything else about that goal
 * is written - see GoalRules.tsx. It lived on the card until v2.19, with a
 * heading, an invitation and two controls per rule, which is a form on a
 * page that is meant to be somebody's own writing.
 */
test('a rule is written in Compose, and reads back under the goal it belongs to', async () => {
  const user = userEvent.setup()
  const ship = goal('Ship something people keep using')
  goal('Be strong at forty')
  render(<NorthView />)

  await compose(user)
  // One per goal, beside the field it is about - and nowhere on the page
  // somebody reads.
  expect(screen.getAllByText('Name one moment that takes you off this, and the one thing you do instead.')).toHaveLength(2)

  await user.click(screen.getByRole('button', { name: 'What pulls me off "Ship something people keep using"' }))
  await user.type(screen.getByLabelText('If'), 'I open the laptop and stall')
  // Enter from either field is the rule form's own way out, and the
  // unambiguous one now that it sits inside a form with a Save of its own.
  await user.type(screen.getByLabelText('Then'), 'I open today and do the first unticked thing{Enter}')

  expect(getData().ifThens).toHaveLength(1)
  expect(getData().ifThens[0].goalId).toBe(ship.id)

  // And back on the page, it is under the goal it protects and no other.
  await user.click(screen.getByRole('button', { name: 'Cancel' }))
  const card = screen.getByRole('heading', { name: 'Ship something people keep using' }).closest('article')!
  const other = screen.getByRole('heading', { name: 'Be strong at forty' }).closest('article')!
  expect(within(card).getByText(/I open the laptop and stall/)).toBeTruthy()
  expect(within(other).queryByText(/I open the laptop and stall/)).toBeNull()
})

/**
 * Deleting a goal leaves its rules behind on purpose - a sentence somebody
 * wrote about themselves should not go quietly with the goal it was filed
 * under. They wait in Compose, beside the fold that orphaned them, because
 * filing one is a form and nothing on the reading page acts.
 */
test('a rule whose goal was deleted waits in Compose, and one press files it', async () => {
  const user = userEvent.setup()
  const gone = goal('A goal on its way out')
  const kept = goal('Ship something people keep using')
  actions.addIfThen({ trigger: 'I get home and the kitchen is a mess', action: 'I do only the sink', goalId: gone.id })
  actions.deleteGoal(gone.id)
  render(<NorthView />)

  // Nothing about it on the page somebody reads.
  expect(screen.queryByText(/the kitchen is a mess/)).toBeNull()

  await user.click(screen.getByRole('button', { name: 'Compose' }))
  const orphans = screen.getByRole('region', { name: 'Rules with no goal' })
  expect(within(orphans).getByText(/the kitchen is a mess/)).toBeInTheDocument()

  await user.click(within(orphans).getByRole('button', { name: 'Ship something people keep using' }))
  expect(getData().ifThens[0].goalId).toBe(kept.id)
})
