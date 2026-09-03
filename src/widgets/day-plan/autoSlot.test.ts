import { describe, expect, it } from 'vitest'
import type { Task } from '../../lib/types'
import { roundUpTo, stepToQuarter, suggestSlot, SLOT_STEP_MINUTES } from './autoSlot'
import type { SleepSettings } from './capacity'

function task(partial: Partial<Task> & { title: string }): Task {
  return { id: partial.title, done: false, ...partial }
}

/** 07:00 to 23:00, the window every install starts with. */
const DEFAULT_WINDOW_START = '07:00'

/**
 * What the quick-add time control opens holding.
 *
 * The rule these all defend: the answer is the start of the first gap that
 * genuinely holds the task, never earlier than now, and `undefined` rather
 * than a squeezed-in time when there is no such gap. A wrong-but-reasonable
 * answer costs two taps on an arrow; a dishonest one costs trust in every
 * time the app ever suggests.
 */
describe('the time quick-add opens with', () => {
  it('offers the start of the waking day when the day is empty and it is not today', () => {
    expect(suggestSlot({ tasks: [], durationMinutes: 30 })).toBe(DEFAULT_WINDOW_START)
  })

  it('offers now itself when now is free, rather than the tidier quarter after it', () => {
    // 14:07. Rounding this up to 14:15 reads better and is wrong: a task
    // starting eight minutes from now is not the running task, and Focus is
    // only ever offered on the running card - so the tidy answer would put
    // the thing just typed out of reach of the one feature for doing it now.
    expect(suggestSlot({ tasks: [], durationMinutes: 30, notBefore: 14 * 60 + 7 })).toBe('14:07')
  })

  it('never offers a time that has already been and gone', () => {
    const tasks = [task({ title: 'Standup', time: '07:00', minutes: 30 })]
    // 07:00 to 07:30 is behind us; the answer comes from after the block.
    expect(suggestSlot({ tasks, durationMinutes: 30, notBefore: 7 * 60 + 10 })).toBe('07:30')
  })

  it('slots into the first gap wide enough, not the first gap', () => {
    const tasks = [
      task({ title: 'Standup', time: '07:00', minutes: 30 }),
      // 07:30 to 08:00 is free, but only for half an hour.
      task({ title: 'Review', time: '08:00', minutes: 60 }),
    ]
    expect(suggestSlot({ tasks, durationMinutes: 30 })).toBe('07:30')
    expect(suggestSlot({ tasks, durationMinutes: 45 })).toBe('09:00')
  })

  it('uses a gap that is exactly the right size', () => {
    const tasks = [
      task({ title: 'Standup', time: '07:00', minutes: 30 }),
      task({ title: 'Review', time: '08:00', minutes: 60 }),
    ]
    expect(suggestSlot({ tasks, durationMinutes: 30 })).toBe('07:30')
  })

  it('starts the moment a meeting ends rather than rounding the free time away', () => {
    // A gap that opens at 10:20 is free at 10:20. Rounding it up to the
    // quarter would quietly give away ten minutes for a tidier number.
    const tasks = [task({ title: 'Dentist', time: '09:00', minutes: 80 })]
    expect(suggestSlot({ tasks, durationMinutes: 30, notBefore: 9 * 60 })).toBe('10:20')
  })

  it('says nothing rather than squeezing a task in on a full day', () => {
    const tasks = [task({ title: 'Shift', time: '07:00', minutes: 16 * 60 })]
    expect(suggestSlot({ tasks, durationMinutes: 30 })).toBeUndefined()
  })

  it('says nothing when the only room left is shorter than the task', () => {
    // 22:40 on the clock and twenty minutes until the day's window closes.
    // A planner that answers this with 22:40 for a half-hour task is one you
    // stop believing; the task goes in with no time instead.
    expect(suggestSlot({ tasks: [], durationMinutes: 30, notBefore: 22 * 60 + 40 })).toBeUndefined()
  })

  it('still offers the last usable slot right up against bedtime', () => {
    expect(suggestSlot({ tasks: [], durationMinutes: 30, notBefore: 22 * 60 + 25 })).toBe('22:25')
  })

  it('says nothing once the waking window has closed for the night', () => {
    expect(suggestSlot({ tasks: [], durationMinutes: 15, notBefore: 23 * 60 + 30 })).toBeUndefined()
  })

  it('counts an external calendar the same as a task of your own', () => {
    const busy = [{ start: 7 * 60, end: 9 * 60 }]
    expect(suggestSlot({ tasks: [], durationMinutes: 30, busy })).toBe('09:00')
  })

  it('measures against whichever sleep schedule the day points at', () => {
    const sleep: SleepSettings = {
      profiles: [{ id: 'nights', name: 'Nights', window: { start: '10:00', end: '18:00' } }],
    }
    expect(suggestSlot({ tasks: [], durationMinutes: 30, sleepProfileId: 'nights', sleep })).toBe('18:00')
  })
})

/**
 * An anchor with no size has an unknown length, and this app has refused to
 * invent one since v1.0. The rule here is the narrowest thing that is still
 * useful: the day around it is still offered, a suggestion never runs across
 * the minute it begins, and nothing anywhere claims to know how long it is.
 */
describe('an anchor whose length nobody has typed', () => {
  it('does not swallow the rest of the day', () => {
    const tasks = [task({ title: 'Dentist', time: '09:00' })]
    // Before it, because that is the first gap that fits - not "nothing free
    // today", which is what treating it as unbounded would say.
    expect(suggestSlot({ tasks, durationMinutes: 30 })).toBe('07:00')
  })

  it('is not started on top of', () => {
    const tasks = [
      task({ title: 'Morning', time: '07:00', minutes: 120 }),
      task({ title: 'Dentist', time: '09:00' }),
    ]
    // 09:00 is where the sized block ends and the unsized one begins. The
    // suggestion steps past it by one press of the arrow rather than
    // proposing the same minute something else starts.
    expect(suggestSlot({ tasks, durationMinutes: 30 })).toBe('09:15')
  })

  it('splits the day around it rather than being counted as time spent', () => {
    const tasks = [task({ title: 'Dentist', time: '09:00' })]
    // 07:00 to 09:00 is two hours, which does not hold three - so the answer
    // comes from after it, and no part of the day was written off.
    expect(suggestSlot({ tasks, durationMinutes: 180 })).toBe('09:15')
  })
})

describe('rounding a minute count up to a step', () => {
  it('leaves a value already on the step alone', () => {
    expect(roundUpTo(60, SLOT_STEP_MINUTES)).toBe(60)
  })

  it('moves a value between steps up to the next one', () => {
    expect(roundUpTo(61, SLOT_STEP_MINUTES)).toBe(75)
  })
})

/**
 * The arrows snap onto the quarter hour rather than adding fifteen minutes to
 * whatever is there. The value they usually start from is the clock, so a
 * flat addition would carry the stray minutes of 14:07 through every press
 * for the rest of the session.
 */
describe('stepping the time by an arrow', () => {
  it('snaps to the next quarter from an odd minute rather than adding fifteen', () => {
    expect(stepToQuarter('14:07', 1)).toBe('14:15')
    expect(stepToQuarter('14:07', -1)).toBe('14:00')
  })

  it('moves a whole quarter when it is already on one', () => {
    expect(stepToQuarter('14:15', 1)).toBe('14:30')
    expect(stepToQuarter('14:15', -1)).toBe('14:00')
  })

  it('wraps around midnight rather than stopping at either end of the day', () => {
    expect(stepToQuarter('23:45', 1)).toBe('00:00')
    expect(stepToQuarter('00:00', -1)).toBe('23:45')
  })
})
