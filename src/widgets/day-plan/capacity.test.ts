import { expect, test } from 'vitest'
import type { Task } from '../../lib/types'
import { computeCapacity, formatCapacityLine, formatDuration, parseMinutesInput, trimCandidate } from './capacity'

function anchor(title: string, time: string, minutes?: number): Task {
  return { id: title, title, done: false, time, minutes }
}

function float(title: string, minutes?: number, extra: Partial<Task> = {}): Task {
  return { id: title, title, done: false, minutes, ...extra }
}

// --- formatDuration -------------------------------------------------------

test('formatDuration renders whole hours and minutes together, matching the spec example', () => {
  expect(formatDuration(370)).toBe('6h10')
  expect(formatDuration(320)).toBe('5h20')
})

test('formatDuration renders an exact number of hours with no trailing zero minutes', () => {
  expect(formatDuration(360)).toBe('6h')
  expect(formatDuration(60)).toBe('1h')
})

test('formatDuration renders under an hour as a plain minute count', () => {
  expect(formatDuration(40)).toBe('40 min')
  expect(formatDuration(1)).toBe('1 min')
})

test('formatDuration pads a single-digit minute remainder', () => {
  expect(formatDuration(65)).toBe('1h05')
})

// --- computeCapacity: anchors and floats classification --------------------

test('a task with a time is an anchor; a task with no time is a float', () => {
  const capacity = computeCapacity([anchor('Shift', '09:00', 60), float('Guitar', 20)])
  expect(capacity.anchorsMinutes).toBe(60)
  expect(capacity.floatsMinutes).toBe(20)
})

// --- computeCapacity: no anchors --------------------------------------------

test('no anchors at all leaves anchors and free undefined, not zero, since there is no window to measure', () => {
  const capacity = computeCapacity([float('Guitar', 20), float('Publish video', 30)])
  expect(capacity.anchorsMinutes).toBeNull()
  expect(capacity.freeMinutes).toBeNull()
  expect(capacity.gaps).toEqual([])
  expect(capacity.overMinutes).toBeNull()
  expect(capacity.floatsMinutes).toBe(50)
})

test('a completely empty day has no anchors, no floats, and nothing to compare', () => {
  const capacity = computeCapacity([])
  expect(capacity.anchorsMinutes).toBeNull()
  expect(capacity.floatsMinutes).toBe(0)
  expect(capacity.unsizedFloatCount).toBe(0)
  expect(capacity.overMinutes).toBeNull()
})

// --- computeCapacity: one anchor --------------------------------------------

test('a single anchor defines a window equal to its own span, so there are no interior gaps', () => {
  const capacity = computeCapacity([anchor('Gym', '09:00', 90)])
  expect(capacity.anchorsMinutes).toBe(90)
  expect(capacity.gaps).toEqual([])
  expect(capacity.freeMinutes).toBe(0)
})

// --- computeCapacity: back-to-back anchors ----------------------------------

test('back-to-back anchors with no gap merge into one block with zero free time between them', () => {
  const capacity = computeCapacity([anchor('Shift', '09:00', 180), anchor('Gym', '12:00', 180)])
  expect(capacity.anchorsMinutes).toBe(360)
  expect(capacity.gaps).toEqual([])
  expect(capacity.freeMinutes).toBe(0)
})

// --- computeCapacity: overlapping anchors -----------------------------------

test('overlapping anchors merge to the union of their time, not the sum of their durations', () => {
  // 09:00-12:00 and 11:00-13:00 overlap by an hour; the union is 09:00-13:00 (4h),
  // not the naive sum of 3h + 2h = 5h, which would overstate how much of the day is occupied.
  const capacity = computeCapacity([anchor('Call', '09:00', 180), anchor('Meeting', '11:00', 120)])
  expect(capacity.anchorsMinutes).toBe(240)
  expect(capacity.gaps).toEqual([])
})

test('overlapping anchors out of chronological order still merge correctly', () => {
  const capacity = computeCapacity([anchor('Later', '11:00', 120), anchor('Earlier', '09:00', 180)])
  expect(capacity.anchorsMinutes).toBe(240)
})

// --- computeCapacity: real interior gaps ------------------------------------

