import { expect, test } from 'vitest'
import type { Task } from '../../lib/types'
import { computeCapacity, formatCapacityLine, formatDuration, parseMinutesInput, parseTimeInput, stepTime } from './capacity'

// 07:00-23:00, matching DEFAULT_WINDOW in capacity.ts.
const WINDOW_START = 7 * 60
const WINDOW_END = 23 * 60
const WINDOW_MINUTES = WINDOW_END - WINDOW_START

// 13:00-24:00, matching NIGHT_WINDOW in capacity.ts.
const NIGHT_START = 13 * 60
const NIGHT_END = 24 * 60

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

// --- computeCapacity: the window is a fixed waking window, not the whole day

test('a single anchor within the window leaves the rest of the window free', () => {
  const capacity = computeCapacity([anchor('Gym', '09:00', 90)]) // 09:00-10:30
  expect(capacity.anchorsMinutes).toBe(90)
  expect(capacity.freeMinutes).toBe(WINDOW_MINUTES - 90)
  // A gap before 09:00 (from 07:00) and a gap after 10:30 (to 23:00).
  expect(capacity.gaps).toHaveLength(2)
})

test('an anchor starting exactly at the window open has no leading gap, only a trailing one', () => {
  const capacity = computeCapacity([anchor('Early start', '07:00', 120)])
  expect(capacity.gaps).toHaveLength(1)
  expect(capacity.gaps[0]).toEqual({ start: 540, end: WINDOW_END, minutes: WINDOW_END - 540 })
})

test('an anchor that fills the entire window leaves no free time and no special case is needed', () => {
  const capacity = computeCapacity([anchor('Whole window', '07:00', WINDOW_MINUTES)])
  expect(capacity.anchorsMinutes).toBe(WINDOW_MINUTES)
  expect(capacity.freeMinutes).toBe(0)
  expect(capacity.gaps).toEqual([])
})

// --- computeCapacity: anchors are clipped to the window, never negative ----

test('an anchor entirely before the window contributes nothing, and the whole window stays free', () => {
  const capacity = computeCapacity([anchor('Too early', '05:00', 60)]) // 05:00-06:00, before 07:00
  expect(capacity.anchorsMinutes).toBe(0)
  expect(capacity.freeMinutes).toBe(WINDOW_MINUTES)
  expect(capacity.gaps).toEqual([{ start: WINDOW_START, end: WINDOW_END, minutes: WINDOW_MINUTES }])
})

test('an anchor that runs past the window close is clipped there, never producing negative free time', () => {
  const capacity = computeCapacity([anchor('Runs late', '22:00', 180)]) // would end at 01:00
  // Only 22:00-23:00 (60 minutes) falls inside the 07:00-23:00 window.
  expect(capacity.anchorsMinutes).toBe(60)
  expect(capacity.freeMinutes).toBeGreaterThanOrEqual(0)
  expect(capacity.freeMinutes).toBe(WINDOW_MINUTES - 60)
})

test('an anchor spanning before the window open and past its close is clipped to exactly the window', () => {
  const capacity = computeCapacity([anchor('All day', '00:00', 24 * 60)])
  expect(capacity.anchorsMinutes).toBe(WINDOW_MINUTES)
  expect(capacity.freeMinutes).toBe(0)
  expect(capacity.gaps).toEqual([])
})

// --- computeCapacity: back-to-back and overlapping anchors ------------------

test('back-to-back anchors with no gap between them merge into one block', () => {
  const capacity = computeCapacity([anchor('Shift', '09:00', 180), anchor('Gym', '12:00', 180)])
  expect(capacity.anchorsMinutes).toBe(360)
  // No interior gap between 09:00 and 15:00 - only the window's own boundary gaps.
  expect(capacity.gaps.every(g => g.end <= 540 || g.start >= 900)).toBe(true)
})

test('overlapping anchors merge to the union of their time, not the sum of their durations', () => {
  // 09:00-12:00 and 11:00-13:00 overlap by an hour; the union is 09:00-13:00 (4h),
  // not the naive sum of 3h + 2h = 5h, which would overstate how much of the window is occupied.
  const capacity = computeCapacity([anchor('Call', '09:00', 180), anchor('Meeting', '11:00', 120)])
  expect(capacity.anchorsMinutes).toBe(240)
})

