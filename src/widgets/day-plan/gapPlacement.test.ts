import { expect, test } from 'vitest'
import type { Task } from '../../lib/types'
import {
  canPlaceFloatInGap,
  describeGapNeighbors,
  matchTaskToGaps,
  offerForGap,
  VISIBLE_ROW_LIMIT,
  visibleRows,
  type GapWithContext,
} from './gapPlacement'

function float(id: string, minutes?: number, done = false): Task {
  return { id, title: id, done, minutes }
}

function anchor(id: string, time: string, minutes?: number): Task {
  return { id, title: id, done: false, time, minutes }
}

test('a float sized under the gap counts as fitting', () => {
  const offer = offerForGap([float('Guitar', 20)], 90)
  expect(offer.fitting.map(f => f.id)).toEqual(['Guitar'])
  expect(offer.unsized).toEqual([])
})

test('a float exactly the size of the gap still fits', () => {
  const offer = offerForGap([float('Guitar', 90)], 90)
  expect(offer.fitting.map(f => f.id)).toEqual(['Guitar'])
})

test('a float larger than the gap is excluded entirely, not offered as unsized or oversized', () => {
  const offer = offerForGap([float('Big errand', 400)], 90)
  expect(offer.fitting).toEqual([])
  expect(offer.unsized).toEqual([])
})

test('fitting floats are sorted smallest first', () => {
  const offer = offerForGap([float('Long', 60), float('Short', 10), float('Mid', 30)], 90)
  expect(offer.fitting.map(f => f.id)).toEqual(['Short', 'Mid', 'Long'])
})

test('an unsized float is never claimed as fitting, and is listed separately', () => {
  const offer = offerForGap([float('Mystery')], 90)
  expect(offer.fitting).toEqual([])
  expect(offer.unsized.map(f => f.id)).toEqual(['Mystery'])
})

test('anchors are never offered, even a small one', () => {
  const offer = offerForGap([anchor('Shift', '09:00', 10)], 90)
  expect(offer.fitting).toEqual([])
  expect(offer.unsized).toEqual([])
})

test('a done float is never offered, sized or not', () => {
  const offer = offerForGap([float('Done sized', 10, true), float('Done unsized', undefined, true)], 90)
  expect(offer.fitting).toEqual([])
  expect(offer.unsized).toEqual([])
})

test('an empty tray offers nothing', () => {
  const offer = offerForGap([], 90)
  expect(offer.fitting).toEqual([])
  expect(offer.unsized).toEqual([])
})

test('a gap shorter than every sized float still offers whatever unsized floats exist', () => {
  const offer = offerForGap([float('Too big', 200), float('Mystery')], 30)
  expect(offer.fitting).toEqual([])
  expect(offer.unsized.map(f => f.id)).toEqual(['Mystery'])
})

test('visibleRows caps the combined list at the limit, fitting floats first', () => {
  const fitting = ['a', 'b', 'c', 'd', 'e'].map(id => float(id, 10))
  const offer = offerForGap(fitting, 90)
  const rows = visibleRows(offer)
  expect(rows).toHaveLength(VISIBLE_ROW_LIMIT)
  expect(rows.map(r => r.id)).toEqual(['a', 'b', 'c', 'd'])
})

test('visibleRows returns every row when the total is at or under the limit', () => {
  const offer = offerForGap([float('a', 10), float('b', 20)], 90)
  expect(visibleRows(offer)).toHaveLength(2)
})

test('visibleRows places unsized rows after every fitting row', () => {
  const offer = offerForGap([float('Mystery'), float('Sized', 10)], 90)
  const rows = visibleRows(offer)
  expect(rows.map(r => r.id)).toEqual(['Sized', 'Mystery'])
})

// canPlaceFloatInGap is the single yes/no rule step 7's drag and long-press
// menu both call, rather than re-deriving it from offerForGap's two-list
// shape - see the doc comment on the function itself.
test('canPlaceFloatInGap allows a sized float no larger than the gap', () => {
  expect(canPlaceFloatInGap(20, 90)).toBe(true)
})

test('canPlaceFloatInGap allows a sized float exactly the size of the gap', () => {
  expect(canPlaceFloatInGap(90, 90)).toBe(true)
})

test('canPlaceFloatInGap refuses a sized float larger than the gap', () => {
  expect(canPlaceFloatInGap(91, 90)).toBe(false)
})

test('canPlaceFloatInGap allows an unsized float regardless of gap size', () => {
  expect(canPlaceFloatInGap(undefined, 5)).toBe(true)
})

// matchTaskToGaps - the inverse read of the same arithmetic: given one
// selected task, every gap in its own day the task's size fits into.

test('a float that fits several gaps gets every one of them, chronological', () => {
  const tasks = [anchor('Meeting', '09:00', 60), anchor('Gym', '18:00', 60), float('Guitar', 20)]
  const result = matchTaskToGaps(tasks, 'full', 'Guitar')
  if (result.kind !== 'matched') throw new Error('expected matched')
  expect(result.gaps.map(g => [g.start, g.end])).toEqual([
    [7 * 60, 9 * 60],
    [10 * 60, 18 * 60],
    [19 * 60, 23 * 60],
  ])
})

