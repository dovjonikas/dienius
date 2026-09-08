import { categoryColor, categoryLabel } from '../lib/categories'
import type { Category, Task } from '../lib/types'
import { clipToWindow, formatDuration, isAnchor, mergeIntervals, timeToMinutes, type Interval } from '../widgets/day-plan/capacity'

/**
 * What a day already holds, read one hour at a time - the arithmetic behind
 * the hour column in the time picker.
 *
 * The owner's words are the whole of the reason: "once we have a block from 9
 * to 10, we should see what is free and what is not, and it should scroll
 * there by itself, so that when picking a time we actually see what is taken
 * and what is not, by colour." A column of twenty-four numerals answers "what
 * hours exist", which nobody was asking; this is what turns it into an answer
 * to "which of them is still mine".
 *
 * Pure and outside React, so the two callers that have a day behind them - the
 * day view's clock button and the template editors - can hand the same
 * component the same shape from two different places, and so the counting is
 * tested without a DOM. jsdom has no layout and the component has no arithmetic
 * left in it once this is here.
 *
 * Nothing in here refuses anything. A taken hour is still an hour you can pick:
 * overlapping is allowed and always was - a commute that runs into the start of
 * a shift is a real Tuesday - this only moves the knowing of it from after the
 * choice to before it.
 */

/** Minutes in one hour, and the hours a column offers. */
const HOUR = 60
const HOURS_IN_DAY = 24

/** Two digits, the way a clock writes them. */
export function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/**
 * One stretch of a day that is already spoken for.
 *
 * `color` and `label` are both optional because both are genuinely absent
 * sometimes: a task written before categories existed, one pointing at a
 * category deleted on another device, or a meeting out of somebody else's
 * calendar, which has a time and no category at all. An hour covered by one of
 * those is still taken, and says so in the neutral colour rather than not
 * saying so.
 */
export interface TakenBlock extends Interval {
  color?: string
  label?: string
}

/** What one hour of the column has to say for itself. */
export interface HourCover {
  /**
   * Minutes of this hour already spoken for, counted once however much its
   * blocks overlap - two blocks on the same twenty minutes take twenty minutes
   * of the hour, not forty. 0 is a free hour.
   */
  minutes: number
  /** The colour of whichever block holds most of the hour. Absent when that block has none. */
  color?: string
  /** What that block is called, and absent for the same reason. */
  label?: string
  /**
   * What a screen reader hears in place of the bare numeral, or undefined for
   * a free hour, which has nothing extra to say. Colour is never the only way
   * this control says an hour is taken.
   */
  saying?: string
}

/**
 * The day's own blocks, and anything somebody else's calendar has booked, as
 * the stretches the column paints.
 *
 * An **unsized anchor contributes nothing**. Its real length is unknown and
 * `capacity.ts` has refused to invent one since v1.0; painting an hour as
 * taken on a guessed half hour would be exactly the kind of claim that makes a
 * planner stop being believed. It is the same silence `computeCapacity` keeps
 * about free time on a day with an unsized anchor in it.
 *
 * External events are folded in beside the tasks because they take the day
 * exactly as a timed task does - the same reasoning as the `busy` argument to
 * `computeCapacity`, and the same intervals, from `busyIntervals`. They carry
 * no category, so the hour they cover reads as taken in the neutral colour.
 */
export function takenBlocks(tasks: Task[], categories: Category[], busy: Interval[] = []): TakenBlock[] {
  const blocks: TakenBlock[] = []
  for (const task of tasks) {
    if (!isAnchor(task) || task.minutes === undefined) continue
    const start = timeToMinutes(task.time!)
    const block: TakenBlock = { start, end: start + task.minutes }
    const color = categoryColor(task.category, categories)
    if (color !== undefined) block.color = color
    const label = categoryLabel(task.category, categories)
    if (label !== undefined) block.label = label
    blocks.push(block)
  }
  for (const event of busy) blocks.push({ start: event.start, end: event.end })
  return blocks
}

/**
 * Every hour of the day and how much of it is gone, in hour order - so
 * `hourCover(blocks)[9]` is what nine o'clock has to say.
 *
 * Twenty-four entries whatever the day looks like, because the column draws
 * twenty-four buttons whatever the day looks like, and a lookup that can miss
 * is a second thing for the component to decide.
 *
 * Where two blocks share an hour the one holding most of it names the colour,
 * and a tie goes to whichever starts earlier: an hour split down the middle
 * then reads as the block that opens it rather than flickering on the order
 * the tasks happen to sit in the list.
 */
export function hourCover(taken: TakenBlock[]): HourCover[] {
  return Array.from({ length: HOURS_IN_DAY }, (_, hour) => {
    const within = taken
      .map(block => ({ block, part: clipToWindow(block, { start: hour * HOUR, end: hour * HOUR + HOUR }) }))
      .filter((held): held is { block: TakenBlock; part: Interval } => held.part !== null)
    if (within.length === 0) return { minutes: 0 }

    // Merged before it is summed, which is what stops a double booking from
    // reporting ninety minutes inside an hour that has sixty.
    const minutes = mergeIntervals(within.map(held => held.part)).reduce((sum, part) => sum + (part.end - part.start), 0)

    let loudest = within[0]
    for (const held of within) {
      const mine = held.part.end - held.part.start
      const best = loudest.part.end - loudest.part.start
      if (mine > best || (mine === best && held.part.start < loudest.part.start)) loudest = held
    }

    const cover: HourCover = { minutes }
    if (loudest.block.color !== undefined) cover.color = loudest.block.color
    if (loudest.block.label !== undefined) cover.label = loudest.block.label
    cover.saying = saying(hour, minutes, loudest.block.label)
    return cover
  })
}

/**
 * The sentence under a taken hour, for somebody who is not reading the colour.
 *
 * It says the amount rather than "partly", because the amount is known and
 * "partly" is the vaguer half of it: forty minutes gone out of an hour is a
 * different answer from five, and a person choosing where to put something
 * wants the one they can act on.
 */
function saying(hour: number, minutes: number, label: string | undefined): string {
  const who = label ? ` by ${label}` : ''
  const how = minutes >= HOUR ? 'taken' : `${formatDuration(minutes)} taken`
  return `${pad(hour)}, ${how}${who}`
}

const HELD_VALUE = /^(\d{1,2}):(\d{2})$/

/**
 * The hour the column opens on, in the order the three answers outrank each
 * other: the value the field already holds, then the first free stretch after
 * the last block of the day, then the hour the day wakes.
 *
 * The owner's words again: "if we get up at 7, start from there, so there is
 * nothing to scroll past". Midnight was where it opened until now, which meant
 * seven flicks of a thumb past hours nobody plans in before the day even
 * started. Night is still reachable - every hour is still in the column and
 * still pickable - it is only not where the column starts.
 *
 * Waking is a floor on the second answer as well as the third: a stray task
 * logged for two in the morning is the last block of the day by the clock, and
 * opening the column there would be the arithmetic being right about a
 * question nobody asked.
 */
export function openingHour(value: string, taken: TakenBlock[], wakingStart: number): number {
  const held = HELD_VALUE.exec(value.trim())
  if (held && Number(held[1]) < HOURS_IN_DAY) return Number(held[1])

  const lastEnd = taken.reduce((latest, block) => Math.max(latest, block.end), -1)
  const from = lastEnd < 0 ? wakingStart : Math.max(lastEnd, wakingStart)
  return Math.max(0, Math.min(HOURS_IN_DAY - 1, Math.floor(from / HOUR)))
}
