import { expect, test } from 'vitest'
import type { Task } from '../../lib/types'
import { canPlaceFloatInGap, offerForGap, VISIBLE_ROW_LIMIT, visibleRows } from './gapPlacement'

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
