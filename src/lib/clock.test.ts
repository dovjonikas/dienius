import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { newestStamp, resetClockForTests, sawPlan, sawServerTime, sawStamp, stampNow } from './clock'
import { defaultData } from './storage'

/**
 * The instant a change is stamped with - docs/SYNC-AUDIT.md, path 6. Never
 * behind anything this device has seen, and on GitHub's clock where GitHub
 * has said what its clock reads.
 */

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-22T10:00:00.000Z'))
  resetClockForTests()
})

afterEach(() => {
  vi.useRealTimers()
})

test('on a clock nothing has overtaken, a stamp is the clock', () => {
  expect(stampNow()).toBe('2026-09-22T10:00:00.000Z')
})

test('two stamps in the same millisecond are still in order', () => {
  const a = stampNow()
  const b = stampNow()
  expect(b > a).toBe(true)
})

test('a stamp is never behind one this device has read, whatever its own clock says', () => {
  sawStamp('2026-09-22T10:04:00.000Z')
  expect(stampNow()).toBe('2026-09-22T10:04:00.001Z')
})

test('the newest stamp in a plan is a floor too, deletions and settings included', () => {
  const data = defaultData()
  data.tombstones = { 'task:a': '2026-09-22T10:02:00.000Z' }
  data.settingsUpdatedAt = { density: '2026-09-22T10:03:00.000Z' }
  sawPlan(data)
  expect(stampNow()).toBe('2026-09-22T10:03:00.001Z')
  expect(newestStamp(data)).toBe('2026-09-22T10:03:00.000Z')
})

test('a stamp from a clock a year out is not believed as a floor', () => {
  sawStamp('2027-09-22T10:00:00.000Z')
  expect(stampNow()).toBe('2026-09-22T10:00:00.000Z')
})

test("GitHub's clock, once it has said what it reads, is the one stamps are on", () => {
  // Sent at 10:00:00.000 by this clock, answered 200ms later, and GitHub's
  // commit says 10:05:00 - five minutes this device is behind.
  sawServerTime('2026-09-22T10:05:00Z', Date.now(), Date.now() + 200)
  expect(stampNow() >= '2026-09-22T10:05:00.000Z').toBe(true)
  expect(stampNow() < '2026-09-22T10:05:02.000Z').toBe(true)
})

test('a difference the request itself could make is not a clock that is wrong', () => {
  sawServerTime('2026-09-22T10:00:01Z', Date.now(), Date.now() + 300)
  expect(stampNow()).toBe('2026-09-22T10:00:00.000Z')
})

test('what GitHub said is remembered across a reload', async () => {
  sawServerTime('2026-09-22T10:05:00Z', Date.now(), Date.now())
  vi.resetModules()
  const fresh = await import('./clock')
  expect(fresh.stampNow() >= '2026-09-22T10:05:00.000Z').toBe(true)
})
