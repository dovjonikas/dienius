import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReplanSheet } from './ReplanSheet'
import { actions, getData } from '../../lib/store'
import { defaultData } from '../../lib/storage'
import { addDays, todayKey } from '../../lib/dates'
import { weekdayOf } from '../../lib/repeats'
import { collectEntities } from '../../lib/syncEntities'
import { getUndo, resetUndoForTests } from '../../lib/undo'
import { DayView } from './DayView'
import { resetReplanForTests } from '../../lib/replanState'
import { forgetRecentTitles, readRecentTitles, rememberTitle } from './replanPrefs'
import type { ReplanMode } from '../../lib/replanState'

const TODAY = todayKey()
const TOMORROW = addDays(TODAY, 1)

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
  resetReplanForTests()
  resetUndoForTests()
  forgetRecentTitles()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

/** Pins the clock to a time of day today. Only Date answers differently; timers run for real. */
function clockAt(hours: number, minutes = 0) {
  const at = new Date()
  at.setHours(hours, minutes, 0, 0)
  vi.setSystemTime(at)
}

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

function renderSheet(mode: ReplanMode, date = TODAY) {
  const onClose = vi.fn()
  render(<ReplanSheet date={date} mode={mode} onClose={onClose} />)
  return onClose
}

const titles = (date = TODAY) => (getData().days[date]?.tasks ?? []).map(t => `${t.title}@${t.time ?? '-'}`)

// --- something came up, for any day ------------------------------------------

/**
 * The phone call. A shape of the loss, not a start and a length: one press
 * says the afternoon is gone, the sheet says what that lands on and where
 * each block goes, the free line says what to tell the caller, and Accept
 * is one commit. Nothing about what was missed, anywhere.
 */
test('a shape on today names what it hits, moves the one-offs into the evening, and applies on Accept', async () => {
  const user = userEvent.setup()
  clockAt(8)
  seed()
  const onClose = renderSheet('interrupt')

  await user.click(screen.getByRole('button', { name: 'Afternoon gone' }))

  const list = screen.getByRole('list')
  const rows = within(list).getAllByRole('listitem')
  expect(rows).toHaveLength(2)
  expect(rows[0]).toHaveTextContent('Lunch')
  expect(rows[0]).toHaveTextContent('at 18:00')
  expect(rows[1]).toHaveTextContent('Gym')
  expect(rows[1]).toHaveTextContent('at 18:45')

  const status = screen.getByRole('status')
  expect(status).toHaveTextContent('Free today: 08:00-09:00, 11:30-13:00, after 19:45.')
  expect(status).toHaveTextContent('Into the gaps: Lunch at 18:00, Gym at 18:45.')
  expect(status).not.toHaveTextContent(/missed|failed|behind|only|should/i)

  await user.click(screen.getByRole('button', { name: 'Accept' }))
  expect(onClose).toHaveBeenCalled()
  expect(titles()).toEqual(['Deep work@09:00', 'Standup@11:15', 'Lunch@18:00', 'Gym@18:45', 'Something came up@13:00'])
  const added = getData().days[TODAY].tasks.find(t => t.title === 'Something came up')
  expect(added?.minutes).toBe(300)
  expect(getData().days[TODAY].replannedOn).toBe(TODAY)
  expect(getUndo()?.label).toBe('Day replanned')
})

/**
 * Proposed, not asked. A routine block in the way is skipped for the day
 * because its template makes it again; a one-off is moved. Either can be
 * overridden by pressing its row, and nobody has to.
 */
test('a routine block in the way is skipped by default, and one press on its row moves it instead', async () => {
  const user = userEvent.setup()
  clockAt(8)
  actions.resetForTests({
    ...defaultData(),
    days: {
      [TODAY]: {
        date: TODAY,
        tasks: [
          { id: 'meet', title: 'Meetings', time: '13:30', minutes: 90, done: false, fromTemplate: true, origin: { type: 'template', sourceId: 'work', blockId: 'b3' } },
          { id: 'post', title: 'Post the parcel', time: '15:30', minutes: 30, done: false, origin: { type: 'manual' } },
        ],
      },
    },
  })
  renderSheet('interrupt')
  await user.click(screen.getByRole('button', { name: 'Afternoon gone' }))

  const rows = within(screen.getByRole('list')).getAllByRole('listitem')
  expect(rows[0]).toHaveTextContent('Meetings')
  expect(rows[0]).toHaveTextContent('skipped')
  expect(rows[1]).toHaveTextContent('Post the parcel')
  expect(rows[1]).toHaveTextContent('at 18:00')
  expect(screen.getByRole('status')).toHaveTextContent('Skipped today: Meetings.')

  await user.click(within(rows[0]).getByRole('button', { name: /^Meetings, 13:30: skipped/ }))
  await user.click(within(screen.getByRole('group', { name: 'What to do with Meetings' })).getByRole('button', { name: 'Move' }))
  expect(rows[0]).toHaveTextContent('at 18:00')
  expect(rows[1]).toHaveTextContent('at 19:30')
  expect(screen.getByRole('status')).not.toHaveTextContent('Skipped')

  await user.click(screen.getByRole('button', { name: 'Accept' }))
  expect(titles()).toEqual(['Meetings@18:00', 'Post the parcel@19:30', 'Something came up@13:00'])
})

