import { expect, test } from 'vitest'
import type { Task } from '../../lib/types'
import { measureScaling } from '../../test/stress'
import {
  chooseWidePxPerMinute,
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

// --- stress test: an anchor with an absurd minutes value --------------------

test('an anchor with ten million minutes still draws a bounded window, never past one calendar day', () => {
  const layout = computeTimelineLayout([anchor('Absurd', '09:00', 10_000_000)])
  expect(layout.window).not.toBeNull()
  // DAY_MINUTES caps the window's own end regardless of how far past it the
  // anchor's real, unclipped end falls.
  expect(layout.window!.end).toBeLessThanOrEqual(24 * 60)
  expect(layout.anchors[0].clippedEnd).toBe(true)
  expect(layout.anchors[0].endMinutes).toBeLessThanOrEqual(24 * 60)
  const vertical = computeVerticalLayout(layout.window!, layout.anchors, {
    pxPerMinute: 1.15, sizedAnchorFloorPx: 32, unsizedAnchorFloorPx: 44, gapFloorPx: 44,
  })
  expect(Number.isFinite(vertical.totalHeightPx)).toBe(true)
  expect(vertical.totalHeightPx).toBeGreaterThan(0)
  // A day-long window at 1.15px/minute is at most a few thousand pixels -
  // nowhere near what an unclamped ten-million-minute anchor would produce
  // if the window were not bounded.
  expect(vertical.totalHeightPx).toBeLessThan(5000)
})

// --- stress test: 200 anchors in one day ------------------------------------

/**
 * A ratio, not a millisecond budget - CONVENTIONS.md section 3, and see
 * src/test/stress.ts. Four times the anchors should cost about four times as
 * much; the overlap arithmetic turning quadratic - which is the plausible
 * regression in a function that has to know which blocks share a column -
 * would land near sixteen.
 */
test('the geometry for 200 anchors costs proportionally, not quadratically, more than for 50', () => {
  const run = (n: number) => () => {
    const tasks: Task[] = Array.from({ length: n }, (_, i) =>
      anchor(`task-${i}`, `${String(i % 24).padStart(2, '0')}:${i % 2 === 0 ? '00' : '30'}`, 10 + (i % 12) * 5),
    )
    const layout = computeTimelineLayout(tasks)
    computeVerticalLayout(layout.window!, layout.anchors, {
      pxPerMinute: 1.15, sizedAnchorFloorPx: 32, unsizedAnchorFloorPx: 44, gapFloorPx: 44,
    })
  }
  expect(measureScaling(run(50), run(200)).ratio).toBeLessThan(12)

  // And it produced what it was asked for.
  const tasks: Task[] = Array.from({ length: 200 }, (_, i) =>
    anchor(`task-${i}`, `${String(i % 24).padStart(2, '0')}:${i % 2 === 0 ? '00' : '30'}`, 10 + (i % 12) * 5),
  )
  expect(computeTimelineLayout(tasks).anchors).toHaveLength(200)
})

// --- chooseWidePxPerMinute -------------------------------------------------
//
// The wide layout's own fix for docs/.../fix-fill-viewport-height-report.md:
// on a phone the grid always draws at one fixed density (PX_PER_MINUTE in
// TimelineGrid.tsx). At the wide breakpoint there is real, measurable room
// below the grid that a fixed density leaves empty on a sparse day, and no
// room at all to spare on a dense one - so the wide layout instead asks for
// whichever density actually fills the space that is there, within two
// hard limits: never thinner than the phone's own density (nothing gets
// harder to read just because the window is wide), and never thinner than
// computeVerticalLayout's own per-segment floors would already force it to
// be regardless of what this function returns - that second guarantee is
// computeVerticalLayout's job, not this one's; this function only ever
// picks the raw density that feeds into it.

const BASE = 1.15
const MAX = BASE * 3

test('never returns less than the base density, even when the available height implies a thinner one', () => {
  // 300 window-minutes at 200px available implies 0.67px/minute - thinner
  // than the phone's own 1.15, which must never happen: a wide screen is
  // never allowed to draw a day more cramped than a narrow one already does.
  expect(chooseWidePxPerMinute(BASE, 300, 200, MAX)).toBe(BASE)
})

test('returns the density the available height actually earns when it falls between the floor and the cap', () => {
  // 300 window-minutes at 600px available is exactly 2px/minute - above the
  // 1.15 floor, below the 3.45 cap, so nothing clamps it.
  expect(chooseWidePxPerMinute(BASE, 300, 600, MAX)).toBe(2)
})

test('never returns more than the cap, even when the available height implies a much denser one', () => {
  // 100 window-minutes at 5000px available implies 50px/minute - the cap
  // exists so one sparse anchor on a very tall monitor does not draw as an
  // absurdly oversized block.
  expect(chooseWidePxPerMinute(BASE, 100, 5000, MAX)).toBe(MAX)
})

test('a zero-minute window falls back to the base density rather than dividing by zero', () => {
  expect(chooseWidePxPerMinute(BASE, 0, 800, MAX)).toBe(BASE)
})

test('a negative available height (the grid measured below the fold entirely) still floors at the base density', () => {
  expect(chooseWidePxPerMinute(BASE, 300, -50, MAX)).toBe(BASE)
})

// --- displayWindow and sleepBands: the greyed sleep band on the grid -------

test('no anchors at all: displayWindow and sleepBands are empty, same as window', () => {
  const layout = computeTimelineLayout([float('Guitar', 20)])
  expect(layout.displayWindow).toBeNull()
  expect(layout.sleepBands).toEqual([])
})

test('displayWindow extends back a full SLEEP_BAND_MIN_MINUTES when the anchor buffer is close enough to bridge to the wake boundary', () => {
  // Shift 09:00 for 2h: anchor-buffered window is 08:00-12:00. The default
  // wake time (07:00) is only 60 minutes earlier than that buffered start -
  // within SLEEP_BAND_BRIDGE_CAP_MINUTES - so displayWindow pulls all the
  // way back to a full 90-minute band past 07:00, to 05:30, not just far
  // enough to close the 60-minute gap.
  const layout = computeTimelineLayout([anchor('Shift', '09:00', 120)])
  expect(layout.window).toEqual({ start: 8 * 60, end: 12 * 60 })
  expect(layout.displayWindow).toEqual({ start: 5 * 60 + 30, end: 12 * 60 })
  expect(layout.sleepBands).toEqual([{ start: 5 * 60 + 30, end: 7 * 60 }])
})

test('displayWindow is left untouched on the side where the anchors are far from the sleep boundary', () => {
  // Dinner ending at 19:30, buffered to 20:30 - a 2.5-hour gap to the
  // default 23:00 bedtime, well past SLEEP_BAND_BRIDGE_CAP_MINUTES, so that
  // edge is left exactly as the anchor buffer computed it rather than
  // padding the grid with empty space just to reach the boundary.
  const layout = computeTimelineLayout([anchor('Dinner', '18:00', 90)]) // 18:00-19:30
  expect(layout.window).toEqual({ start: 17 * 60, end: 20 * 60 + 30 })
  expect(layout.displayWindow).toEqual(layout.window)
  expect(layout.sleepBands).toEqual([])
})

test('an edge that already sits exactly on the boundary still earns a full band, not a zero-depth one', () => {
  // A schedule whose waking window (13:00-24:00) happens to land exactly on
  // the anchor-buffered window's own edges: neither edge has crossed into
  // sleep hours at all yet (zero depth), but the boundary itself needs no
  // bridging (the gap to it is exactly zero), so both edges still pull back
  // a full 90-minute band rather than being treated as "close enough
  // already" the way the first version of this feature would have.
  const layout = computeTimelineLayout(
    [anchor('Wake up task', '14:00', 30), anchor('Late task', '23:30', 20)],
    'shift',
    { profiles: [
      { id: 'default', name: 'Sleep schedule', window: { start: '23:00', end: '07:00' } },
      { id: 'shift', name: 'Shift', window: { start: '00:00', end: '13:00' } },
    ] },
  )
  // window: min(14:00)-1h=13:00 to max(23:50)+1h clamped to 24:00
  expect(layout.window).toEqual({ start: 13 * 60, end: 24 * 60 })
  expect(layout.displayWindow).toEqual({ start: 11 * 60 + 30, end: 24 * 60 })
  expect(layout.sleepBands).toEqual([{ start: 11 * 60 + 30, end: 13 * 60 }])
})

test('a day close to both the wake and bed boundary draws a full-depth sleep band on both ends', () => {
  const layout = computeTimelineLayout([
    anchor('Morning task', '08:30', 30), // buffered start 07:30, 30 min inside the bridge cap
    anchor('Evening task', '21:00', 30), // buffered end 22:30, 30 min inside the bridge cap on the other side
  ])
  expect(layout.window).toEqual({ start: 7 * 60 + 30, end: 22 * 60 + 30 })
  expect(layout.displayWindow).toEqual({ start: 5 * 60 + 30, end: 24 * 60 })
  expect(layout.sleepBands).toEqual([
    { start: 5 * 60 + 30, end: 7 * 60 },
    // The bedtime side's full 90-minute depth (23:00 to 00:30) would run
    // past midnight; clamped to the end of this calendar day instead, so
    // the drawn band here is only 60 minutes deep, not 90 - the same
    // one-day clamp `wakingWindow` itself already applies.
    { start: 23 * 60, end: 24 * 60 },
  ])
})

test('sleepBands respects a custom sleep window rather than the historical default', () => {
  const sleep = { profiles: [{ id: 'default', name: 'Sleep schedule', window: { start: '21:00', end: '09:00' } }, { id: 'shift', name: 'Shift', window: { start: '00:00', end: '13:00' } }] }
  const layout = computeTimelineLayout([anchor('Shift', '10:00', 60)], 'full', sleep)
  // Buffered window 09:00-12:00; wake time is 09:00, exactly the buffered
  // start (zero gap to bridge), so the start edge pulls back a full 90
  // minutes into sleep. The end edge (12:00) is 9 hours from the 21:00
  // bedtime, well past the bridge cap, so it is left untouched.
  expect(layout.window).toEqual({ start: 9 * 60, end: 12 * 60 })
  expect(layout.displayWindow).toEqual({ start: 7 * 60 + 30, end: 12 * 60 })
  expect(layout.sleepBands).toEqual([{ start: 7 * 60 + 30, end: 9 * 60 }])
})

test('sleepBands measures a night day against the night sleep setting, not the ordinary one', () => {
  const sleep = { profiles: [{ id: 'default', name: 'Sleep schedule', window: { start: '23:00', end: '07:00' } }, { id: 'shift', name: 'Shift', window: { start: '10:00', end: '18:00' } }] }
  const layout = computeTimelineLayout([anchor('Shift prep', '18:30', 30)], 'shift', sleep)
  // Waking window for night here is 18:00-24:00. The buffered display
  // window already reaches 30 minutes into sleep (17:30 against an 18:00
  // wake time) - short of the 90-minute floor, so the start edge pulls
  // back further, to a full 90-minute band ending at the 18:00 boundary.
  expect(layout.sleepBands).toEqual([{ start: 16 * 60 + 30, end: 18 * 60 }])
})
// --- a cluster's floor is its tallest column ------------------------------
//
// Two anchors that do not overlap each other share a column. A third that
// overlaps both pulls all three into one cluster, and the cluster's own
// floor used to be the largest floor any single member needed - one 32px
// for a column holding two 32px blocks stacked. On a full day at 1920x1080
// that drew "Wash the car" across the middle of "Reply to the landlord".
// The floor is the tallest column's stacked total now.

test('a column holding two stacked anchors gets room for both their floors', () => {
  // 14:45-15:10 and 15:15-16:15 do not overlap, so they share column 0;
  // 15:00-16:00 overlaps both and takes column 1, which is what makes all
  // three one cluster.
  const layout = computeTimelineLayout([
    anchor('Landlord', '14:45', 25),
    anchor('Quarter numbers', '15:00', 60),
    anchor('Wash the car', '15:15', 60),
  ])
  // A density low enough that ninety minutes is worth less than two floors.
  const squeezed = { ...OPTS, pxPerMinute: 0.3 }
  const vertical = computeVerticalLayout(layout.window!, layout.anchors, squeezed)

  const first = layout.anchors.find(a => a.id === 'Landlord')!
  const second = layout.anchors.find(a => a.id === 'Wash the car')!
  expect(first.column).toBe(second.column)

  // The cluster spans 14:45 to 16:15 and its tallest column holds two 32px
  // blocks, so the whole cluster is 64px rather than the 32 it used to be.
  const clusterHeight = vertical.topPx(975) - vertical.topPx(885)
  expect(clusterHeight).toBeCloseTo(64, 5)

  // Inside a cluster the map is still proportional, so the first block's
  // own share of that is thirty of ninety minutes - twenty-one pixels, not
  // thirty-two. That is why `TimelineGrid` also caps a block's drawn height
  // at the next one in its column: the room doubled, and a block that still
  // cannot have its floor is drawn short rather than over its neighbour.
  const room = vertical.topPx(second.startMinutes) - vertical.topPx(first.startMinutes)
  expect(room).toBeCloseTo((30 / 90) * 64, 5)
})

test('a lone short anchor still gets exactly its own floor and no more', () => {
  const layout = computeTimelineLayout([anchor('Standup', '09:00', 15), anchor('Deep work', '11:00', 120)])
  const squeezed = { ...OPTS, pxPerMinute: 0.3, gapFloorPx: 0 }
  const vertical = computeVerticalLayout(layout.window!, layout.anchors, squeezed)
  const top = vertical.topPx(540)
  const bottom = vertical.topPx(555)
  expect(bottom - top).toBeCloseTo(32, 5)
})