test('four anchors with three interior gaps summing to the free total', () => {
  const tasks = [
    anchor('Shift', '06:00', 240), // 06:00-10:00, 4h
    anchor('Gym', '11:30', 60), // 11:30-12:30, 1h30 gap before, 1h
    anchor('Call', '14:00', 30), // 14:00-14:30, 1h30 gap before
    anchor('Dinner prep', '17:20', 40), // 17:20-18:00, 2h50 gap before
  ]
  const capacity = computeCapacity(tasks)
  expect(capacity.anchorsMinutes).toBe(370) // 6h10
  expect(capacity.gaps).toHaveLength(3)
  expect(capacity.freeMinutes).toBe(90 + 90 + 170) // 5h50
})

// --- computeCapacity: a day that is one long shift --------------------------

test('a day that is one long shift leaves no free time at all', () => {
  const capacity = computeCapacity([anchor('Shift', '08:00', 600)]) // 10 hours
  expect(capacity.anchorsMinutes).toBe(600)
  expect(capacity.freeMinutes).toBe(0)
  expect(capacity.gaps).toEqual([])
})

test('a long shift with floats reports the entire float total as over, since nothing is free', () => {
  const capacity = computeCapacity([anchor('Shift', '08:00', 600), float('Errand', 45)])
  expect(capacity.freeMinutes).toBe(0)
  expect(capacity.overMinutes).toBe(45)
})

// --- computeCapacity: floats with and without sizes -------------------------

test('unsized floats are counted separately and never folded into the total', () => {
  const capacity = computeCapacity([float('Sized', 20), float('No size yet'), float('Also no size')])
  expect(capacity.floatsMinutes).toBe(20)
  expect(capacity.unsizedFloatCount).toBe(2)
})

test('a done float still counts toward the size total - capacity describes the day, not what is left', () => {
  const capacity = computeCapacity([float('Finished already', 30, { done: true })])
  expect(capacity.floatsMinutes).toBe(30)
})

// --- computeCapacity: exactly-fitting floats --------------------------------

test('floats that exactly use up the free time are not reported as over', () => {
  const tasks = [anchor('Shift', '09:00', 240), anchor('Evening', '15:00', 60), float('Errand', 120)]
  // gap between anchors: 09:00-13:00 then 15:00-16:00 -> free 09:00-15:00 minus... simpler: gap = 120 min
  const capacity = computeCapacity(tasks)
  expect(capacity.freeMinutes).toBe(120)
  expect(capacity.floatsMinutes).toBe(120)
  expect(capacity.overMinutes).toBe(0)
})

// --- computeCapacity: the over case ------------------------------------------

test('floats that exceed free time report the exact overage', () => {
  const tasks = [anchor('Shift', '09:00', 240), anchor('Evening', '15:00', 60), float('Errand', 160)]
  const capacity = computeCapacity(tasks)
  expect(capacity.freeMinutes).toBe(120)
  expect(capacity.overMinutes).toBe(40)
})

// --- computeCapacity: an anchor with no minutes ------------------------------

test('an anchor with no minutes contributes zero occupied time but still marks a point in the day', () => {
  const tasks = [anchor('Call', '10:00', undefined), anchor('Shift', '14:00', 120)]
  const capacity = computeCapacity(tasks)
  // The call is known to start at 10:00 but has no known length, so it adds
  // nothing to the occupied total - only the 2-hour shift does.
  expect(capacity.anchorsMinutes).toBe(120)
  // It still splits the day: the gap runs the full 10:00-14:00 stretch,
  // since a zero-width point removes none of that free time itself.
  expect(capacity.gaps).toHaveLength(1)
  expect(capacity.freeMinutes).toBe(240)
})

// --- formatCapacityLine ------------------------------------------------------

test('an empty day produces no capacity line at all', () => {
  expect(formatCapacityLine(computeCapacity([]))).toBeNull()
})

test('matches the spec example sentence exactly', () => {
  const tasks = [
    anchor('Shift', '06:00', 240),
    anchor('Gym', '11:30', 60),
    anchor('Call', '14:00', 30),
    anchor('Dinner prep', '17:20', 40),
    float('Publish video', 200),
    float('Guitar', 20),
    float('Call grandma', 130),
  ]
  const capacity = computeCapacity(tasks)
  expect(capacity.anchorsMinutes).toBe(370)
  expect(capacity.freeMinutes).toBe(350)
  expect(capacity.floatsMinutes).toBe(350)
  const line = formatCapacityLine(capacity)
  expect(line).toBe('Anchors take 6h10. Free: 5h50 across 3 gaps. Floats need about 5h50.')
})

test('being over is stated plainly, with the word about only on the floats estimate', () => {
  const tasks = [anchor('Shift', '09:00', 240), anchor('Evening', '15:00', 60), float('Errand', 160)]
  const line = formatCapacityLine(computeCapacity(tasks))
  expect(line).toBe('Anchors take 5h. Free: 2h across 1 gap. Floats need about 2h40. You are 40 min over.')
})

