import { addDays } from './dates'
import { tasksForBlocks } from './planReading'
import { columnFor, tasksOfStamp } from './stamping'
import type { AppData } from './types'

/**
 * How many times each repeating block happened, lately.
 *
 * The owner asked for this in place of anything counted in a row: beside
 * each block a template puts on the days, how many of the last seven and
 * the last thirty days it was done on. A count and nothing else - no
 * percentage, no target, no colour, no word about it - and no streak, so a
 * day it did not happen changes nothing but the count, because there is
 * nothing else to change. Computed from the days as they are, every time,
 * like everything on Review (see review.ts): nothing is recorded when a
 * task is ticked, so nothing here can drift from the days it describes.
 *
 * A block happened on a day when the task standing for it on that day is
 * done - matched the way the plan reading matches, by identity first and by
 * title and time after (`tasksForBlocks`). The day has to have been stamped
 * from the block's template, the rule the reading keeps; a block that stood
 * on no day in the thirty is not listed, since a count of a thing that was
 * never on the calendar says nothing. Today counts: a block done this
 * morning happened today.
 */
export interface BlockCount {
  templateId: string
  templateName: string
  blockId: string
  title: string
  /** The block's time on the template now, 'HH:MM'; absent on an untimed block. */
  time?: string
  /** Days of the thirty the block stood on, done or not. */
  days: number
  /** Days of the last seven it was done on. */
  last7: number
  /** Days of the last thirty it was done on. */
  last30: number
}

/** The lines of one template, in order. */
export interface CountGroup {
  templateId: string
  templateName: string
  counts: BlockCount[]
}

export const COUNT_WINDOW_SHORT = 7
export const COUNT_WINDOW_LONG = 30

export function blockCounts(data: AppData, today: string): BlockCount[] {
  const counts = new Map<string, BlockCount>()
  const shortFrom = addDays(today, -(COUNT_WINDOW_SHORT - 1))
  for (let back = COUNT_WINDOW_LONG - 1; back >= 0; back--) {
    const date = addDays(today, -back)
    const day = data.days[date]
    if (!day?.templateId) continue
    const template = data.templates.find(t => t.id === day.templateId)
    if (!template) continue

    const blocks = columnFor(template, date).blocks
    // Its night's blocks are on the date after - see tasksOfStamp.
    const matched = tasksForBlocks(blocks, tasksOfStamp(data.days, date), template.id)
    for (const block of blocks) {
      const key = `${template.id}:${block.id}`
      let count = counts.get(key)
      if (!count) {
        count = {
          templateId: template.id,
          templateName: template.name,
          blockId: block.id,
          title: block.title,
          time: block.time,
          days: 0,
          last7: 0,
          last30: 0,
        }
        counts.set(key, count)
      }
      count.days += 1
      if (matched.get(block.id)?.done) {
        count.last30 += 1
        if (date >= shortFrom) count.last7 += 1
      }
    }
  }

  // The templates' own order, then the day's: timed blocks by their time,
  // untimed ones after, and by name inside a tie - the order the block
  // stands on the day, so the list reads like the day does.
  const templateOrder = new Map(data.templates.map((t, i) => [t.id, i]))
  return [...counts.values()].sort(
    (a, b) =>
      (templateOrder.get(a.templateId) ?? 0) - (templateOrder.get(b.templateId) ?? 0) ||
      timeOrder(a.time) - timeOrder(b.time) ||
      a.title.localeCompare(b.title),
  )
}

function timeOrder(time: string | undefined): number {
  if (!time) return Number.MAX_SAFE_INTEGER
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

/** The counts grouped by template, in the order they came. */
export function countGroups(counts: BlockCount[]): CountGroup[] {
  const groups: CountGroup[] = []
  for (const count of counts) {
    const last = groups[groups.length - 1]
    if (last && last.templateId === count.templateId) last.counts.push(count)
    else groups.push({ templateId: count.templateId, templateName: count.templateName, counts: [count] })
  }
  return groups
}
