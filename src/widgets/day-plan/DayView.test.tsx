import { beforeEach, expect, test } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DayView } from './DayView'
import { consumeDraft, saveDraft } from './draft'
import { actions, getData } from '../../lib/store'
import { defaultData } from '../../lib/storage'

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  actions.resetForTests(defaultData())
})

test('quick add creates a task on Enter', async () => {
  const user = userEvent.setup()
  const { container } = render(<DayView date="2026-09-01" onDateChange={() => {}} />)
  await user.type(screen.getByPlaceholderText(/add a task/i), '14:00 Call mom{Enter}')
  // Scoped to the task list: the same anchor also appears in the read-only
  // timeline grid above it, which is a second, aria-hidden picture of the
  // exact same task rather than a separate one.
  const taskList = within(container.querySelector('.task-list')!)
  expect(taskList.getByText('Call mom')).toBeInTheDocument()
  expect(taskList.getByText('14:00')).toBeInTheDocument()
})

test('a draft left over from before a reload is restored into the input', () => {
  saveDraft('2026-09-01', 'half-typed task')
  render(<DayView date="2026-09-01" onDateChange={() => {}} />)
  expect(screen.getByPlaceholderText(/add a task/i)).toHaveValue('half-typed task')
})

test('typing saves a draft, and finishing the task clears it', async () => {
  const user = userEvent.setup()
  render(<DayView date="2026-09-01" onDateChange={() => {}} />)
  await user.type(screen.getByPlaceholderText(/add a task/i), 'Call mom')
  expect(consumeDraft('2026-09-01')).toBe('Call mom')

  // consumeDraft above already cleared it; put it back to prove submitting
  // clears it too, not just consuming it once for this assertion.
  saveDraft('2026-09-01', 'Call mom')
  await user.type(screen.getByPlaceholderText(/add a task/i), '{Enter}')
  expect(consumeDraft('2026-09-01')).toBe('')
})

test('a draft saved for a different day is not restored here', () => {
  saveDraft('2026-09-02', 'wrong day')
  render(<DayView date="2026-09-01" onDateChange={() => {}} />)
  expect(screen.getByPlaceholderText(/add a task/i)).toHaveValue('')
})

test('clicking a task toggles done', async () => {
  const user = userEvent.setup()
  actions.addTask('2026-09-01', 'Gym')
  render(<DayView date="2026-09-01" onDateChange={() => {}} />)
  await user.click(screen.getByRole('checkbox', { name: /gym/i }))
  expect(screen.getByRole('checkbox', { name: /gym/i })).toBeChecked()
})

test('rollover button moves unfinished tasks to tomorrow', async () => {
  const user = userEvent.setup()
  actions.addTask('2026-09-01', 'Unfinished')
  render(<DayView date="2026-09-01" onDateChange={() => {}} />)
  await user.click(screen.getByRole('button', { name: /move .* to tomorrow/i }))
  expect(screen.queryByText('Unfinished')).not.toBeInTheDocument()
  const tomorrow = getData().days['2026-09-02']
  expect(tomorrow?.tasks.map(t => t.title)).toEqual(['Unfinished'])
})

test('renders without crashing when a day points at a deleted template', () => {
  actions.resetForTests({
    ...defaultData(),
    days: {
      '2026-09-01': { date: '2026-09-01', templateId: 'missing-template', tasks: [] },
    },
  })
  const { container } = render(<DayView date="2026-09-01" onDateChange={() => {}} />)
  expect(screen.getByPlaceholderText(/add a task/i)).toBeInTheDocument()
  expect(container.querySelector('.day-template')).toBeNull()
})

test('arrows navigate between days', async () => {
  const user = userEvent.setup()
  let navigated = ''
  render(<DayView date="2026-09-01" onDateChange={d => (navigated = d)} />)
  await user.click(screen.getByRole('button', { name: 'Next day' }))
  expect(navigated).toBe('2026-09-02')
})

test('a task that has never been pushed shows no push count', () => {
  actions.addTask('2026-09-01', 'Fresh')
  render(<DayView date="2026-09-01" onDateChange={() => {}} />)
  expect(screen.queryByText(/pushed/i)).not.toBeInTheDocument()
})

test('a task pushed once shows a quiet push count', () => {
  actions.addTask('2026-09-01', 'Once pushed')
  const id = getData().days['2026-09-01'].tasks[0].id
  actions.resetForTests({
    ...getData(),
    days: {
      ...getData().days,
      '2026-09-01': {
        ...getData().days['2026-09-01'],
        tasks: getData().days['2026-09-01'].tasks.map(t => (t.id === id ? { ...t, pushCount: 1 } : t)),
      },
    },
  })
  render(<DayView date="2026-09-01" onDateChange={() => {}} />)
  const badge = screen.getByText(/pushed once/i)
  expect(badge).toBeInTheDocument()

  // The push state must be announced along with the task, not only visible.
  const checkbox = screen.getByRole('checkbox', { name: /once pushed/i })
  const describedBy = checkbox.getAttribute('aria-describedby')
  expect(describedBy).toBeTruthy()
  expect(document.getElementById(describedBy!)).toBe(badge)
})