/**
 * A day nobody has opened. Choosing it opens it - its weekday template,
 * exactly as looking at it would - so what is shown is what Accept lands on,
 * and opening it later shows the day as accepted.
 */
test('choosing tomorrow opens it the way looking at it would, and the plan lands on the day its template makes', async () => {
  const user = userEvent.setup()
  clockAt(8)
  const template = actions.addTemplate({
    name: 'Workday',
    color: '#a7c4f5',
    blocks: [
      { time: '08:00', title: 'Commute', minutes: 30 },
      { time: '09:00', title: 'Deep work', minutes: 120 },
      { time: '13:30', title: 'Meetings', minutes: 90 },
    ],
  })
  actions.setWeekdayTemplate(weekdayOf(TOMORROW), template.id)
  expect(getData().days[TOMORROW]).toBeUndefined()
  renderSheet('interrupt')

  await user.click(screen.getByRole('button', { name: 'Tomorrow' }))
  expect(getData().days[TOMORROW].templateId).toBe(template.id)
  await user.click(screen.getByRole('button', { name: 'Afternoon gone' }))

  expect(screen.getByRole('list')).toHaveTextContent('Meetings')
  expect(screen.getByRole('status')).toHaveTextContent('Free tomorrow: 07:00-08:00, 08:30-09:00, 11:00-13:00, after 18:00.')
  expect(screen.getByRole('status')).toHaveTextContent('Skipped tomorrow: Meetings.')

  await user.click(screen.getByRole('button', { name: 'Accept' }))
  expect(titles(TOMORROW)).toEqual(['Commute@08:00', 'Deep work@09:00', 'Something came up@13:00'])
  expect(getData().days[TOMORROW].replannedOn).toBe(TODAY)
  expect(getData().days[TODAY]?.tasks ?? []).toEqual([])
  expect(getUndo()?.label).toBe('Tomorrow replanned')
})

/**
 * The line and the chips are one truth. A line that names a day and a time
 * wins and the chips redraw to show it; a pressed chip takes its word out of
 * the line, so the two can never disagree - CONVENTIONS section 16, kept
 * here the cheap way.
 */
