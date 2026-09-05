import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReplanSheet } from './ReplanSheet'
import { actions, getData } from '../../lib/store'
import { defaultData } from '../../lib/storage'
import { addDays } from '../../lib/dates'
import { DEFAULT_SLEEP_SETTINGS } from './capacity'
import { collectEntities } from '../../lib/syncEntities'
import { DayView } from './DayView'
import { requestReplan, resetReplanForTests } from '../../lib/replanState'
import { todayKey } from '../../lib/dates'

const TODAY = todayKey()
const TOMORROW = addDays(TODAY, 1)

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
  resetReplanForTests()
})

afterEach(() => {
  vi.restoreAllMocks()
})

function seed() {
  actions.addTask(TODAY, 'Deep work', '09:00')
  actions.addTask(TODAY, 'Standup', '11:15')
  actions.addTask(TODAY, 'Lunch', '12:30')
  actions.addTask(TODAY, 'Gym', '17:30')
  const tasks = getData().days[TODAY].tasks
  actions.setTaskMinutes(TODAY, tasks[0].id, 120)
  actions.setTaskMinutes(TODAY, tasks[1].id, 15)
  actions.setTaskMinutes(TODAY, tasks[2].id, 45)
  actions.setTaskMinutes(TODAY, tasks[3].id, 60)
  actions.toggleTaskHighlight(TODAY, tasks[0].id)
  return getData().days[TODAY].tasks
}

function renderSheet(mode: 'menu' | 'interrupt' | 'shift' | 'away' | 'back', nowMinutes = 8 * 60, away?: string) {
  const onClose = vi.fn()
  render(
    <ReplanSheet
      date={TODAY}
      tasks={getData().days[TODAY]?.tasks ?? []}
      nowMinutes={nowMinutes}
      sleep={DEFAULT_SLEEP_SETTINGS}
      sleepProfileId={undefined}
      busy={[]}
      away={away}
      mode={mode}
      onClose={onClose}
    />,
  )
  return onClose
}

const titles = () => getData().days[TODAY].tasks.map(t => `${t.title}@${t.time ?? '-'}`)

/**
 * Something came up. The sheet shows what the new block hits and what
 * happens to each before anything is applied; Accept is one commit.
 */
test('an interruption names what it hits, moves them into the gaps, and applies on Accept', async () => {
  const user = userEvent.setup()
  seed()
  const onClose = renderSheet('interrupt')
  await user.type(screen.getByPlaceholderText('Dentist'), 'Dentist')
  await user.clear(screen.getByLabelText('Start time'))
  await user.type(screen.getByLabelText('Start time'), '09:00')
  await user.click(screen.getByRole('button', { name: '2h' }))

  const list = screen.getByRole('list')
  expect(within(list).getAllByRole('listitem')).toHaveLength(1)
  expect(list).toHaveTextContent('Deep work')
  expect(list).toHaveTextContent('at 13:15')
  expect(screen.getByRole('status')).not.toHaveTextContent(/missed/i)

  await user.click(screen.getByRole('button', { name: 'Accept' }))
  expect(onClose).toHaveBeenCalled()
  expect(titles()).toEqual(['Deep work@13:15', 'Standup@11:15', 'Lunch@12:30', 'Gym@17:30', 'Dentist@09:00'])
  const dentist = getData().days[TODAY].tasks.find(t => t.title === 'Dentist')
  expect(dentist?.minutes).toBe(120)
})

test('each conflict can go to tomorrow or be dropped, and "for all" sets them together', async () => {
  const user = userEvent.setup()
  seed()
  renderSheet('interrupt')
  await user.type(screen.getByPlaceholderText('Dentist'), 'Call')
  await user.clear(screen.getByLabelText('Start time'))
  await user.type(screen.getByLabelText('Start time'), '09:00')
  await user.click(screen.getByRole('button', { name: "Don't know" }))

  // Open-ended: everything from 09:00 is in the way.
  expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(4)
  await user.click(within(screen.getByRole('group', { name: 'For all of them' })).getByRole('button', { name: 'Tomorrow' }))
  await user.click(within(screen.getByRole('group', { name: 'What to do with Gym' })).getByRole('button', { name: 'Drop' }))
  await user.click(screen.getByRole('button', { name: 'Accept' }))

  expect(titles()).toEqual(['Call@09:00'])
  expect(getData().days[TOMORROW].tasks.map(t => t.title)).toEqual(['Deep work', 'Standup', 'Lunch'])
})

test('Cancel changes nothing', async () => {
  const user = userEvent.setup()
  const before = seed()
  renderSheet('interrupt')
  await user.type(screen.getByPlaceholderText('Dentist'), 'Dentist')
  await user.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(getData().days[TODAY].tasks).toEqual(before)
})

