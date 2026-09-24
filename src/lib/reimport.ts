import { addDays } from './dates'
import { kindOnDate } from './dayKinds'
import { composeDay, followNeighbours } from './shiftDay'
import { endedBy, isNightBlock, refreshFromTemplate, stampedTask } from './stamping'
import { originFor } from './taskIdentity'
import { MAX_HIGHLIGHTS, type AppData, type DayPlan, type Task, type Template, type TemplateBlock } from './types'

/**
 * A templates file pasted again - the owner's shift brief of 2026-09-25,
 * stage 2, and docs/TEMPLATE-JSON.md section 6.
 *
 * The owner's journal writes the file, and the owner pastes it again
 * whenever the rota or a day changes - many times, and never by erasing the
 * dates first. So a date already stamped with a template the file changed
 * follows the change by itself, the way a day already follows its template
 * when it is opened (`refreshFromTemplate`), and a little further:
 *
 * - **A date behind today is left as it was lived.** Its template may have
 *   changed since; the day says what it was.
 * - **Today and the dates ahead follow the file** wherever they still hold
 *   what it gave them: a time, a title, a length, a recipe or a note the
 *   file changed arrives; a block the file took away goes; a block the file
 *   added arrives.
 * - **Nothing a person did is undone.** A ticked block stays as it was, the
 *   block the file took away with it; a block moved by hand keeps its time,
 *   and one written on keeps its note - the fields nobody touched still
 *   follow, as they do on an open; and a task written by hand stands for no
 *   block and is never touched.
 * - **Today is cut at now.** A block that has ended today is the day as it
 *   was lived and stays, ticked or not; one still running or still ahead
 *   follows the file; a block the file added arrives only where it has not
 *   ended yet.
 *
 * A date whose kind the file changes is the roster's, not this: it is
 * stamped anew as its new kind, and its neighbours follow it
 * (`rosterApplied`). Today even then keeps what it has lived -
 * `keepTodayAsLived`.
 *
 * A block the file renames is another block to the file, which finds a
 * block by its title: on a date nobody touched the old one goes and the new
 * one arrives, which is the rename; where the old one was ticked or moved,
 * it stays beside the new one.
 */

/** What pasting the file again did to the dates already stamped. */
export interface StampRefresh {
  data: AppData
  /** Today and the dates ahead whose tasks changed, in order. */
  ahead: string[]
  /** Dates behind today stamped with a template the file changed, left as they were. */
  behind: number
  /** Ticked tasks, today or ahead, whose block the file changed or took away - kept as they were. */
  kept: number
}

/**
 * Whether a task still holds exactly what its block gave it: nothing moved,
 * renamed, resized, recoloured, written on or started on by hand. A task
 * with no record of what it was given - stamped before one was kept - is
 * read against the block it was stamped from, where that is known.
 */
function untouched(task: Task, was: TemplateBlock | undefined): boolean {
  if (task.note !== undefined && task.note !== task.templateNote) return false
  const gave = task.fromBlock ?? (was ? { title: was.title, time: was.time, minutes: was.minutes, category: was.category } : undefined)
  if (!gave) return false
  // A title drawn from a Library list is the list's, not a hand's.
  const title = task.libraryRef ? true : task.title === gave.title
  return title && task.time === gave.time && task.minutes === gave.minutes && task.category === gave.category
}

/** The fields of a block a date can see change - anything but its id. */
const shape = (block: TemplateBlock | undefined) => (block ? JSON.stringify({ ...block, id: undefined }) : '')

/**
 * One date's tasks of one template - the date's own, or its night's on the
 * date after - following the template as the file left it. `now` is set on
 * today only. Returns the day itself where nothing changes.
 */
function follow(
  day: DayPlan,
  template: Template,
  before: Template,
  night: boolean,
  stampDate: string,
  now: number | undefined,
  data: AppData,
): { day: DayPlan; kept: number } {
  const ofSlot = (b: TemplateBlock) => isNightBlock(b) === night
  const blocks = template.blocks.filter(ofSlot)
  const was = before.blocks.filter(ofSlot)
  const mine = (t: Task) => {
    if (!t.fromTemplate) return false
    const origin = originFor(t)
    if (origin.type !== 'template' || origin.sourceId !== template.id) return false
    return night ? t.nightOf === stampDate : !t.nightOf
  }

  let kept = 0
  const tasks: Task[] = []
  for (const task of day.tasks) {
    if (!mine(task)) {
      tasks.push(task)
      continue
    }
    const blockId = originFor(task).blockId
    const block = blocks.find(b => b.id === blockId)
    const old = was.find(b => b.id === blockId)
    if (task.done) {
      if (!block || shape(block) !== shape(old)) kept++
      tasks.push(task)
      continue
    }
    // A block that did not happen, and one that has ended today, are the day as it was lived.
    if (task.missed || endedBy(task.time, task.minutes, now)) {
      tasks.push(task)
      continue
    }
    // Its block is gone: it goes with it, unless somebody made it their own.
    if (!block && untouched(task, old)) continue
    tasks.push(task)
  }

  // The blocks the file added, where the date has none of them yet. A block
  // that was there before and has no task here was taken off by hand, and
  // stays off.
  const fresh = blocks.filter(b => !was.some(o => o.id === b.id) && !tasks.some(t => mine(t) && originFor(t).blockId === b.id))
  let keys = tasks.filter(t => t.highlight).length
  for (const block of fresh) {
    if (endedBy(block.time, block.minutes, now)) continue
    const task = stampedTask(block, template.id, [], stampDate, data.library, data.recipes)
    // Three key tasks a day, however they came.
    const highlight = task.highlight && keys < MAX_HIGHLIGHTS
    if (highlight) keys++
    tasks.push({ ...task, highlight, ...(night ? { nightOf: stampDate } : {}) })
  }

  const same = tasks.length === day.tasks.length && tasks.every((t, i) => t === day.tasks[i])
  return { day: same ? day : { ...day, tasks }, kept }
}

