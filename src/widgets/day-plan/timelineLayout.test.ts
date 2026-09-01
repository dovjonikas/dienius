import { expect, test } from 'vitest'
import type { Task } from '../../lib/types'
import {
  computeTimelineLayout,
  computeVerticalLayout,
  currentMinutes,
  formatAnchorTimeRange,
  formatClock,
  halfHourMarks,
  hourMarks,
} from './timelineLayout'

function anchor(id: string, time: string, minutes?: number): Task {
  return { id, title: id, done: false, time, minutes }
}

function float(id: string, minutes?: number): Task {
  return { id, title: id, done: false, minutes }
}

// --- no anchors --------------------------------------------------------

test('no anchors at all: no window, nothing to draw', () => {
  const layout = computeTimelineLayout([float('Guitar', 20), float('Publish video', 30)])
  expect(layout.window).toBeNull()
  expect(layout.anchors).toEqual([])
  expect(layout.gaps).toEqual([])
  expect(layout.unsizedAnchorCount).toBe(0)
})

// --- a single anchor, filling the window it defines ---------------------

test('a single sized anchor gets a one-hour buffer on each side and no interior gaps', () => {
  const layout = computeTimelineLayout([anchor('Shift', '09:00', 120)])
  expect(layout.window).toEqual({ start: 8 * 60, end: 12 * 60 })
  expect(layout.anchors).toHaveLength(1)
  expect(layout.anchors[0]).toMatchObject({
    id: 'Shift',
    startMinutes: 9 * 60,
    endMinutes: 11 * 60,
    sized: true,
    clippedEnd: false,
    clippedStart: false,
    column: 0,
    columns: 1,
  })
  expect(layout.gaps).toEqual([])
})

// --- two anchors with a real gap between them ----------------------------

test('two anchors with room between them produce exactly one interior gap, not edge gaps', () => {
  const layout = computeTimelineLayout([
    anchor('Shift', '09:00', 240), // 09:00-13:00
    anchor('Gym', '14:30', 60), // 14:30-15:30
  ])
  // window: first start - 1h to last end + 1h
  expect(layout.window).toEqual({ start: 8 * 60, end: 16 * 60 + 30 })
  expect(layout.gaps).toHaveLength(1)
  expect(layout.gaps[0]).toEqual({ startMinutes: 13 * 60, endMinutes: 14 * 60 + 30, minutes: 90 })
})

// --- overlapping anchors --------------------------------------------------

test('overlapping anchors are placed in side-by-side columns rather than stacked on top of each other', () => {
  const layout = computeTimelineLayout([
    anchor('Call', '10:00', 60), // 10:00-11:00
    anchor('Standup', '10:30', 30), // 10:30-11:00, overlaps Call
  ])
  const call = layout.anchors.find(a => a.id === 'Call')!
  const standup = layout.anchors.find(a => a.id === 'Standup')!
  expect(call.columns).toBe(2)
  expect(standup.columns).toBe(2)
  expect(call.column).not.toBe(standup.column)
})

test('overlapping anchors do not open a false gap between them', () => {
  const layout = computeTimelineLayout([
    anchor('Call', '10:00', 60),
    anchor('Standup', '10:30', 30),
  ])
  expect(layout.gaps).toEqual([])
})

test('three mutually overlapping anchors each get their own column', () => {
  const layout = computeTimelineLayout([
    anchor('A', '09:00', 90),
    anchor('B', '09:15', 90),
    anchor('C', '09:30', 90),
  ])
  const columns = layout.anchors.map(a => a.column).sort()
  expect(columns).toEqual([0, 1, 2])
  expect(layout.anchors.every(a => a.columns === 3)).toBe(true)
})

test('back-to-back anchors that only touch do not open a gap and do not share a column', () => {
  const layout = computeTimelineLayout([
    anchor('Shift', '09:00', 60), // 09:00-10:00
    anchor('Handoff', '10:00', 30), // 10:00-10:30, starts exactly when Shift ends
  ])
  expect(layout.gaps).toEqual([])
  const shift = layout.anchors.find(a => a.id === 'Shift')!
  const handoff = layout.anchors.find(a => a.id === 'Handoff')!
  // They do not overlap in time, so each is free to take the full width.
  expect(shift.columns).toBe(1)
  expect(handoff.columns).toBe(1)
})

// --- unsized anchors -------------------------------------------------------

