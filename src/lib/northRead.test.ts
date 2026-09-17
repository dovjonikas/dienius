import { beforeEach, expect, test } from 'vitest'
import { NORTH_WOKE_EVENT, arriveAtNorth, isWaking, leaveNorth, northWindowDue, northWokeAt } from './northRead'

/**
 * North's introduction comes forward on its own once after sleep: the first
 * time the app is in view after five hours out of view, and never twice in
 * twelve hours. Sleep is read from the gap and not from the clock, so it
 * holds after a night shift and does not fire after a nap.
 */

const HOUR = 60 * 60 * 1000
/** An arbitrary moment to count hours from; only the differences matter. */
const T0 = Date.UTC(2026, 8, 16, 0, 0)
const at = (hours: number) => T0 + hours * HOUR
const ON = { intro: true, enabled: true, demo: false }

beforeEach(() => localStorage.clear())

// --- the rule ----------------------------------------------------------------------

test('opened after five hours out of view it is due, and after two it is not', () => {
  expect(northWindowDue({ seenAt: at(0), shownAt: null }, at(5), ON)).toBe(true)
  expect(northWindowDue({ seenAt: at(0), shownAt: null }, at(9), ON)).toBe(true)
  expect(northWindowDue({ seenAt: at(0), shownAt: null }, at(2), ON)).toBe(false)
  expect(northWindowDue({ seenAt: at(0), shownAt: null }, at(4.99), ON)).toBe(false)
})

test('after a night shift slept through to three in the afternoon it is due, and after a nap it is not', () => {
  // Last seen at seven in the morning, coming off the shift; opened at 15:00.
  expect(northWindowDue({ seenAt: at(7), shownAt: at(-10) }, at(15), ON)).toBe(true)
  // Last seen at 13:00, opened again at 14:30 after lying down.
  expect(northWindowDue({ seenAt: at(13), shownAt: at(7.5) }, at(14.5), ON)).toBe(false)
})

test('it is never due twice in twelve hours, however long the app was out of view in between', () => {
  // Shown at seven, closed at eight, opened at seven in the evening: eleven
  // hours out of view, but twelve have not passed since it was shown.
  expect(northWindowDue({ seenAt: at(8), shownAt: at(7) }, at(18.99), ON)).toBe(false)
  expect(northWindowDue({ seenAt: at(8), shownAt: at(7) }, at(19), ON)).toBe(true)
})

test('with no introduction, with the switch off, or in the demo, it is never due', () => {
  const memory = { seenAt: at(0), shownAt: null }
  expect(northWindowDue(memory, at(10), { ...ON, intro: false })).toBe(false)
  expect(northWindowDue(memory, at(10), { ...ON, enabled: false })).toBe(false)
  expect(northWindowDue(memory, at(10), { ...ON, demo: true })).toBe(false)
})

test('a device the app has never been seen on has no break to measure, and nothing is due', () => {
  expect(northWindowDue({ seenAt: null, shownAt: null }, at(10), ON)).toBe(false)
})

// --- what the device remembers ---------------------------------------------------------

/**
 * Two moments, kept on the device under keys of their own and never in the
 * plan: when the app was last in view, and when the window was last shown.
 * Written to the plan they would be a commit on every open in a synced repo.
 */
test('arriving decides, and remembers the moment, so an open a minute later is no break', () => {
  expect(arriveAtNorth(at(0), ON)).toBe(false)
  expect(arriveAtNorth(at(6), ON)).toBe(true)
  expect(arriveAtNorth(at(6.02), ON)).toBe(false)
  // Out of view overnight, and back within twelve hours of the last one.
  leaveNorth(at(7))
  expect(arriveAtNorth(at(14), ON)).toBe(false)
  // And the next morning.
  leaveNorth(at(22))
  expect(arriveAtNorth(at(30), ON)).toBe(true)
})

test('the break starts when the app leaves view, not when it was opened', () => {
  arriveAtNorth(at(0), ON)
  leaveNorth(at(4))
  expect(arriveAtNorth(at(8), ON)).toBe(false)
  expect(arriveAtNorth(at(14), ON)).toBe(true)
})

test('in the demo nothing is decided and nothing about the device is written', () => {
  expect(arriveAtNorth(at(0), { ...ON, demo: true })).toBe(false)
  leaveNorth(at(1), true)
  expect(arriveAtNorth(at(10), ON)).toBe(false)
})

test('the morning key the page opening used is cleared on the first arrival', () => {
  localStorage.setItem('dienius:north-read', '2026-09-15')
  arriveAtNorth(at(0), ON)
  expect(localStorage.getItem('dienius:north-read')).toBeNull()
})

test('nothing of it reaches the plan: it lives under three keys of its own', () => {
  arriveAtNorth(at(0), ON)
  arriveAtNorth(at(6), ON)
  expect(Object.keys(localStorage).sort()).toEqual(['dienius:north-seen', 'dienius:north-window', 'dienius:north-woke'])
})

// --- the waking the day's line reads ---------------------------------------------------

test('a waking is the same break the window reads, and nothing else of its terms', () => {
  expect(isWaking({ seenAt: at(0), shownAt: null }, at(5))).toBe(true)
  expect(isWaking({ seenAt: at(0), shownAt: null }, at(4.99))).toBe(false)
  expect(isWaking({ seenAt: null, shownAt: null }, at(10))).toBe(false)
  // Shown an hour ago is no reason for a sleep not to be a waking.
  expect(isWaking({ seenAt: at(0), shownAt: at(5) }, at(6))).toBe(true)
})

test('arriving after sleep writes the waking, with the window off or no introduction too, and says so', () => {
  let said = 0
  const listen = () => said++
  window.addEventListener(NORTH_WOKE_EVENT, listen)
  try {
    arriveAtNorth(at(0), { ...ON, enabled: false, intro: false })
    expect(northWokeAt()).toBeNull()
    expect(said).toBe(0)
    arriveAtNorth(at(2), { ...ON, enabled: false, intro: false })
    expect(northWokeAt()).toBeNull()
    arriveAtNorth(at(8), { ...ON, enabled: false, intro: false })
    expect(northWokeAt()).toBe(at(8))
    expect(said).toBe(1)
    // A minute later is no new waking.
    arriveAtNorth(at(8.02), ON)
    expect(northWokeAt()).toBe(at(8))
    expect(said).toBe(1)
  } finally {
    window.removeEventListener(NORTH_WOKE_EVENT, listen)
  }
})

test('the first arrival on a device is no waking, and the demo writes none', () => {
  arriveAtNorth(at(0), ON)
  expect(northWokeAt()).toBeNull()
  localStorage.clear()
  arriveAtNorth(at(0), { ...ON, demo: true })
  arriveAtNorth(at(10), { ...ON, demo: true })
  expect(northWokeAt()).toBeNull()
})
