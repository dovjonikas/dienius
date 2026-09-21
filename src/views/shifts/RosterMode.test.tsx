import { beforeEach, expect, test } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CalendarView } from '../CalendarView'
import { actions, getData } from '../../lib/store'
import { defaultData } from '../../lib/storage'
import { addDays, monthEnd, todayKey } from '../../lib/dates'
import { readCycle, readDraft } from '../../lib/rosterDraft'
import { getUndo, runUndo } from '../../lib/undo'
import type { AppData, Template } from '../../lib/types'

/**
 * The roster in the month - rotating shifts, v2.29 stage 6, and
 * docs/RESEARCH-SHIFTS.md section 2.5. A tap on a date walks it through the
 * kinds and round again; the Clear tool takes a kind off; a cycle fills a
 * stretch in one press. All of it builds a draft kept on this device: nothing
 * reaches the plan until it is applied, which is stage 7. Every name here is a
 * generic one.
 */

const KIND = (id: string, name: string, letter: string, order: number, blocks: Template['blocks'] = []): Template =>
  ({ id, name, color: '#a7c4f5', blocks, dayKind: { letter, order } }) as Template

function plan(over: Partial<AppData> = {}): AppData {
  const data = defaultData()
  data.templates = [KIND('day', 'Day shift', 'D', 0), KIND('night', 'Night shift', 'N', 1)]
  return { ...data, ...over }
}

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(plan())
})

const cell = (date: string) => document.querySelector<HTMLElement>(`[data-date="${date}"]`)!

/** Opens the month with the roster on. */
async function openRoster() {
  const user = userEvent.setup()
  render(<CalendarView onOpenDay={() => {}} />)
  await user.click(screen.getByRole('button', { name: 'Roster' }))
  return user
}

test('with no kind of day marked, the month does not offer a roster', () => {
  actions.resetForTests({ ...defaultData(), templates: [{ id: 'plain', name: 'Working day', color: '#a7e3bd', blocks: [] } as Template] })
  render(<CalendarView onOpenDay={() => {}} />)
  expect(screen.queryByRole('button', { name: 'Roster' })).toBeNull()
})

test('a tap walks the kinds and round again, in the draft and never in the plan', async () => {
  const user = await openRoster()
  const date = addDays(todayKey(), 1)

  await user.click(cell(date))
  expect(readDraft().dates[date]).toBe('day')
  expect(cell(date)).toHaveTextContent('D')

  await user.click(cell(date))
  expect(readDraft().dates[date]).toBe('night')
  expect(cell(date)).toHaveTextContent('N')

  await user.click(cell(date))
  expect(readDraft().dates[date]).toBe('day')

  expect(getData().days[date]).toBeUndefined()
})

test('the letter a date already carries is drawn, and a date behind today is not walked', async () => {
  const yesterday = addDays(todayKey(), -1)
  actions.resetForTests(plan({ days: { [yesterday]: { date: yesterday, templateId: 'night', tasks: [] } } }))
  const user = await openRoster()

  expect(cell(yesterday)).toHaveTextContent('N')
  await user.click(cell(yesterday))
  expect(readDraft().dates[yesterday]).toBeUndefined()
})

test('the Clear tool takes a kind off, and a tap after it walks again', async () => {
  const date = addDays(todayKey(), 1)
  actions.resetForTests(plan({ days: { [date]: { date, templateId: 'night', tasks: [] } } }))
  const user = await openRoster()

  await user.click(screen.getByRole('button', { name: 'Clear' }))
  await user.click(cell(date))
  expect(readDraft().dates[date]).toBeNull()
  // The letter itself is gone, and so is the name the plan still holds: in
  // the roster a date reads as what it will be, not as what it was.
  expect(cell(date).querySelector('.cell-kind')).toBeNull()
  expect(cell(date)).not.toHaveTextContent('Night shift')

  await user.click(screen.getByRole('button', { name: 'Clear' }))
  await user.click(cell(date))
  expect(readDraft().dates[date]).toBe('day')
})

