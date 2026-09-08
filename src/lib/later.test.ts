import { expect, test } from 'vitest'
import { dropDeletedFolds, foldInbox } from './later'
import { defaultData } from './storage'

const T0 = '2026-09-01T08:00:00.000Z'
const T1 = '2026-09-02T08:00:00.000Z'
const NOW = '2026-09-08T08:00:00.000Z'

function withInbox(lines: Array<{ id: string; text: string; updatedAt?: string }>) {
  const data = defaultData()
  data.inbox = lines.map(l => ({ id: l.id, text: l.text, captured: T0, ...(l.updatedAt ? { updatedAt: l.updatedAt } : {}) }))
  return data
}

/**
 * The fold is the one migration in this app that changes which shelf a
 * thing is on, and it runs on every open and after every merge, so it has
 * to be exact about order, ids and its own idempotence - lib/later.ts.
 */
test('inbox lines go to the top of Later in their own order, with a tombstone each', () => {
  const data = withInbox([{ id: 'a', text: 'Newest', updatedAt: T1 }, { id: 'b', text: 'Older' }])
  data.backlog = [{ id: 'c', title: 'Parked' }]
  const folded = foldInbox(data, NOW)
  expect(folded.inbox).toEqual([])
  expect(folded.backlog).toEqual([{ id: 'a', title: 'Newest', updatedAt: T1 }, { id: 'b', title: 'Older' }, { id: 'c', title: 'Parked' }])
  expect(folded.tombstones).toEqual({ 'inbox:a': NOW, 'inbox:b': NOW })
})

test('an empty inbox is the same object back, so an ordinary open costs nothing', () => {
  const data = defaultData()
  expect(foldInbox(data, NOW)).toBe(data)
})

// The merge lets a remote inbox line in under its old kind whenever its
// updatedAt beats this device's own fold tombstone, which clock skew between
// two devices produces. The Later copy that already stands is the one kept.
test('a line another device already folded is not made twice', () => {
  const data = withInbox([{ id: 'a', text: 'Same line, old name', updatedAt: T1 }])
  data.backlog = [{ id: 'a', title: 'Same line' }]
  const folded = foldInbox(data, NOW)
  expect(folded.backlog).toEqual([{ id: 'a', title: 'Same line' }])
  expect(folded.inbox).toEqual([])
  expect(folded.tombstones).toEqual({ 'inbox:a': NOW })
})

test('a line deleted on another device before this one folded it does not come back', () => {
  const data = defaultData()
  data.backlog = [{ id: 'a', title: 'Deleted over there', updatedAt: T0 }, { id: 'b', title: 'Still wanted', updatedAt: T0 }]
  const settled = dropDeletedFolds(data, { 'inbox:a': T1 }, NOW)
  expect(settled.backlog).toEqual([{ id: 'b', title: 'Still wanted', updatedAt: T0 }])
  expect(settled.tombstones).toEqual({ 'backlog:a': NOW })
})

test('a folded line the person has touched since the other device deleted it stays', () => {
  const data = defaultData()
  data.backlog = [{ id: 'a', title: 'Renamed here', updatedAt: NOW }]
  expect(dropDeletedFolds(data, { 'inbox:a': T1 }, NOW)).toBe(data)
})

test('with no remote tombstones, or none about the inbox, nothing is dropped and the object is the same', () => {
  const data = defaultData()
  data.backlog = [{ id: 'a', title: 'Here', updatedAt: T0 }]
  expect(dropDeletedFolds(data, undefined, NOW)).toBe(data)
  expect(dropDeletedFolds(data, { 'task:x': T1 }, NOW)).toBe(data)
})
