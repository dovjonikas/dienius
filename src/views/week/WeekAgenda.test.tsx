import { beforeEach, expect, test, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WeekAgenda } from './WeekAgenda'
import { LaterStrip } from './LaterStrip'
import { actions, getData } from '../../lib/store'
import { defaultData } from '../../lib/storage'
import { addDays, todayKey } from '../../lib/dates'

const DATES = ['2026-09-07', '2026-09-08', '2026-09-09']

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
})

function seed() {
  actions.resetForTests({
    ...defaultData(),
    days: {
      '2026-09-07': {
        date: '2026-09-07',
        tasks: [
          { id: 'b', title: 'Gym: Upper', time: '17:30', done: false },
          { id: 'a', title: 'Job hunt', time: '09:00', done: true, highlight: true },
        ],
      },
      '2026-09-09': { date: '2026-09-09', tasks: [{ id: 'c', title: 'Read a chapter', done: false }] },
    },
  })
}

/**
 * The second way to read a week. The grid answers a question about shape and
 * answers it better than any list could; this answers the other one, which is
 * simply what is on it - a 40px block reading "Call the b..." seven times over
 * is a week somebody has to decode.
 */

test('every day in the window gets a heading, in the day\'s own order underneath', () => {
  seed()
  render(<WeekAgenda dates={DATES} onOpenDay={() => {}} onOpenTask={() => {}} />)

  expect(screen.getByRole('button', { name: 'Monday, September 7' })).toBeInTheDocument()
  const monday = screen.getByRole('button', { name: 'Monday, September 7' }).closest('section')!
  expect(within(monday).getAllByRole('listitem').map(li => li.textContent)).toEqual(['09:00Job hunt', '17:30Gym: Upper'])
})

/**
 * An empty Thursday is information. Skipping days with nothing on them would
 * make the list shorter and the week unreadable - which is the opposite of
 * what a second reading is for.
 */
test('a day with nothing on it keeps its place and says so', () => {
  seed()
  render(<WeekAgenda dates={DATES} onOpenDay={() => {}} onOpenTask={() => {}} />)

  const tuesday = screen.getByRole('button', { name: 'Tuesday, September 8' }).closest('section')!
  expect(within(tuesday).getByText('Nothing on this day.')).toBeInTheDocument()
})

test('the date opens the day, and a row opens the task', async () => {
  const user = userEvent.setup()
  const onOpenDay = vi.fn()
  const onOpenTask = vi.fn()
  seed()
  render(<WeekAgenda dates={DATES} onOpenDay={onOpenDay} onOpenTask={onOpenTask} />)

  await user.click(screen.getByRole('button', { name: 'Monday, September 7' }))
  expect(onOpenDay).toHaveBeenCalledWith('2026-09-07')

  await user.click(screen.getByRole('button', { name: /Job hunt/ }))
  expect(onOpenTask).toHaveBeenCalledWith('2026-09-07', 'a')
})

/**
 * The window without today is built from today rather than written down: the
 * fixture dates are a real week in September 2026, and on the three mornings
 * that week actually arrives, a hardcoded "these are not today" is wrong.
 * This failed for real on 7 September 2026, which is the only kind of proof
 * that matters for a date in a test.
 */
test('today is the one day marked, and only when it is in the window', () => {
  seed()
  const notToday = [addDays(todayKey(), 30), addDays(todayKey(), 31), addDays(todayKey(), 32)]
  const { container, unmount } = render(<WeekAgenda dates={notToday} onOpenDay={() => {}} onOpenTask={() => {}} />)
  expect(container.querySelectorAll('.agenda-day.is-today')).toHaveLength(0)
  unmount()

  const { container: withToday } = render(
    <WeekAgenda dates={[todayKey(), ...notToday]} onOpenDay={() => {}} onOpenTask={() => {}} />,
  )
  expect(withToday.querySelectorAll('.agenda-day.is-today')).toHaveLength(1)
})

// Nothing on this screen totals anything. The grid's own footers carry a
// ratio where it belongs, on a day that has happened; a list of what is
// coming has nothing to count.
test('it counts nothing', () => {
  seed()
  const { container } = render(<WeekAgenda dates={DATES} onOpenDay={() => {}} onOpenTask={() => {}} />)
  expect(container.textContent).not.toMatch(/\d+\s*(of|\/)\s*\d+|%|left|remaining/i)
})

// --- Later, under the week -----------------------------------------------------

/**
 * The shelf keeps every rule it keeps on the day view - CONVENTIONS section
 * 14 - and gains exactly one thing here: what you have without a day, beside
 * what you have with one.
 */