test('an unsized anchor is positioned but carries no end time or duration', () => {
  const layout = computeTimelineLayout([anchor('Mystery', '14:00')])
  const block = layout.anchors[0]
  expect(block.sized).toBe(false)
  expect(block.startMinutes).toBe(14 * 60)
  expect(block.endMinutes).toBeUndefined()
  expect(block.minutes).toBeUndefined()
})

test('an unsized anchor suppresses gap computation for the whole day, the same way the capacity line does', () => {
  const layout = computeTimelineLayout([
    anchor('Shift', '09:00', 120),
    anchor('Mystery', '13:00'),
    anchor('Gym', '16:00', 60),
  ])
  expect(layout.unsizedAnchorCount).toBe(1)
  expect(layout.gaps).toEqual([])
})

test('unsizedAnchorCount counts every anchor missing a size', () => {
  const layout = computeTimelineLayout([anchor('A', '09:00'), anchor('B', '11:00')])
  expect(layout.unsizedAnchorCount).toBe(2)
})

// --- clipping at the window edge --------------------------------------------

test('an anchor that would run past midnight is clipped to the window and flagged', () => {
  const layout = computeTimelineLayout([anchor('Night shift', '23:00', 180)])
  expect(layout.window!.end).toBe(24 * 60)
  const block = layout.anchors[0]
  expect(block.clippedEnd).toBe(true)
  // Visible portion stops at midnight even though the real duration is longer.
  expect(block.endMinutes).toBe(24 * 60)
  expect(block.minutes).toBe(180)
})

test('an anchor that fits entirely inside the window is never flagged as clipped', () => {
  const layout = computeTimelineLayout([anchor('Gym', '18:00', 60)])
  expect(layout.anchors[0].clippedEnd).toBe(false)
  expect(layout.anchors[0].clippedStart).toBe(false)
})

// --- floats are ignored entirely -------------------------------------------

test('floats never appear in the timeline layout', () => {
  const layout = computeTimelineLayout([anchor('Shift', '09:00', 60), float('Guitar', 20)])
  expect(layout.anchors).toHaveLength(1)
  expect(layout.anchors[0].id).toBe('Shift')
})

// --- anchors out of input order are laid out in time order -----------------

test('anchors are laid out in time order regardless of input order', () => {
  const layout = computeTimelineLayout([
    anchor('Gym', '16:00', 60),
    anchor('Shift', '09:00', 120),
  ])
  expect(layout.anchors.map(a => a.id)).toEqual(['Shift', 'Gym'])
})

// --- hourMarks -----------------------------------------------------------

test('hourMarks lists every whole hour within the window', () => {
  const window = { start: 8 * 60, end: 12 * 60 }
  expect(hourMarks(window)).toEqual([8 * 60, 9 * 60, 10 * 60, 11 * 60, 12 * 60])
})

test('hourMarks starts at the first whole hour at or after a non-aligned window start', () => {
  const window = { start: 8 * 60 + 15, end: 10 * 60 }
  expect(hourMarks(window)).toEqual([9 * 60, 10 * 60])
})

// --- formatClock -----------------------------------------------------------

test('formatClock renders a plain zero-padded 24-hour time', () => {
  expect(formatClock(9 * 60)).toBe('09:00')
  expect(formatClock(14 * 60 + 5)).toBe('14:05')
})

test('formatClock renders the end of a night window as 24:00, not 00:00', () => {
  expect(formatClock(24 * 60)).toBe('24:00')
})

// --- formatAnchorTimeRange ---------------------------------------------

test('formatAnchorTimeRange renders a plain range for an anchor that stays within one day', () => {
  expect(formatAnchorTimeRange(9 * 60, 120)).toBe('09:00 - 11:00')
})

test('formatAnchorTimeRange renders an anchor ending exactly at midnight as 24:00', () => {
  expect(formatAnchorTimeRange(22 * 60, 120)).toBe('22:00 - 24:00')
})

test('formatAnchorTimeRange wraps an anchor that runs past midnight and says so', () => {
  expect(formatAnchorTimeRange(23 * 60, 180)).toBe('23:00 - 02:00 (next day)')
})

// --- halfHourMarks -----------------------------------------------------

test('halfHourMarks lists every half-hour strictly within the window, never the hours themselves', () => {
  const window = { start: 8 * 60, end: 10 * 60 }
  expect(halfHourMarks(window)).toEqual([8 * 60 + 30, 9 * 60 + 30])
})