/**
 * Shift the rest. Presets, a preview, and the sleep boundary respected
 * out loud: what would end after it is named and goes to tomorrow.
 */
test('shifting the rest moves everything from now, and names what falls past sleep', async () => {
  const user = userEvent.setup()
  seed()
  actions.addTask(TODAY, 'Read', '22:30')
  actions.setTaskMinutes(TODAY, getData().days[TODAY].tasks.at(-1)!.id, 30)
  renderSheet('shift', 12 * 60)
  await user.click(screen.getByRole('button', { name: '+1h' }))
  expect(screen.getByRole('status')).toHaveTextContent('Read - tomorrow')
  await user.click(screen.getByRole('button', { name: 'Accept' }))
  expect(titles()).toEqual(['Deep work@09:00', 'Standup@11:15', 'Lunch@13:30', 'Gym@18:30'])
  expect(getData().days[TOMORROW].tasks.map(t => t.title)).toEqual(['Read'])
})

/**
 * Away, and back. Away is a fact on the day, so it syncs; while it is set
 * nothing nudges. Back offers one rescue that leads with what is still
 * winnable and never with what was missed.
 */
test('Away marks the day, and the mark travels as part of the day entity', async () => {
  const user = userEvent.setup()
  seed()
  const onClose = renderSheet('away', 10 * 60 + 5)
  await user.click(screen.getByRole('button', { name: 'Away' }))
  expect(getData().days[TODAY].away).toBe('10:05')
  expect(onClose).toHaveBeenCalled()
  const body = collectEntities(getData()).get(`day:${TODAY}`)!.bodyOf() as { away?: string }
  expect(body.away).toBe('10:05')
})

test('I\'m back proposes a rescue, key tasks first, and Accept clears the pause', async () => {
  const user = userEvent.setup()
  seed()
  actions.setAway(TODAY, '09:30')
  // Back at 15:00: Deep work (key, passed), Standup and Lunch passed; Gym still to come.
  renderSheet('back', 15 * 60, '09:30')
  expect(screen.getByText(/Still winnable: 1 of 1 key\./)).toBeInTheDocument()
  expect(screen.queryByText(/miss/i)).toBeNull()
  const items = within(screen.getByRole('list')).getAllByRole('listitem')
  expect(items[0]).toHaveTextContent('Deep work')
  expect(items[0]).toHaveTextContent('at 15:00')
  await user.click(screen.getByRole('button', { name: 'Accept' }))
  expect(getData().days[TODAY].away).toBeUndefined()
  // Deep work fills 15:00-17:00, Standup takes the quarter hour before Gym,
  // and Lunch's 45 minutes only fit after it.
  expect(titles()).toEqual(['Deep work@15:00', 'Standup@17:00', 'Lunch@18:30', 'Gym@17:30'])
})

test('Not now clears the pause and moves nothing', async () => {
  const user = userEvent.setup()
  const before = seed()
  actions.setAway(TODAY, '09:30')
  renderSheet('back', 15 * 60, '09:30')
  await user.click(screen.getByRole('button', { name: 'Not now' }))
  expect(getData().days[TODAY].away).toBeUndefined()
  expect(getData().days[TODAY].tasks).toEqual(before)
})

// --- reaching it -----------------------------------------------------------

test('the day header offers Replan on today, and "I\'m back" while away', () => {
  seed()
  const { rerender } = render(<DayView date={TODAY} onDateChange={() => {}} onOpenNorth={() => {}} />)
  expect(screen.getByRole('button', { name: 'Replan' })).toBeInTheDocument()
  actions.setAway(TODAY, '11:00')
  rerender(<DayView date={TODAY} onDateChange={() => {}} onOpenNorth={() => {}} />)
  expect(screen.getByText('Away since 11:00')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: "I'm back" })).toBeInTheDocument()
})

test('yesterday has no Replan door', () => {
  render(<DayView date={addDays(TODAY, -1)} onDateChange={() => {}} onOpenNorth={() => {}} />)
  expect(screen.queryByRole('button', { name: 'Replan' })).toBeNull()
})

test('a request from the palette opens the sheet on today', async () => {
  seed()
  render(<DayView date={TODAY} onDateChange={() => {}} onOpenNorth={() => {}} />)
  await userEvent.setup().click(screen.getByRole('button', { name: 'Replan' }))
  expect(screen.getByRole('dialog', { name: 'Replan' })).toHaveTextContent('Something came up')
  await userEvent.setup().keyboard('{Escape}')
  expect(screen.queryByRole('dialog', { name: 'Replan' })).toBeNull()
  requestReplan('shift')
  expect(await screen.findByRole('dialog', { name: 'Replan' })).toHaveTextContent('Shift the rest')
})