/**
 * Today and the dates ahead stamped with a template the file changed,
 * brought to the template as the file left it - see the module's doc. Pure.
 *
 * @param changed The templates the file changed, as they were before it:
 *   the blocks the dates were stamped from.
 * @param now Minutes on today's clock; undefined when the caller has no
 *   clock to cut today at, and today then follows the file whole.
 */
export function refreshStampedDays(data: AppData, changed: ReadonlyMap<string, Template>, today: string, now?: number): StampRefresh {
  if (changed.size === 0) return { data, ahead: [], behind: 0, kept: 0 }
  let days = data.days
  let behind = 0
  let kept = 0
  const touched = new Set<string>()
  const put = (date: string, day: DayPlan) => {
    if (day === days[date]) return
    if (days === data.days) days = { ...data.days }
    days[date] = day
    touched.add(date)
  }

  for (const date of Object.keys(data.days).sort()) {
    const stamped = data.days[date].templateId
    const before = stamped ? changed.get(stamped) : undefined
    const template = before ? data.templates.find(t => t.id === stamped) : undefined
    if (!before || !template) continue
    if (date < today) behind++
    else {
      const own = follow(days[date], template, before, false, date, date === today ? now : undefined, data)
      kept += own.kept
      let next = own.day
      // The day type the template gives, as a stamp writes it.
      if (next.dayType !== template.type) {
        const { dayType: _type, ...rest } = next
        next = template.type ? { ...rest, dayType: template.type } : rest
      }
      put(date, next)
    }
    // The night's hours, on the date after - today's morning included.
    const after = addDays(date, 1)
    if (after >= today && (template.blocks.some(isNightBlock) || before.blocks.some(isNightBlock))) {
      const morning = days[after] ?? { date: after, tasks: [] }
      const night = follow(morning, template, before, true, date, after === today ? now : undefined, data)
      kept += night.kept
      if (night.day !== morning) put(after, night.day)
    }
  }

  // And the fields the tasks still carry from their blocks, the way an open
  // brings them - today cut at now.
  for (const date of Object.keys(days).sort()) {
    if (date < today) continue
    const plan = days[date]
    const bound = plan.tasks.some(t => {
      const origin = originFor(t)
      return origin.type === 'template' && !!origin.sourceId && changed.has(origin.sourceId)
    })
    if (!bound) continue
    const refreshed = refreshFromTemplate(plan, data.templates, data.library, data.recipes, date === today ? now : undefined)
    if (refreshed) put(date, refreshed)
  }

  if (days === data.days) return { data, ahead: [], behind, kept }
  // A routine is measured again against the blocks it now stands among.
  let plan: AppData = { ...data, days }
  const ahead = [...touched].sort()
  for (const date of ahead) {
    const kind = kindOnDate(plan, date)
    if (!kind) continue
    const reading = plan
    const { day } = composeDay(reading, date, kind, on => kindOnDate(reading, on), today)
    if (day !== plan.days[date]) plan = { ...plan, days: { ...plan.days, [date]: day } }
  }
  plan = followNeighbours(plan, ahead, today, new Set(ahead))
  return { data: plan, ahead, behind, kept }
}

/**
 * Today, when the file changes its kind: the blocks of the kind it had that
 * have ended are the day as it was lived and stay, ticked or not, and so
 * does every ticked one; the new kind's blocks arrive where they have not
 * ended yet. A day whose kind did not change is handed back as it is.
 */
export function keepTodayAsLived(before: DayPlan | undefined, after: DayPlan, now: number | undefined): DayPlan {
  if (!before?.templateId || before.templateId === after.templateId || now === undefined) return after
  const ofKind = (t: Task, templateId: string | undefined) => {
    const origin = originFor(t)
    return t.fromTemplate && !t.nightOf && origin.type === 'template' && origin.sourceId === templateId
  }
  const lived = before.tasks.filter(t => ofKind(t, before.templateId) && (t.done || t.missed || endedBy(t.time, t.minutes, now)))
  const arriving = after.tasks.filter(t => !(ofKind(t, after.templateId) && !t.done && endedBy(t.time, t.minutes, now)))
  const tasks = [...arriving, ...lived.filter(t => !arriving.some(a => a.id === t.id))]
  const same = tasks.length === after.tasks.length && tasks.every((t, i) => t === after.tasks[i])
  return same ? after : { ...after, tasks }
}