test('a task at the push bound carries a quiet mark on the row, and the full do-or-delete sentence in its menu', async () => {
  const user = userEvent.setup()
  actions.addTask('2026-09-01', 'Maxed out')
  const id = getData().days['2026-09-01'].tasks[0].id
  actions.resetForTests({
    ...getData(),
    days: {
      ...getData().days,
      '2026-09-01': {
        ...getData().days['2026-09-01'],
        tasks: getData().days['2026-09-01'].tasks.map(t => (t.id === id ? { ...t, pushCount: 2 } : t)),
      },
    },
  })
  const { container } = render(<DayView date="2026-09-01" onDateChange={() => {}} />)
  // The row itself stays quiet: a short mark, not a separate paragraph.
  expect(container.querySelector('p.task-maxed-note')).toBeNull()
  const mark = screen.getByText(/pushed twice/i)
  expect(mark).toBeInTheDocument()

  // The mark must be announced along with the task, full sentence included -
  // it never became invisible, only quieter until asked for.
  const checkbox = screen.getByRole('checkbox', { name: /maxed out/i })
  const describedBy = checkbox.getAttribute('aria-describedby')
  expect(describedBy).toBeTruthy()
  expect(document.getElementById(describedBy!)).toBe(mark)
  expect(mark).toHaveTextContent(/pushed twice - do it today, let it go, or mark it ongoing/i)

  // The decision is made where its explanation now lives: the actions menu.
  await user.click(screen.getByRole('button', { name: 'More actions for Maxed out' }))
  const dialog = screen.getByRole('dialog', { name: 'Maxed out' })
  expect(within(dialog).getByText(/pushed twice - do it today, let it go, or mark it ongoing/i)).toBeInTheDocument()
  expect(within(dialog).getByRole('button', { name: 'Mark Maxed out as ongoing' })).toBeInTheDocument()
  expect(within(dialog).getByRole('button', { name: 'Let go of Maxed out' })).toBeInTheDocument()
})

test('marking a maxed task ongoing through its menu clears the do-or-delete mark and lets it keep being pushed', async () => {
  const user = userEvent.setup()
  actions.addTask('2026-09-01', 'Standing task')
  const id = getData().days['2026-09-01'].tasks[0].id
  actions.resetForTests({
    ...getData(),
    days: {
      ...getData().days,
      '2026-09-01': {
        ...getData().days['2026-09-01'],
        tasks: getData().days['2026-09-01'].tasks.map(t => (t.id === id ? { ...t, pushCount: 2 } : t)),
      },
    },
  })
  render(<DayView date="2026-09-01" onDateChange={() => {}} />)
  await user.click(screen.getByRole('button', { name: 'More actions for Standing task' }))
  await user.click(screen.getByRole('button', { name: 'Mark Standing task as ongoing' }))

  expect(getData().days['2026-09-01'].tasks[0].unbounded).toBe(true)
  expect(screen.queryByText(/do it today, let it go, or mark it ongoing/i)).not.toBeInTheDocument()
  expect(screen.getByText('ongoing')).toBeInTheDocument()

  // Still pushable past the bound, right away.
  await user.click(screen.getByRole('button', { name: 'More actions for Standing task' }))
  expect(screen.getByRole('button', { name: 'Push Standing task to tomorrow' })).toBeInTheDocument()
})

test('an ongoing task carries a quiet, reversible mark instead of the maxed sentence', async () => {
  const user = userEvent.setup()
  actions.addTask('2026-09-01', 'Standing task')
  const id = getData().days['2026-09-01'].tasks[0].id
  actions.resetForTests({
    ...getData(),
    days: {
      ...getData().days,
      '2026-09-01': {
        ...getData().days['2026-09-01'],
        tasks: getData().days['2026-09-01'].tasks.map(t =>
          t.id === id ? { ...t, pushCount: 6, unbounded: true } : t,
        ),
      },
    },
  })
  render(<DayView date="2026-09-01" onDateChange={() => {}} />)
  expect(screen.queryByText(/do it today, let it go, or mark it ongoing/i)).not.toBeInTheDocument()
  const mark = screen.getByText('ongoing')
  expect(mark).toBeInTheDocument()

  // Reversible without hunting: one extra tap through the row's own menu.
  await user.click(screen.getByRole('button', { name: 'More actions for Standing task' }))
  await user.click(screen.getByRole('button', { name: 'Stop treating Standing task as ongoing' }))
  expect(getData().days['2026-09-01'].tasks[0].unbounded).toBeUndefined()
  // With pushCount still at the bound and unbounded now cleared, the
  // do-or-delete mark reappears - the choice was undone, not erased.
  expect(screen.getByText(/pushed/i)).toBeInTheDocument()
})

