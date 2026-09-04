import { commit, dayOf, getData, withDay } from './core'
import { advanceForTask } from './library'
import type { DayPlan, LibraryRef, Repeat, Subtask, Task } from '../types'
import { MAX_HIGHLIGHTS } from '../types'
import type { CategoryId } from '../categories'
import { materialiseRepeats, sourceFor, weekdayOf } from '../repeats'
import { addWithoutDuplicates, dayHas, isRoutine, willReceive } from '../taskIdentity'
import { applyStamps } from '../stamping'
import { addDays } from '../dates'
import { isPushable } from '../pushRules'
import { applyPlan } from '../../widgets/day-plan/replan'
import type { ReplanPlan } from '../../widgets/day-plan/replan'

export interface RolloverResult {
  /** Tasks moved to the next day, with pushCount incremented. */
  moved: number
  /** Tasks left in place because they had already reached MAX_PUSHES. */
  held: number
  /**
   * Routine tasks not moved because tomorrow is getting them anyway - from
   * the same template, or from their own repeat series. Reported rather than
   * silently skipped, because "seven of your nine did not move" is a
   * surprising thing for a button to do without saying so.
   */
  skipped: number
}

// Shared by rolloverUnfinished and pushTask below - both move a task to the
// next day the same way, one pushing everything unfinished at once, the
// other pushing exactly one. See the doc comment on rolloverUnfinished's
// own mapping for why fromTemplate and core are cleared here. unbounded is
// deliberately left untouched - see its own doc comment on Task in
// types.ts - it is a fact about the kind of task this is, not a promise
// tied to the day it was pushed from.
function pushedForward(task: DayPlan['tasks'][number]): DayPlan['tasks'][number] {
  return { ...task, fromTemplate: false, pushCount: (task.pushCount ?? 0) + 1, core: undefined }
}

/**
 * The day and everything on it: tasks, their details, the two pushes, the
 * grid's moves, replan, and what a day itself carries (away, best moment,
 * its sleep schedule). The largest area, because the day is what the app is.
 */
