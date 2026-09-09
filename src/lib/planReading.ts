import { columnFor } from './stamping'
import { originFor } from './taskIdentity'
import { formatDuration, timeToMinutes } from '../widgets/day-plan/capacity'
import type { AppData, Task, TemplateBlock } from './types'

/**
 * Where the plan and the week disagreed.
 *
 * The one reading the app keeps for the week after it closed. Review draws it
 * over a finished Monday-to-Sunday week: for every block of every template a
 * past day of that week was stamped from, on how many days it happened at its
 * time, how often it moved and by how much, how often it was set aside, how
 * often it was not done. The next brief comes out of these lines - from the
 * data of a lived-in week, not from a feeling - which is why they are counts
 * and nothing else. See STATE "The v2.7 wave".
 *
 * "Happened at its time" is defined from what already exists. No timestamp of
 * a tick is stored and none is added for this: the app would be collecting a
 * fact about the person to grade them by, which is the thing it has refused
 * since its first commit. So a block happened at its time when its task is
 * done and its time still equals the block's; a task on the day at another
 * time moved, done or not; a task with the set-aside flag was set aside; and
 * anything else - unticked at its time, or gone from the day - was not done.
 * Four states, exclusive, in that order.
 *
 * The block's time is the template's time now, not the time it had that week.
 * A template edited after the week changes what this says about it, and that
 * is accepted rather than fixed by storing a copy on the day - DECISIONS says
 * so. The data is the days and the templates as they are, every time.
 *
 * What this must never become is a verdict. No percentage, no colour, no good
 * or bad, no streak, and none of the words CONVENTIONS section 15 keeps away
 * from a day's outcome. A line is something somebody can read and decide
 * about; the deciding is theirs.
 */

export interface BlockReading {
  templateId: string
  templateName: string
  blockId: string
  title: string
  /** The block's time on the template now, 'HH:MM'; absent on an untimed block. */
  time?: string
  /** Past days of the stretch whose template gave this block. */
  days: number
  atTime: number
  movedLater: number
  movedEarlier: number
  /** Mean minutes later over the days it moved later; absent when it never did. */
  avgLater?: number
  /** Mean minutes earlier, as a positive number; absent when it never moved earlier. */
  avgEarlier?: number
  setAside: number
  notDone: number
  /**
   * Days of the stretch on which somebody actually measured this block - see
   * `Task.actualMinutes`. Almost always zero, because measuring is a press
   * and nothing does it on its own.
   */
  timed: number
  /** Mean measured minutes over those days; absent when nobody measured it. */
  avgActual?: number
  /** The block's planned length, for the number beside it. */
  minutes?: number
}

/** The lines of one template, in the order the sorted list gave them. */
export interface ReadingGroup {
  templateId: string
  templateName: string
  readings: BlockReading[]
}

/** A reading while its days are still being added up. */
interface Tally extends BlockReading {
  laterMinutes: number
  earlierMinutes: number
  actualMinutes: number
}

type Outcome =
  | { state: 'atTime' | 'setAside' | 'notDone' }
  | { state: 'moved'; minutes: number }

/**
 * Which task on the day stands for each block: by identity first, then by
 * title and time, the two rules `applyStamps` matches by. Identity goes over
 * every block before any fallback runs, so a row written before origins
 * existed cannot be taken by one block while the block it was stamped for is
 * still to come. A task stands for one block at most.
 *
 * The fallback pool is the day's template rows and anything carrying this
 * template's identity, as stamping's own pool is. A repeat instance is in
 * neither and never stands for a block, whatever it is called.
 */
function tasksForBlocks(blocks: TemplateBlock[], tasks: Task[], templateId: string): Map<string, Task> {
  const matched = new Map<string, Task>()
  const taken = new Set<Task>()
  const ofTemplate = (task: Task) => {
    const origin = originFor(task)
    return origin.type === 'template' && origin.sourceId === templateId
  }
  for (const block of blocks) {
    const task = tasks.find(t => !taken.has(t) && ofTemplate(t) && originFor(t).blockId === block.id)
    if (task) {
      matched.set(block.id, task)
      taken.add(task)
    }
  }
  for (const block of blocks) {
    if (matched.has(block.id)) continue
    const task = tasks.find(
      t => !taken.has(t) && (t.fromTemplate || ofTemplate(t)) && t.title === block.title && t.time === block.time,
    )
    if (task) {
      matched.set(block.id, task)
      taken.add(task)
    }
  }
  return matched
}