test('an ongoing task shows no push count, even after many more pushes than the bound', () => {
  actions.addTask('2026-09-01', 'Standing task')
  const id = getData().days['2026-09-01'].tasks[0].id
  actions.resetForTests({
    ...getData(),
    days: {
      ...getData().days,
      '2026-09-01': {
        ...getData().days['2026-09-01'],
        tasks: getData().days['2026-09-01'].tasks.map(t =>
          t.id === id ? { ...t, pushCount: 9, unbounded: true } : t,
        ),
      },
    },
  })
  render(<DayView date="2026-09-01" onDateChange={() => {}} />)
  expect(screen.queryByText(/pushed/i)).not.toBeInTheDocument()
})

test('an ordinary task under the bound shows neither the ongoing label nor the mark-ongoing control', () => {
  actions.addTask('2026-09-01', 'Fresh')
  render(<DayView date="2026-09-01" onDateChange={() => {}} />)
  expect(screen.queryByRole('button', { name: /is ongoing/i })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /mark .* as ongoing/i })).not.toBeInTheDocument()
})

test('rollover button explains when some tasks moved and some stayed behind', async () => {
  const user = userEvent.setup()
  actions.addTask('2026-09-01', 'Fresh task')
  actions.addTask('2026-09-01', 'Maxed task')
  const maxedId = getData().days['2026-09-01'].tasks[1].id
  actions.resetForTests({
    ...getData(),
    days: {
      ...getData().days,
      '2026-09-01': {
        ...getData().days['2026-09-01'],
        tasks: getData().days['2026-09-01'].tasks.map(t =>
          t.id === maxedId ? { ...t, pushCount: 2 } : t,
        ),
      },
    },
  })
  render(<DayView date="2026-09-01" onDateChange={() => {}} />)
  const button = screen.getByRole('button', { name: /move 1 to tomorrow/i })
  expect(button).toHaveTextContent(/1 (is )?stay/i)
  await user.click(button)
  expect(screen.queryByText('Fresh task')).not.toBeInTheDocument()
  expect(screen.getByText('Maxed task')).toBeInTheDocument()
})

test('an empty day shows no score at all', () => {
  render(<DayView date="2026-09-01" onDateChange={() => {}} />)
  expect(screen.queryByText(/^\d+\/\d+$/)).not.toBeInTheDocument()
})

test('a planned day shows done over total as a plain fraction', () => {
  actions.addTask('2026-09-01', 'One')
  actions.addTask('2026-09-01', 'Two')
  render(<DayView date="2026-09-01" onDateChange={() => {}} />)
  expect(screen.getByText('0/2')).toBeInTheDocument()
})

test('checking a task updates the score live', async () => {
  const user = userEvent.setup()
  actions.addTask('2026-09-01', 'One')
  actions.addTask('2026-09-01', 'Two')
  render(<DayView date="2026-09-01" onDateChange={() => {}} />)
  expect(screen.getByText('0/2')).toBeInTheDocument()
  await user.click(screen.getByRole('checkbox', { name: /one/i }))
  expect(screen.getByText('1/2')).toBeInTheDocument()
})

test('the score is announced to screen readers as a sentence, not a fraction', () => {
  actions.addTask('2026-09-01', 'One')
  render(<DayView date="2026-09-01" onDateChange={() => {}} />)

  // The spoken sentence exists and is not itself hidden from assistive tech.
  const spoken = screen.getByText('0 of 1 done')
  expect(spoken).toBeInTheDocument()
  expect(spoken).not.toHaveAttribute('aria-hidden')

  // The visible fraction is hidden from assistive tech, so a screen reader
  // reads the sentence above instead of "zero slash one".
  const visibleFraction = screen.getByText('0/1')
  expect(visibleFraction).toHaveAttribute('aria-hidden', 'true')
})

test('a full day scores every task and shows no core annotation, even with a template stamped', () => {
  actions.resetForTests({
    ...defaultData(),
    days: {
      '2026-09-01': {
        date: '2026-09-01',
        dayType: 'full',
        tasks: [
          { id: 'a', title: 'Core one', done: true, core: true },
          { id: 'b', title: 'Optional one', done: false },
        ],
      },
    },
  })
  render(<DayView date="2026-09-01" onDateChange={() => {}} />)
  expect(screen.getByText('1/2')).toBeInTheDocument()
  expect(screen.queryByText('core')).not.toBeInTheDocument()
})

test('a shift day scores only core tasks and says so next to the fraction', () => {
  actions.resetForTests({
    ...defaultData(),
    days: {
      '2026-09-01': {
        date: '2026-09-01',
        dayType: 'shift',
        tasks: [
          { id: 'a', title: 'Clock in', done: true, core: true },
          { id: 'b', title: 'Clock out', done: false, core: true },
          { id: 'c', title: 'Grab coffee', done: true },
        ],
      },
    },
  })
  render(<DayView date="2026-09-01" onDateChange={() => {}} />)
  expect(screen.getByText('1/2')).toBeInTheDocument()
  const spoken = screen.getByText('1 of 2 core tasks done')
  expect(spoken).toBeInTheDocument()
  expect(spoken).not.toHaveAttribute('aria-hidden')
})

