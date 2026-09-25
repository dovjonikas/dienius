import { describe, expect, it } from 'vitest'
import { DEFAULT_EVENING_CLOSE, eveningSummary, isEnough, pushableAtClose, shouldClose, stillAhead } from './eveningClose'
import type { DayPlan, Task } from './types'

const DATE = '2026-09-01'

function day(tasks: Partial<Task>[], extra: Partial<DayPlan> = {}): DayPlan {
  return {
    date: DATE,
    tasks: tasks.map((t, i) => ({ id: `t${i}`, title: `Task ${i}`, done: false, ...t })),
    ...extra,
  }
}

const ALWAYS = { settings: DEFAULT_EVENING_CLOSE, nowMinutes: 22 * 60, dismissed: false }

/**
 * Tone is the feature here, so most of these are about what the card is not
 * allowed to say. The arithmetic is four lines; the rules are the point.
 */
describe('what the evening close says', () => {
  it('calls half a day enough, because half a real plan is a day that went well', () => {
    const summary = eveningSummary(day([{ done: true }, { done: true }, {}, {}]))!
    expect(summary.enough).toBe(true)
    expect(summary.line).toBe('2 of 4 done - enough.')
  })

  it('calls every key task enough, however few of the rest got done', () => {
    // Three key tasks done out of nine is a day that did the things that
    // mattered. A threshold that called that "not enough" because 3/9 is
    // under a half would be measuring the wrong thing.
    const tasks = [
      { done: true, highlight: true },
      { done: true, highlight: true },
      { done: true, highlight: true },
      {}, {}, {}, {}, {}, {},
    ]
    const summary = eveningSummary(day(tasks))!
    expect(summary.enough).toBe(true)
    expect(summary.line).toBe('3 of 9 done, all 3 key tasks - enough.')
  })

  it('names one key task as one, because "all 1 key task" is not a sentence', () => {
    const summary = eveningSummary(day([{ done: true, highlight: true }, {}, {}, {}]))!
    expect(summary.line).toBe('1 of 4 done, and the key one - enough.')
  })

  it('says the day gave what it gave, and nothing else, when it did not reach enough', () => {
    const summary = eveningSummary(day([{ done: true }, {}, {}, {}, {}]))!
    expect(summary.enough).toBe(false)
    expect(summary.line).toBe('1 of 5 - the day gave what it gave.')
  })

  it('never names, counts or implies what was not done', () => {
    // Every shape of day, checked against the words this app has decided it
    // does not use. There is no third, sadder tier below "the day gave what
    // it gave", and adding one would be inventing a way to lose.
    const shapes = [
      day([{}, {}, {}]),
      day([{ done: true }, {}, {}]),
      day([{ done: true }, { done: true }, {}]),
      day([{ done: true }, { done: true }, { done: true }]),
      day([{ done: true, highlight: true }, { highlight: true }, {}]),
    ]
    for (const shape of shapes) {
      const line = eveningSummary(shape)!.line
      expect(line, line).not.toMatch(/missed|fail|behind|left|remaining|unfinished|only|still|but|%/i)
    }
  })

  it('has nothing to close on a day that was never planned', () => {
    // dayScore already refuses to call an empty day a zero. Saying
    // "0 of 0 - the day gave what it gave" about a Sunday nobody planned
    // would be making something out of nothing, and making it slightly sad.
    expect(eveningSummary(day([]))).toBeNull()
    expect(eveningSummary(undefined)).toBeNull()
  })

  it('counts only what the day type counts', () => {
    // A twelve-hour shift is not scored like an ordinary Tuesday, and the
    // ending it gets follows the same rule the score already does.
    const shift = day([{ done: true, core: true }, {}, {}, {}], { dayType: 'shift' })
    expect(eveningSummary(shift)!.line).toBe('1 of 1 done - enough.')
  })
})

describe('enough', () => {
  it('is exactly half, not more than half', () => {
    expect(isEnough({ done: 2, total: 4, keyDone: 0, keyTotal: 0 })).toBe(true)
    expect(isEnough({ done: 1, total: 3, keyDone: 0, keyTotal: 0 })).toBe(false)
  })

  it('is not reached by having no key tasks and doing none of them', () => {
    expect(isEnough({ done: 0, total: 4, keyDone: 0, keyTotal: 0 })).toBe(false)
  })

  it('is reached by one key task out of one', () => {
    expect(isEnough({ done: 1, total: 9, keyDone: 1, keyTotal: 1 })).toBe(true)
  })
})

/**
 * Two ways in, and the second is the better one: finishing the last thing on
 * the list means the day is over, and being told so in the same second is the
 * whole point.
 */