/**
 * The four states, in the order the module comment gives them. Set aside is
 * read before moved because a set-aside task keeps the time it had, and that
 * time may be one a replan gave it. An untimed block cannot move: with no
 * time on the template there is nothing for the task's time to differ from,
 * so a time given by hand and a tick is still the block happening.
 */
function outcomeOf(block: TemplateBlock, task: Task | undefined): Outcome {
  if (!task) return { state: 'notDone' }
  if (task.setAside && !task.done) return { state: 'setAside' }
  if (block.time !== undefined && task.time !== undefined && task.time !== block.time) {
    return { state: 'moved', minutes: timeToMinutes(task.time) - timeToMinutes(block.time) }
  }
  if (task.done && (block.time === undefined || task.time === block.time)) return { state: 'atTime' }
  return { state: 'notDone' }
}

/** Untimed blocks sort after every timed one; between two untimed the title decides. */
function timeOrder(time: string | undefined): number {
  return time === undefined ? Number.POSITIVE_INFINITY : timeToMinutes(time)
}

/**
 * The largest disagreement first: the days a block did not happen at its
 * time, then how often it moved, then the block's own time, then its name.
 * A block that happened every day is at the bottom, where a reader who
 * came for what went differently does not have to pass it.
 */
function byDisagreement(a: BlockReading, b: BlockReading): number {
  return (
    b.days - b.atTime - (a.days - a.atTime) ||
    b.movedLater + b.movedEarlier - (a.movedLater + a.movedEarlier) ||
    timeOrder(a.time) - timeOrder(b.time) ||
    a.title.localeCompare(b.title)
  )
}

/**
 * The reading for a stretch of dates, as of `today`: one entry per block of
 * every template a past day of the stretch was stamped from, sorted with the
 * largest disagreement first. Empty when there is nothing to say - no past
 * day with a template, or a template that no longer exists, which reads as
 * no template the way every other reader of `templateId` treats it.
 *
 * Only days before `today` count. Today is still being lived and its blocks
 * have not had their chance yet; a reading that counted it would say "not
 * done" about the afternoon at nine in the morning.
 */
export function planReading(data: AppData, dates: string[], today: string): BlockReading[] {
  const tallies = new Map<string, Tally>()
  for (const date of dates) {
    if (date >= today) continue
    const day = data.days[date]
    if (!day?.templateId) continue
    const template = data.templates.find(t => t.id === day.templateId)
    if (!template) continue

    const blocks = columnFor(template, date).blocks
    const matched = tasksForBlocks(blocks, day.tasks, template.id)
    for (const block of blocks) {
      const key = `${template.id}:${block.id}`
      let tally = tallies.get(key)
      if (!tally) {
        tally = {
          templateId: template.id,
          templateName: template.name,
          blockId: block.id,
          title: block.title,
          time: block.time,
          minutes: block.minutes,
          days: 0,
          timed: 0,
          actualMinutes: 0,
          atTime: 0,
          movedLater: 0,
          movedEarlier: 0,
          setAside: 0,
          notDone: 0,
          laterMinutes: 0,
          earlierMinutes: 0,
        }
        tallies.set(key, tally)
      }
      tally.days += 1
      // What it actually took, on the days somebody said so. Counted apart
      // from the four outcomes rather than inside them: a block can be moved
      // and still be measured, and a measurement is a fact about its length
      // rather than about when it happened.
      const actual = matched.get(block.id)?.actualMinutes
      if (actual !== undefined) {
        tally.timed += 1
        tally.actualMinutes += actual
      }
      const outcome = outcomeOf(block, matched.get(block.id))
      if (outcome.state === 'moved') {
        if (outcome.minutes > 0) {
          tally.movedLater += 1
          tally.laterMinutes += outcome.minutes
        } else {
          tally.movedEarlier += 1
          tally.earlierMinutes -= outcome.minutes
        }
      } else if (outcome.state === 'atTime') tally.atTime += 1
      else if (outcome.state === 'setAside') tally.setAside += 1
      else tally.notDone += 1
    }
  }

  return [...tallies.values()]
    .map(({ laterMinutes, earlierMinutes, actualMinutes, ...reading }) => ({
      ...reading,
      avgLater: reading.movedLater > 0 ? Math.round(laterMinutes / reading.movedLater) : undefined,
      avgEarlier: reading.movedEarlier > 0 ? Math.round(earlierMinutes / reading.movedEarlier) : undefined,
      avgActual: reading.timed > 0 ? Math.round(actualMinutes / reading.timed) : undefined,
    }))
    .sort(byDisagreement)
}