test('on a shift day, core tasks carry a visible and announced core marker and optional tasks do not', () => {
  actions.resetForTests({
    ...defaultData(),
    days: {
      '2026-09-01': {
        date: '2026-09-01',
        dayType: 'shift',
        tasks: [
          { id: 'a', title: 'Clock in', done: false, core: true },
          { id: 'b', title: 'Grab coffee', done: false },
        ],
      },
    },
  })
  const { container } = render(<DayView date="2026-09-01" onDateChange={() => {}} />)
  const badges = container.querySelectorAll('.task-core')
  expect(badges).toHaveLength(1)

  const checkbox = screen.getByRole('checkbox', { name: /clock in/i })
  const describedBy = checkbox.getAttribute('aria-describedby')
  expect(describedBy).toBeTruthy()
  expect(document.getElementById(describedBy!.split(' ')[0])).toBe(badges[0])

  const optionalCheckbox = screen.getByRole('checkbox', { name: /grab coffee/i })
  expect(optionalCheckbox).not.toHaveAttribute('aria-describedby')
})

test('on a shift day with tasks but none of them core, no score shows at all', () => {
  actions.resetForTests({
    ...defaultData(),
    days: {
      '2026-09-01': {
        date: '2026-09-01',
        dayType: 'shift',
        tasks: [{ id: 'a', title: 'Grab coffee', done: false }],
      },
    },
  })
  render(<DayView date="2026-09-01" onDateChange={() => {}} />)
  expect(screen.queryByText(/^\d+\/\d+$/)).not.toBeInTheDocument()
  expect(screen.queryByText('core')).not.toBeInTheDocument()
})

test('a task pushed once on a shift day still shows both its core and pushed markers', () => {
  actions.resetForTests({
    ...defaultData(),
    days: {
      '2026-09-01': {
        date: '2026-09-01',
        dayType: 'shift',
        tasks: [{ id: 'a', title: 'Clock in', done: false, core: true, pushCount: 1 }],
      },
    },
  })
  const { container } = render(<DayView date="2026-09-01" onDateChange={() => {}} />)
  const checkbox = screen.getByRole('checkbox', { name: /clock in/i })
  const describedBy = checkbox.getAttribute('aria-describedby')!.split(' ')
  expect(describedBy).toHaveLength(2)
  expect(container.querySelectorAll('.task-core')).toHaveLength(1)
  expect(screen.getByText(/pushed once/i)).toBeInTheDocument()
})

test('an empty day shows no capacity line at all', () => {
  render(<DayView date="2026-09-01" onDateChange={() => {}} />)
  expect(screen.queryByText(/anchors take|floats need/i)).not.toBeInTheDocument()
})

test('a day with only floats shows their total with no anchors or gaps claim', () => {
  actions.resetForTests({
    ...defaultData(),
    days: {
      '2026-09-01': {
        date: '2026-09-01',
        tasks: [
          { id: 'a', title: 'Publish video', done: false, minutes: 200 },
          { id: 'b', title: 'Guitar', done: false, minutes: 20 },
        ],
      },
    },
  })
  render(<DayView date="2026-09-01" onDateChange={() => {}} />)
  expect(screen.getByText('Floats need about 3h40.')).toBeInTheDocument()
})

test('a fully sized day renders the exact capacity sentence from the anchors and floats it contains', () => {
  actions.resetForTests({
    ...defaultData(),
    days: {
      '2026-09-01': {
        date: '2026-09-01',
        tasks: [
          { id: 'shift', title: 'Shift', done: false, time: '07:00', minutes: 240 },
          { id: 'gym', title: 'Gym', done: false, time: '11:30', minutes: 60 },
          { id: 'call', title: 'Call', done: false, time: '14:00', minutes: 30 },
          { id: 'dinner', title: 'Dinner prep', done: false, time: '17:20', minutes: 40 },
          { id: 'video', title: 'Publish video', done: false, minutes: 200 },
          { id: 'guitar', title: 'Guitar', done: false, minutes: 20 },
          { id: 'grandma', title: 'Call grandma', done: false, minutes: 130 },
        ],
      },
    },
  })
  render(<DayView date="2026-09-01" onDateChange={() => {}} />)
  expect(
    screen.getByText('Anchors take 6h10. Free: 9h50 across 4 gaps. Floats need about 5h50.'),
  ).toBeInTheDocument()
})

test('a mid-day shift leaves real free time within the window, not a false "no free time" claim', () => {
  actions.resetForTests({
    ...defaultData(),
    days: {
      '2026-09-01': {
        date: '2026-09-01',
        tasks: [{ id: 'shift', title: 'Shift', done: false, time: '09:00', minutes: 720 }],
      },
    },
  })
  render(<DayView date="2026-09-01" onDateChange={() => {}} />)
  expect(screen.getByText('Anchors take 12h. Free: 4h across 2 gaps.')).toBeInTheDocument()
  expect(screen.queryByText(/no free time/i)).not.toBeInTheDocument()
})

