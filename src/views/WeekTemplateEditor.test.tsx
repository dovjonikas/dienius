import { beforeEach, describe, expect, test, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemplatesView } from './TemplatesView'
import { daysFor, WeekPreview } from './WeekTemplateEditor'
import { actions, getData } from '../lib/store'
import { defaultData } from '../lib/storage'
import type { Template } from '../lib/types'

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
  // A Wednesday, so "this day" is not accidentally the same as any of the
  // group scopes and a test that confused them would fail.
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-09-09T09:00:00'))
})

async function newWeek(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'New template' }))
  await user.click(screen.getByRole('button', { name: /^A week/ }))
}

async function addBlock(user: ReturnType<typeof userEvent.setup>, title: string) {
  await user.type(screen.getByPlaceholderText('What happens'), title)
  await user.click(screen.getByRole('button', { name: 'Add a block' }))
}

function column(label: string) {
  return screen.getByRole('region', { name: label })
}

/** Pure, and the piece every "add to" and "copy to" press is built out of. */
describe('which days a scope names', () => {
  test('this day is the one picked; the rest are the week, the weekend and all of it', () => {
    expect(daysFor('day', 3)).toEqual([3])
    expect(daysFor('weekdays', 3)).toEqual([1, 2, 3, 4, 5])
    expect(daysFor('weekend', 3)).toEqual([6, 0])
    expect(daysFor('all', 3)).toEqual([1, 2, 3, 4, 5, 6, 0])
  })
})

/**
 * A week is the unit people plan in, and it was the one thing this app could
 * not hold: building "my week" meant seven day templates, seven entries in
 * the weekday map, and seven places to edit when the gym rotation changed.
 */