/** "once", "twice", "3 times" - the way somebody says a count out loud. */
function times(count: number): string {
  if (count === 1) return 'once'
  if (count === 2) return 'twice'
  return `${count} times`
}

/** "+45 min" for one move, "avg +1h10" over several; the sign is the direction. */
function byHowMuch(count: number, sign: '+' | '-', minutes: number): string {
  const amount = `${sign}${formatDuration(minutes)}`
  return count === 1 ? amount : `avg ${amount}`
}

/**
 * One line of facts for a block, in the form the brief set:
 * "Deep work 09:00 - happened at its time 2 of 5 days, moved later 3 times
 * (avg +1h10)". Everything after the first count is there only when it is
 * not zero, in a fixed order, so two lines are compared by eye. An untimed
 * block "happened" rather than happened at its time, because it had none.
 */
export function readingLine(reading: BlockReading): string {
  const block = reading.time ? `${reading.title} ${reading.time}` : reading.title
  const days = reading.days === 1 ? 'day' : 'days'
  const facts = [
    reading.time
      ? `happened at its time ${reading.atTime} of ${reading.days} ${days}`
      : `happened ${reading.atTime} of ${reading.days} ${days}`,
  ]
  if (reading.movedLater > 0) {
    facts.push(`moved later ${times(reading.movedLater)} (${byHowMuch(reading.movedLater, '+', reading.avgLater ?? 0)})`)
  }
  if (reading.movedEarlier > 0) {
    facts.push(
      `moved earlier ${times(reading.movedEarlier)} (${byHowMuch(reading.movedEarlier, '-', reading.avgEarlier ?? 0)})`,
    )
  }
  // The one fact here that is about how long rather than about when. Last,
  // because it is the newest and the rarest: nothing measures anything on its
  // own, so this is only ever on a block somebody chose to time.
  if (reading.timed > 0 && reading.avgActual !== undefined) {
    const took = reading.timed === 1 ? 'took' : `took on average`
    const against = reading.minutes !== undefined ? ` against ${formatDuration(reading.minutes)} planned` : ''
    facts.push(`${took} ${formatDuration(reading.avgActual)}${against} (${times(reading.timed)} measured)`)
  }
  if (reading.setAside > 0) facts.push(`set aside ${times(reading.setAside)}`)
  if (reading.notDone > 0) facts.push(`not done ${times(reading.notDone)}`)
  return `${block} - ${facts.join(', ')}`
}

/**
 * The readings by template, each template in the place its first line has
 * in the sorted list - so the template with the largest disagreement is the
 * first group, not the first template somebody happened to make.
 */
export function readingGroups(readings: BlockReading[]): ReadingGroup[] {
  const groups: ReadingGroup[] = []
  for (const reading of readings) {
    let group = groups.find(g => g.templateId === reading.templateId)
    if (!group) {
      group = { templateId: reading.templateId, templateName: reading.templateName, readings: [] }
      groups.push(group)
    }
    group.readings.push(reading)
  }
  return groups
}

/**
 * The reading as markdown for the clipboard: the heading names the week,
 * every template has its own heading even when it is the only one - pasted
 * somewhere else the lines have no screen to say which plan they are about
 * - and each block is one list item, the same sentence the screen shows.
 */
export function readingMarkdown(readings: BlockReading[], title: string): string {
  const out = [`# Where the plan and the week disagreed, ${title}`]
  for (const group of readingGroups(readings)) {
    out.push('', `## ${group.templateName}`, '', ...group.readings.map(r => `- ${readingLine(r)}`))
  }
  return out.join('\n') + '\n'
}
