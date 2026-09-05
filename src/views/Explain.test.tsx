import { beforeEach, describe, expect, test, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { Explain, EXPLAIN_DELAY, EXPLAIN_HOLD } from './Explain'
import { EXPLAIN_IDS, EXPLANATIONS, type ExplainId } from '../lib/explain'
import { actions, getData } from '../lib/store'
import { defaultData } from '../lib/storage'
import { CalendarView } from './CalendarView'
import { LibraryAddLine } from './LibraryAddLine'
import { TemplatesView } from './TemplatesView'
import { SyncSettings } from './SyncSettings'
import { BackupSettings } from './BackupSettings'
import { NorthView } from './north/NorthView'
import { Inbox } from '../widgets/day-plan/Inbox'
import { Backlog } from '../widgets/day-plan/Backlog'
import { TaskRow } from '../widgets/day-plan/TaskRow'
import { TaskDetail } from '../widgets/day-plan/TaskDetail'
import { TaskActionsSheet } from '../widgets/day-plan/TaskActionsSheet'
import { ReplanSheet } from '../widgets/day-plan/ReplanSheet'
import type { Task } from '../lib/types'
import { DEFAULT_SLEEP_SETTINGS } from '../widgets/day-plan/capacity'

const DATE = '2026-09-04'

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
})

// --- the copy ----------------------------------------------------------------

/**
 * The vocabulary this app invented, and the promise that every word in it is
 * explained somewhere a person can reach.
 *
 * The report behind all of this was one sentence: "arriving for the first
 * time I would not even know what Ongoing means." These tests are the list
 * of every other word with the same problem, and they are written so that
 * the list itself is the data: adding an id to EXPLAIN_IDS without writing
 * its sentence fails here, and writing a sentence without ever putting the
 * term on screen fails in the section below.
 */
describe('the copy', () => {
  test('every term on the audit list has a sentence and a word to attach it to', () => {
    for (const id of EXPLAIN_IDS) {
      const entry = EXPLANATIONS[id]
      expect(entry, id).toBeTruthy()
      expect(entry.term.trim().length, id).toBeGreaterThan(0)
      expect(entry.text.trim().length, id).toBeGreaterThan(0)
    }
  })

  test('nothing in it is longer than two sentences - anything more is documentation', () => {
    for (const id of EXPLAIN_IDS) {
      const sentences = EXPLANATIONS[id].text.split(/(?<=[.?!])\s+/).filter(Boolean)
      expect(sentences.length, `${id}: ${EXPLANATIONS[id].text}`).toBeLessThanOrEqual(2)
      expect(EXPLANATIONS[id].text.split(/\s+/).length, id).toBeLessThanOrEqual(45)
    }
  })

  // The owner's standing rule, and the one thing about this codebase that is
  // checked rather than remembered - see CONVENTIONS section 1.
  test('no em dash or en dash anywhere in the copy', () => {
    for (const id of EXPLAIN_IDS) {
      expect(EXPLANATIONS[id].text, id).not.toMatch(/[–—]/)
      expect(EXPLANATIONS[id].term, id).not.toMatch(/[–—]/)
    }
  })
})

// --- where each one lives ----------------------------------------------------

const task: Task = { id: 't1', title: 'Deep work', time: '09:00', minutes: 60, category: 'core', done: false }

// Every prop TaskRow needs that has nothing to do with the term being tested.
const rowChrome = {
  sizeEditingId: null,
  sizeDraft: '',
  onStartSizeEdit: () => {},
  onSizeDraftChange: () => {},
  onCommitSizeEdit: () => {},
  onCancelSizeEdit: () => {},
  onOpenActions: () => {},
  onToggleDone: () => {},
  selected: false,
  onToggleSelect: () => {},
}

const replanChrome = {
  date: DATE,
  tasks: [] as Task[],
  nowMinutes: 600,
  sleep: DEFAULT_SLEEP_SETTINGS,
  sleepProfileId: undefined,
  busy: [],
  away: undefined,
  onClose: () => {},
}