test('when floats exceed free time, the line states it plainly with no embedded action', async () => {
  actions.resetForTests({
    ...defaultData(),
    days: {
      '2026-09-01': {
        date: '2026-09-01',
        tasks: [
          { id: 'shift', title: 'Shift', done: false, time: '00:00', minutes: 1080 },
          { id: 'small', title: 'Small errand', done: false, minutes: 20 },
          { id: 'big', title: 'Big errand', done: false, minutes: 400 },
        ],
      },
    },
  })
  const { container } = render(<DayView date="2026-09-01" onDateChange={() => {}} />)
  // The shift runs 00:00-18:00; only the 07:00-18:00 portion falls inside
  // the 07:00-23:00 window, leaving 18:00-23:00 (5h) free. It started
  // before the window opened, so the sentence says the figure is only
  // today's portion rather than implying the shift itself was 11 hours.
  expect(
    screen.getByText("Anchors take 11h within today's window. Free: 5h across 1 gap. Floats need about 7h. You are 2h over."),
  ).toBeInTheDocument()
  // The capacity line itself carries no button - it only ever states the arithmetic.
  expect(container.querySelector('.capacity-line button')).toBeNull()
})

test('the capacity line never uses an alarming word for the over case', () => {
  actions.resetForTests({
    ...defaultData(),
    days: {
      '2026-09-01': {
        date: '2026-09-01',
        tasks: [
          { id: 'shift', title: 'Shift', done: false, time: '00:00', minutes: 1080 },
          { id: 'errand', title: 'Errand', done: false, minutes: 500 },
        ],
      },
    },
  })
  const { container } = render(<DayView date="2026-09-01" onDateChange={() => {}} />)
  expect(screen.getByText(/you are/i)).toBeInTheDocument()
  expect(container.querySelector('.capacity-line')).not.toHaveTextContent(/warning|danger|alert|!/i)
})

test('a night-type day uses the night window instead of the default one', () => {
  actions.resetForTests({
    ...defaultData(),
    days: {
      '2026-09-01': {
        date: '2026-09-01',
        dayType: 'night',
        tasks: [{ id: 'shift', title: 'Night shift', done: false, time: '22:00', minutes: 480 }],
      },
    },
  })
  render(<DayView date="2026-09-01" onDateChange={() => {}} />)
  // Only the 22:00-24:00 portion of the shift falls inside the night
  // window (13:00-24:00); the default 07:00-23:00 window would have
  // clipped it to just one hour instead of two. The shift itself runs
  // eight hours, so the sentence flags the figure as today's portion
  // rather than implying the shift was two hours long.
  expect(screen.getByText("Anchors take 2h within today's window. Free: 9h across 1 gap.")).toBeInTheDocument()
})

test('a night shift crossing midnight reads as a partial figure, not as the shift\'s real length', () => {
  actions.resetForTests({
    ...defaultData(),
    days: {
      '2026-09-01': {
        date: '2026-09-01',
        dayType: 'night',
        tasks: [
          { id: 'shift', title: 'Night shift', done: false, time: '22:00', minutes: 480 },
          { id: 'wind-down', title: 'Wind-down task', done: false, minutes: 30 },
        ],
      },
    },
  })
  render(<DayView date="2026-09-01" onDateChange={() => {}} />)
  expect(
    screen.getByText("Anchors take 2h within today's window. Free: 9h across 1 gap. Floats need about 30 min."),
  ).toBeInTheDocument()
})

