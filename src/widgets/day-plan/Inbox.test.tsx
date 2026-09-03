import { beforeEach, expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Inbox } from './Inbox'
import { actions, getData } from '../../lib/store'
import { defaultData } from '../../lib/storage'

const DATE = '2026-09-01'

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
})

/**
 * The inbox exists because the moment a thought arrives is almost never the
 * moment to decide what day it belongs on, and being asked to decide is
 * exactly what makes people stop writing things down. Every test here is
 * some version of that: an item has nothing to fill in, and nothing about
 * it is a decision until somebody makes one.
 */

test('an empty inbox is not there at all - it is not a section waiting to be filled', () => {
  const { container } = render(<Inbox date={DATE} />)
  expect(container).toBeEmptyDOMElement()
})

test('a caught line has no date, no time, no size and no category', () => {
  actions.addInboxItem('Book the dentist')
  // updatedAt is written by commit() for sync and is on every entity in the
  // store - see stampChanges. It is not something the inbox item carries
  // about itself, which is what this test is really asserting.
  expect(getData().inbox[0]).toEqual({
    id: expect.any(String),
    text: 'Book the dentist',
    captured: expect.any(String),
    updatedAt: expect.any(String),
  })
})

test('a blank line is not caught', () => {
  actions.addInboxItem('   ')
  expect(getData().inbox).toHaveLength(0)
})

// Newest first: an inbox is read from the top, and the thing just written is
// the thing most likely to still matter.
test('the newest catch is at the top', () => {
  actions.addInboxItem('First')
  actions.addInboxItem('Second')
  expect(getData().inbox.map(i => i.text)).toEqual(['Second', 'First'])
})

test('the count is on the fold, so the inbox says how much is in it while closed', () => {
  actions.addInboxItem('One')
  actions.addInboxItem('Two')
  render(<Inbox date={DATE} />)
  expect(screen.getByRole('button', { name: /Inbox/ })).toHaveTextContent('2')
})

test('adding to the day makes a task and empties that line from the inbox in one action', async () => {
  const user = userEvent.setup()
  actions.addInboxItem('Book the dentist')
  render(<Inbox date={DATE} />)

  await user.click(screen.getByRole('button', { name: 'Add "Book the dentist" to this day' }))

  expect(getData().days[DATE].tasks.map(t => t.title)).toEqual(['Book the dentist'])
  expect(getData().inbox).toHaveLength(0)
})

// The whole point is that deciding when was postponed. Being made to decide
// on the way out would move the friction rather than remove it.
test('an item added to a day arrives untimed, not asked to name an hour', async () => {
  const user = userEvent.setup()
  actions.addInboxItem('Book the dentist')
  render(<Inbox date={DATE} />)
  await user.click(screen.getByRole('button', { name: 'Add "Book the dentist" to this day' }))
  expect(getData().days[DATE].tasks[0].time).toBeUndefined()
})

test('deleting takes a confirming second tap - a stray tap cannot lose a line', async () => {
  const user = userEvent.setup()
  actions.addInboxItem('Book the dentist')
  render(<Inbox date={DATE} />)

  await user.click(screen.getByRole('button', { name: 'Delete "Book the dentist"' }))
  expect(getData().inbox).toHaveLength(1)

  await user.click(screen.getByRole('button', { name: 'Confirm delete "Book the dentist"' }))
  expect(getData().inbox).toHaveLength(0)
})

test('the armed delete disarms itself when it loses focus', async () => {
  const user = userEvent.setup()
  actions.addInboxItem('Book the dentist')
  render(<Inbox date={DATE} />)

  await user.click(screen.getByRole('button', { name: 'Delete "Book the dentist"' }))
  await user.tab()
  expect(screen.getByRole('button', { name: 'Delete "Book the dentist"' })).toBeInTheDocument()
})

test('scheduling an item that is already gone changes nothing rather than throwing', () => {
  expect(actions.scheduleInboxItem('not-an-item', DATE)).toBe(false)
  expect(getData().days[DATE]).toBeUndefined()
})