/**
 * One entry per term: how to put the screen it lives on in front of the test.
 *
 * This table is the audit. It is checked against EXPLAIN_IDS below, so a term
 * with copy that was never actually placed anywhere fails - which is the
 * failure worth catching, because an explanation nobody can reach is exactly
 * the state the whole vocabulary was already in.
 */
const PLACED: Record<ExplainId, () => ReactElement> = {
  north: () => <NorthView onOpenSettings={() => {}} />,
  'key-task': () => <TaskDetail task={task} tasks={[task]} date={DATE} library={[]} onClose={() => {}} />,
  push: () => (
    <TaskActionsSheet
      task={{ ...task, time: undefined }}
      tasks={[]}
      onPlace={() => {}}
      onUnanchor={() => {}}
      onPush={() => {}}
      onSetOngoing={() => {}}
      onDelete={() => {}}
      onClose={() => {}}
    />
  ),
  ongoing: () => <TemplatesView />,
  focus: () => <TaskRow task={task} isFullDay active onFocus={() => {}} {...rowChrome} />,
  inbox: () => <Inbox date={DATE} />,
  backlog: () => <Backlog date={DATE} />,
  stamp: () => <CalendarView onOpenDay={() => {}} onOpenTemplates={() => {}} date={DATE} onDateChange={() => {}} />,
  'day-type': () => <TemplatesView />,
  'day-type-full': () => <TemplatesView />,
  'day-type-shift': () => <TemplatesView />,
  'day-type-night': () => <TemplatesView />,
  'day-type-rest': () => <TemplatesView />,
  'replan-interrupt': () => <ReplanSheet {...replanChrome} mode="menu" />,
  'replan-shift': () => <ReplanSheet {...replanChrome} mode="menu" />,
  'replan-away': () => <ReplanSheet {...replanChrome} mode="menu" />,
  'library-unit': () => <LibraryAddLine list={getData().library[0]} />,
  'sleep-schedule': () => <TemplatesView />,
  sync: () => <SyncSettings />,
  backup: () => <BackupSettings />,
}

test('every term on the audit list is placed on a real screen', () => {
  expect(Object.keys(PLACED).sort()).toEqual([...EXPLAIN_IDS].sort())
})

describe.each(EXPLAIN_IDS)('%s', id => {
  test('is explained where it is used', async () => {
    // Enough of a store that every screen in the table has something to draw:
    // a template with a day type and a block, a sleep schedule to choose
    // between, a library list to count in, an inbox line and a backlog item.
    actions.resetForTests({
      ...defaultData(),
      settings: {
        ...defaultData().settings,
        sleepProfiles: [
          { id: 's1', name: 'Ordinary', window: { start: '23:00', end: '07:00' } },
          { id: 's2', name: 'Night shift', window: { start: '09:00', end: '16:00' } },
        ],
      },
      templates: [{ id: 'tpl', name: 'Workday', color: '#a7c4f5', blocks: [{ id: 'b1', title: 'Deep work', time: '09:00', minutes: 60 }] }],
      library: [{ id: 'lst', name: 'Books', unit: 'chapter', items: [] }],
      inbox: [{ id: 'i1', text: 'Ask about the boiler', captured: DATE }],
      backlog: [{ id: 'b1', title: 'Move the ISA' }],
      days: { [DATE]: { date: DATE, tasks: [{ ...task, time: undefined }] } },
    })

    const user = userEvent.setup()
    const { container } = render(PLACED[id]())

    // The template editor and the day-type note only exist once a template is
    // open for editing, and the four day-type values only one at a time.
    if (id === 'ongoing' || id === 'day-type' || id.startsWith('day-type-') || id === 'sleep-schedule') {
      await user.click(screen.getByRole('button', { name: /Edit Workday/ }))
    }
    if (id.startsWith('day-type-')) {
      // The segment's own labels are the copy's `term` for each value, which
      // is not a coincidence: the word on the button and the word the
      // sentence is about have to be the same word.
      await user.click(screen.getByRole('button', { name: EXPLANATIONS[id].term }))
    }

    expect(container.querySelector(`[data-explains="${id}"]`), `${id} is not on screen anywhere`).toBeTruthy()
  })
})