describe('when the day closes', () => {
  it('opens once the evening has started', () => {
    const d = day([{ done: true }, {}])
    expect(shouldClose({ ...ALWAYS, day: d, nowMinutes: 21 * 60 + 29 })).toBe(false)
    expect(shouldClose({ ...ALWAYS, day: d, nowMinutes: 21 * 60 + 30 })).toBe(true)
  })

  it('opens the moment the last task is ticked off, whatever the clock says', () => {
    const finished = day([{ done: true }, { done: true }])
    expect(shouldClose({ ...ALWAYS, day: finished, nowMinutes: 16 * 60 })).toBe(true)
  })

  it('does not open once its evening is over - yesterday does not close itself', () => {
    const finished = day([{ done: true }, { done: true }])
    expect(shouldClose({ ...ALWAYS, day: finished, nowMinutes: 24 * 60 + 30 })).toBe(false)
    expect(shouldClose({ ...ALWAYS, day: finished, nowMinutes: 8 * 60, evening: { from: 7 * 60, until: 9 * 60 } })).toBe(true)
    expect(shouldClose({ ...ALWAYS, day: finished, nowMinutes: 9 * 60, evening: { from: 7 * 60, until: 9 * 60 } })).toBe(false)
  })

  it('opens at the evening it is given rather than the time in Settings', () => {
    const d = day([{ done: true }, {}])
    const evening = { from: 22 * 60 + 30, until: 32 * 60 }
    expect(shouldClose({ ...ALWAYS, day: d, nowMinutes: 22 * 60 + 29, evening })).toBe(false)
    expect(shouldClose({ ...ALWAYS, day: d, nowMinutes: 22 * 60 + 30, evening })).toBe(true)
    // Past midnight, on the same day's clock, while its evening lasts.
    expect(shouldClose({ ...ALWAYS, day: d, nowMinutes: 25 * 60, evening })).toBe(true)
  })

  it('does not open twice - dismissing is remembered for the date', () => {
    expect(shouldClose({ ...ALWAYS, day: day([{ done: true }, {}]), dismissed: true })).toBe(false)
  })

  it('does not open at all when it is switched off', () => {
    const off = { ...DEFAULT_EVENING_CLOSE, enabled: false }
    expect(shouldClose({ ...ALWAYS, day: day([{ done: true }, { done: true }]), settings: off })).toBe(false)
  })

  it('does not open on a day with no plan', () => {
    expect(shouldClose({ ...ALWAYS, day: day([]) })).toBe(false)
    expect(shouldClose({ ...ALWAYS, day: undefined })).toBe(false)
  })

  it('never opens on a time it cannot read, rather than opening always', () => {
    // A hand-edited backup with "at": "banana" should switch the card off,
    // not turn it on permanently at midnight.
    const broken = { ...DEFAULT_EVENING_CLOSE, at: 'banana' }
    expect(shouldClose({ ...ALWAYS, day: day([{ done: true }, {}]), settings: broken, nowMinutes: 23 * 60 })).toBe(false)
  })
})

describe('the offer to push', () => {
  it('counts what is unfinished, and is silent when there is nothing', () => {
    expect(pushableAtClose(day([{ done: true }, {}, {}]))).toBe(2)
    expect(pushableAtClose(day([{ done: true }]))).toBe(0)
    expect(pushableAtClose(undefined)).toBe(0)
  })

  // Rotating shifts, v2.29 stage 9: the card shows from half past nine, and on
  // a night-shift day the shift starts at ten. What has not started yet, and
  // what is still happening, is not unfinished - it is tonight's.
  it('leaves out what is still to come tonight, and what is happening now', () => {
    const night = day([{ title: 'Paperwork' }, { title: 'Night shift', time: '22:00', minutes: 480 }, { title: 'Class', time: '21:00', minutes: 90 }, { title: 'Walk', time: '17:00', minutes: 30 }, { title: 'Dinner', time: '23:00', done: true }])
    // At 21:40: the shift has not begun, the class is running, and the walk
    // and the paperwork are what did not happen.
    expect(stillAhead(night, 21 * 60 + 40)).toEqual(['t1', 't2'])
    expect(pushableAtClose(night, stillAhead(night, 21 * 60 + 40))).toBe(2)
    // Once the class is over it is unfinished like anything else.
    expect(stillAhead(night, 22 * 60 + 40)).toEqual(['t1'])
    expect(stillAhead(undefined, 21 * 60)).toEqual([])
  })

  // A time with no length is still a time: "22:00 Call home" at 21:40 has not
  // happened yet whatever it takes, and it is not what the day failed to do.
  it('leaves out a task later tonight that has a time and no length', () => {
    const evening = day([{ title: 'Call home', time: '22:00' }, { title: 'Walk', time: '17:00' }])
    expect(stillAhead(evening, 21 * 60 + 40)).toEqual(['t0'])
  })
})
