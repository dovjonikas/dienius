import { beforeEach, expect, test, vi } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WeekView, visibleWeekDays } from './WeekView'
import { actions, getData } from '../../lib/store'
import { defaultData } from '../../lib/storage'
import { weekOf } from '../../lib/dates'

const DATE = '2026-09-02'
const WEEK = weekOf(DATE)
const MON = WEEK[0]
const TUE = WEEK[1]

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
  // jsdom has no hit testing at all, so the property a drop reads does not
  // exist to be spied on until it is put there.
  document.elementFromPoint = () => null
  // useIsWide reads matchMedia; jsdom has none, so the hook's own try/catch
  // treats the viewport as narrow. Stubbed wide here because the seven-column
  // week is the case these are about; the three-day one has its own test.
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: true,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
})

function renderWeek(date = DATE) {
  const onOpenDay = vi.fn()
  const onDateChange = vi.fn()
  const result = render(<WeekView date={date} onDateChange={onDateChange} onOpenDay={onOpenDay} />)
  return { ...result, onOpenDay, onDateChange }
}

function column(date: string): HTMLElement {
  const el = document.querySelector<HTMLElement>(`[data-week-date="${date}"]`)
  if (!el) throw new Error(`no column for ${date}`)
  return el
}

/**
 * A whole drag gesture: press the block, release it over `onto`.
 *
 * The drop reads `document.elementFromPoint`, and jsdom has no hit testing, so
 * the target is supplied rather than found. `distance` is what separates a
 * drag from a tap that wobbled - see MIN_DRAG_DISTANCE_PX.
 */
function dragBlock(block: HTMLElement, onto: Element, distance = 200) {
  vi.spyOn(document, 'elementFromPoint').mockReturnValue(onto)
  act(() => {
    block.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 10, clientY: 10 }))
    document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 10 + distance, clientY: 12 }))
  })
}

/**
 * The week exists to answer a question neither Today nor the month can: does
 * this week hold together. These cover the four things you do to it once you
 * can see that - move a block to another day, open one, put one somewhere
 * empty, and lay a template over the days that have none.
 */

test('the whole week is drawn, Monday first', () => {
  renderWeek()
  const dates = [...document.querySelectorAll('[data-week-date]')].map(el => (el as HTMLElement).dataset.weekDate)
  expect(dates).toEqual(WEEK)
})

test('only tasks with a time are drawn - the rest are counted, not invented onto the grid', () => {
  actions.addTask(MON, 'Standup', '09:00')
  actions.addTask(MON, 'Someday')
  renderWeek()

  const blocks = within(column(MON)).getAllByRole('button', { name: /Standup/ })
  expect(blocks).toHaveLength(1)
  expect(within(column(MON)).queryByRole('button', { name: /Someday/ })).toBeNull()
  // Counted in the footer, so a column that looks empty is never silently so.
  expect(column(MON).textContent).toContain('~1')
})

// --- moving a block between days ----------------------------------------

/**
 * The interaction the whole view is for. Note what it is not: a push. See
 * actions.moveTaskToDay - dragging Thursday's dentist onto Friday because that
 * is when it actually is has nothing to do with a task that keeps failing to
 * happen, and counting it would eventually trip the two-push bound on
 * something nobody has ever postponed.
 */
test('dragging a block to another day moves the task and keeps its time', async () => {
  actions.addTask(MON, 'Dentist', '14:00')
  const { container } = renderWeek()
  const block = within(column(MON)).getByRole('button', { name: /Dentist/ })

  dragBlock(block, column(TUE))

  expect(getData().days[MON].tasks).toHaveLength(0)
  expect(getData().days[TUE].tasks[0]).toMatchObject({ title: 'Dentist', time: '14:00' })
  expect(getData().days[TUE].tasks[0].pushCount).toBeUndefined()
  expect(container.textContent).toBeTruthy()
})

test('a drag that never really moved opens the task instead of relocating it', async () => {
  actions.addTask(MON, 'Dentist', '14:00')
  renderWeek()
  const block = within(column(MON)).getByRole('button', { name: /Dentist/ })
  // Two pixels is a finger holding still, not a drag.
  dragBlock(block, column(TUE), 2)

  expect(getData().days[MON].tasks).toHaveLength(1)
  expect(screen.getByRole('dialog', { name: /Dentist/i })).toBeInTheDocument()
})