// --- how it opens ------------------------------------------------------------

/**
 * Three ways in, because there are three kinds of input and a tooltip that
 * only answers to one of them is an explanation half the people who need it
 * cannot reach - the same rule as CONVENTIONS section 17, one step down.
 *
 * All five of these changed when the (i) went. They used to reach for a
 * marker button of its own; there is no marker any more, so they reach for
 * the control the sentence is about - which is the whole point of the change.
 */
describe('opening it', () => {
  const host = (id: 'ongoing' | 'push' | 'stamp' | 'focus') => (
    <Explain id={id}>
      <button type="button">Ongoing</button>
    </Explain>
  )

  test('a mouse has to rest on the control, not merely cross it', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(host('ongoing'))
    const bubble = screen.getByRole('tooltip', { hidden: true })

    await user.hover(screen.getByRole('button', { name: 'Ongoing' }))
    expect(bubble).toHaveAttribute('hidden')

    act(() => vi.advanceTimersByTime(EXPLAIN_DELAY))
    expect(bubble).not.toHaveAttribute('hidden')
    vi.useRealTimers()
  })

  test('a cursor passing over on its way somewhere else never opens it', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(host('ongoing'))
    const control = screen.getByRole('button', { name: 'Ongoing' })

    await user.hover(control)
    act(() => vi.advanceTimersByTime(EXPLAIN_DELAY - 50))
    await user.unhover(control)
    act(() => vi.advanceTimersByTime(EXPLAIN_DELAY))
    expect(screen.getByRole('tooltip', { hidden: true })).toHaveAttribute('hidden')
    vi.useRealTimers()
  })

  /**
   * A finger holds. The important half is the second assertion: the control's
   * own click still fires, because this wraps rather than replaces - a tap
   * that stopped doing what the button does in order to explain the button
   * would be the worst trade in the app.
   */
  test('a finger holds the control to get the sentence, and a tap still presses it', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const pressed = vi.fn()
    render(
      <Explain id="push">
        <button type="button" onClick={pressed}>
          Push
        </button>
      </Explain>,
    )
    const control = screen.getByRole('button', { name: 'Push' })

    await user.pointer({ keys: '[TouchA]', target: control })
    act(() => vi.advanceTimersByTime(EXPLAIN_HOLD))
    expect(screen.getByRole('tooltip', { hidden: true })).toHaveAttribute('hidden')
    expect(pressed).toHaveBeenCalledTimes(1)

    await user.pointer({ keys: '[TouchA>]', target: control })
    act(() => vi.advanceTimersByTime(EXPLAIN_HOLD))
    expect(screen.getByRole('tooltip')).toHaveTextContent('Moves a task to tomorrow')
    vi.useRealTimers()
  })

  test('a keyboard reaching the control gets it at once - nobody tabs past by accident', async () => {
    const user = userEvent.setup()
    render(host('stamp'))

    await user.tab()
    expect(screen.getByRole('button', { name: 'Ongoing' })).toHaveFocus()
    expect(screen.getByRole('tooltip')).not.toHaveAttribute('hidden')
  })

  test('Escape closes the bubble and stops there, so it does not also close what is under it', async () => {
    const user = userEvent.setup()
    const outer = vi.fn()
    render(<div onKeyDown={outer}>{host('focus')}</div>)

    await user.tab()
    expect(screen.getByRole('tooltip')).not.toHaveAttribute('hidden')
    await user.keyboard('{Escape}')
    expect(screen.getByRole('tooltip', { hidden: true })).toHaveAttribute('hidden')
    expect(outer).not.toHaveBeenCalled()
  })

  // Printed rather than asked for - see the `inline` prop. Same copy, same
  // file, same audit hook, no control and no gesture.
  test('an inline explanation is the sentence itself, with nothing to press', () => {
    const { container } = render(<Explain id="replan-away" inline />)
    expect(container.querySelector('[data-explains="replan-away"]')).toHaveTextContent('Pauses the day')
    expect(container.querySelector('button')).toBeNull()
  })
})