test('a cycle fills the rest of the month from a date, and is remembered for the next one', async () => {
  const user = await openRoster()
  const today = todayKey()

  await user.click(screen.getByRole('button', { name: 'Cycle' }))
  const kinds = screen.getByRole('group', { name: 'The cycle' })
  await user.click(within(kinds).getByRole('button', { name: /Day shift/ }))
  await user.click(within(kinds).getByRole('button', { name: /Night shift/ }))
  expect(screen.getByLabelText('Starting on')).toHaveValue(today)
  await user.click(screen.getByRole('button', { name: 'Fill to the end of the month' }))

  // The sequence from the day it starts on, round and round to the end of the
  // month, and nothing of it in the plan.
  const filled = readDraft().dates
  expect(filled[today]).toBe('day')
  expect(filled[addDays(today, 1)]).toBe('night')
  expect(filled[addDays(today, 2)]).toBe('day')
  expect(filled[monthEnd(today)]).toBeDefined()
  expect(filled[addDays(monthEnd(today), 1)]).toBeUndefined()
  expect(filled[addDays(today, -1)]).toBeUndefined()
  expect(readCycle()).toEqual({ kinds: ['day', 'night'], from: today })
  expect(getData().days[today]).toBeUndefined()

  // The app opened again, and the cycle is the one last used: next month is
  // usually this month's pattern moved on.
  cleanup()
  const again = userEvent.setup()
  render(<CalendarView onOpenDay={() => {}} />)
  await again.click(screen.getByRole('button', { name: 'Roster' }))
  await again.click(screen.getByRole('button', { name: 'Cycle' }))
  expect(screen.getByLabelText('The cycle so far')).toHaveTextContent('D N')
})

test('a cycle that starts behind today keeps its place and writes nothing into the past', async () => {
  const user = await openRoster()
  const today = todayKey()
  const before = addDays(today, -3)

  await user.click(screen.getByRole('button', { name: 'Cycle' }))
  const kinds = screen.getByRole('group', { name: 'The cycle' })
  await user.click(within(kinds).getByRole('button', { name: /Day shift/ }))
  await user.click(within(kinds).getByRole('button', { name: /Night shift/ }))
  // The field asks for today or later; a date behind it is the rule's own
  // case, and the rule is the app's, not the field's.
  fireEvent.change(screen.getByLabelText('Starting on'), { target: { value: before } })
  await user.click(screen.getByRole('button', { name: 'Fill to the end of the month' }))

  const filled = readDraft().dates
  expect(filled[before]).toBeUndefined()
  expect(filled[addDays(today, -1)]).toBeUndefined()
  // Three days on from a sequence of two is the first kind again, and that is
  // what today gets: the cycle keeps its place over today rather than starting
  // again on it.
  expect(filled[today]).toBe('night')
  expect(filled[addDays(today, 1)]).toBe('day')
})

test('the draft outlives a reload, says how many days are waiting, and can be thrown away', async () => {
  const user = await openRoster()
  const date = addDays(todayKey(), 1)
  await user.click(cell(date))
  await user.click(cell(addDays(todayKey(), 2)))
  expect(screen.getByRole('status')).toHaveTextContent('2 days waiting')

  // The app opened again: the draft is read back off the device.
  cleanup()
  const again = userEvent.setup()
  render(<CalendarView onOpenDay={() => {}} />)
  await again.click(screen.getByRole('button', { name: 'Roster' }))
  expect(cell(date)).toHaveTextContent('D')

  await again.click(screen.getByRole('button', { name: 'Throw it away' }))
  expect(readDraft().dates).toEqual({})
  expect(getData().days[date]).toBeUndefined()
})

// --- what Apply says first, and what it then does - section 6.1 and 6.2 -------------------------

