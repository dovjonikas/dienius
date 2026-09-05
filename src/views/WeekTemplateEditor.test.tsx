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
  await user.click(screen.getByRole('button', { name: 'Add block' }))
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
  })

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
  expect(within(column('Monday')).getByText('Standup')).toBeInTheDocument()
  expect(within(column('Sunday')).getByText('Standup')).toBeInTheDocument()

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