test('never uses a warning word for the over case', () => {
  const tasks = [anchor('Shift', '09:00', 240), anchor('Evening', '15:00', 60), float('Errand', 160)]
  const line = formatCapacityLine(computeCapacity(tasks))
  expect(line).not.toMatch(/warning|danger|alert|fail|!/i)
})

test('anchors with no free time between them say so in plain words, not "0 gaps"', () => {
  const capacity = computeCapacity([anchor('Shift', '08:00', 600)])
  expect(formatCapacityLine(capacity)).toBe('Anchors take 10h. No free time between anchors.')
})

test('floats only, with no anchors, reports the float total with no free-time claim', () => {
  const capacity = computeCapacity([float('Publish video', 200), float('Guitar', 20)])
  expect(formatCapacityLine(capacity)).toBe('Floats need about 3h40.')
})

test('unsized floats are named in the sentence, not silently dropped', () => {
  const capacity = computeCapacity([float('Publish video', 200), float('No size yet')])
  expect(formatCapacityLine(capacity)).toBe('Floats need about 3h20, plus 1 unsized.')
})

test('floats that are entirely unsized cannot claim a total, so the sentence says so honestly', () => {
  const capacity = computeCapacity([float('No size yet'), float('Also no size')])
  expect(formatCapacityLine(capacity)).toBe('2 floats with no size yet.')
})

test('a single unsized float uses the singular', () => {
  const capacity = computeCapacity([float('No size yet')])
  expect(formatCapacityLine(capacity)).toBe('1 float with no size yet.')
})

test('anchors with no floats at all say nothing about floats', () => {
  const tasks = [anchor('Shift', '06:00', 240), anchor('Gym', '11:30', 60)]
  const line = formatCapacityLine(computeCapacity(tasks))
  expect(line).not.toMatch(/float/i)
})

test('a single gap uses the singular word "gap"', () => {
  const tasks = [anchor('Shift', '09:00', 60), anchor('Evening', '12:00', 60)]
  const line = formatCapacityLine(computeCapacity(tasks))
  expect(line).toMatch(/across 1 gap\./)
  expect(line).not.toMatch(/1 gaps/)
})

// --- trimCandidate ------------------------------------------------------------

test('trimCandidate picks the largest sized, undone float', () => {
  const tasks = [
    anchor('Shift', '09:00', 240),
    float('Small', 20),
    float('Big', 90),
    float('Unsized'),
    float('Done big', 200, { done: true }),
  ]
  expect(trimCandidate(tasks)?.title).toBe('Big')
})

test('trimCandidate skips a float that has already been pushed to the push bound', () => {
  const tasks = [float('Maxed', 90, { pushCount: 2 }), float('Still pushable', 20, { pushCount: 1 })]
  expect(trimCandidate(tasks)?.title).toBe('Still pushable')
})

test('trimCandidate returns undefined when nothing is eligible', () => {
  expect(trimCandidate([float('Maxed', 90, { pushCount: 2 })])).toBeUndefined()
  expect(trimCandidate([float('Unsized only')])).toBeUndefined()
  expect(trimCandidate([anchor('Shift', '09:00', 60)])).toBeUndefined()
  expect(trimCandidate([])).toBeUndefined()
})

test('trimCandidate never returns an anchor, even an oversized one', () => {
  const tasks = [anchor('Long shift', '08:00', 600), float('Small', 5)]
  expect(trimCandidate(tasks)?.title).toBe('Small')
})

// --- parseMinutesInput ---------------------------------------------------------

test('parseMinutesInput reads a plain whole number', () => {
  expect(parseMinutesInput('20')).toBe(20)
  expect(parseMinutesInput('  90  ')).toBe(90)
})

test('parseMinutesInput treats an empty string as clearing the size', () => {
  expect(parseMinutesInput('')).toBeUndefined()
  expect(parseMinutesInput('   ')).toBeUndefined()
})

test('parseMinutesInput rejects a negative, fractional, or non-numeric value', () => {
  expect(parseMinutesInput('-5')).toBeUndefined()
  expect(parseMinutesInput('12.5')).toBeUndefined()
  expect(parseMinutesInput('abc')).toBeUndefined()
})

test('parseMinutesInput rejects zero, since a task cannot take no time at all', () => {
  expect(parseMinutesInput('0')).toBeUndefined()
})
