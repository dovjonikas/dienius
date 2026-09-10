import { beforeEach, describe, expect, test, vi } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
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
  addedAt = 6
})

async function newWeek(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'New template' }))
  await user.click(screen.getByRole('button', { name: /^A week/ }))
}

/**
 * A block, at a time of its own.
 *
 * The time matters now: a block without one is not on the week picture at
 * all, because there is nowhere on a clock to draw it - it goes under its
 * column as an untimed chip instead. Every block a person makes has a time,
 * so the tests make them that way too. The times climb in the order blocks
 * are added, which is also the order anything sorted by time reports them in.
 */
let addedAt = 6

/**
 * Opens the add row if an open block has folded it away - see addOpen in
 * WeekTemplateEditor. A test that adds a second block while reading the
 * first does what a person does: presses the one line that brings the form
 * back. Both the folded line and the form button answer to the same words,
 * because they are the same job, and they are never on screen together.
 */
async function openAddRow(user: ReturnType<typeof userEvent.setup>) {
  if (document.querySelector('.block-add')) return
  await user.click(screen.getByRole('button', { name: 'Add a block' }))
}

async function addBlockAt(user: ReturnType<typeof userEvent.setup>, time: string, title: string) {
  await openAddRow(user)
  await user.clear(screen.getByPlaceholderText('09:00'))
  await user.type(screen.getByPlaceholderText('09:00'), time)
  await user.type(screen.getByPlaceholderText('What happens'), title)
  await user.click(screen.getByRole('button', { name: 'Add a block' }))
}

async function addBlock(user: ReturnType<typeof userEvent.setup>, title: string) {
  await openAddRow(user)
  await user.clear(screen.getByPlaceholderText('09:00'))
  await user.type(screen.getByPlaceholderText('09:00'), `${String(addedAt).padStart(2, '0')}:00`)
  addedAt = addedAt >= 22 ? 6 : addedAt + 1
  await user.type(screen.getByPlaceholderText('What happens'), title)
  await user.click(screen.getByRole('button', { name: 'Add a block' }))
}

/**
 * Opens a block from the week picture. Its controls - Key, Note, Remove -
 * live in the panel under the grid rather than on the block itself, because
 * a column is a seventh of the editor and four controls do not fit in one.
 */
async function openBlock(user: ReturnType<typeof userEvent.setup>, day: string, title: string) {
  await user.click(within(column(day)).getByRole('button', { name: new RegExp(`^${title}[ ,]`) }))
}

/**
 * The two places the binding control now lives, told apart.
 *
 * Both carry the visible label the owner asked for, so both answer to
 * "Library list" and a bare query finds two. On screen they are never
 * confusable - one sits under the block's own name and the other under
 * WHAT, where a block is being composed - but a test has to say which.
 */
function openBlockPanel() {
  const panel = document.querySelector('.wt-note')
  if (!panel) throw new Error('no block is open')
  return within(panel as HTMLElement)
}

function addRow() {
  const row = document.querySelector('.block-add')
  if (!row) throw new Error('no add row')
  return within(row as HTMLElement)
}

/**
 * The day switches and their presets, queried fresh every time.
 *
 * Captured once into a const, this went stale: the add row unmounts when a
 * block is opened and mounts again when it is asked for, so a held node
 * points at a detached tree and every press on it silently does nothing.
 * A test then failed three assertions later, on a block that had landed on
 * the wrong day for a reason nothing near the failure mentioned.
 */
function whereRow() {
  return within(screen.getByRole('group', { name: 'Add to' }))
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
    await openBlock(user, 'Wednesday', 'Commute')
    await user.click(
      screen.getByRole('button', { name: 'Remove Commute from every day it is on' }),
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
    await openBlock(user, 'Wednesday', 'Commute')
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

  await user.selectOptions(addRow().getByLabelText('Library list'), mind.id)
  await user.click(within(screen.getByRole('group', { name: 'Add to' })).getByRole('button', { name: 'All days' }))
  await addBlock(user, 'Reading')

  expect(within(column('Monday')).getByText('from MIND')).toBeInTheDocument()

  await user.type(screen.getByPlaceholderText('Week name'), 'My week')
  await user.click(screen.getByRole('button', { name: 'Save template' }))
  expect(getData().templates[0].blocks.every(b => b.libraryListId === mind.id)).toBe(true)
})