describe('building a week', () => {
  test('the kind is asked once, before anything is open', async () => {
    const user = userEvent.setup()
    render(<TemplatesView />)
    await user.click(screen.getByRole('button', { name: 'New template' }))

    expect(screen.getByText('One day, or a whole week?')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Template name')).toBeNull()
    expect(screen.queryByPlaceholderText('Week name')).toBeNull()
  })

  test('a block added to this day lands on that day and nowhere else', async () => {
    const user = userEvent.setup()
    render(<TemplatesView />)
    await newWeek(user)
    await addBlock(user, 'Physio')

    expect(within(column('Wednesday')).getByText('Physio')).toBeInTheDocument()
    expect(within(column('Monday')).queryByText('Physio')).toBeNull()
  })

  test('a block added to the weekdays lands on five, sharing one group', async () => {
    const user = userEvent.setup()
    render(<TemplatesView />)
    await newWeek(user)
    await user.click(screen.getByRole('button', { name: 'Weekdays' }))
    await addBlock(user, 'Commute')
    await user.type(screen.getByPlaceholderText('Week name'), 'My week')
    await user.click(screen.getByRole('button', { name: 'Save template' }))

    const saved = getData().templates[0]
    expect(saved.kind).toBe('week')
    const commutes = saved.blocks.filter(b => b.title === 'Commute')
    expect(commutes.map(b => b.weekday).sort()).toEqual([1, 2, 3, 4, 5])
    expect(new Set(commutes.map(b => b.groupId)).size).toBe(1)
    // Fifteen seconds of its own, for the reason the two tests in
    // Scratch.test.tsx and NorthView.test.tsx already have theirs: this one
    // types a week's name and a block's through real key presses and draws
    // seven day pictures for every keystroke, which is 1.5s alone and over
    // the runner's five-second default when a hundred and forty-eight files
    // are rendering beside it. Nothing it asserts has changed.
  }, 15000)

  /**
   * A group only exists where there is something to group. Giving one block
   * a group of one would mean the edit scope question appears for a block
   * that has nowhere else to apply.
   */
  test('a block on one day joins no group', async () => {
    const user = userEvent.setup()
    render(<TemplatesView />)
    await newWeek(user)
    await addBlock(user, 'Physio')
    await user.type(screen.getByPlaceholderText('Week name'), 'My week')
    await user.click(screen.getByRole('button', { name: 'Save template' }))

    expect(getData().templates[0].blocks[0].groupId).toBeUndefined()
    expect(screen.queryByRole('group', { name: 'Edits apply to' })).toBeNull()
  })
})

/**
 * The scope of an edit is a standing choice above the columns, not a dialog
 * per press. A confirmation that appears every single time you touch a
 * grouped block is a confirmation people learn to dismiss without reading -
 * the same reasoning, and the same words, as the repeat scope in the task
 * detail sheet.
 */
describe('editing something that is on several days', () => {
  test('the scope question appears only once something is grouped', async () => {
    const user = userEvent.setup()
    render(<TemplatesView />)
    await newWeek(user)
    expect(screen.queryByRole('group', { name: 'Edits apply to' })).toBeNull()

    await user.click(screen.getByRole('button', { name: 'All days' }))
    await addBlock(user, 'Commute')
    expect(screen.getByRole('group', { name: 'Edits apply to' })).toBeInTheDocument()
  })

  test('removing one takes it off every day it is on, by default', async () => {
    const user = userEvent.setup()
    render(<TemplatesView />)
    await newWeek(user)
    await user.click(screen.getByRole('button', { name: 'All days' }))
    await addBlock(user, 'Commute')

    // Seven of them, one per column, and pressing any one is the same press.
    await user.click(
      within(column('Wednesday')).getByRole('button', { name: 'Remove Commute from every day it is on' }),
    )
    expect(screen.queryByText('Commute')).toBeNull()
  })

  test('and just this day when that is what was asked for', async () => {
    const user = userEvent.setup()
    render(<TemplatesView />)
    await newWeek(user)
    await user.click(screen.getByRole('button', { name: 'All days' }))
    await addBlock(user, 'Commute')

    await user.click(screen.getByRole('button', { name: 'Just this day' }))
    await user.click(screen.getByRole('button', { name: 'Remove Commute from Wednesday' }))

    expect(within(column('Wednesday')).queryByText('Commute')).toBeNull()
    expect(within(column('Monday')).getByText('Commute')).toBeInTheDocument()
  })
})

test('Copy to puts a day it has already built onto the others', async () => {
  const user = userEvent.setup()
  render(<TemplatesView />)
  await newWeek(user)
  await addBlock(user, 'Gym: Upper')

  await user.click(within(column('Wednesday')).getByRole('button', { name: 'Copy to' }))
  await user.click(within(column('Wednesday')).getByRole('button', { name: 'Weekdays' }))

  for (const day of ['Monday', 'Tuesday', 'Thursday', 'Friday']) {
    expect(within(column(day)).getByText('Gym: Upper'), day).toBeInTheDocument()
  }
  expect(within(column('Saturday')).queryByText('Gym: Upper')).toBeNull()
})

/**
 * A week is not seven copies of the same day: Saturday is a rest day and
 * Wednesday is a night shift, and both are the same template.
 */
test('a column can name its own day type, and absent means the week\'s own', async () => {
  const user = userEvent.setup()
  render(<TemplatesView />)
  await newWeek(user)
  // The column shows its type and hides the choosing, the same as the day
  // editor above it - see the day type note in WeekTemplateEditor.
  await user.click(screen.getByRole('button', { name: 'Day type for Saturday: Week default. Change' }))
  await user.selectOptions(screen.getByLabelText('Day type for Saturday'), 'rest')
  await user.type(screen.getByPlaceholderText('Week name'), 'My week')
  await user.click(screen.getByRole('button', { name: 'Save template' }))

  const saved = getData().templates[0]
  expect(saved.weekDays).toEqual({ 6: { type: 'rest' } })
})

/**
 * Most weeks are one shape with three differences in it, and typing the shape
 * seven times to get at the differences is the work this feature exists to
 * remove. It copies rather than converting: a person trying this out should
 * not lose the day template that already worked.
 */
test('a week can start from a day template, and leaves that template alone', async () => {
  const user = userEvent.setup()
  actions.addTemplate({
    name: 'Workday',
    color: '#a7c4f5',
    blocks: [{ title: 'Standup', time: '09:00' }, { title: 'Lunch', time: '13:00' }],
  })
  render(<TemplatesView />)
  await user.click(screen.getByRole('button', { name: 'New template' }))
  await user.click(screen.getByRole('button', { name: 'Workday' }))

  expect(screen.getByPlaceholderText('Week name')).toHaveValue('Workday week')
  // Twice per column since v2.5: once in the list of blocks and once in the
  // little day the column draws - see TemplateTimeline.
  expect(within(column('Monday')).getAllByText('Standup').length).toBeGreaterThan(0)
  expect(within(column('Sunday')).getAllByText('Standup').length).toBeGreaterThan(0)

  await user.click(screen.getByRole('button', { name: 'Save template' }))
  expect(getData().templates).toHaveLength(2)
  expect(getData().templates.find(t => t.name === 'Workday')?.kind).toBeUndefined()
  expect(getData().templates.find(t => t.name === 'Workday week')?.blocks).toHaveLength(14)
})

/**
 * A day template's card says its first four titles, which is the whole of
 * what there is to say about one. "23 blocks" says nothing about a week; the
 * shape does.
 */
test('a week template\'s card shows its shape rather than its first four titles', () => {
  const template: Template = {
    id: 'wk',
    name: 'My week',
    color: '#a7c4f5',
    kind: 'week',
    blocks: [
      { id: '1', title: 'A', weekday: 1 },
      { id: '2', title: 'B', weekday: 1 },
      { id: '3', title: 'C', weekday: 6 },
    ],
  }
  render(<WeekPreview template={template} />)
  expect(screen.getByLabelText('Mon 2, Tue 0, Wed 0, Thu 0, Fri 0, Sat 1, Sun 0')).toBeInTheDocument()
})

/**
 * A week is where a library binding earns its keep: "Reading on six days from
 * MIND and on the Wednesday from CRAFT" is a sentence about a week and cannot
 * be said with a day template at all.
 */
test('a block can be bound to a library list as it is added, and says which', async () => {
  const user = userEvent.setup()
  const mind = actions.addLibraryList({ name: 'MIND', unit: 'chapter' })
  actions.addLibraryItem(mind.id, 'Sapiens, 20 chapters')
  render(<TemplatesView />)
  await newWeek(user)

  await user.selectOptions(screen.getByLabelText('What the new block draws from'), mind.id)
  await user.click(within(screen.getByRole('group', { name: 'Add to' })).getByRole('button', { name: 'All days' }))
  await addBlock(user, 'Reading')

  expect(within(column('Monday')).getByText('from MIND')).toBeInTheDocument()

  await user.type(screen.getByPlaceholderText('Week name'), 'My week')
  await user.click(screen.getByRole('button', { name: 'Save template' }))
  expect(getData().templates[0].blocks.every(b => b.libraryListId === mind.id)).toBe(true)
})

// The control is not there at all while the library is empty, so a template
// editor stays a template editor for the many people who never build a list.
test('there is nothing to bind to while the library is empty', async () => {
  const user = userEvent.setup()
  render(<TemplatesView />)
  await newWeek(user)
  expect(screen.queryByLabelText('What the new block draws from')).toBeNull()
})

/**
 * The owner's report, in their words: with Add to chosen, you have to be
 * able to see which one is chosen. Four chips that look identical are four
 * chips that make somebody guess which day a block is about to land on -
 * and the guess is only settled after the block has already landed.
 *
 * `aria-pressed` was always right; the paint was not, because the generic
 * rule for buttons in this row is more specific than `.chip.selected` and
 * gave all four the same border. The class is asserted here because a test
 * cannot see a border, and the rule that paints it keys off the same
 * attribute.
 */
test('the chosen Add to says so, and choosing another moves the mark', async () => {
  const user = userEvent.setup()
  render(<TemplatesView />)
  await newWeek(user)
  const where = within(screen.getByRole('group', { name: 'Add to' }))

  const pressed = () =>
    where
      .getAllByRole('button')
      .filter(b => b.getAttribute('aria-pressed') === 'true')
      .map(b => b.textContent)

  // The first chip is whichever day the editor opened on - today's.
  const today = pressed()[0]!
  expect(where.getByRole('button', { name: today })).toHaveClass('selected')

  await user.click(where.getByRole('button', { name: 'Weekdays' }))
  expect(pressed()).toEqual(['Weekdays'])
  expect(where.getByRole('button', { name: 'Weekdays' })).toHaveClass('selected')
  expect(where.getByRole('button', { name: today })).not.toHaveClass('selected')
})

/**
 * The week editor's own answer to "what is already taken". "Add to" is one
 * question about several days at once, so the hours the time field calls
 * taken are the hours taken on the days this press would land on - and they
 * change when the scope does, because that is a different question.
 */
test('the hour column speaks about the days the block would land on', async () => {
  const user = userEvent.setup()
  render(<TemplatesView />)
  await newWeek(user)
  await user.type(screen.getByPlaceholderText('09:00'), '09:00')
  await addBlock(user, 'Standup')

  await user.click(screen.getByRole('button', { name: 'Block time: pick from a list' }))
  expect(within(screen.getByRole('listbox', { name: 'Hour' })).getByRole('option', { name: /^09, .* taken/ })).toBeInTheDocument()

  // Nothing has been put on a Saturday or a Sunday, so nine o'clock is free
  // the moment the question is about those two days instead.
  await user.click(screen.getByRole('button', { name: 'Weekend' }))
  await user.click(screen.getByRole('button', { name: 'Block time: pick from a list' }))
  expect(within(screen.getByRole('listbox', { name: 'Hour' })).getByRole('option', { name: '09' })).toBeInTheDocument()
})

// A note on a block of a week template. The panel is drawn under all seven
// columns rather than inside one of them - see the comment in the editor.

test('a block on a column carries a note, written in one panel under the week', async () => {
  const user = userEvent.setup()
  render(<TemplatesView />)
  await newWeek(user)
  await user.type(screen.getByPlaceholderText('Week name'), 'My week')
  await addBlock(user, 'Meal')

  await user.click(within(column('Wednesday')).getByRole('button', { name: 'Add a note or steps to Meal on Wednesday' }))
  await user.type(screen.getByLabelText('Note on Meal'), 'Rice and chicken')
  await user.click(screen.getByRole('button', { name: 'Save template' }))

  const blocks = getData().templates[0].blocks
  expect(blocks).toHaveLength(1)
  expect(blocks[0].note).toBe('Rice and chicken')
})

test('a note on a block added to every day is written onto all seven at once', async () => {
  const user = userEvent.setup()
  render(<TemplatesView />)
  await newWeek(user)
  await user.type(screen.getByPlaceholderText('Week name'), 'My week')
  await user.click(screen.getByRole('button', { name: 'All days' }))
  await addBlock(user, 'Morning routine')

  await user.click(
    within(column('Monday')).getByRole('button', { name: 'Add a note or steps to Morning routine on Monday' }),
  )
  // One event rather than 29: every keystroke here redraws seven columns
  // and the timeline over them, which is fine at human speed and slow enough
  // under a loaded test run to reach the timeout.
  await user.click(screen.getByLabelText('Note on Morning routine'))
  await user.paste('Water, light, out of the room')
  await user.click(screen.getByRole('button', { name: 'Save template' }))

  const blocks = getData().templates[0].blocks
  expect(blocks).toHaveLength(7)
  // The standing scope above the columns is "every day it is on", and a note
  // follows it exactly as a removal does.
  expect(blocks.every(b => b.note === 'Water, light, out of the room')).toBe(true)
})

test('a step added to a block on a week template reaches every day it is on', async () => {
  const user = userEvent.setup()
  render(<TemplatesView />)
  await newWeek(user)
  await user.type(screen.getByPlaceholderText('Week name'), 'My week')
  await user.click(screen.getByRole('button', { name: 'All days' }))
  await addBlock(user, 'Morning routine')

  await user.click(
    within(column('Monday')).getByRole('button', { name: 'Add a note or steps to Morning routine on Monday' }),
  )
  await user.type(screen.getByLabelText('Add a step to Morning routine'), 'Meditation 10 min{Enter}')
  await user.click(screen.getByRole('button', { name: 'Save template' }))

  const blocks = getData().templates[0].blocks
  expect(blocks).toHaveLength(7)
  expect(blocks.every(b => b.steps?.[0].title === 'Meditation' && b.steps?.[0].minutes === 10)).toBe(true)
})
