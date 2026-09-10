import { expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DayDigest } from './DayDigest'
import { computeCapacity } from './capacity'
import { dayScore } from './score'
import type { Task } from '../../lib/types'

/**
 * The rail's lower half, and the rule it kept breaking.
 *
 * Every figure on this card is said here and nowhere else - CONVENTIONS
 * section 23, "once and only once". Until v2.6 it carried a ring with the
 * day's fraction in it and a Done row beside the ring, while the header
 * already had the bar and the same fraction: one number, three times, on one
 * screen. These hold the card to its four rows, to the two notes it took over
 * from the capacity sentence when that sentence left the desktop, and to the
 * older rule that nothing in it is a percentage in any disguise.
 */

function task(over: Partial<Task> = {}): Task {
  return { id: crypto.randomUUID(), title: 'Something', done: false, ...over }
}

function digest(tasks: Task[]) {
  return render(
    <DayDigest
      tasks={tasks}
      capacity={computeCapacity(tasks)}
      score={dayScore(tasks)}
      sleepMinutes={480}
      nowMinutes={13 * 60}
      isToday
    />,
  )
}

// --- what the header already says is not said again ------------------------

test('the card says nothing the header already does: no ring, no done count', () => {
  const { container } = digest([
    task({ time: '09:00', minutes: 60, done: true }),
    ...Array.from({ length: 8 }, (_, i) => task({ time: `1${i}:00`, minutes: 30 })),
  ])
  expect(container.querySelector('.digest-ring')).toBeNull()
  expect(screen.queryByText('Done')).toBeNull()
  // The fraction the header shows, in digits or in words: neither is here.
  expect(container.textContent).not.toMatch(/1\/9|1 of 9/)
})

// The second row sums the Deep work category, not the focus session, so it is
// named after the category - Focus is the countdown, and one word does one job.
test('four rows, and they are the shape of the day: timed, deep work, free and sleep', () => {
  digest([task({ time: '09:00', minutes: 60, category: 'core' }), task({ time: '14:00', minutes: 30 })])
  const labels = screen.getAllByRole('term').map(dt => dt.textContent)
  expect(labels).toEqual(['Timed', 'Deep work', 'Free', 'Sleep'])
  expect(screen.getByText('1h 30 min')).toBeInTheDocument()
  expect(screen.getByText('1h')).toBeInTheDocument()
})

// --- the two notes the capacity sentence used to carry ----------------------

test('free says across how many gaps it is spread', () => {
  // 07:00-09:00, 10:00-12:00, 13:00-15:00 and 16:00-23:00 are the four holes
  // in the default waking window around these three.
  digest([
    task({ time: '09:00', minutes: 60 }),
    task({ time: '12:00', minutes: 60 }),
    task({ time: '15:00', minutes: 60 }),
  ])
  expect(screen.getByText('4 gaps')).toBeInTheDocument()
})

test('sleep says, once, that it is not counted', () => {
  digest([task({ time: '09:00', minutes: 60 })])
  expect(screen.getAllByText('not counted')).toHaveLength(1)
  expect(screen.getByText('8h')).toBeInTheDocument()
})

test('when the untimed tasks do not fit, free says how far over', () => {
  digest([task({ time: '07:00', minutes: 900 }), task({ minutes: 180 })])
  expect(screen.getByText('1 gap · 2h over')).toBeInTheDocument()
})

test('a day with somebody else\'s events on it says so, in a row that is not there otherwise', () => {
  const tasks = [task({ time: '09:00', minutes: 60 })]
  render(
    <DayDigest
      tasks={tasks}
      capacity={computeCapacity(tasks, undefined, undefined, [{ start: 14 * 60, end: 15 * 60 }])}
      score={dayScore(tasks)}
      sleepMinutes={480}
      nowMinutes={13 * 60}
      isToday
    />,
  )
  expect(screen.getByText('Calendar')).toBeInTheDocument()
  expect(screen.getByText('1 event')).toBeInTheDocument()
  // Counted apart from Timed: a meeting is not something you planned.
  expect(screen.getAllByText('1h')).toHaveLength(2)
})

test('a timed task with no size leaves free unknown, and says why', () => {
  digest([task({ time: '09:00' })])
  expect(screen.getByText('a timed task has no size')).toBeInTheDocument()
  expect(screen.getByText('1 with no length')).toBeInTheDocument()
})

// --- no percentage, in any disguise ---------------------------------------

test('nothing in the digest is a percentage, written or implied', () => {
  const { container } = digest([
    task({ time: '09:00', minutes: 60, done: true }),
    ...Array.from({ length: 8 }, (_, i) => task({ time: `1${i}:00`, minutes: 30 })),
  ])
  const text = container.textContent ?? ''
  expect(text).not.toMatch(/%/)
  // One of nine is eleven per cent. A bare "11" anywhere here would be that
  // number with its sign filed off.
  expect(text).not.toMatch(/\b11\b/)
})

// --- a day with no plan says nothing about itself -------------------------

test('an empty day draws no figures at all', () => {
  const { container } = digest([])
  expect(container.querySelector('.digest-stats')).toBeNull()
})

// --- the door on the card the owner says they will use most ---------------

/**
 * Up next carries the link because that is where it is wanted: the card says
 * what is coming, and one press is the thing itself. The link comes from the
 * task or from the library item it is bound to - see `linkFor`.
 */
test('up next carries the door to what is next, in a new tab', () => {
  digest([task({ time: '14:00', minutes: 45, title: 'Spanish', link: 'http://localhost:8080/easy' })])
  const link = screen.getByRole('link', { name: /Open Spanish at localhost:8080/ })
  expect(link).toHaveAttribute('target', '_blank')
  expect(link.getAttribute('rel')).toContain('noopener')
})

test('a next thing with no address carries no door', () => {
  digest([task({ time: '14:00', minutes: 45, title: 'Spanish' })])
  expect(screen.queryByRole('link')).toBeNull()
})

/**
 * The figures read down three straight edges, and that is a structural
 * promise rather than a look: the small grey note used to ride inside the
 * figure's own cell, so its right edge moved with the width of the number
 * beside it. jsdom cannot measure an edge, but it can hold the shape the
 * edge comes from - one cell per column on every row, including the rows
 * with nothing to note.
 */
test('every figure in the digest draws all three of its cells, noted or not', () => {
  const { container } = digest([task({ time: '09:00', minutes: 120, title: 'Deep work: pricing page' })])
  const rows = [...container.querySelectorAll('.digest-figures > div')]
  expect(rows.length).toBeGreaterThan(2)
  for (const row of rows) {
    expect([...row.children].map(c => c.tagName)).toEqual(['DT', 'DD', 'DD'])
  }
})
