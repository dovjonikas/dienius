import { dateKey } from './dates'

/**
 * The clock on the wall - rotating shifts, since v2.29, and
 * docs/RESEARCH-SHIFTS.md section 4. A block's time and length are read off the
 * wall clock: the night shift that starts at 22:00 ends at 06:00 whatever the
 * clocks do in between. How much time really passes is this device's time
 * zone's to say, and on the two nights a year the clocks change it is an hour
 * more or an hour less. Whatever means an amount of time rather than a place
 * on a clock face asks here.
 */

/**
 * The instant this device's clock reads `minutes` after the midnight that
 * starts `date`. Past 1440 is the next date's clock and below zero the date
 * before's, so a block's end and a sleep that began last night are each one
 * call. A reading the clock skips - inside the hour lost in spring - comes out
 * an hour on, which is what the device's own clock does; a reading that
 * happens twice, in autumn, is the first of the two.
 */
export function wallInstant(date: string, minutes: number): number {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d, 0, minutes).getTime()
}

/**
 * Where a moment is on `date`'s wall clock: minutes past that date's midnight,
 * past 1440 on the days after it. At half past one in the morning, last night's
 * date reads 1530 - which is how a block that started there is still found
 * running, and a focus session on it still counts down.
 */
export function clockMinutesOn(date: string, at: Date = new Date()): number {
  const [y, m, d] = date.split('-').map(Number)
  const days = Math.round((Date.UTC(at.getFullYear(), at.getMonth(), at.getDate()) - Date.UTC(y, m - 1, d)) / 86_400_000)
  return days * 24 * 60 + at.getHours() * 60 + at.getMinutes()
}

/** Whether `time` ("HH:MM") happens on `date` at all: 03:30 on the night the clocks go forward does not. */
export function clockTimeExists(date: string, time: string): boolean {
  const [h, m] = time.split(':').map(Number)
  const at = new Date(wallInstant(date, h * 60 + m))
  return dateKey(at) === date && at.getHours() === h && at.getMinutes() === m
}

/**
 * How many minutes really pass from `start` minutes into `date` until the
 * clock face has moved on by `length`: 540 for 22:00 plus eight hours on the
 * night the clocks go back, 420 on the night they go forward, and `length` on
 * every other night.
 */
export function realMinutes(date: string, start: number, length: number): number {
  return Math.round((wallInstant(date, start + length) - wallInstant(date, start)) / 60_000)
}