test('halfHourMarks starts at the first half-hour at or after a non-aligned window start', () => {
  const window = { start: 8 * 60 + 45, end: 10 * 60 }
  expect(halfHourMarks(window)).toEqual([9 * 60 + 30])
})

test('halfHourMarks is empty for a window shorter than one half-hour step', () => {
  const window = { start: 8 * 60, end: 8 * 60 + 20 }
  expect(halfHourMarks(window)).toEqual([])
})

// --- currentMinutes ------------------------------------------------------

test('currentMinutes reads hours and minutes off the clock, ignoring seconds and the date', () => {
  expect(currentMinutes(new Date(2026, 0, 15, 9, 30, 45))).toBe(9 * 60 + 30)
})

test('currentMinutes at midnight is 0', () => {
  expect(currentMinutes(new Date(2026, 0, 15, 0, 0))).toBe(0)
})

// --- computeVerticalLayout -----------------------------------------------
//
// This is the fix for the audit finding: GAP_MIN_HEIGHT_PX (44px, a touch
// target floor) used to be applied only as a CSS min-height on a box whose
// top/height were still computed from raw proportional time. On a real
// shift schedule a gap under about 38 minutes earns fewer than 44 raw
// pixels, so the floor drew the gap's box straight over the next anchor's
// card - two labels on top of each other. computeVerticalLayout replaces
// pure time-proportional positioning with a piecewise-linear map: every
// anchor cluster and every real gap gets at least its own floor in pixels,
// and everything downstream of a stretched segment is displaced by exactly
// the same amount, so nothing after it can ever be drawn underneath it.

const OPTS = { pxPerMinute: 1.15, sizedAnchorFloorPx: 32, unsizedAnchorFloorPx: 44, gapFloorPx: 44 }

test('a gap far above the floor is not inflated: positions match plain proportional math', () => {
  const layout = computeTimelineLayout([anchor('Shift', '09:00', 240), anchor('Gym', '14:30', 60)])
  const vertical = computeVerticalLayout(layout.window!, layout.anchors, OPTS)
  const gap = layout.gaps[0]
  const expectedTop = (gap.startMinutes - layout.window!.start) * OPTS.pxPerMinute
  const expectedBottom = (gap.endMinutes - layout.window!.start) * OPTS.pxPerMinute
  expect(vertical.topPx(gap.startMinutes)).toBeCloseTo(expectedTop, 5)
  expect(vertical.topPx(gap.endMinutes)).toBeCloseTo(expectedBottom, 5)
  const totalMinutes = layout.window!.end - layout.window!.start
  expect(vertical.totalHeightPx).toBeCloseTo(totalMinutes * OPTS.pxPerMinute, 5)
})

test.each([15, 25, 35])(
  'a %i-minute gap gets its full 44px floor and the following anchor never overlaps it',
  gapMinutes => {
    // Reproduces the audit's own case: two real 30-minute blocks with a
    // short buffer between them, the common shape of a real shift change.
    const layout = computeTimelineLayout([
      anchor('Commute home', '06:30', 30),
      anchor('Wind down and sleep', formatClock(7 * 60 + gapMinutes), 30),
    ])
    const vertical = computeVerticalLayout(layout.window!, layout.anchors, OPTS)
    expect(layout.gaps).toHaveLength(1)
    const gap = layout.gaps[0]
    const gapTop = vertical.topPx(gap.startMinutes)
    const gapBottom = vertical.topPx(gap.endMinutes)
    expect(gapBottom - gapTop).toBeGreaterThanOrEqual(44)

    const nextAnchor = layout.anchors.find(a => a.id === 'Wind down and sleep')!
    const nextAnchorTop = vertical.topPx(nextAnchor.startMinutes)
    // The next anchor starts exactly where the gap's own floored box ends -
    // never earlier, which is what "overlap" would mean here.
    expect(nextAnchorTop).toBe(gapBottom)
  },
)