test('Later says nothing but a count until it is opened', async () => {
  const user = userEvent.setup()
  actions.addLaterItem({ title: 'Move the ISA' })!
  actions.addLaterItem({ title: 'Reread the lease' })
  const { container } = render(<LaterStrip onScheduled={() => {}} />)

  const fold = screen.getByRole('button', { name: /^Later/ })
  expect(fold).toHaveTextContent('2')
  expect(container.querySelector('.later-strip-list')).toHaveAttribute('hidden')
  // No age, no badge, no accent, nothing that says how long any of it has sat
  // there - LaterItem has no createdAt on purpose.
  expect(container.textContent).not.toMatch(/\d+\s*(day|week|month)s?\b|ago|since then|waiting|unprocessed/i)

  await user.click(fold)
  expect(container.querySelector('.later-strip-list')).not.toHaveAttribute('hidden')
  expect(screen.getByRole('button', { name: 'Move the ISA' })).toBeInTheDocument()
})

test('an empty Later shows nothing at all, not an empty fold', () => {
  const { container } = render(<LaterStrip onScheduled={() => {}} />)
  expect(container).toBeEmptyDOMElement()
})

/**
 * The drop lands the item at the day's next free slot rather than at the
 * height it was dropped on. A week column is a timeline and a drop halfway
 * down it looks like it means 13:40, but the item has no time and often no
 * size - `nextSlotFor` puts it where the day genuinely has room. Until v2.7
 * the drop landed the item with no time at all while its comment promised
 * this; the time is asserted now, not only the day.
 */
test('dragging one onto a day plans it there, at a time, and takes it off the shelf', async () => {
  const user = userEvent.setup()
  const onScheduled = vi.fn()
  actions.addTask('2026-09-08', 'Standup', '07:00')
  actions.setTaskMinutes('2026-09-08', getData().days['2026-09-08'].tasks[0].id, 60)
  const item = actions.addLaterItem({ title: 'Move the ISA', minutes: 45 })!

  render(
    <div>
      <div data-week-date="2026-09-08" style={{ width: 100, height: 100 }} />
      <LaterStrip onScheduled={onScheduled} />
    </div>,
  )
  await user.click(screen.getByRole('button', { name: /^Later/ }))

  const chip = screen.getByRole('button', { name: 'Move the ISA' })
  const column = document.querySelector('[data-week-date]')!
  // jsdom has no layout and no elementFromPoint at all, so it is told what is
  // under the pointer. The geometry is the browser's job and is covered by the
  // sweep; what is pinned here is what happens on a drop, not where it lands.
  document.elementFromPoint = () => column

  chip.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 0, clientY: 0 }))
  document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 200, clientY: 200 }))

  expect(getData().backlog.find(b => b.id === item.id)).toBeUndefined()
  const landed = getData().days['2026-09-08']?.tasks.at(-1)
  expect(landed).toMatchObject({ title: 'Move the ISA', minutes: 45 })
  // The first gap after Standup that holds three quarters of an hour.
  expect(landed?.time).toBe('08:00')
  // Said as a day's name, not as a date key.
  expect(onScheduled).toHaveBeenCalledWith('Move the ISA is on Tue')
})

// A press that does not move is not a drag. An item here has no day, so there
// is nothing for a tap to open - and a tap that quietly scheduled it somewhere
// would be the one thing this shelf must never do.
test('a press that goes nowhere plans nothing', async () => {
  const user = userEvent.setup()
  const item = actions.addLaterItem({ title: 'Move the ISA' })!
  render(<LaterStrip onScheduled={() => {}} />)
  await user.click(screen.getByRole('button', { name: /^Later/ }))

  const chip = screen.getByRole('button', { name: 'Move the ISA' })
  chip.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 10, clientY: 10 }))
  document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 12, clientY: 11 }))

  expect(getData().backlog.find(b => b.id === item.id)).toBeTruthy()
})

// --- the journal under a day ---------------------------------------------------

/**
 * What was written on a day, under what was on it, as it was written - and
 * nothing at all for a day with none. Not an empty block, not a prompt, no
 * labels: since v2.5 there are no fields to label. See DECISIONS "A
 * journal, not a form".
 */
test("a day's writing reads under its tasks, and a day without any shows nothing for it", () => {
  seed()
  actions.setJournal('2026-09-07', 'Ship the pricing page\nStart with the walk')
  render(<WeekAgenda dates={DATES} onOpenDay={() => {}} onOpenTask={() => {}} />)

  expect(screen.getByText(/Ship the pricing page/)).toBeInTheDocument()
  expect(screen.getByText(/Start with the walk/)).toBeInTheDocument()
  expect(document.querySelectorAll('.agenda-journal')).toHaveLength(1)
})