// While the library is empty there is nothing to choose from, so no select
// is drawn - but there is a way to make one, which there was not until
// v2.17. The old shape of this test asserted the control was absent
// entirely; that was the behaviour the owner asked to keep and then asked
// to change, once it turned out that a first template is built against an
// empty library by definition.
test('an empty library offers no choice, and a way to make one', async () => {
  const user = userEvent.setup()
  render(<TemplatesView />)
  await newWeek(user)
  expect(addRow().queryByLabelText('Library list')).toBeNull()
  expect(addRow().getByRole('button', { name: 'Make a list' })).toBeInTheDocument()
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
/** Which day switches are on, by name, in week order. */
function switchedOn() {
  return within(screen.getByRole('group', { name: 'Add to' }))
    .getAllByRole('button')
    .filter(b => b.getAttribute('aria-pressed') === 'true')
    .map(b => b.getAttribute('aria-label'))
}

test('the switches open on the column being worked in, and each one is its own answer', async () => {
  const user = userEvent.setup()
  render(<TemplatesView />)
  await newWeek(user)

  // The editor opens on today, which the fake clock pins to a Wednesday.
  expect(switchedOn()).toEqual(['Wednesday'])
  expect(screen.getByText('Adds to Wed')).toBeInTheDocument()

  // A day is a switch, not a choice among four: turning Saturday on leaves
  // Wednesday on. This is the whole point - a rotation has no name.
  await user.click(whereRow().getByRole('button', { name: 'Saturday' }))
  expect(switchedOn()).toEqual(['Wednesday', 'Saturday'])
  expect(screen.getByText('Adds to Wed, Sat')).toBeInTheDocument()

  await user.click(whereRow().getByRole('button', { name: 'Wednesday' }))
  expect(switchedOn()).toEqual(['Saturday'])
})

test('a preset sets the switches, and shows what it set', async () => {
  const user = userEvent.setup()
  render(<TemplatesView />)
  await newWeek(user)

  await user.click(whereRow().getByRole('button', { name: 'Weekdays' }))
  expect(switchedOn()).toEqual(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'])
  expect(screen.getByText('Adds to 5 days')).toBeInTheDocument()

  // It sets rather than adds: the weekend is the weekend, not the weekend
  // plus whatever was on before it.
  await user.click(whereRow().getByRole('button', { name: 'Weekend' }))
  expect(switchedOn()).toEqual(['Saturday', 'Sunday'])
  expect(screen.getByText('Adds to Sat, Sun')).toBeInTheDocument()

  await user.click(whereRow().getByRole('button', { name: 'All days' }))
  expect(switchedOn()).toHaveLength(7)
  expect(screen.getByText('Adds to every day')).toBeInTheDocument()
})

test('a rotation is set once and holds for the next block', async () => {
  const user = userEvent.setup()
  render(<TemplatesView />)
  await newWeek(user)
  await user.type(screen.getByPlaceholderText('Week name'), 'My week')

  // Mon and Thu - the shape that took two passes per block before this.
  await user.click(whereRow().getByRole('button', { name: 'Monday' }))
  await user.click(whereRow().getByRole('button', { name: 'Wednesday' }))
  await user.click(whereRow().getByRole('button', { name: 'Thursday' }))
  expect(switchedOn()).toEqual(['Monday', 'Thursday'])

  await addBlock(user, 'Training A')
  // Still Mon and Thu. The next block in the rotation is a title and Enter.
  expect(switchedOn()).toEqual(['Monday', 'Thursday'])
  await addBlock(user, 'Training B')

  await user.click(screen.getByRole('button', { name: 'Save template' }))
  const blocks = getData().templates[0].blocks
  expect(blocks.filter(b => b.title === 'Training A').map(b => b.weekday).sort()).toEqual([1, 4])
  expect(blocks.filter(b => b.title === 'Training B').map(b => b.weekday).sort()).toEqual([1, 4])
  // Made together, so they are one group and the standing scope can act on
  // them as one - unchanged by any of this.
  const a = blocks.filter(b => b.title === 'Training A')
  expect(a[0].groupId).toBeDefined()
  expect(a[0].groupId).toBe(a[1].groupId)
  expect(a[0].groupId).not.toBe(blocks.find(b => b.title === 'Training B')!.groupId)
})

test('with no day switched on there is nothing to add to, and the button says so', async () => {
  const user = userEvent.setup()
  render(<TemplatesView />)
  await newWeek(user)
  await user.click(whereRow().getByRole('button', { name: 'Wednesday' }))

  expect(switchedOn()).toEqual([])
  expect(screen.getByText('No days chosen - nothing to add to.')).toBeInTheDocument()
  await user.type(screen.getByPlaceholderText('What happens'), 'Nowhere')
  expect(screen.getByRole('button', { name: 'Add a block' })).toBeDisabled()
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
  // addBlock gives a block its own climbing time, so this one says nine
  // for itself - the hour it then asks the column about.
  await addBlockAt(user, '09:00', 'Standup')

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

  await openBlock(user, 'Wednesday', 'Meal')
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

  await openBlock(user, 'Monday', 'Morning routine')
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

test('one press goes back to a single day, from whatever a preset left on', async () => {
  const user = userEvent.setup()
  render(<TemplatesView />)
  await newWeek(user)

  await user.click(whereRow().getByRole('button', { name: 'Weekdays' }))
  expect(switchedOn()).toHaveLength(5)

  // Without this, one Thursday-only block after a run of weekday blocks is
  // four switches off. It is the old "this day" scope, converted to a preset
  // the same way the other three were, and named for the day so it cannot be
  // read as the switch beside it.
  await user.click(whereRow().getByRole('button', { name: 'Just one day' }))
  expect(switchedOn()).toEqual(['Wednesday'])
})

// KEY on a week template, where the cap is a fact about a column and not
// about the template: three per day, seven days, twenty-one in all.

test('the key limit is counted per day, not per template', async () => {
  const user = userEvent.setup()
  render(<TemplatesView />)
  await newWeek(user)
  await user.type(screen.getByPlaceholderText('Week name'), 'My week')

  // Three key blocks on every day at once - twenty-one marked blocks, and
  // not one day over its three.
  await user.click(whereRow().getByRole('button', { name: 'All days' }))
  for (const title of ['Morning', 'Deep work', 'Training']) {
    await addBlock(user, title)
    await openBlock(user, 'Monday', title)
    await user.click(
      screen.getByRole('button', { name: `Mark ${title} on Monday as a key task` }),
    )
  }

  await user.click(screen.getByRole('button', { name: 'Save template' }))
  const blocks = getData().templates[0].blocks
  expect(blocks.filter(b => b.highlight)).toHaveLength(21)
  for (const day of [0, 1, 2, 3, 4, 5, 6]) {
    expect(blocks.filter(b => b.weekday === day && b.highlight), `day ${day}`).toHaveLength(3)
  }
}, 30000)

test('a fourth key block on one column is refused, and the day is named', async () => {
  const user = userEvent.setup()
  render(<TemplatesView />)
  await newWeek(user)
  await user.type(screen.getByPlaceholderText('Week name'), 'My week')

  for (const title of ['Morning', 'Deep work', 'Training', 'Reading']) {
    await addBlock(user, title)
    await openBlock(user, 'Wednesday', title)
    await user.click(
      screen.getByRole('button', { name: `Mark ${title} on Wednesday as a key task` }),
    )
  }

  expect(
    screen.getByText('Wednesday: 3 already matter here: Morning, Deep work, Training. Take one off first.'),
  ).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Save template' }))
  expect(getData().templates[0].blocks.filter(b => b.highlight)).toHaveLength(3)
}, 30000)

test('a block on five days is refused if any one of those days is full', async () => {
  const user = userEvent.setup()
  render(<TemplatesView />)
  await newWeek(user)
  await user.type(screen.getByPlaceholderText('Week name'), 'My week')

  // Wednesday alone gets three key blocks.
  await user.click(whereRow().getByRole('button', { name: 'Just one day' }))
  for (const title of ['One', 'Two', 'Three']) {
    await addBlock(user, title)
    await openBlock(user, 'Wednesday', title)
    await user.click(screen.getByRole('button', { name: `Mark ${title} on Wednesday as a key task` }))
  }

  // Then a block across all the weekdays. Monday to Friday could each take
  // one, except Wednesday - and a template that marked four things on
  // Wednesday and three everywhere else would be doing something different
  // on Wednesday without saying so.
  //
  // The last block of the loop above is still open, which folds the add
  // row - so the switches have to be brought back before they can be set,
  // which is what a person does too.
  await openAddRow(user)
  await user.click(whereRow().getByRole('button', { name: 'Weekdays' }))
  await addBlock(user, 'Everywhere')
  await openBlock(user, 'Monday', 'Everywhere')
  await user.click(screen.getByRole('button', { name: 'Mark Everywhere on Monday as a key task' }))

  expect(screen.getByText(/^Wednesday: 3 already matter here/)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Save template' }))
  expect(getData().templates[0].blocks.filter(b => b.title === 'Everywhere' && b.highlight)).toHaveLength(0)
}, 30000)

test('Return refuses what Add block refuses, rather than eating the title', async () => {
  const user = userEvent.setup()
  render(<TemplatesView />)
  await newWeek(user)

  // The one column that is on by default is the day this runs on.
  await user.click(screen.getByRole('button', { name: 'Wednesday' }))
  expect(screen.getByText('No days chosen - nothing to add to.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Add a block' })).toBeDisabled()

  const title = screen.getByPlaceholderText('What happens')
  await user.type(title, 'Gym{Enter}')

  // It made nothing, which was always true - and it used to clear the field
  // on its way past, so the press read as having worked.
  expect(title).toHaveValue('Gym')
  expect(screen.queryByRole('button', { name: /^Gym[ ,]/ })).not.toBeInTheDocument()
})

// The library binding, on a block that already exists.
//
// It lived only on the add row - "What the new block draws from" - so binding
// a list to a block that was already on the week meant removing it and making
// it again. The owner looked for it on the open block, did not find it, and
// took the feature for missing. A field a week template is precisely the place
// for: "Reading on six days from MIND and on the Wednesday from CRAFT" is a
// sentence about a week and cannot be said with a day template at all.

async function withList(name: string) {
  const list = actions.addLibraryList({ name, unit: 'chapter' })
  actions.addLibraryItem(list.id, 'Deep Work')
  return list
}

test('an existing block is bound to a list from its own panel, and the binding survives a reopen', async () => {
  const user = userEvent.setup()
  await withList('MIND')
  render(<TemplatesView />)
  await newWeek(user)
  await user.type(screen.getByPlaceholderText('Week name'), 'My week')
  await addBlock(user, 'Reading')

  await openBlock(user, 'Wednesday', 'Reading')
  await user.selectOptions(openBlockPanel().getByLabelText('Library list'), 'From MIND')
  // The line under it says what would actually land on a day, which is a book
  // and not a list - see bindingLine.
  expect(screen.getByText('Next: Deep Work')).toBeInTheDocument()

  // Closed and opened again: the answer is still there, read off the block
  // rather than off a field that happened to still be filled in.
  await user.click(screen.getByRole('button', { name: /^Close Reading/ }))
  await openBlock(user, 'Wednesday', 'Reading')
  expect(openBlockPanel().getByLabelText('Library list')).toHaveValue(getData().library[0]?.id ?? '')

  await user.click(screen.getByRole('button', { name: 'Save template' }))
  const blocks = getData().templates[0].blocks
  expect(blocks).toHaveLength(1)
  expect(blocks[0].libraryListId).toBe(getData().library[0].id)
})

test('binding a block that is on every day binds all seven, the way its note does', async () => {
  const user = userEvent.setup()
  await withList('MIND')
  render(<TemplatesView />)
  await newWeek(user)
  await user.type(screen.getByPlaceholderText('Week name'), 'My week')
  await user.click(screen.getByRole('button', { name: 'All days' }))
  await addBlock(user, 'Reading')

  await openBlock(user, 'Monday', 'Reading')
  await user.selectOptions(openBlockPanel().getByLabelText('Library list'), 'From MIND')
  await user.click(screen.getByRole('button', { name: 'Save template' }))

  const listId = getData().library[0].id
  const blocks = getData().templates[0].blocks
  expect(blocks).toHaveLength(7)
  expect(blocks.every(b => b.libraryListId === listId)).toBe(true)
})

test('a bound block can be unbound again, without being removed and rebuilt', async () => {
  const user = userEvent.setup()
  await withList('MIND')
  render(<TemplatesView />)
  await newWeek(user)
  await user.type(screen.getByPlaceholderText('Week name'), 'My week')
  await addBlock(user, 'Reading')

  await openBlock(user, 'Wednesday', 'Reading')
  await user.selectOptions(openBlockPanel().getByLabelText('Library list'), 'From MIND')
  await user.selectOptions(openBlockPanel().getByLabelText('Library list'), 'Nothing')

  expect(screen.queryByText('Next: Deep Work')).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Save template' }))
  expect(getData().templates[0].blocks[0].libraryListId).toBeUndefined()
})

test('the panel offers no binding at all while there is no library to bind to', async () => {
  const user = userEvent.setup()
  render(<TemplatesView />)
  await newWeek(user)
  await user.type(screen.getByPlaceholderText('Week name'), 'My week')
  await addBlock(user, 'Reading')

  await openBlock(user, 'Wednesday', 'Reading')
  expect(openBlockPanel().queryByLabelText('Library list')).not.toBeInTheDocument()
})

test('a block pointing at a list that is not there says nothing, rather than an empty line', async () => {
  const user = userEvent.setup()
  const list = await withList('MIND')
  render(<TemplatesView />)
  await newWeek(user)
  await user.type(screen.getByPlaceholderText('Week name'), 'My week')
  await addBlock(user, 'Reading')
  await openBlock(user, 'Wednesday', 'Reading')
  await user.selectOptions(openBlockPanel().getByLabelText('Library list'), 'From MIND')
  expect(screen.getByText('Next: Deep Work')).toBeInTheDocument()

  // Deleting a list clears it off every block that pointed at it, so this is
  // the imported-file case rather than one anybody can reach by pressing
  // things: the id survives and the list does not.
  await act(async () => {
    actions.deleteLibraryList(list.id)
  })
  expect(openBlockPanel().queryByLabelText('Library list')).not.toBeInTheDocument()
  expect(screen.queryByText(/^Next:/)).not.toBeInTheDocument()
  expect(document.querySelector('.wt-note-binding')).toBeNull()
})

// Making a list without leaving the editor.
//
// The control was hidden outright while the library was empty, which is the
// state every person is in the first time they build a template - so the one
// moment somebody wants a reading block was the one moment the app showed no
// sign that reading blocks exist. Leaving to make a list lost the draft.

test('with no library at all, the block panel still offers a way to make a list', async () => {
  const user = userEvent.setup()
  render(<TemplatesView />)
  await newWeek(user)
  await user.type(screen.getByPlaceholderText('Week name'), 'My week')
  await addBlock(user, 'Reading')
  await openBlock(user, 'Wednesday', 'Reading')

  // No select, because there is nothing to choose - and a door anyway.
  expect(openBlockPanel().queryByLabelText('Library list')).not.toBeInTheDocument()
  expect(openBlockPanel().getByRole('button', { name: 'Make a list' })).toBeInTheDocument()
})

test('a list made from the block binds that block to it, without a second choice', async () => {
  const user = userEvent.setup()
  render(<TemplatesView />)
  await newWeek(user)
  await user.type(screen.getByPlaceholderText('Week name'), 'My week')
  await addBlock(user, 'Reading')
  await openBlock(user, 'Wednesday', 'Reading')

  await user.click(openBlockPanel().getByRole('button', { name: 'Make a list' }))
  await user.type(screen.getByLabelText('List name'), 'MIND')
  await user.click(within(screen.getByRole('group', { name: 'One of them is a' })).getByRole('button', { name: 'chapter' }))
  await user.click(within(screen.getByRole('dialog', { name: 'A new list' })).getByRole('button', { name: 'Save' }))

  // The list exists, and the block is on it - one answer, not two.
  expect(getData().library.map(l => l.name)).toEqual(['MIND'])
  await user.click(screen.getByRole('button', { name: 'Save template' }))
  expect(getData().templates[0].blocks[0].libraryListId).toBe(getData().library[0].id)
})

test('the short form is derived rather than asked for, so the sheet is two answers', async () => {
  const user = userEvent.setup()
  render(<TemplatesView />)
  await newWeek(user)
  await user.type(screen.getByPlaceholderText('Week name'), 'My week')
  await addBlock(user, 'Reading')
  await openBlock(user, 'Wednesday', 'Reading')

  await user.click(openBlockPanel().getByRole('button', { name: 'Make a list' }))
  const sheet = within(screen.getByRole('dialog', { name: 'A new list' }))
  expect(sheet.queryByText('Short form')).not.toBeInTheDocument()
  await user.type(sheet.getByLabelText('List name'), 'MIND')
  await user.click(sheet.getByRole('button', { name: 'chapter' }))
  await user.click(sheet.getByRole('button', { name: 'Save' }))

  expect(getData().library[0].unitShort).toBe('ch')
})

test('the add row asks what the next block draws from, under a label somebody can read', async () => {
  const user = userEvent.setup()
  await withList('MIND')
  render(<TemplatesView />)
  await newWeek(user)
  await user.type(screen.getByPlaceholderText('Week name'), 'My week')

  // Answered before the block exists, which is what an add row is for.
  await user.selectOptions(addRow().getByLabelText('Library list'), 'From MIND')
  await addBlock(user, 'Reading')
  await user.click(screen.getByRole('button', { name: 'Save template' }))

  expect(getData().templates[0].blocks[0].libraryListId).toBe(getData().library[0].id)
})

/**
 * One thing being composed at a time.
 *
 * The block panel and the add row were both open always, which put the block
 * being read and the block being written on one screen: thirty-six controls
 * under the grid, "Library list" printed twice four hundred pixels apart, and
 * two identical dashed pluses under it. The owner's word for it was
 * overwhelmed.
 *
 * So opening a block folds the add row to the one line that opens it again,
 * and asking for it explicitly brings it back - somebody who pressed for it
 * wants both. It folds again on the next block opened.
 */
test('opening a block folds the add row away', async () => {
  const user = userEvent.setup()
  render(<TemplatesView />)
  await newWeek(user)
  await user.type(screen.getByPlaceholderText('Week name'), 'My week')
  await addBlock(user, 'Reading')
  expect(screen.getByPlaceholderText('What happens')).toBeInTheDocument()

  await openBlock(user, 'Wednesday', 'Reading')
  expect(screen.queryByPlaceholderText('What happens')).toBeNull()
  expect(document.querySelector('.block-add')).toBeNull()
})

test('and asking for it brings it back, with the block still open', async () => {
  const user = userEvent.setup()
  render(<TemplatesView />)
  await newWeek(user)
  await user.type(screen.getByPlaceholderText('Week name'), 'My week')
  await addBlock(user, 'Reading')
  await openBlock(user, 'Wednesday', 'Reading')

  await user.click(screen.getByRole('button', { name: 'Add a block' }))
  expect(screen.getByPlaceholderText('What happens')).toBeInTheDocument()
  // Both, because that is what was asked for.
  expect(document.querySelector('.wt-note')).not.toBeNull()
})

test('the next block opened folds it again, which is where the question starts over', async () => {
  const user = userEvent.setup()
  render(<TemplatesView />)
  await newWeek(user)
  await user.type(screen.getByPlaceholderText('Week name'), 'My week')
  await addBlock(user, 'Reading')
  await addBlock(user, 'Gym')

  await openBlock(user, 'Wednesday', 'Reading')
  await user.click(screen.getByRole('button', { name: 'Add a block' }))
  expect(screen.getByPlaceholderText('What happens')).toBeInTheDocument()

  await openBlock(user, 'Wednesday', 'Gym')
  expect(screen.queryByPlaceholderText('What happens')).toBeNull()
})

test('closing the block brings the add row back on its own', async () => {
  const user = userEvent.setup()
  render(<TemplatesView />)
  await newWeek(user)
  await user.type(screen.getByPlaceholderText('Week name'), 'My week')
  await addBlock(user, 'Reading')
  await openBlock(user, 'Wednesday', 'Reading')

  await user.click(screen.getByRole('button', { name: /^Close Reading/ }))
  expect(screen.getByPlaceholderText('What happens')).toBeInTheDocument()
})

/**
 * Removing a block moved to the foot of its panel and now says what it will
 * take. The label a test and a screen reader see has said this all along; the
 * eye sees it too, and it is no longer a red outline one pixel from the
 * toggle that marks a block as key.
 */
test('remove says which days it will take the block from, in words', async () => {
  const user = userEvent.setup()
  render(<TemplatesView />)
  await newWeek(user)
  await user.type(screen.getByPlaceholderText('Week name'), 'My week')
  await user.click(screen.getByRole('button', { name: 'All days' }))
  await addBlock(user, 'Commute')
  await openBlock(user, 'Wednesday', 'Commute')

  expect(openBlockPanel().getByText('Remove from every day it is on')).toBeInTheDocument()
  await user.click(
    screen.getByRole('button', { name: 'Remove Commute from every day it is on' }),
  )
  expect(screen.queryByText('Commute')).toBeNull()
})
