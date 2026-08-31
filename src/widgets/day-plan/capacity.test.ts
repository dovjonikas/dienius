import { expect, test } from 'vitest'
import type { Task } from '../../lib/types'
import { computeCapacity, formatCapacityLine, formatDuration, parseMinutesInput } from './capacity'

const DAY_MINUTES = 24 * 60

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

test('no anchors at all leaves anchors and free undefined, not zero, since there is nothing to measure', () => {
  const capacity = computeCapacity([float('Guitar', 20), float('Publish video', 30)])
  expect(capacity.anchorCount).toBe(0)
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

// --- computeCapacity: the window is the calendar day, not the anchor span --

test('a single anchor leaves the rest of the calendar day free, not zero - the window is the whole day', () => {
  const capacity = computeCapacity([anchor('Gym', '09:00', 90)])
  expect(capacity.anchorsMinutes).toBe(90)
  expect(capacity.freeMinutes).toBe(DAY_MINUTES - 90)
  // A gap before 09:00 and a gap after the gym block ends.
  expect(capacity.gaps).toHaveLength(2)
})

test('an anchor starting at midnight has no leading gap, only a trailing one', () => {
  const capacity = computeCapacity([anchor('Early shift', '00:00', 120)])
  expect(capacity.gaps).toHaveLength(1)
  expect(capacity.gaps[0]).toEqual({ start: 120, end: DAY_MINUTES, minutes: DAY_MINUTES - 120 })
})

test('a single anchor spanning the entire calendar day leaves no free time and no special case is needed', () => {
  const capacity = computeCapacity([anchor('Whole day', '00:00', DAY_MINUTES)])
  expect(capacity.anchorsMinutes).toBe(DAY_MINUTES)
  expect(capacity.freeMinutes).toBe(0)
  expect(capacity.gaps).toEqual([])
})

// --- computeCapacity: back-to-back and overlapping anchors ------------------

test('back-to-back anchors with no gap between them merge into one block', () => {
  const capacity = computeCapacity([anchor('Shift', '09:00', 180), anchor('Gym', '12:00', 180)])
  expect(capacity.anchorsMinutes).toBe(360)
  // No interior gap between 09:00 and 15:00 - only the boundary gaps before and after.
  expect(capacity.gaps.every(g => g.end <= 540 || g.start >= 900)).toBe(true)
  expect(capacity.freeMinutes).toBe(DAY_MINUTES - 360)
})

test('overlapping anchors merge to the union of their time, not the sum of their durations', () => {
  // 09:00-12:00 and 11:00-13:00 overlap by an hour; the union is 09:00-13:00 (4h),
  // not the naive sum of 3h + 2h = 5h, which would overstate how much of the day is occupied.
  const capacity = computeCapacity([anchor('Call', '09:00', 180), anchor('Meeting', '11:00', 120)])
  expect(capacity.anchorsMinutes).toBe(240)
})

test('overlapping anchors out of chronological order still merge correctly', () => {
  const capacity = computeCapacity([anchor('Later', '11:00', 120), anchor('Earlier', '09:00', 180)])
  expect(capacity.anchorsMinutes).toBe(240)
})

// --- computeCapacity: several anchors with real interior and boundary gaps -

test('several anchors produce both interior gaps between them and boundary gaps at the edges of the day', () => {
  const tasks = [
    anchor('Shift', '06:00', 240), // 06:00-10:00, 4h
    anchor('Gym', '11:30', 60), // 11:30-12:30, 1h30 gap before
    anchor('Call', '14:00', 30), // 14:00-14:30, 1h30 gap before
    anchor('Dinner prep', '17:20', 40), // 17:20-18:00, 2h50 gap before
  ]
  const capacity = computeCapacity(tasks)
  expect(capacity.anchorsMinutes).toBe(370) // 6h10
  // 3 interior gaps (90 + 90 + 170) plus a leading gap (0-06:00) and a
  // trailing gap (18:00-24:00) - 5 in total, not just the 3 between anchors.
  expect(capacity.gaps).toHaveLength(5)
  expect(capacity.freeMinutes).toBe(DAY_MINUTES - 370)
})

// --- computeCapacity: Finding 1 regressions - a mid-day or morning-only shift

test('a mid-day shift leaves real free time before and after it, not "no free time" - reviewer case 1', () => {
  const capacity = computeCapacity([anchor('Shift', '09:00', 720)]) // 09:00-21:00, 12h
  expect(capacity.anchorsMinutes).toBe(720)
  // 9h before 09:00, 3h after 21:00.
  expect(capacity.gaps).toEqual([
    { start: 0, end: 540, minutes: 540 },
    { start: 1260, end: 1440, minutes: 180 },
  ])
  expect(capacity.freeMinutes).toBe(720)
})

test('a mid-day shift with a small float fits comfortably in the evening, not "over" - reviewer case 1', () => {
  const capacity = computeCapacity([anchor('Shift', '09:00', 720), float('Errand', 35)])
  expect(capacity.freeMinutes).toBe(720)
  expect(capacity.overMinutes).toBe(0)
  expect(formatCapacityLine(capacity)).toBe(
    'Anchors take 12h. Free: 12h across 2 gaps. Floats need about 35 min.',
  )
})

test('a morning-only anchor leaves the whole afternoon and evening free - reviewer case 2', () => {
  const capacity = computeCapacity([anchor('Shift', '07:00', 300), float('Errand', 35)]) // 07:00-12:00
  expect(capacity.anchorsMinutes).toBe(300)
  expect(capacity.freeMinutes).toBe(DAY_MINUTES - 300)
  expect(capacity.overMinutes).toBe(0)
  expect(formatCapacityLine(capacity)).toBe(
    'Anchors take 5h. Free: 19h across 2 gaps. Floats need about 35 min.',
  )
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

// --- computeCapacity: exactly-fitting floats and the over case -------------

test('floats that exactly use up the free time are not reported as over', () => {
  const tasks = [anchor('Shift', '09:00', 240), anchor('Evening', '15:00', 60), float('Errand', 1140)]
  const capacity = computeCapacity(tasks)
  expect(capacity.freeMinutes).toBe(1140)
  expect(capacity.floatsMinutes).toBe(1140)
  expect(capacity.overMinutes).toBe(0)
})

test('floats that exceed free time report the exact overage', () => {
  const tasks = [anchor('Shift', '09:00', 240), anchor('Evening', '15:00', 60), float('Errand', 1200)]
  const capacity = computeCapacity(tasks)
  expect(capacity.freeMinutes).toBe(1140)
  expect(capacity.overMinutes).toBe(60)
})

// --- computeCapacity: an anchor that crosses midnight (Finding 3) ----------

test('an anchor that runs past midnight is clamped to the end of this calendar day', () => {
  // 23:00 for 3 hours would end at 02:00 the next day - only the 60 minutes
  // before midnight belong to today's capacity.
  const capacity = computeCapacity([anchor('Night shift', '23:00', 180)])
  expect(capacity.anchorsMinutes).toBe(60)
  expect(capacity.gaps).toEqual([{ start: 0, end: 1380, minutes: 1380 }])
  expect(capacity.freeMinutes).toBe(1380)
})

test('an anchor starting mid-evening and running past midnight is clamped the same way', () => {
  const capacity = computeCapacity([anchor('Late call', '23:30', 90)]) // would end at 01:00
  expect(capacity.anchorsMinutes).toBe(30)
})

test('a night-shift anchor clamped at midnight still merges correctly with an earlier anchor', () => {
  const tasks = [anchor('Wind down', '21:00', 60), anchor('Night shift', '23:00', 240)]
  const capacity = computeCapacity(tasks)
  // Wind down runs 21:00-22:00 and the night shift is clamped to 23:00-24:00 -
  // two separate blocks with a real 1-hour gap between them.
  expect(capacity.anchorsMinutes).toBe(120)
  expect(capacity.gaps).toContainEqual({ start: 1320, end: 1380, minutes: 60 })
})

// --- computeCapacity: unsized anchors (Finding 2) ---------------------------

test('an anchor with no size contributes nothing to the occupied total and blocks the free-time figure entirely', () => {
  const capacity = computeCapacity([anchor('Call', '10:00', undefined), anchor('Shift', '14:00', 120)])
  expect(capacity.unsizedAnchorCount).toBe(1)
  // The sized anchor's own duration is still known...
  expect(capacity.anchorsMinutes).toBe(120)
  // ...but nothing about free time is asserted, because the call's real
  // length is unknown and it might run through what looks like a gap.
  expect(capacity.freeMinutes).toBeNull()
  expect(capacity.gaps).toEqual([])
  expect(capacity.overMinutes).toBeNull()
})

test('two unsized anchors report zero known occupied time and no free-time figure - reviewer repro', () => {
  const capacity = computeCapacity([anchor('Gym', '09:00', undefined), anchor('Dinner', '18:00', undefined)])
  expect(capacity.anchorCount).toBe(2)
  expect(capacity.unsizedAnchorCount).toBe(2)
  expect(capacity.anchorsMinutes).toBe(0)
  expect(capacity.freeMinutes).toBeNull()
  expect(formatCapacityLine(capacity)).toBe(
    "2 anchors with no size yet. Free time isn't known until every anchor has a size.",
  )
})

test('a single unsized anchor uses the singular in the sentence', () => {
  const capacity = computeCapacity([anchor('Call', '10:00', undefined)])
  expect(formatCapacityLine(capacity)).toBe(
    "1 anchor with no size yet. Free time isn't known until every anchor has a size.",
  )
})

test('sizing the previously-unsized anchor restores a trustworthy free-time figure', () => {
  const sized = computeCapacity([anchor('Call', '10:00', 30), anchor('Shift', '14:00', 120)])
  expect(sized.unsizedAnchorCount).toBe(0)
  expect(sized.freeMinutes).not.toBeNull()
})

// --- formatCapacityLine ------------------------------------------------------

test('an empty day produces no capacity line at all', () => {
  expect(formatCapacityLine(computeCapacity([]))).toBeNull()
})

test('a fully packed calendar day says so in plain words, not "0 gaps"', () => {
  const capacity = computeCapacity([anchor('Whole day', '00:00', DAY_MINUTES)])
  expect(formatCapacityLine(capacity)).toBe('Anchors take 24h. No free time left today.')
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
  const capacity = computeCapacity([anchor('Early shift', '00:00', 120)])
  expect(formatCapacityLine(capacity)).toMatch(/across 1 gap\./)
  expect(formatCapacityLine(capacity)).not.toMatch(/1 gaps/)
})

test('never uses a warning word for the over case', () => {
  const tasks = [anchor('Shift', '09:00', 240), anchor('Evening', '15:00', 60), float('Errand', 1300)]
  const line = formatCapacityLine(computeCapacity(tasks))
  expect(line).toMatch(/you are/i)
  expect(line).not.toMatch(/warning|danger|alert|fail|!/i)
})

test('being over is stated plainly, with the word about only on the floats estimate', () => {
  const tasks = [anchor('Shift', '09:00', 240), anchor('Evening', '15:00', 60), float('Errand', 1200)]
  const line = formatCapacityLine(computeCapacity(tasks))
  expect(line).toBe('Anchors take 5h. Free: 19h across 3 gaps. Floats need about 20h. You are 1h over.')
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
