import { describe, expect, test } from 'vitest'
import { cellPoints } from './calendarCell'
import type { Task } from './types'

function task(id: string, title: string, extra: Partial<Task> = {}): Task {
  return { id, title, done: false, ...extra }
}

/**
 * What a month cell says about a day.
 *
 * A cell carried a template's name, which is a word somebody chose for a
 * shape of day two months ago - it is not what is on Thursday. These are the
 * three rules that make two or three lines worth more than that name, and
 * every one of them is about honesty rather than about fitting.
 */
describe('the lines a month cell shows', () => {
  test('the day\'s own order, so the first line is the first thing that happens', () => {
    const points = cellPoints(
      { tasks: [task('c', 'Gym', { time: '17:30' }), task('a', 'Job hunt', { time: '09:00' }), task('b', 'Lunch', { time: '13:00' })] },
      3,
    )
    expect(points.points.map(p => p.title)).toEqual(['Job hunt', 'Lunch', 'Gym'])
  })

  /**
   * The count is of what is *left over*, not of the whole day. Two lines and
   * a "+5" over a day with five things on it is the cell lying about the one
   * number it exists to be honest about - which is exactly what happened when
   * the third line was hidden by a media query while the count was worked out
   * in JavaScript against a limit of three.
   */
  test('the overflow count is what did not fit, not the total', () => {
    const day = { tasks: [1, 2, 3, 4, 5].map(n => task(`t${n}`, `Task ${n}`, { time: `0${n}:00` })) }
    expect(cellPoints(day, 3).more).toBe(2)
    expect(cellPoints(day, 2).more).toBe(3)
    expect(cellPoints(day, 5).more).toBe(0)
    expect(cellPoints(day, 9).more).toBe(0)
  })

  /**
   * A float has no time and is still a real part of the day. Inventing one
   * would be a lie the cell tells at a glance, which is the worst kind - the
   * same refusal quick-add's own time control makes when a day is full.
   */
  test('a task with no time keeps none, and is still on the list', () => {
    const points = cellPoints({ tasks: [task('a', 'Read a chapter'), task('b', 'Standup', { time: '09:15' })] }, 3)
    expect(points.points.find(p => p.title === 'Read a chapter')?.time).toBeUndefined()
    expect(points.points).toHaveLength(2)
  })

  test('a key task is marked, and being done is carried through', () => {
    const points = cellPoints(
      { tasks: [task('a', 'Job hunt', { time: '09:00', highlight: true, done: true }), task('b', 'Gym', { time: '17:30' })] },
      3,
    )
    expect(points.points[0]).toMatchObject({ key: true, done: true })
    expect(points.points[1]).toMatchObject({ key: false, done: false })
  })

  test('a day with nothing on it has nothing to say', () => {
    expect(cellPoints(undefined, 3)).toEqual({ points: [], more: 0 })
    expect(cellPoints({ tasks: [] }, 3)).toEqual({ points: [], more: 0 })
  })
})