test('each float offers its own push-to-tomorrow control through its menu, so the owner picks which one moves', async () => {
  const user = userEvent.setup()
  actions.resetForTests({
    ...defaultData(),
    days: {
      '2026-09-01': {
        date: '2026-09-01',
        tasks: [
          { id: 'shift', title: 'Shift', done: false, time: '00:00', minutes: 1080 },
          { id: 'small', title: 'Small errand', done: false, minutes: 20 },
          { id: 'big', title: 'Big errand', done: false, minutes: 400 },
        ],
      },
    },
  })
  render(<DayView date="2026-09-01" onDateChange={() => {}} />)

  // Both floats offer the control - the app never pre-selects the larger one.
  await user.click(screen.getByRole('button', { name: 'More actions for Small errand' }))
  expect(screen.getByRole('button', { name: 'Push Small errand to tomorrow' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Close' }))
  await user.click(screen.getByRole('button', { name: 'More actions for Big errand' }))
  expect(screen.getByRole('button', { name: 'Push Big errand to tomorrow' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Push Big errand to tomorrow' }))

  expect(screen.queryByText('Big errand')).not.toBeInTheDocument()
  expect(screen.getByText('Small errand')).toBeInTheDocument()
  expect(getData().days['2026-09-02']?.tasks.map(t => t.title)).toEqual(['Big errand'])
})

test('an anchor never offers a push-to-tomorrow control - only floats do', async () => {
  const user = userEvent.setup()
  actions.resetForTests({
    ...defaultData(),
    days: {
      '2026-09-01': {
        date: '2026-09-01',
        tasks: [{ id: 'shift', title: 'Shift', done: false, time: '09:00', minutes: 60 }],
      },
    },
  })
  render(<DayView date="2026-09-01" onDateChange={() => {}} />)
  await user.click(screen.getByRole('button', { name: 'More actions for Shift' }))
  expect(screen.queryByRole('button', { name: /push shift to tomorrow/i })).not.toBeInTheDocument()
})

test('a float already at the push bound offers no push control', async () => {
  const user = userEvent.setup()
  actions.resetForTests({
    ...defaultData(),
    days: {
      '2026-09-01': {
        date: '2026-09-01',
        tasks: [{ id: 'maxed', title: 'Maxed errand', done: false, minutes: 300, pushCount: 2 }],
      },
    },
  })
  render(<DayView date="2026-09-01" onDateChange={() => {}} />)
  await user.click(screen.getByRole('button', { name: 'More actions for Maxed errand' }))
  expect(screen.queryByRole('button', { name: /push maxed errand to tomorrow/i })).not.toBeInTheDocument()
})

test('a done float offers no push control - there is nothing left to move', async () => {
  const user = userEvent.setup()
  actions.resetForTests({
    ...defaultData(),
    days: {
      '2026-09-01': {
        date: '2026-09-01',
        tasks: [{ id: 'done', title: 'Finished errand', done: true, minutes: 30 }],
      },
    },
  })
  render(<DayView date="2026-09-01" onDateChange={() => {}} />)
  await user.click(screen.getByRole('button', { name: 'More actions for Finished errand' }))
  expect(screen.queryByRole('button', { name: /push finished errand to tomorrow/i })).not.toBeInTheDocument()
})

test('a task with no size shows a quiet control to set one, not a number', () => {
  actions.addTask('2026-09-01', 'Guitar')
  render(<DayView date="2026-09-01" onDateChange={() => {}} />)
  expect(screen.getByRole('button', { name: 'Set size for Guitar' })).toBeInTheDocument()
})

test('setting a task size through its own control updates the task, not the quick-add flow', async () => {
  const user = userEvent.setup()
  actions.addTask('2026-09-01', 'Guitar')
  render(<DayView date="2026-09-01" onDateChange={() => {}} />)

  await user.click(screen.getByRole('button', { name: 'Set size for Guitar' }))
  const sizeInput = screen.getByRole('textbox', { name: /size in minutes for guitar/i })
  await user.type(sizeInput, '20{Enter}')

  expect(getData().days['2026-09-01'].tasks[0].minutes).toBe(20)
  expect(screen.getByRole('button', { name: /change size for guitar, currently 20 min/i })).toBeInTheDocument()
  // The quick-add input is untouched by any of this - it stays one field, one Enter.
  expect(screen.getByPlaceholderText(/add a task/i)).toHaveValue('')
})

test('an existing task size can be changed and cleared back to unsized', async () => {
  const user = userEvent.setup()
  actions.addTask('2026-09-01', 'Guitar')
  const id = getData().days['2026-09-01'].tasks[0].id
  actions.setTaskMinutes('2026-09-01', id, 20)
  render(<DayView date="2026-09-01" onDateChange={() => {}} />)

  await user.click(screen.getByRole('button', { name: /change size for guitar/i }))
  const sizeInput = screen.getByRole('textbox', { name: /size in minutes for guitar/i })
  await user.clear(sizeInput)
  await user.keyboard('{Enter}')

  expect(getData().days['2026-09-01'].tasks[0].minutes).toBeUndefined()
  expect(screen.getByRole('button', { name: 'Set size for Guitar' })).toBeInTheDocument()
})

test('typing garbage into the size field leaves an existing size untouched', async () => {
  const user = userEvent.setup()
  actions.addTask('2026-09-01', 'Guitar')
  const id = getData().days['2026-09-01'].tasks[0].id
  actions.setTaskMinutes('2026-09-01', id, 20)
  render(<DayView date="2026-09-01" onDateChange={() => {}} />)

  await user.click(screen.getByRole('button', { name: /change size for guitar/i }))
  const sizeInput = screen.getByRole('textbox', { name: /size in minutes for guitar/i })
  await user.clear(sizeInput)
  await user.type(sizeInput, 'abc{Enter}')

  expect(getData().days['2026-09-01'].tasks[0].minutes).toBe(20)
})

test('pressing Escape while editing a size cancels without changing it', async () => {
  const user = userEvent.setup()
  actions.addTask('2026-09-01', 'Guitar')
  const id = getData().days['2026-09-01'].tasks[0].id
  actions.setTaskMinutes('2026-09-01', id, 20)
  render(<DayView date="2026-09-01" onDateChange={() => {}} />)

  await user.click(screen.getByRole('button', { name: /change size for guitar/i }))
  const sizeInput = screen.getByRole('textbox', { name: /size in minutes for guitar/i })
  await user.clear(sizeInput)
  await user.type(sizeInput, '99')
  await user.keyboard('{Escape}')

  expect(getData().days['2026-09-01'].tasks[0].minutes).toBe(20)
})

test('the timeline grid stays collapsed until its own toggle is opened, and the task list is present the whole time', () => {
  actions.resetForTests({
    ...defaultData(),
    days: {
      '2026-09-01': {
        date: '2026-09-01',
        tasks: [{ id: 'shift', title: 'Shift', done: false, time: '09:00', minutes: 60 }],
      },
    },
  })
  const { container } = render(<DayView date="2026-09-01" onDateChange={() => {}} />)

  const toggle = screen.getByRole('button', { name: /show timeline/i })
  expect(toggle).toHaveAttribute('aria-expanded', 'false')
  expect(container.querySelector('.timeline-grid-wrap')).toBeNull()

  // The things the owner opens the app to act on are already there,
  // whether or not the grid has ever been opened.
  expect(screen.getByPlaceholderText(/add a task/i)).toBeInTheDocument()
  expect(container.querySelector('.task-list')).toBeInTheDocument()
})

test('opening the timeline toggle reveals the grid and relabels itself', async () => {
  const user = userEvent.setup()
  actions.resetForTests({
    ...defaultData(),
    days: {
      '2026-09-01': {
        date: '2026-09-01',
        tasks: [{ id: 'shift', title: 'Shift', done: false, time: '09:00', minutes: 60 }],
      },
    },
  })
  const { container } = render(<DayView date="2026-09-01" onDateChange={() => {}} />)

  await user.click(screen.getByRole('button', { name: /show timeline/i }))

  const toggle = screen.getByRole('button', { name: /hide timeline/i })
  expect(toggle).toHaveAttribute('aria-expanded', 'true')
  expect(container.querySelector('.timeline-grid-wrap')).toBeInTheDocument()
  expect(within(container.querySelector('.timeline-grid-wrap')!).getByText('Shift')).toBeInTheDocument()

  await user.click(toggle)
  expect(screen.getByRole('button', { name: /show timeline/i })).toHaveAttribute('aria-expanded', 'false')
  expect(container.querySelector('.timeline-grid-wrap')).toBeNull()
})

test('a day with no anchors shows no timeline toggle at all - there is nothing to expand', () => {
  actions.addTask('2026-09-01', 'Guitar')
  render(<DayView date="2026-09-01" onDateChange={() => {}} />)
  expect(screen.queryByRole('button', { name: /timeline/i })).not.toBeInTheDocument()
})

test('the timeline toggle stays open across a render once opened, since the choice is app-wide, not per day', () => {
  actions.resetForTests({
    ...defaultData(),
    settings: { ...defaultData().settings, timelineExpanded: true },
    days: {
      '2026-09-01': {
        date: '2026-09-01',
        tasks: [{ id: 'shift', title: 'Shift', done: false, time: '09:00', minutes: 60 }],
      },
    },
  })
  const { container } = render(<DayView date="2026-09-01" onDateChange={() => {}} />)
  expect(screen.getByRole('button', { name: /hide timeline/i })).toHaveAttribute('aria-expanded', 'true')
  expect(container.querySelector('.timeline-grid-wrap')).toBeInTheDocument()
})

test('the timeline toggle names the region it controls, for assistive tech', () => {
  actions.resetForTests({
    ...defaultData(),
    days: {
      '2026-09-01': {
        date: '2026-09-01',
        tasks: [{ id: 'shift', title: 'Shift', done: false, time: '09:00', minutes: 60 }],
      },
    },
  })
  const { container } = render(<DayView date="2026-09-01" onDateChange={() => {}} />)
  const toggle = screen.getByRole('button', { name: /show timeline/i })
  const controlsId = toggle.getAttribute('aria-controls')
  expect(controlsId).toBeTruthy()
  // Nothing to point at yet while collapsed - the id is reused once the
  // region actually mounts, not invented ahead of it.
  expect(container.querySelector(`#${controlsId}`)).toBeNull()
})

test('tapping a gap and placing a float turns it into an anchor, live in the day view', async () => {
  const user = userEvent.setup()
  actions.resetForTests({
    ...defaultData(),
    settings: { ...defaultData().settings, timelineExpanded: true },
    days: {
      '2026-09-01': {
        date: '2026-09-01',
        tasks: [
          { id: 'shift', title: 'Shift', done: false, time: '09:00', minutes: 60 },
          { id: 'gym', title: 'Gym', done: false, time: '11:00', minutes: 30 },
          { id: 'guitar', title: 'Guitar', done: false, minutes: 20 },
        ],
      },
    },
  })
  const { container } = render(<DayView date="2026-09-01" onDateChange={() => {}} />)

  await user.click(screen.getByRole('button', { name: /1h free/i }))
  await user.click(screen.getByRole('button', { name: /place guitar, 20 min/i }))

  expect(getData().days['2026-09-01'].tasks.find(t => t.id === 'guitar')?.time).toBe('10:00')
  const taskList = within(container.querySelector('.task-list')!)
  expect(taskList.getByText('10:00')).toBeInTheDocument()
  // Now an anchor, reachable through its own menu - one extra tap, not
  // hunting, since the menu button sits right on the same row.
  await user.click(taskList.getByRole('button', { name: 'More actions for Guitar' }))
  expect(screen.getByRole('button', { name: 'Remove time from Guitar' })).toBeInTheDocument()
})

test('a placed float can be returned to the tray through its own menu, no hunting for a setting', async () => {
  const user = userEvent.setup()
  actions.resetForTests({
    ...defaultData(),
    days: {
      '2026-09-01': {
        date: '2026-09-01',
        tasks: [{ id: 'guitar', title: 'Guitar', done: false, time: '10:00', minutes: 20 }],
      },
    },
  })
  render(<DayView date="2026-09-01" onDateChange={() => {}} />)

  await user.click(screen.getByRole('button', { name: 'More actions for Guitar' }))
  await user.click(screen.getByRole('button', { name: 'Remove time from Guitar' }))
  expect(getData().days['2026-09-01'].tasks[0].time).toBeUndefined()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('a float with no time offers no remove-time control in its menu - there is nothing to undo', async () => {
  const user = userEvent.setup()
  actions.addTask('2026-09-01', 'Guitar')
  render(<DayView date="2026-09-01" onDateChange={() => {}} />)
  await user.click(screen.getByRole('button', { name: 'More actions for Guitar' }))
  expect(screen.queryByRole('button', { name: /remove time/i })).not.toBeInTheDocument()
})

test('rollover button is not shown when every unfinished task is already at the push bound', () => {
  actions.addTask('2026-09-01', 'Maxed task')
  const id = getData().days['2026-09-01'].tasks[0].id
  actions.resetForTests({
    ...getData(),
    days: {
      ...getData().days,
      '2026-09-01': {
        ...getData().days['2026-09-01'],
        tasks: getData().days['2026-09-01'].tasks.map(t => (t.id === id ? { ...t, pushCount: 2 } : t)),
      },
    },
  })
  render(<DayView date="2026-09-01" onDateChange={() => {}} />)
  expect(screen.queryByRole('button', { name: /move .* to tomorrow/i })).not.toBeInTheDocument()
  expect(screen.getByText(/waiting on a decision/i)).toBeInTheDocument()
  expect(screen.queryByText(/need a decision today/i)).not.toBeInTheDocument()
})

test('the rollover button counts a task marked ongoing as pushable, not held, even past the bound', () => {
  actions.addTask('2026-09-01', 'Standing task')
  const id = getData().days['2026-09-01'].tasks[0].id
  actions.resetForTests({
    ...getData(),
    days: {
      ...getData().days,
      '2026-09-01': {
        ...getData().days['2026-09-01'],
        tasks: getData().days['2026-09-01'].tasks.map(t =>
          t.id === id ? { ...t, pushCount: 4, unbounded: true } : t,
        ),
      },
    },
  })
  render(<DayView date="2026-09-01" onDateChange={() => {}} />)
  expect(screen.getByRole('button', { name: /move 1 unfinished to tomorrow/i })).toBeInTheDocument()
  expect(screen.queryByText(/waiting on a decision/i)).not.toBeInTheDocument()
})

test('a genuinely fresh install shows the starter offers instead of the plain empty line', () => {
  render(<DayView date="2026-09-01" onDateChange={() => {}} />)
  expect(screen.getByRole('button', { name: /use the working day template/i })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /use the rest day template/i })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /use the night shift template/i })).toBeInTheDocument()
  expect(screen.queryByText(/^nothing planned\./i)).not.toBeInTheDocument()
})

test('tapping a starter creates it as a real template and stamps it onto the day being viewed', async () => {
  const user = userEvent.setup()
  render(<DayView date="2026-09-01" onDateChange={() => {}} />)
  await user.click(screen.getByRole('button', { name: /use the rest day template/i }))

  const templates = getData().templates
  expect(templates).toHaveLength(1)
  expect(templates[0].name).toBe('Rest day')
  expect(templates[0].type).toBe('rest')

  const day = getData().days['2026-09-01']
  expect(day.templateId).toBe(templates[0].id)
  expect(day.tasks.length).toBe(templates[0].blocks.length)
  expect(day.tasks.some(t => t.title === 'Take morning medication')).toBe(true)

  // The teaching state is gone now that the day has real tasks on it - the
  // rest of the day view (task list, quick add) takes over.
  expect(screen.queryByRole('button', { name: /use the working day template/i })).not.toBeInTheDocument()
})

test('once a template exists anywhere, an empty day falls back to the plain, non-teaching message', () => {
  actions.addTemplate({ name: 'Existing', color: '#a7c4f5', blocks: [] })
  render(<DayView date="2026-09-01" onDateChange={() => {}} />)
  expect(screen.queryByRole('button', { name: /use the working day template/i })).not.toBeInTheDocument()
  expect(screen.getByText(/nothing planned/i)).toBeInTheDocument()
})

test('a day that already has a hand-typed task never shows the starter offers, even before any template exists', async () => {
  const user = userEvent.setup()
  render(<DayView date="2026-09-01" onDateChange={() => {}} />)
  await user.type(screen.getByPlaceholderText(/add a task/i), 'Water the plants{Enter}')
  expect(screen.queryByRole('button', { name: /use the working day template/i })).not.toBeInTheDocument()
})