test('a float that fits exactly one gap gets only that one', () => {
  const tasks = [anchor('Work', '07:00', 600), anchor('Errand', '17:05', 15), float('Guitar', 20)]
  const result = matchTaskToGaps(tasks, 'full', 'Guitar')
  if (result.kind !== 'matched') throw new Error('expected matched')
  expect(result.gaps).toHaveLength(1)
  expect(result.gaps[0]).toMatchObject({ start: 17 * 60 + 20, end: 23 * 60 })
})

test('a float too big for every gap that exists still reports them honestly - just none fit', () => {
  const tasks = [
    anchor('Morning shift', '07:00', 240), // 07:00-11:00
    anchor('Afternoon shift', '11:30', 510), // 11:30-20:00, leaving a 30 min gap before it
    anchor('Evening call', '20:30', 150), // 20:30-23:00, leaving a 30 min gap before it
    float('Big errand', 90),
    float('Guitar', 20),
  ]
  const result = matchTaskToGaps(tasks, 'full', 'Big errand')
  if (result.kind !== 'matched') throw new Error('expected matched')
  expect(result.gaps).toEqual([])

  // The same day has two real 30-minute gaps - a smaller float does fit
  // them, confirming the empty result above is about this float's own
  // size, not a day that has genuinely nothing free.
  const smaller = matchTaskToGaps(tasks, 'full', 'Guitar')
  if (smaller.kind !== 'matched') throw new Error('expected matched')
  expect(smaller.gaps.map(g => g.minutes)).toEqual([30, 30])
})

test('a float with no size cannot be matched', () => {
  const tasks = [anchor('Meeting', '09:00', 60), float('Guitar')]
  expect(matchTaskToGaps(tasks, 'full', 'Guitar')).toEqual({ kind: 'no-size' })
})

test('a task already anchored has nowhere left to match', () => {
  const tasks = [anchor('Meeting', '09:00', 60)]
  expect(matchTaskToGaps(tasks, 'full', 'Meeting')).toEqual({ kind: 'already-timed' })
})

test('a day entirely filled by anchors has no gaps at all - a real, plain outcome', () => {
  const tasks = [anchor('Work', '07:00', 960), float('Guitar', 20)]
  const result = matchTaskToGaps(tasks, 'full', 'Guitar')
  expect(result).toEqual({ kind: 'matched', gaps: [] })
})

test('a gap exactly the size of the float fits - the boundary case itself', () => {
  const tasks = [anchor('Morning', '07:00', 60), anchor('Evening', '09:30', 810), float('Guitar', 90)]
  // Morning 07:00-08:00, gap 08:00-09:30 (90 minutes exactly), Evening 09:30-23:00.
  const result = matchTaskToGaps(tasks, 'full', 'Guitar')
  if (result.kind !== 'matched') throw new Error('expected matched')
  expect(result.gaps.map(g => g.minutes)).toEqual([90])
})

test('an empty day offers its whole waking window as one gap', () => {
  const tasks = [float('Guitar', 20)]
  const result = matchTaskToGaps(tasks, 'full', 'Guitar')
  expect(result).toEqual({ kind: 'matched', gaps: [{ start: 7 * 60, end: 23 * 60, minutes: 16 * 60, before: undefined, after: undefined }] })
})

test('a night day is measured against the night window, not the default one', () => {
  const tasks = [float('Guitar', 20)]
  const result = matchTaskToGaps(tasks, 'night', 'Guitar')
  expect(result).toEqual({ kind: 'matched', gaps: [{ start: 13 * 60, end: 24 * 60, minutes: 11 * 60, before: undefined, after: undefined }] })
})

test('an unsized anchor elsewhere in the day makes every match unknown, not a guess', () => {
  const tasks = [anchor('Mystery shift', '09:00'), float('Guitar', 20)]
  expect(matchTaskToGaps(tasks, 'full', 'Guitar')).toEqual({ kind: 'unknown' })
})

test('an unknown task id offers nothing rather than crashing', () => {
  const tasks = [float('Guitar', 20)]
  expect(matchTaskToGaps(tasks, 'full', 'does-not-exist')).toEqual({ kind: 'matched', gaps: [] })
})

test('gaps carry the anchor immediately before and after them', () => {
  const tasks = [anchor('Meeting', '09:00', 60), anchor('Gym', '18:00', 60), float('Guitar', 20)]
  const result = matchTaskToGaps(tasks, 'full', 'Guitar')
  if (result.kind !== 'matched') throw new Error('expected matched')
  const [first, middle, last] = result.gaps
  expect(first).toMatchObject({ before: undefined, after: 'Meeting' })
  expect(middle).toMatchObject({ before: 'Meeting', after: 'Gym' })
  expect(last).toMatchObject({ before: 'Gym', after: undefined })
})

function gapWith(before: string | undefined, after: string | undefined): GapWithContext {
  return { start: 0, end: 0, minutes: 0, before, after }
}

test('describeGapNeighbors names both sides when both exist', () => {
  expect(describeGapNeighbors(gapWith('Meeting', 'Gym'))).toBe('between Meeting and Gym')
})

test('describeGapNeighbors names only the side that exists', () => {
  expect(describeGapNeighbors(gapWith('Meeting', undefined))).toBe('after Meeting')
  expect(describeGapNeighbors(gapWith(undefined, 'Gym'))).toBe('before Gym')
})

test('describeGapNeighbors is undefined when the gap touches nothing on either side', () => {
  expect(describeGapNeighbors(gapWith(undefined, undefined))).toBeUndefined()
})