test('overlapping anchors out of chronological order still merge correctly', () => {
  const capacity = computeCapacity([anchor('Later', '11:00', 120), anchor('Earlier', '09:00', 180)])
  expect(capacity.anchorsMinutes).toBe(240)
})

// --- computeCapacity: Finding 1 regressions - a mid-day or morning-only shift

test('a mid-day shift leaves real free time before and after it within the window - reviewer case 1', () => {
  const capacity = computeCapacity([anchor('Shift', '09:00', 720)]) // 09:00-21:00, 12h
  expect(capacity.anchorsMinutes).toBe(720)
  // 2h before 09:00 (from 07:00), 2h after 21:00 (to 23:00).
  expect(capacity.gaps).toEqual([
    { start: WINDOW_START, end: 540, minutes: 120 },
    { start: 1260, end: WINDOW_END, minutes: 120 },
  ])
  expect(capacity.freeMinutes).toBe(240)
})

test('a mid-day shift with a small float fits comfortably in the window, not "over" - reviewer case 1', () => {
  const capacity = computeCapacity([anchor('Shift', '09:00', 720), float('Errand', 35)])
  expect(capacity.freeMinutes).toBe(240)
  expect(capacity.overMinutes).toBe(0)
  expect(formatCapacityLine(capacity)).toBe(
    'Anchors take 12h. Free: 4h across 2 gaps. Floats need about 35 min.',
  )
})