test('the typed line drives the chips, and a pressed chip takes its word out of the line', async () => {
  const user = userEvent.setup()
  clockAt(8)
  seed()
  renderSheet('interrupt')

  const field = screen.getByRole('textbox', { name: 'What came up' })
  await user.type(field, 'tomorrow 10-13 dad')
  expect(screen.getByRole('button', { name: 'Tomorrow' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'A time' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByLabelText('Start time')).toHaveValue('10:00')
  expect(screen.getByRole('status')).toHaveTextContent('Free tomorrow:')

  await user.click(screen.getByRole('button', { name: 'Today' }))
  expect(field).toHaveValue('10-13 dad')
  expect(screen.getByRole('button', { name: 'Today' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('status')).toHaveTextContent('Free today:')

  await user.click(screen.getByRole('button', { name: 'Accept' }))
  const dad = getData().days[TODAY].tasks.find(t => t.title === 'dad')
  expect(dad?.time).toBe('10:00')
  expect(dad?.minutes).toBe(180)
})

test('a recent name is one press, and the name given is remembered for next time', async () => {
  const user = userEvent.setup()
  clockAt(8)
  rememberTitle('Dad')
  rememberTitle('Dentist')
  seed()
  renderSheet('interrupt')

  await user.click(within(screen.getByRole('group', { name: 'Recent names' })).getByRole('button', { name: 'Dad' }))
  expect(screen.getByRole('textbox', { name: 'What came up' })).toHaveValue('Dad')
  await user.click(screen.getByRole('button', { name: 'Morning gone' }))
  await user.click(screen.getByRole('button', { name: 'Accept' }))

  expect(getData().days[TODAY].tasks.map(t => t.title)).toContain('Dad')
  expect(readRecentTitles()).toEqual(['Dad', 'Dentist'])
})

test('a shape already behind you is not offered', () => {
  clockAt(15)
  seed()
  renderSheet('interrupt')
  expect(screen.getByRole('button', { name: 'Morning gone' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Afternoon gone' })).toBeEnabled()
})

test('Cancel changes nothing', async () => {
  const user = userEvent.setup()
  clockAt(8)
  const before = seed()
  renderSheet('interrupt')
  await user.click(screen.getByRole('button', { name: 'Whole day gone' }))
  await user.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(getData().days[TODAY].tasks).toEqual(before)
})

// --- shift the rest -------------------------------------------------------------

/**
 * Shift the rest. Presets, a preview, and the sleep boundary respected
 * out loud: what would end after it is named and goes to tomorrow.
 */
test('shifting the rest moves everything from now, and names what falls past sleep', async () => {
  const user = userEvent.setup()
  clockAt(12)
  seed()
  actions.addTask(TODAY, 'Read', '22:30')
  actions.setTaskMinutes(TODAY, getData().days[TODAY].tasks.at(-1)!.id, 30)
  renderSheet('shift')
  await user.click(screen.getByRole('button', { name: '+1h' }))
  expect(screen.getByRole('status')).toHaveTextContent('Read - tomorrow')
  await user.click(screen.getByRole('button', { name: 'Accept' }))
  expect(titles()).toEqual(['Deep work@09:00', 'Standup@11:15', 'Lunch@13:30', 'Gym@18:30'])
  expect(getData().days[TOMORROW].tasks.map(t => t.title)).toEqual(['Read'])
})

// --- away, and back -------------------------------------------------------------

/**
 * Away, and back. Away is a fact on the day, so it syncs; while it is set
 * nothing nudges. Back offers one rescue that leads with what is still
 * winnable and never with what was missed.
 */
test('Away marks the day, and the mark travels as part of the day entity', async () => {
  const user = userEvent.setup()
  clockAt(10, 5)
  seed()
  const onClose = renderSheet('away')
  await user.click(screen.getByRole('button', { name: 'Away' }))
  expect(getData().days[TODAY].away).toBe('10:05')
  expect(onClose).toHaveBeenCalled()
  const body = collectEntities(getData()).get(`day:${TODAY}`)!.bodyOf() as { away?: string }
  expect(body.away).toBe('10:05')
})

test('I\'m back proposes a rescue, key tasks first, and Accept clears the pause', async () => {
  const user = userEvent.setup()
  clockAt(15)
  seed()
  actions.setAway(TODAY, '09:30')
  // Back at 15:00: Deep work (key, passed), Standup and Lunch passed; Gym still to come.
  renderSheet('back')
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
  clockAt(15)
  const before = seed()
  actions.setAway(TODAY, '09:30')
  renderSheet('back')
  await user.click(screen.getByRole('button', { name: 'Not now' }))
  expect(getData().days[TODAY].away).toBeUndefined()
  expect(getData().days[TODAY].tasks).toEqual(before)
})

// --- reaching it -----------------------------------------------------------

/**
 * Today has the three doors behind Replan, and the way back while away. A
 * day still ahead has the one door that applies to it. A day that has passed
 * has none: nothing can come up in it any more. The sheet itself is at the
 * app root - App.test.tsx covers a request opening it.
 */
test('the day header offers Replan on today, and "I\'m back" while away', () => {
  seed()
  const { rerender } = render(<DayView date={TODAY} onDateChange={() => {}} onOpenNorth={() => {}} />)
  expect(screen.getByRole('button', { name: 'Replan' })).toBeInTheDocument()
  actions.setAway(TODAY, '11:00')
  rerender(<DayView date={TODAY} onDateChange={() => {}} onOpenNorth={() => {}} />)
  expect(screen.getByText('Away since 11:00')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: "I'm back" })).toBeInTheDocument()
})

test('a day still ahead offers Something came up straight onto it', () => {
  render(<DayView date={TOMORROW} onDateChange={() => {}} onOpenNorth={() => {}} />)
  expect(screen.getByRole('button', { name: 'Something came up' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Replan' })).toBeNull()
})

test('yesterday has no door at all', () => {
  render(<DayView date={addDays(TODAY, -1)} onDateChange={() => {}} onOpenNorth={() => {}} />)
  expect(screen.queryByRole('button', { name: 'Replan' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Something came up' })).toBeNull()
})
