import { beforeEach, describe, expect, it } from 'vitest'
import { assistWith } from './tourAssist'
import { TOUR_EVENTS, type TourContext } from './tour'
import { actions, getData } from './store'
import { defaultData } from './storage'
import { clockTools, getClockTools } from './clockTools'
import { todayKey } from './dates'
 import { resetTourForTests, startTour } from './tourState'

const TODAY = todayKey()

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
  clockTools.endFocus()
  resetTourForTests()
  // These only ever run inside a running tour, and that is not incidental:
  // the task they act on is found by the tourCreated flag, which commit()
  // only writes while a tour is going. An assist that fell back to "the
  // newest task" would happily tick off something of the owner's own.
  startTour('desktop', 2)
})

function ctx(before: ReturnType<typeof getData>): TourContext {
  return { before, now: getData(), today: TODAY, focusRunning: getClockTools().focus !== null }
}

/**
 * "Do it for me" is the way out of a step that will not end, and the promise
 * it makes is stronger than it looks: it does not tick the step off, it does
 * the thing. So the test that matters for every one of them is the same -
 * after the assist, the step's own predicate says it is done, for the same
 * reason it would have if a person had pressed the button.
 *
 * That is not a formality. An assist that faked its way past a step would
 * hand the next one a state it was not written for: "mark Walk key" needs a
 * Walk, and "start Focus on Walk" needs it to be the running task.
 */
describe('doing a step on somebody behalf', () => {
  it('stamps a real, editable template onto the day', () => {
    const before = getData()
    expect(assistWith('stamped', TODAY)).toBe(true)
    expect(TOUR_EVENTS.stamped(ctx(before))).toBe(true)
    expect(getData().templates).toHaveLength(1)
    expect(getData().days[TODAY].tasks.length).toBeGreaterThan(0)
  })

  it('adds Walk at the current minute, so the steps after it have their task', () => {
    const before = getData()
    expect(assistWith('task-added', TODAY)).toBe(true)
    expect(TOUR_EVENTS['task-added'](ctx(before))).toBe(true)
    const added = getData().days[TODAY].tasks.at(-1)
    expect(added).toMatchObject({ title: 'Walk', minutes: 30 })
    // At the clock, not at a tidy hour: Focus is only offered on the running
    // card, and the step two on needs this one to be it.
    const now = new Date()
    expect(added?.time).toBe(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`)
  })

  it('marks the tour task key, ticks it off, and starts Focus on it', () => {
    assistWith('task-added', TODAY)

    let before = getData()
    expect(assistWith('key-marked', TODAY)).toBe(true)
    expect(TOUR_EVENTS['key-marked'](ctx(before))).toBe(true)

    before = getData()
    expect(assistWith('focus-started', TODAY)).toBe(true)
    expect(TOUR_EVENTS['focus-started'](ctx(before))).toBe(true)

    before = getData()
    expect(assistWith('task-done', TODAY)).toBe(true)
    expect(TOUR_EVENTS['task-done'](ctx(before))).toBe(true)
  })

  it('says so rather than pretending when the task it needs is not there', () => {
    // Nothing has been added, so there is no tour task to mark, focus or
    // tick. The caller falls back to skipping the step outright.
    expect(assistWith('key-marked', TODAY)).toBe(false)
    expect(assistWith('focus-started', TODAY)).toBe(false)
    expect(assistWith('task-done', TODAY)).toBe(false)
  })

  it('starts a list and writes a goal', () => {
    let before = getData()
    expect(assistWith('list-added', TODAY)).toBe(true)
    expect(TOUR_EVENTS['list-added'](ctx(before))).toBe(true)

    before = getData()
    expect(assistWith('goal-added', TODAY)).toBe(true)
    expect(TOUR_EVENTS['goal-added'](ctx(before))).toBe(true)
  })

  it('has nothing to do at either end of the tour', () => {
    expect(assistWith('start', TODAY)).toBe(false)
    expect(assistWith('finish', TODAY)).toBe(false)
  })
})