test('a morning-only anchor leaves the rest of the window free - reviewer case 2', () => {
  const capacity = computeCapacity([anchor('Shift', '07:00', 300), float('Errand', 35)]) // 07:00-12:00
  expect(capacity.anchorsMinutes).toBe(300)
  expect(capacity.freeMinutes).toBe(WINDOW_MINUTES - 300)
  expect(capacity.overMinutes).toBe(0)
  expect(formatCapacityLine(capacity)).toBe(
    'Anchors take 5h. Free: 11h across 1 gap. Floats need about 35 min.',
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
  const tasks = [anchor('Shift', '09:00', 240), anchor('Evening', '19:00', 60), float('Errand', 660)]
  const capacity = computeCapacity(tasks)
  expect(capacity.freeMinutes).toBe(660)
  expect(capacity.floatsMinutes).toBe(660)
  expect(capacity.overMinutes).toBe(0)
})

test('floats that exceed free time report the exact overage', () => {
  const tasks = [anchor('Shift', '09:00', 240), anchor('Evening', '19:00', 60), float('Errand', 700)]
  const capacity = computeCapacity(tasks)
  expect(capacity.freeMinutes).toBe(660)
  expect(capacity.overMinutes).toBe(40)
})

// --- computeCapacity: the night window (Finding 1 follow-up) ---------------

test('a night-shift anchor crossing midnight is clipped to the night window close, never negative', () => {
  // 22:00 for 8 hours would run to 06:00 the next day - only 22:00-24:00
  // (2 hours) falls within this calendar day's 13:00-24:00 night window.
  const capacity = computeCapacity([anchor('Night shift', '22:00', 480)], 'night')
  expect(capacity.anchorsMinutes).toBe(120)
  expect(capacity.freeMinutes).toBe(NIGHT_END - NIGHT_START - 120)
  expect(capacity.gaps).toEqual([{ start: NIGHT_START, end: 22 * 60, minutes: 22 * 60 - NIGHT_START }])
})

test('the same night-shift anchor is clipped harder under the default window than under the night one', () => {
  const tasks = [anchor('Night shift', '22:00', 480)]
  const asFullDay = computeCapacity(tasks, 'full')
  const asNight = computeCapacity(tasks, 'night')
  // The default window closes at 23:00, so only one hour of the shift counts;
  // the night window runs to midnight, so two hours do.
  expect(asFullDay.anchorsMinutes).toBe(60)
  expect(asNight.anchorsMinutes).toBe(120)
})

test('a night day with no anchors still defaults sensibly - no window special-casing needed', () => {
  const capacity = computeCapacity([float('Snack', 10)], 'night')
  expect(capacity.anchorsMinutes).toBeNull()
  expect(capacity.floatsMinutes).toBe(10)
})

test('an anchor that fills the entire night window leaves no free time', () => {
  const capacity = computeCapacity([anchor('Whole night', '13:00', NIGHT_END - NIGHT_START)], 'night')
  expect(capacity.anchorsMinutes).toBe(NIGHT_END - NIGHT_START)
  expect(capacity.freeMinutes).toBe(0)
  expect(capacity.gaps).toEqual([])
})

test('a shift and rest day type use the same window as an ordinary day', () => {
  const tasks = [anchor('Shift start', '09:00', 60)]
  const shift = computeCapacity(tasks, 'shift')
  const rest = computeCapacity(tasks, 'rest')
  const full = computeCapacity(tasks, 'full')
  expect(shift.freeMinutes).toBe(full.freeMinutes)
  expect(rest.freeMinutes).toBe(full.freeMinutes)
})

// --- computeCapacity: saying so when an anchor is clipped, not just clipping it

test('an anchor entirely inside the window is not flagged as clipped', () => {
  const capacity = computeCapacity([anchor('Gym', '09:00', 90)])
  expect(capacity.anchorsClippedByWindow).toBe(false)
  expect(formatCapacityLine(capacity)).toBe('Anchors take 1h30. Free: 14h30 across 2 gaps.')
})

test('an anchor that runs past the window close is flagged as clipped, and the sentence says so', () => {
  const capacity = computeCapacity([anchor('Runs late', '22:00', 180)]) // clipped from 3h down to 1h
  expect(capacity.anchorsClippedByWindow).toBe(true)
  expect(formatCapacityLine(capacity)).toMatch(/^Anchors take 1h within today's window\./)
})

test('an anchor that starts before the window opens is flagged as clipped too', () => {
  const capacity = computeCapacity([anchor('Starts early', '06:00', 180)]) // clipped from 3h down to 2h
  expect(capacity.anchorsClippedByWindow).toBe(true)
  expect(capacity.anchorsMinutes).toBe(120)
})

test('an anchor entirely outside the window is flagged as clipped, even though it reports zero', () => {
  const capacity = computeCapacity([anchor('Too early', '05:00', 60)])
  expect(capacity.anchorsClippedByWindow).toBe(true)
  expect(formatCapacityLine(capacity)).toMatch(/^Anchors take 0 min within today's window\./)
})

test('the clipped-window note appears before the unsized-anchor note, in one clause', () => {
  const capacity = computeCapacity([anchor('Runs late', '22:00', 180), anchor('No size', '10:00', undefined)])
  expect(formatCapacityLine(capacity)).toBe(
    "Anchors take 1h within today's window, plus 1 unsized. Free time isn't known until every anchor has a size.",
  )
})

test('two overlapping anchors merging into their union is not treated as a window clip', () => {
  // 09:00-12:00 and 11:00-13:00 overlap and merge to 09:00-13:00 - both
  // fall entirely inside the default window, so nothing was actually cut
  // off by the window itself.
  const capacity = computeCapacity([anchor('Call', '09:00', 180), anchor('Meeting', '11:00', 120)])
  expect(capacity.anchorsClippedByWindow).toBe(false)
})

test('the night-shift anchor crossing midnight is flagged as clipped under the night window', () => {
  const capacity = computeCapacity([anchor('Night shift', '22:00', 480)], 'night')
  expect(capacity.anchorsClippedByWindow).toBe(true)
})

test('reviewer repro: an eight-hour night shift reads as clipped, not as a two-hour shift', () => {
  const capacity = computeCapacity(
    [anchor('Night shift', '22:00', 480), float('Wind-down task', 30)],
    'night',
  )
  expect(formatCapacityLine(capacity)).toBe(
    "Anchors take 2h within today's window. Free: 9h across 1 gap. Floats need about 30 min.",
  )
})

// --- computeCapacity: unsized anchors (Finding 2) ---------------------------

test('an anchor with no size contributes nothing to the occupied total and blocks the free-time figure entirely', () => {
  const capacity = computeCapacity([anchor('Call', '10:00', undefined), anchor('Shift', '14:00', 120)])
  expect(capacity.unsizedAnchorCount).toBe(1)
  expect(capacity.anchorsMinutes).toBe(120)
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

test('a window entirely filled by anchors says so in plain words, not "0 gaps"', () => {
  const capacity = computeCapacity([anchor('Whole window', '07:00', WINDOW_MINUTES)])
  expect(formatCapacityLine(capacity)).toBe('Anchors take 16h. No free time left today.')
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
  const tasks = [anchor('Shift', '09:00', 240), anchor('Evening', '19:00', 60)]
  const line = formatCapacityLine(computeCapacity(tasks))
  expect(line).not.toMatch(/float/i)
})

test('a single gap uses the singular word "gap"', () => {
  const capacity = computeCapacity([anchor('Early start', '07:00', 120)])
  expect(formatCapacityLine(capacity)).toMatch(/across 1 gap\./)
  expect(formatCapacityLine(capacity)).not.toMatch(/1 gaps/)
})

test('never uses a warning word for the over case', () => {
  const tasks = [anchor('Shift', '09:00', 240), anchor('Evening', '19:00', 60), float('Errand', 800)]
  const line = formatCapacityLine(computeCapacity(tasks))
  expect(line).toMatch(/you are/i)
  expect(line).not.toMatch(/warning|danger|alert|fail|!/i)
})

test('being over is stated plainly, with the word about only on the floats estimate', () => {
  const tasks = [anchor('Shift', '09:00', 240), anchor('Evening', '19:00', 60), float('Errand', 700)]
  const line = formatCapacityLine(computeCapacity(tasks))
  expect(line).toBe('Anchors take 5h. Free: 11h across 3 gaps. Floats need about 11h40. You are 40 min over.')
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

// --- parseTimeInput ---------------------------------------------------------

test('parseTimeInput reads a colon-separated time, padding a single-digit hour', () => {
  expect(parseTimeInput('9:30')).toBe('09:30')
  expect(parseTimeInput('14:00')).toBe('14:00')
  expect(parseTimeInput('  09:30  ')).toBe('09:30')
})

test('parseTimeInput reads bare digits with no colon, minutes as the last two', () => {
  expect(parseTimeInput('0930')).toBe('09:30')
  expect(parseTimeInput('930')).toBe('09:30')
  expect(parseTimeInput('2300')).toBe('23:00')
})

test('parseTimeInput reads one or two bare digits as an hour with no minutes', () => {
  expect(parseTimeInput('9')).toBe('09:00')
  expect(parseTimeInput('14')).toBe('14:00')
})

test('parseTimeInput treats an empty or whitespace-only string as clearing the time', () => {
  expect(parseTimeInput('')).toBeUndefined()
  expect(parseTimeInput('   ')).toBeUndefined()
})

test('parseTimeInput rejects text that is not a time at all', () => {
  expect(parseTimeInput('banana')).toBeUndefined()
})

test('parseTimeInput rejects an out-of-range hour, colon or bare-digit form', () => {
  expect(parseTimeInput('25:00')).toBeUndefined()
  expect(parseTimeInput('2500')).toBeUndefined()
  expect(parseTimeInput('99')).toBeUndefined()
})

test('parseTimeInput rejects an out-of-range minute', () => {
  expect(parseTimeInput('09:75')).toBeUndefined()
  expect(parseTimeInput('0975')).toBeUndefined()
})

// --- stepTime ---------------------------------------------------------------

test('stepTime moves forward and back by the given number of minutes', () => {
  expect(stepTime('09:00', 15)).toBe('09:15')
  expect(stepTime('09:15', -15)).toBe('09:00')
})

test('stepTime crosses an hour boundary in both directions', () => {
  expect(stepTime('09:50', 15)).toBe('10:05')
  expect(stepTime('10:05', -15)).toBe('09:50')
})

test('stepTime crosses midnight forward, wrapping back to the start of the day', () => {
  expect(stepTime('23:50', 15)).toBe('00:05')
})

test('stepTime crosses midnight backward, wrapping to the end of the day', () => {
  expect(stepTime('00:05', -15)).toBe('23:50')
})

test('stepTime supports a larger step, such as the hour jump held with a modifier key', () => {
  expect(stepTime('09:00', 60)).toBe('10:00')
  expect(stepTime('00:30', -60)).toBe('23:30')
})