/** The kinds with something in them, and a routine with a time on one of them. */
function withShift() {
  const data = plan()
  data.templates = [
    KIND('day', 'Day shift', 'D', 0, [{ id: 'shift', title: 'On shift', time: '07:00', minutes: 480, category: 'core' }]),
    KIND('night', 'Night shift', 'N', 1),
  ]
  data.routines = [{ id: 'gym', title: 'Training', minutes: 60, weekdays: [0, 1, 2, 3, 4, 5, 6], times: { day: '17:00' } } as AppData['routines'][number]]
  return data
}

test('Apply says what it will do first, week by week, and then does it in one press', async () => {
  actions.resetForTests(withShift())
  const user = await openRoster()
  const first = addDays(todayKey(), 1)
  await user.click(cell(first))
  await user.click(cell(addDays(todayKey(), 2)))

  await user.click(screen.getByRole('button', { name: 'Apply' }))
  const preview = screen.getByRole('group', { name: 'What Apply will do' })
  expect(within(preview).getAllByRole('listitem')).toHaveLength(2)
  expect(within(preview).getAllByRole('listitem')[0]).toHaveTextContent('D')
  expect(within(preview).getAllByRole('listitem')[0]).toHaveTextContent('Day shift')

  await user.click(screen.getByRole('button', { name: 'Apply 2 days' }))
  expect(getData().days[first].templateId).toBe('day')
  expect(getData().days[first].tasks.map(t => t.title)).toEqual(['On shift', 'Training'])
  // The draft is spent, and the way back is offered.
  expect(readDraft().dates).toEqual({})
  expect(getUndo()?.label).toBe('Roster applied')

  act(() => runUndo())
  expect(getData().days[first]).toBeUndefined()
})

test('a day changed by hand is asked about, and Leave it leaves that day alone', async () => {
  const first = addDays(todayKey(), 1)
  const data = withShift()
  data.days = {
    [first]: {
      date: first,
      templateId: 'day',
      tasks: [
        {
          id: 't1',
          title: 'On shift',
          time: '07:00',
          minutes: 480,
          done: true,
          category: 'core',
          origin: { type: 'template', sourceId: 'day', blockId: 'shift' },
          fromBlock: { title: 'On shift', time: '07:00', minutes: 480, category: 'core' },
        },
      ],
    },
  }
  actions.resetForTests(data)

  const user = await openRoster()
  // One tap walks it from the day shift it carries to the night shift, and
  // another date goes with it.
  await user.click(cell(first))
  const second = addDays(todayKey(), 2)
  await user.click(cell(second))

  await user.click(screen.getByRole('button', { name: 'Apply' }))
  const asked = screen.getByRole('listitem', { name: /changed by hand/ })
  expect(asked).toHaveTextContent('1 done')
  await user.click(within(asked).getByRole('button', { name: 'Leave it' }))

  await user.click(screen.getByRole('button', { name: 'Apply 1 day' }))
  // The day somebody had worked on is untouched, and still waiting.
  expect(getData().days[first].templateId).toBe('day')
  expect(getData().days[first].tasks[0].done).toBe(true)
  expect(readDraft().dates).toEqual({ [first]: 'night' })
  // The other date went ahead.
  expect(getData().days[second].templateId).toBe('day')
})

test('with nothing left to do, Apply says so rather than offering a press that does nothing', async () => {
  const first = addDays(todayKey(), 1)
  // Kinds with nothing in them and no routines, so a date that already carries
  // the kind the draft names is a date the roster would not change at all.
  actions.resetForTests({ ...plan(), days: { [first]: { date: first, templateId: 'day', tasks: [] } } })
  const user = await openRoster()
  // Twice round the two kinds is back where it started: the draft says what
  // the date already is.
  await user.click(cell(first))
  await user.click(cell(first))

  await user.click(screen.getByRole('button', { name: 'Apply' }))
  expect(screen.getByRole('group', { name: 'What Apply will do' })).toHaveTextContent('Nothing to apply')
  expect(screen.queryByRole('button', { name: /^Apply \d/ })).toBeNull()
})