export const dayActions = {
  /**
   * `category` is optional so every existing caller - and a task restored
   * from a backup written before categories existed - keeps producing exactly
   * the uncategorised task it always did, drawn in the day's own template
   * colour. Quick-add is the one caller that passes it.
   */
  addTask(date: string, title: string, time?: string, category?: CategoryId): void {
    const day = dayOf(date)
    const task: Task = { id: crypto.randomUUID(), title, time, done: false, category, origin: { type: 'manual' } }
    commit(withDay(date, { ...day, tasks: [...day.tasks, task] }))
  },

  setTaskCategory(date: string, taskId: string, category: CategoryId): void {
    const day = dayOf(date)
    commit(withDay(date, {
      ...day,
      tasks: day.tasks.map(t => (t.id === taskId ? { ...t, category } : t)),
    }))
  },

  toggleTask(date: string, taskId: string): void {
    const data = getData()
    const day = dayOf(date)
    const task = day.tasks.find(t => t.id === taskId)
    const tasks = day.tasks.map(t => (t.id === taskId ? { ...t, done: !t.done } : t))
    const library = task ? advanceForTask(data.library, task, !task.done, date) : data.library
    commit({ ...withDay(date, { ...day, tasks }), library })
  },

  /**
   * Everything a day gets on its own, applied once, the first time it is
   * opened: the template its weekday maps to, and the instances every
   * repeating task owes it.
   *
   * One entry point for both, because they are the same promise - that a day
   * is already set up when you get to it - and because they have the same
   * escape hatch. `autoApplied` is written the first time and never again, so
   * a day whose auto-stamped template was deleted, or whose repeat instances
   * were all removed, stays the way it was left. Automatic is a starting
   * point, not a rule the day is held to.
   *
   * A day already stamped by hand is never re-stamped: a deliberate choice
   * outranks a standing one, always. Repeats are still generated onto it -
   * those are two different promises, and a stamped Tuesday still owes you
   * your daily medication.
   *
   * Returns true when it changed something, so a caller can tell an ordinary
   * open from one that did work.
   */
  ensureDay(date: string): boolean {
    const data = getData()
    const existing = data.days[date]
    if (existing?.autoApplied) return false

    const mapped = data.settings.weekdayTemplates[weekdayOf(date)]
    const template = mapped ? data.templates.find(t => t.id === mapped) : undefined
    // A day that already carries a templateId was stamped on purpose - by
    // hand, or from the calendar - and the weekday map does not get to argue
    // with it.
    const shouldStamp = !!template && !existing?.templateId

    let days = data.days
    if (shouldStamp) {
      days = applyStamps(days, data.templates, { [date]: template.id }, data.library)
    }

    const base = days[date] ?? { date, tasks: [] }
    const { tasks, added } = materialiseRepeats(days, date, base.tasks)
    // The one guard everything that adds to a day goes through - see
    // taskIdentity.ts. Generation is already idempotent on its own; this is
    // the belt to that pair of braces, and the thing that catches a series
    // whose instance arrived by being pushed rather than generated.
    const guarded = addWithoutDuplicates(base.tasks, tasks.slice(base.tasks.length))

    commit({
      ...data,
      days: { ...days, [date]: { ...base, tasks: guarded, autoApplied: true } },
    })
    return shouldStamp || added
  },

  /**
   * Puts a whole day back exactly as it was. The one thing undo needs that
   * no ordinary action can express: a task does not exist apart from its
   * position in a list, and deleting a repeat instance also writes a skip
   * onto the day, so restoring the task without the skip would restore it
   * and immediately re-delete it on the next open.
   */
  replaceDay(date: string, day: DayPlan): void {
    commit(withDay(date, day))
  },

  /**
   * The one line somebody wrote about how a day was - see `DayPlan.bestMoment`
   * and `eveningClose.ts`. Empty clears it, so a line typed and thought
   * better of does not have to be lived with.
   */
  setBestMoment(date: string, text: string): void {
    const trimmed = text.trim()
    const { bestMoment: _was, ...rest } = dayOf(date)
    commit(withDay(date, trimmed ? { ...rest, bestMoment: trimmed } : rest))
  },

  /**
   * Removing a task, and - for one that repeats - saying how much of it.
   *
   * 'day' is the default and the ordinary case: this one, here, gone. For an
   * instance that also means recording a skip, or generation would put it
   * straight back the next time this day is opened.
   *
   * 'series' ends the repeat itself: the source stops repeating, and every
   * instance from this day forward goes with it. Days already lived are left
   * exactly as they were - a task that happened on Monday still happened,
   * whatever was decided about Thursday.
   */
  deleteTask(date: string, taskId: string, scope: 'day' | 'series' = 'day'): void {
    const data = getData()
    const day = dayOf(date)
    const task = day.tasks.find(t => t.id === taskId)
    const series = task ? sourceFor(data.days, task) : undefined

    if (scope === 'series' && series) {
      const sourceId = series.task.id
      const days = Object.fromEntries(
        Object.entries({ ...data.days, [date]: day }).map(([key, plan]) => [
          key,
          {
            ...plan,
            tasks: plan.tasks
              .filter(t => !(key >= date && (t.id === taskId || t.repeatOf === sourceId)))
              .map(t => (t.id === sourceId ? { ...t, repeat: undefined } : t)),
          },
        ]),
      )
      commit({ ...data, days })
      return
    }

    const skips = task?.repeatOf ? [...new Set([...(day.repeatSkips ?? []), task.repeatOf])] : day.repeatSkips
    commit(withDay(date, { ...day, repeatSkips: skips, tasks: day.tasks.filter(t => t.id !== taskId) }))
  },

  setTaskTime(date: string, taskId: string, time: string | undefined): void {
    const day = dayOf(date)
    commit(withDay(date, {
      ...day,
      tasks: day.tasks.map(t => (t.id === taskId ? { ...t, time: time || undefined } : t)),
    }))
  },

  setTaskTitle(date: string, taskId: string, title: string): void {
    const trimmed = title.trim()
    if (trimmed === '') return
    const day = dayOf(date)
    commit(withDay(date, {
      ...day,
      tasks: day.tasks.map(t => (t.id === taskId ? { ...t, title: trimmed } : t)),
    }))
  },

  setTaskNote(date: string, taskId: string, note: string): void {
    const day = dayOf(date)
    commit(withDay(date, {
      ...day,
      tasks: day.tasks.map(t => (t.id === taskId ? { ...t, note: note.trim() || undefined } : t)),
    }))
  },

  /**
   * Refuses past MAX_HIGHLIGHTS rather than dropping the oldest. Silently
   * swapping one out would make the cap invisible and the choice arbitrary;
   * refusing makes the day say, in the one place it matters, that this is a
   * decision with a cost. Un-highlighting always works.
   */
  toggleTaskHighlight(date: string, taskId: string): void {
    const day = dayOf(date)
    const task = day.tasks.find(t => t.id === taskId)
    if (!task) return
    if (!task.highlight && day.tasks.filter(t => t.highlight).length >= MAX_HIGHLIGHTS) return
    commit(withDay(date, {
      ...day,
      tasks: day.tasks.map(t => (t.id === taskId ? { ...t, highlight: !t.highlight } : t)),
    }))
  },

  /**
   * Changing how a task repeats.
   *
   * 'series' writes to the source, which is what "every day it repeats"
   * means; 'day' detaches this one instance into an ordinary task, which is
   * what "just this day" means and is the only honest way to say it - a
   * per-instance override would be a second, invisible rule competing with
   * the one on the source.
   */
  setTaskRepeat(date: string, taskId: string, repeat: Repeat | undefined, scope: 'day' | 'series' = 'series'): void {
    const data = getData()
    const day = dayOf(date)
    const task = day.tasks.find(t => t.id === taskId)
    if (!task) return
    const series = sourceFor(data.days, task)

    if (scope === 'day' || !series || series.task.id === taskId) {
      const detach = scope === 'day' && !!task.repeatOf
      commit(withDay(date, {
        ...day,
        tasks: day.tasks.map(t =>
          t.id === taskId ? { ...t, repeat, repeatOf: detach ? undefined : t.repeatOf } : t,
        ),
      }))
      return
    }

    const sourceId = series.task.id
    const days = Object.fromEntries(
      Object.entries({ ...data.days, [date]: day }).map(([key, plan]) => [
        key,
        {
          ...plan,
          tasks: plan.tasks.map(t =>
            t.id === sourceId || t.repeatOf === sourceId ? { ...t, repeat } : t,
          ),
        },
      ]),
    )
    commit({ ...data, days })
  },

  addSubtask(date: string, taskId: string, title: string): void {
    const trimmed = title.trim()
    if (trimmed === '') return
    const day = dayOf(date)
    const subtask: Subtask = { id: crypto.randomUUID(), title: trimmed, done: false }
    commit(withDay(date, {
      ...day,
      tasks: day.tasks.map(t => (t.id === taskId ? { ...t, subtasks: [...(t.subtasks ?? []), subtask] } : t)),
    }))
  },

  toggleSubtask(date: string, taskId: string, subtaskId: string): void {
    const day = dayOf(date)
    commit(withDay(date, {
      ...day,
      tasks: day.tasks.map(t =>
        t.id === taskId
          ? { ...t, subtasks: (t.subtasks ?? []).map(sub => (sub.id === subtaskId ? { ...sub, done: !sub.done } : sub)) }
          : t,
      ),
    }))
  },

  deleteSubtask(date: string, taskId: string, subtaskId: string): void {
    const day = dayOf(date)
    commit(withDay(date, {
      ...day,
      tasks: day.tasks.map(t =>
        t.id === taskId ? { ...t, subtasks: (t.subtasks ?? []).filter(sub => sub.id !== subtaskId) } : t,
      ),
    }))
  },

  setTaskLibraryRef(date: string, taskId: string, ref: LibraryRef | undefined): void {
    const day = dayOf(date)
    commit(withDay(date, {
      ...day,
      tasks: day.tasks.map(t => (t.id === taskId ? { ...t, libraryRef: ref } : t)),
    }))
  },

  /**
   * Carries what is left of a day onto tomorrow - the one-off part of it.
   *
   * A routine task is not carried. If a "Commute" came from a template and
   * tomorrow is stamped from that same template, or will be by the weekday
   * map, then tomorrow already has a Commute; moving this one there produces
   * two, which is exactly the duplication that made the timeline draw two
   * columns for one commute. The same holds for a repeat instance, whose
   * series generates tomorrow's copy on its own.
   *
   * This is not a refusal to move a routine task - the detail sheet moves any
   * task to any day, always. It is a refusal to move one *in bulk, blindly*,
   * which is the only mode this button has.
   */
  rolloverUnfinished(date: string): RolloverResult {
    const data = getData()
    const day = data.days[date]
    if (!day) return { moved: 0, held: 0, skipped: 0 }
    const unfinished = day.tasks.filter(t => !t.done)
    if (unfinished.length === 0) return { moved: 0, held: 0, skipped: 0 }

    const targetDate = addDays(date, 1)
    const target = data.days[targetDate]
    const mapped = data.settings.weekdayTemplates[weekdayOf(targetDate)]

    // A routine task tomorrow is getting anyway. A repeat instance always
    // qualifies: its source generates tomorrow's copy the moment the day is
    // opened, whatever else is on it.
    const covered = unfinished.filter(
      t => isRoutine(t) && (t.repeatOf !== undefined || willReceive(target, t, mapped)),
    )
    const coveredIds = new Set(covered.map(t => t.id))
    const candidates = unfinished.filter(t => !coveredIds.has(t.id))

    const pushable = candidates.filter(isPushable)
    const held = candidates.length - pushable.length
    if (pushable.length === 0) return { moved: 0, held, skipped: covered.length }

    const targetDay = target ?? { date: targetDate, tasks: [] }
    const movedIds = new Set(pushable.map(t => t.id))
    // core describes a promise a template made about the day it was
    // stamped for, not a property of the task itself - the same reason
    // fromTemplate is cleared here too. Carrying it forward unchanged
    // would let a shift day's required task silently become a required
    // task on whatever day it happens to land on next, including a rest
    // day that is supposed to have nothing required at all. If a pushed
    // task is still genuinely necessary, the push bound already forces a
    // decision on it - unbounded is the escape hatch from that decision,
    // core is not, and the two stay separate for exactly this reason.
    const moved = pushable.map(pushedForward)
    const landed = addWithoutDuplicates(targetDay.tasks, moved)
    commit({
      ...data,
      days: {
        ...data.days,
        [date]: { ...day, tasks: day.tasks.filter(t => !movedIds.has(t.id)) },
        [targetDate]: { ...targetDay, tasks: landed },
      },
    })
    return { moved: landed.length - targetDay.tasks.length, held, skipped: covered.length }
  },

  /**
   * Pushes exactly one task to the next day - the same move
   * rolloverUnfinished makes for every unfinished task at once, offered
   * here as its own entry point so one specific task can move without
   * touching anything else on the day. The day view offers this per float,
   * so the owner picks which one moves rather than the app choosing for
   * them - see docs/TIMELINE.md section 8. Bound by the same `isPushable`
   * check rolloverUnfinished uses, so a task marked unbounded keeps moving
   * here too, and a done task is never eligible - pushing finished work to
   * tomorrow makes no sense - so this returns false rather than acting in
   * either case, the same way rolloverUnfinished silently excludes both.
   */
  pushTask(date: string, taskId: string): boolean {
    const data = getData()
    const day = data.days[date]
    const task = day?.tasks.find(t => t.id === taskId)
    if (!task || task.done || !isPushable(task)) return false

    const targetDate = addDays(date, 1)
    const target = data.days[targetDate] ?? { date: targetDate, tasks: [] }
    commit({
      ...data,
      days: {
        ...data.days,
        [date]: { ...day!, tasks: day!.tasks.filter(t => t.id !== taskId) },
        [targetDate]: { ...target, tasks: [...target.tasks, pushedForward(task)] },
      },
    })
    return true
  },

  /**
   * Sets, changes or clears a task's estimated size. Never invoked by the
   * quick-add flow itself - see docs/TIMELINE.md section 9 - this is the
   * separate, optional control a task's own row offers, so sizing a task
   * is never a question the owner has to answer before the day can start.
   * Passing undefined clears it back to unsized.
   */
  setTaskMinutes(date: string, taskId: string, minutes: number | undefined): void {
    const day = dayOf(date)
    commit(withDay(date, {
      ...day,
      tasks: day.tasks.map(t => (t.id === taskId ? { ...t, minutes } : t)),
    }))
  },

  /**
   * Sets or clears whether a task is exempt from the push bound - the
   * third choice offered once a task reaches `MAX_PUSHES`, and its own
   * undo. Writes `undefined` rather than a literal `false` when clearing,
   * the same absent-means-false convention `core` and every other
   * optional flag on `Task` already follows, so a task that has never
   * been marked ongoing does not carry a stray field around forever.
   *
   * Plain and reversible with no confirmation step, the same weight as
   * `setTaskMinutes` above - marking a task ongoing by mistake, or
   * deciding it is not standing after all, costs nothing to undo either
   * way.
   */
  setTaskUnbounded(date: string, taskId: string, unbounded: boolean): void {
    const day = dayOf(date)
    commit(withDay(date, {
      ...day,
      tasks: day.tasks.map(t => (t.id === taskId ? { ...t, unbounded: unbounded || undefined } : t)),
    }))
  },

  /**
   * Gives a float a `time`, which is what makes it an anchor - see
   * docs/TIMELINE.md section 5 and `capacity.ts`'s own definition of
   * `isAnchor`. This is the tap-a-gap path today; step 7's drag will call
   * the same action rather than invent a second way to place a float.
   * Refuses a task that already has a time - placing only ever moves a
   * float out of the tray, never re-times something already anchored, so a
   * stray double-tap on a race with another update cannot silently move an
   * anchor out from under whatever is already showing for it. Refuses
   * silently (returning false) exactly like `pushTask` does for its own
   * guard, rather than throwing on a state the UI should not have offered
   * in the first place.
   */
  placeFloat(date: string, taskId: string, time: string): boolean {
    const data = getData()
    const day = data.days[date]
    const task = day?.tasks.find(t => t.id === taskId)
    if (!task || task.time !== undefined) return false
    commit(withDay(date, { ...day!, tasks: day!.tasks.map(t => (t.id === taskId ? { ...t, time } : t)) }))
    return true
  },

  /**
   * Clears a task's `time`, returning it to the tray as a float - the undo
   * for `placeFloat` above, and the same action step 7's drag-back-to-tray
   * will call. Nothing else about the task changes: its size, if it has
   * one, survives being placed and undone, because undo is meant to be
   * exactly reversible, not a second push. Refuses a task with no time to
   * clear, the mirror image of `placeFloat`'s own guard.
   */
  unanchorTask(date: string, taskId: string): boolean {
    const data = getData()
    const day = data.days[date]
    const task = day?.tasks.find(t => t.id === taskId)
    if (!task || task.time === undefined) return false
    commit(withDay(date, {
      ...day!,
      tasks: day!.tasks.map(t => (t.id === taskId ? { ...t, time: undefined } : t)),
    }))
    return true
  },

  /**
   * Moves an anchor to a different time, or resizes it - what dragging a
   * block on the grid and pulling its bottom edge actually commit.
   *
   * Deliberately separate from `placeFloat`, which refuses a task that
   * already has a time. That guard is right for placing (placing something
   * twice is a bug), and wrong for moving (moving something is only ever
   * done to a task that already has a position). Both fields are optional
   * so one gesture can change one of them without restating the other, and
   * a no-op call - the same time, the same size - still commits, which is
   * what makes the undo below able to put a task back exactly as it was.
   *
   * Refuses a task that does not exist, or one with no time at all: an
   * untimed task has no position to move and no edge to pull.
   */
  reshapeTask(date: string, taskId: string, next: { time?: string; minutes?: number }): boolean {
    const data = getData()
    const day = data.days[date]
    const task = day?.tasks.find(t => t.id === taskId)
    if (!task || task.time === undefined) return false
    commit(withDay(date, {
      ...day!,
      tasks: day!.tasks.map(t =>
        t.id === taskId
          ? { ...t, time: next.time ?? t.time, minutes: next.minutes ?? t.minutes }
          : t,
      ),
    }))
    return true
  },

  /**
   * Moves a task to a different day, keeping its time - what dragging a block
   * from one column of the week to another commits.
   *
   * Deliberately not a push. `pushCount` is not incremented and `core` is not
   * cleared, because those exist to describe a task that keeps failing to
   * happen and getting shunted to tomorrow. Dragging Thursday's dentist
   * appointment onto Friday because that is when it actually is has nothing to
   * do with that, and counting it would eventually trip the two-push bound on
   * a task nobody has ever postponed.
   *
   * `origin` travels untouched, which is what keeps a moved template task the
   * same task as the block it came from - see taskIdentity.ts. That means a
   * day that already has the same block refuses the move rather than ending up
   * with two of it, which is the bug the origin field was added to fix.
   *
   * Refuses a move onto the same day, and a move onto a day that already has
   * this task's identity; returns false either way so the view can say nothing
   * happened rather than silently losing the drag.
   */
  moveTaskToDay(from: string, to: string, taskId: string): boolean {
    const data = getData()
    if (from === to) return false
    const day = data.days[from]
    const task = day?.tasks.find(t => t.id === taskId)
    if (!task) return false
    const target = data.days[to] ?? { date: to, tasks: [] }
    if (dayHas(target, task)) return false
    commit({
      ...data,
      days: {
        ...data.days,
        [from]: { ...day!, tasks: day!.tasks.filter(t => t.id !== taskId) },
        [to]: { ...target, tasks: [...target.tasks, task] },
      },
    })
    return true
  },

  /**
   * Replan - see widgets/day-plan/replan.ts. Away is a fact about the day,
   * kept on the day so it travels to the other device: a phone that says
   * "away" while the PC nudges about a task that started ten minutes ago is
   * two devices with two different days.
   */
  setAway(date: string, time: string | undefined): void {
    const { away: _was, ...rest } = dayOf(date)
    commit(withDay(date, time ? { ...rest, away: time } : rest))
  },

  /**
   * One commit for the whole plan, and one undo for it. The undo puts the
   * previous state back through commit, so it is stamped like any other
   * change and wins the next sync the way a restore does.
   */
  applyReplan(date: string, plan: ReplanPlan): { undo: () => void } {
    const data = getData()
    const previous = data
    commit(applyPlan(data, date, plan, () => crypto.randomUUID()))
    return { undo: () => commit(previous) }
  },

  /** Which schedule one already-planned day is measured against. */
  setDaySleepProfile(date: string, profileId: string | undefined): void {
    const day = dayOf(date)
    commit(withDay(date, { ...day, sleepProfileId: profileId }))
  },
}