test('dropping a block back on its own day changes nothing', () => {
  actions.addTask(MON, 'Dentist', '14:00')
  renderWeek()
  const block = within(column(MON)).getByRole('button', { name: /Dentist/ })
  dragBlock(block, column(MON))

  expect(getData().days[MON].tasks).toHaveLength(1)
})

test('a drop outside every column is a cancelled drag, not a lost task', () => {
  actions.addTask(MON, 'Dentist', '14:00')
  renderWeek()
  const block = within(column(MON)).getByRole('button', { name: /Dentist/ })
  dragBlock(block, document.body)

  expect(getData().days[MON].tasks).toHaveLength(1)
})

/**
 * A template block dragged onto a day that already has the same block would
 * make two of it - the exact duplication `origin` was added to stop. The move
 * is refused and said out loud, because a drag that silently snaps back reads
 * as a broken gesture rather than as an answer.
 */
test('a day that already has that task refuses the move and says so', () => {
  const template = actions.addTemplate({
    name: 'Work',
    color: '#8ab6f9',
    blocks: [{ time: '09:00', title: 'Standup' }],
  })
  actions.stamp({ [MON]: template.id, [TUE]: template.id })
  renderWeek()

  const block = within(column(MON)).getByRole('button', { name: /Standup/ })
  dragBlock(block, column(TUE))

  expect(getData().days[MON].tasks).toHaveLength(1)
  expect(getData().days[TUE].tasks).toHaveLength(1)
  expect(document.querySelector('[aria-live]')?.textContent).toMatch(/already has/i)
})

// --- putting something in an empty space ---------------------------------

test('clicking an empty column adds a task on that day, at that time, ready to name', async () => {
  const user = userEvent.setup()
  renderWeek()
  const track = column(TUE).querySelector<HTMLElement>('.week-track')!
  // jsdom gives every element a zero-size rect, so the click reads as the very
  // top of the track - which is the start of the window.
  await user.click(track)

  const added = getData().days[TUE].tasks
  expect(added).toHaveLength(1)
  expect(added[0].time).toBe('07:00')
  // Straight into the sheet: "New task" is the placeholder the gesture leaves
  // behind while you type the real one, not the point of it.
  expect(screen.getByRole('dialog')).toBeInTheDocument()
})

test('clicking a block does not also count as clicking the empty space under it', async () => {
  const user = userEvent.setup()
  actions.addTask(TUE, 'Standup', '09:00')
  renderWeek()

  await user.click(within(column(TUE)).getByRole('button', { name: /Standup/ }))
  expect(getData().days[TUE].tasks).toHaveLength(1)
})

// --- stamping -------------------------------------------------------------

test('a column header stamps a template straight onto its own day', async () => {
  const user = userEvent.setup()
  const template = actions.addTemplate({ name: 'Work', color: '#8ab6f9', blocks: [{ time: '09:00', title: 'Standup' }] })
  actions.setWeekdayTemplate(1, template.id) // Monday
  renderWeek()

  await user.click(within(column(MON)).getByRole('button', { name: /Stamp Work onto/i }))
  expect(getData().days[MON].tasks.map(t => t.title)).toEqual(['Standup'])
})

// Stamp week and the arrows moved to the calendar bar - see CalendarView.test.

test('a column header opens that day', async () => {
  const user = userEvent.setup()
  const { onOpenDay } = renderWeek()
  await user.click(within(column(TUE)).getByRole('button', { name: /Open Tue/ }))
  expect(onOpenDay).toHaveBeenCalledWith(TUE)
})

// --- the phone ------------------------------------------------------------

/**
 * Three days, not seven, and not a vertical list - see NARROW_DAYS. At 390px
 * seven columns are 47px each, which is a stripe rather than a block; a list
 * would just be the Today view repeated, which the app already has.
 */
test('a narrow screen shows three days around the one chosen, not seven', () => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
  renderWeek(DATE)
  const dates = [...document.querySelectorAll('[data-week-date]')].map(el => (el as HTMLElement).dataset.weekDate)
  expect(dates).toEqual(['2026-09-01', '2026-09-02', '2026-09-03'])
})

test('the visible days are the whole week when wide and the chosen day with its neighbours when not', () => {
  expect(visibleWeekDays(DATE, true)).toEqual(WEEK)
  expect(visibleWeekDays(DATE, false)).toEqual(['2026-09-01', '2026-09-02', '2026-09-03'])
})