test('a gap right at the 38-minute threshold barely needs the floor, and clearing it does not', () => {
  // 38 minutes raw is just under 44px at 1.15 px/min (43.7px); 39 minutes clears it.
  const short = computeTimelineLayout([anchor('A', '09:00', 30), anchor('B', '10:08', 30)]) // 38-min gap
  const long = computeTimelineLayout([anchor('A', '09:00', 30), anchor('B', '10:09', 30)]) // 39-min gap
  const shortVertical = computeVerticalLayout(short.window!, short.anchors, OPTS)
  const longVertical = computeVerticalLayout(long.window!, long.anchors, OPTS)
  const shortGap = short.gaps[0]
  const longGap = long.gaps[0]
  expect(shortVertical.topPx(shortGap.endMinutes) - shortVertical.topPx(shortGap.startMinutes)).toBeCloseTo(44, 5)
  expect(longVertical.topPx(longGap.endMinutes) - longVertical.topPx(longGap.startMinutes)).toBeGreaterThan(44)
})

test('an anchor shorter than its own floor still leaves room for whatever follows it', () => {
  // A 5-minute anchor sandwiched between two others - its own drawn card is
  // floored to 32px even though 5 real minutes only earns 5.75px, so the
  // gap right after it must start no earlier than that floored bottom.
  const layout = computeTimelineLayout([
    anchor('Shift', '09:00', 60),
    anchor('Quick call', '10:05', 5),
    anchor('Gym', '11:00', 60),
  ])
  const vertical = computeVerticalLayout(layout.window!, layout.anchors, OPTS)
  const quickCall = layout.anchors.find(a => a.id === 'Quick call')!
  const callTop = vertical.topPx(quickCall.startMinutes)
  const callBottom = vertical.topPx(quickCall.endMinutes!)
  expect(callBottom - callTop).toBeGreaterThanOrEqual(32)

  const gapAfterCall = layout.gaps.find(g => g.startMinutes === quickCall.endMinutes)!
  const gapAfterTop = vertical.topPx(gapAfterCall.startMinutes)
  expect(gapAfterTop).toBe(callBottom)
})

test('topPx is monotonically non-decreasing across a whole realistic day', () => {
  const layout = computeTimelineLayout([
    anchor('Commute home', '06:30', 30),
    anchor('Wind down and sleep', '06:55', 30), // 10-min gap before, deliberately short
    anchor('Errand', '09:00', 15),
    anchor('Shift', '13:00', 480),
  ])
  const vertical = computeVerticalLayout(layout.window!, layout.anchors, OPTS)
  const sampleMinutes: number[] = [layout.window!.start]
  for (const a of layout.anchors) {
    sampleMinutes.push(a.startMinutes)
    if (a.endMinutes !== undefined) sampleMinutes.push(a.endMinutes)
  }
  sampleMinutes.push(layout.window!.end)
  let previous = -Infinity
  for (const m of sampleMinutes.sort((a, b) => a - b)) {
    const top = vertical.topPx(m)
    expect(top).toBeGreaterThanOrEqual(previous)
    previous = top
  }
  expect(vertical.totalHeightPx).toBeGreaterThan(0)
})

test('a day with no anchors maps proportionally with no clusters to floor', () => {
  const window = { start: 8 * 60, end: 12 * 60 }
  const vertical = computeVerticalLayout(window, [], OPTS)
  expect(vertical.topPx(window.start)).toBe(0)
  expect(vertical.topPx(window.end)).toBeCloseTo((window.end - window.start) * OPTS.pxPerMinute, 5)
})

test('when any anchor is unsized, interior spacing is not artificially inflated for a gap that will never render', () => {
  // computeTimelineLayout suppresses every TimelineGap object for the whole
  // day once one anchor is unsized (its real end is unknown, so no gap
  // around it can be trusted) - the vertical layout should not reserve a
  // 44px floor for a gap that the grid will never draw a button for.
  const layout = computeTimelineLayout([anchor('Shift', '09:00', 60), anchor('Mystery', '10:05')])
  expect(layout.gaps).toEqual([])
  const vertical = computeVerticalLayout(layout.window!, layout.anchors, { ...OPTS, gapFloorPx: 0 })
  const shift = layout.anchors.find(a => a.id === 'Shift')!
  const mystery = layout.anchors.find(a => a.id === 'Mystery')!
  const shiftBottom = vertical.topPx(shift.endMinutes!)
  const mysteryTop = vertical.topPx(mystery.startMinutes)
  // Real gap here is only 5 minutes (5.75px) - with no gap floor reserved,
  // the two stay close together rather than being pushed 44px apart for a
  // button that does not exist.
  expect(mysteryTop - shiftBottom).toBeLessThan(44)
})
