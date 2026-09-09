import { expect, test } from 'vitest'
import { msUntilNextMidnight } from './useToday'

/**
 * The arithmetic behind the app's one clock signal - see useToday.ts. Pure,
 * and tested directly, because the hook it drives is a timeout and jsdom
 * cannot be left to run for a day.
 *
 * The rule these defend: the wait always lands *inside* the new day, and it
 * is built from the calendar rather than from 86,400,000ms, so the two days
 * a year that are not twenty four hours long still land on midnight.
 */

test('the wait from an ordinary afternoon reaches the next midnight, a second inside it', () => {
  const now = new Date(2026, 8, 16, 15, 0, 0)
  const landed = new Date(now.getTime() + msUntilNextMidnight(now))
  expect(landed.getDate()).toBe(17)
  expect(landed.getHours()).toBe(0)
  expect(landed.getMinutes()).toBe(0)
  expect(landed.getSeconds()).toBe(1)
})

test('a second before midnight waits two seconds, not another whole day', () => {
  const now = new Date(2026, 8, 16, 23, 59, 59)
  expect(msUntilNextMidnight(now)).toBe(2000)
})

test('midnight itself waits a day, because the day it is in has only just started', () => {
  const now = new Date(2026, 8, 17, 0, 0, 0)
  const landed = new Date(now.getTime() + msUntilNextMidnight(now))
  expect(landed.getDate()).toBe(18)
})

test('the last day of a month lands on the first of the next one', () => {
  const now = new Date(2026, 8, 30, 22, 30, 0)
  const landed = new Date(now.getTime() + msUntilNextMidnight(now))
  expect(landed.getMonth()).toBe(9)
  expect(landed.getDate()).toBe(1)
})

test('new year eve lands in the new year', () => {
  const now = new Date(2026, 11, 31, 20, 0, 0)
  const landed = new Date(now.getTime() + msUntilNextMidnight(now))
  expect(landed.getFullYear()).toBe(2027)
  expect(landed.getMonth()).toBe(0)
  expect(landed.getDate()).toBe(1)
})

/**
 * The clock going forward and back. Built from calendar fields, so whatever
 * the runner's own zone does with 29 March and 25 October 2026, the wait
 * still ends on the next date rather than an hour into it or an hour short.
 */
test('the wait lands on the next date across both daylight-saving switches', () => {
  for (const [month, day] of [
    [2, 28],
    [2, 29],
    [9, 24],
    [9, 25],
  ]) {
    const now = new Date(2026, month, day, 21, 0, 0)
    const landed = new Date(now.getTime() + msUntilNextMidnight(now))
    expect(landed.getDate()).toBe(new Date(2026, month, day + 1).getDate())
    expect(landed.getHours()).toBeLessThan(2)
  }
})

test('a clock that has been nudged past midnight still waits a whole second, never zero', () => {
  const now = new Date(2026, 8, 17, 0, 0, 0, 999)
  expect(msUntilNextMidnight(now)).toBeGreaterThanOrEqual(1000)
})
