import { expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DayDigest } from './DayDigest'
import { computeCapacity } from './capacity'
import { dayScore } from './score'
import type { Task } from '../../lib/types'

/**
 * The rail's lower half, and the one rule it kept breaking.
 *
 * A digest is four numbers and a shape, and every one of the numbers is
 * already stated in words somewhere else on the screen. That is the whole
 * licence for repeating them: small, together, glanceable. The moment one of
 * them says something the words do not, it has stopped being a repeat and
 * started being a second opinion about the day.
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

// --- no percentage, in any disguise ---------------------------------------
//
// The ring used to carry `Math.round(fraction * 100)` in its middle. A
// percentage with the sign taken off is not less of a percentage, and this
// app's day score does not do them - STATE section 2, and DECISIONS on why a
// number that goes up is a report card. `score.test.ts` already held the rule
// for `formatDayScore`; the digest computed its own and walked around it,
// which is what this test is for.

test('the ring is a shape and carries no number of its own', () => {
  const { container } = digest([
    task({ time: '09:00', minutes: 60, done: true }),
    ...Array.from({ length: 8 }, (_, i) => task({ time: `1${i}:00`, minutes: 30 })),
  ])
  const ring = container.querySelector('.digest-ring')
  expect(ring).not.toBeNull()
  expect(ring!.textContent?.trim()).toBe('')
})

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

test('how far along the day is, is said in words and only in words', () => {
  digest([
    task({ time: '09:00', minutes: 60, done: true }),
    task({ time: '11:00', minutes: 30 }),
    task({ time: '13:00', minutes: 30 }),
  ])
  expect(screen.getByText('Done')).toBeInTheDocument()
  expect(screen.getByText('1 of 3')).toBeInTheDocument()
})

// --- a day with no plan says nothing about itself -------------------------

test('an empty day draws no ring and no figures at all', () => {
  const { container } = digest([])
  expect(container.querySelector('.digest-stats')).toBeNull()
  expect(container.querySelector('.digest-ring')).toBeNull()
})
