/**
 * What kind of day a template describes. A full day is measured on every
 * task, the same way every day worked before this field existed. On a
 * shift, night or rest day the score counts only tasks marked `core` -
 * see `dayScore` in `src/widgets/day-plan/score.ts`. Shift and night are
 * kept as separate values because they read differently on a calendar and
 * in a person's own head, even though today they behave identically for
 * scoring; rest is its own value for the same reason, not because it
 * scores any differently from the other two.
 */
import type { CategoryId } from './categories'
import type { ChimeProfile } from './chime'

export type DayType = 'full' | 'shift' | 'night' | 'rest'

/**
 * When this entity last changed, as an ISO instant.
 *
 * Written by `commit()` rather than by any action - see `stampChanges` - and
 * read only by the sync merge, which takes the newer side per entity. Absent
 * on anything written before sync existed, which `normalizeLoaded` and the
 * first commit both treat as "stamp it now".
 */
export interface Timestamped {
  updatedAt?: string
}

export interface TemplateBlock {
  id: string
  time?: string
  title: string
  /**
   * Which weekday this block belongs to on a week template - 0 = Sunday
   * through 6 = Saturday.
   *
   * Absent on every block of a day template, which is every block written
   * before week templates existed. A block on a week template with no weekday
   * belongs to no column and stamps onto nothing: that is a defect rather
   * than a state, but it degrades the way a dangling id does instead of
   * throwing, so one bad block cannot cost somebody their week.
   */
  weekday?: number
  /**
   * Blocks added to several days in one press share this.
   *
   * It is what lets editing one of them ask "this day, or everywhere?" the
   * way a repeating task already does - the same question, and deliberately
   * the same words. Absent means the block stands alone, which is every block
   * on a day template and every block added to one column at a time.
   */
  groupId?: string
  /**
   * Marks this block as something that genuinely had to happen. Only
   * matters on a template whose type is not 'full' - there, only core
   * blocks count toward the day's score. Absent or false is not core.
   */
  core?: boolean
  /**
   * Estimated size in minutes. Absent means unsized - see `capacity.ts` in
   * `src/widgets/day-plan`. Sizes belong here, on the template block, so a
   * stamped day arrives already sized and nobody has to type a number into
   * a task by hand; see docs/TIMELINE.md section 4.
   */
  minutes?: number
  /**
   * Marks a block as producing a standing task, one that is not expected
   * to resolve within the push bound. Copied straight onto `Task.unbounded`
   * at stamp time in `applyStamps`, exactly the way `core` is copied - so
   * a task the owner already knows, while building the template, will
   * outlive `MAX_PUSHES` can skip the bound from its very first day rather
   * than earning the exemption the hard way by reaching it. Absent or
   * false is an ordinary block, bound like any other.
   */
  unbounded?: boolean
  /**
   * Recipes this meal block named before Kitchen had them - by name, from a
   * templates file (docs/TEMPLATE-JSON.md). The block takes each as soon as
   * Kitchen has a recipe of that name - lib/waitingRecipes.ts - and the name
   * leaves this list. Absent: nothing waits.
   */
  waitingRecipes?: string[]
  /**
   * Which of `AppData.categories` this block belongs to.
   * Copied onto `Task.category` at stamp time exactly the way `core` and
   * `unbounded` already are, so a stamped day arrives already coloured and
   * nobody has to sort a morning's tasks by hand. Absent means the task the
   * block produces has no category and falls back to the day's own template
   * colour, the way every task did before this field existed.
   */
  category?: CategoryId
  /**
   * Binds this block to a library list (`LibraryList`), not to one item in
   * it. A block is a shape of a day - "read for an hour" - and which book
   * that hour goes into is a fact about the week, not about the template.
   * At stamp time `applyStamps` resolves the list's current unfinished item
   * and writes it onto the task's `libraryRef`, so a stamped day arrives
   * naming the actual book rather than the word "Reading".
   *
   * Absent is the ordinary case. A list that has been deleted, or has
   * nothing unfinished left in it, stamps a perfectly normal task with the
   * block's own title - a template never breaks because a list ran out.
   */
  libraryListId?: string
  /**
   * The Library list this block named before the Library had it - by name,
   * from a templates file (docs/TEMPLATE-JSON.md, `library`). The block reads
   * from the list as soon as the Library has one of that name -
   * lib/waitingList.ts - and the name leaves the block. Absent: nothing
   * waits.
   */
  waitingLibrary?: string
  /**
   * On a block in the meals category: the recipe this meal is - Kitchen,
   * since v2.27. Copied onto the task it stamps, where the day shows the
   * recipe's name and a press opens it. An id that resolves to nothing - the
   * recipe was removed - is read as absent, see `mealLink` in lib/kitchen.ts.
   *
   * Since v2.30 the first of `recipeIds`, kept so a device on an older version
   * still stamps a meal from the block rather than none.
   */
  recipeId?: string
  /**
   * The recipes this meal walks - Kitchen, since v2.30: each day stamped from
   * the block gets the next one, worked out from the date (`recipeForDate` in
   * lib/kitchen.ts), the way a reading block moves through a list of books.
   * In the order they were chosen. Absent on a block with one recipe written
   * before lists, whose `recipeId` is its list of one.
   */
  recipeIds?: string[]
  /**
   * On a block in the meals category, with no recipe chosen yet: the kind of
   * meal it is, so a press on the day opens Kitchen on that meal's recipes
   * to choose from. Copied onto the task like `recipeId`.
   */
  mealType?: MealType
  /**
   * On a meal block with a `mealType`: the block walks every recipe Kitchen
   * has for that meal, in the order of their names - the ones added later
   * too - rather than a list chosen once. Kitchen, v2.32. The task a date gets
   * carries the recipe and the meal both, so a recipe removed since leaves
   * the meal to choose on the day. An older device reads the block as its
   * `mealType` alone: a meal chosen on the day.
   */
  followMeal?: boolean
  /**
   * What this block says when it arrives on a day - the recipe, the four
   * things the routine is, the weight to start the set at.
   *
   * Until this existed a template could only bring a title and a time, so
   * text written into a template never reached a day at all: `applyStamps`
   * took `note` from the matching prior task, which on a fresh day is
   * nothing. A block that means "make the same thing every Tuesday" had
   * nowhere to put what the thing is.
   *
   * A day that was written on keeps every word of it; a day that was not
   * takes what the block says. Telling those two apart needs
   * `Task.templateNote` - see its comment, and the rule in `stamping.ts`.
   */
  note?: string
  /**
   * Whether the note shows without being asked for.
   *
   * Off by default, which is every block ever written: a mark on the card,
   * and the words behind it. On, the intro is simply there - for the block
   * whose note is the reason you look at the card at all.
   *
   * Copied onto the day with the note it is about - see applyStamps.
   */
  noteExpanded?: boolean
  /**
   * Marks this block as one of the day's key tasks - see `Task.highlight`.
   *
   * The same gap `note` and `steps` had, and the same fix. `applyStamps` read
   * `highlight` off the matching prior task, which on a fresh day is nothing,
   * so a stamped day arrived with no key tasks at all and the same three
   * blocks had to be marked by hand every morning. That is precisely the
   * decision the app exists to have already made.
   *
   * Stamped as `match?.highlight ?? b.highlight`: the day's own answer wins
   * in both directions, so taking KEY off today's task is not undone by a
   * re-stamp - `toggleTaskHighlight` writes `false` rather than removing the
   * field, which is what makes that work.
   *
   * `MAX_HIGHLIGHTS` applies here too. Both editors refuse a fourth key
   * block on a day and say which three are already there; stamping caps
   * whatever reaches it, keeping the earliest by time and letting the rest
   * arrive unmarked rather than dropping them.
   */
  highlight?: boolean
  /**
   * One of the hours after the template's midnight - docs/RESEARCH-SHIFTS.md
   * section 10. Its time is on the next date's clock, and a stamp puts it on
   * the next date, as a task marked with the night it belongs to
   * (`Task.nightOf`): a night shift's meal at one in the morning is written
   * in the night shift, and lands on the morning after it and on no other.
   *
   * Absent is an ordinary block, which is every block written before it. An
   * older version carries it untouched - the guard lets a field it does not
   * name ride along - and stamps the block onto the date itself.
   */
  afterMidnight?: boolean
}

/**
 * Whether a template is one day or a whole week.
 *
 * Absent means `'day'`, and that is the whole of the migration: every
 * template ever saved is a day template, loads unchanged, and stamps
 * unchanged. The two kinds share one entity on purpose - a week template is
 * seven days' worth of blocks in one list, each block saying which weekday it
 * belongs to, rather than a second type with its own storage, its own
 * validator, its own stamping path and its own editor. The one thing that
 * genuinely differs is which blocks a given date takes, and that is one
 * filter.
 */
export type TemplateKind = 'day' | 'week'

/**
 * What one weekday of a week template overrides.
 *
 * A week is not seven copies of the same day: Saturday is a rest day and
 * Wednesday is a night shift, and both are the same template. Absent means
 * the template's own `type` and `sleepProfileId` stand, which is what makes
 * a week template that overrides nothing behave exactly like a day one.
 */
export interface WeekDayOverride {
  type?: DayType
  sleepProfileId?: string
}

export interface Template extends Timestamped {
  id: string
  name: string
  color: string
  blocks: TemplateBlock[]
  /** Absent means a day template - see `TemplateKind`. */
  kind?: TemplateKind
  /**
   * Per-weekday overrides, keyed the way `WeekdayMap` is: 0 = Sunday through
   * 6 = Saturday, the numbering `Date.getDay()` uses. Only read on a week
   * template; a day template carrying one is data that means nothing, not an
   * error, the same treatment every other field out of place gets here.
   */
  weekDays?: Partial<Record<number, WeekDayOverride>>
  /** Which sleep schedule days stamped from this template use - see `SleepProfile`. */
  sleepProfileId?: string
  /**
   * Absent means 'full' - a template saved before this field existed
   * loads and scores exactly as it always did.
   */
  type?: DayType
  /**
   * Marks a day template as a kind of day on the roster - rotating shifts,
   * since v2.29; see `DayKindMark`. Absent is an ordinary template, which is
   * every template there has ever been.
   */
  dayKind?: DayKindMark
  /**
   * Made by the tour. "Start clean" at the end of it removes exactly the
   * entities carrying this, and "Keep what I built" strips it, so it is only
   * ever present while the question is still open. See lib/tour.ts.
   */
  tourCreated?: boolean
}

/**
 * What makes a day template a kind of day - rotating shifts, since v2.29, and
 * docs/RESEARCH-SHIFTS.md section 2.1. Rest, day shift, night shift and after
 * nights are templates the owner already builds; the mark gives one the letter
 * the roster draws on a date and its place in the cycle a tap walks through.
 * The roster itself is the stamps: a date's kind is the kind template stamped
 * on it, and nothing else holds it.
 *
 * Only a day template can be one. A week template carrying the mark is data
 * out of place, read as no kind - see `isDayKind` in lib/dayKinds.ts.
 */
export interface DayKindMark {
  /** One or two characters, drawn on a date in the template's colour. */
  letter: string
  /** The kind's place in the cycle, from nought; ties fall back to the name. */
  order: number
  /**
   * The kind this kind is on a date after a night - the id of another kind
   * template - docs/RESEARCH-SHIFTS.md section 2.6. A rest day after a night
   * shift is not the rest day after a day shift, and this is how the roster
   * knows without a second letter to remember: a rest day written after a
   * night is stamped as the kind named here, every door says so, and the
   * date follows the night before it when that arrives or goes. Absent, or
   * naming itself or no kind: the kind is itself after a night too.
   */
  afterNight?: string
}

/**
 * A commitment written once - rotating shifts, since v2.29, and
 * docs/RESEARCH-SHIFTS.md section 2.3. On a date whose kind is a template in
 * `times` and whose weekday is in `weekdays`, it puts one real task on the
 * day at that kind's time; with no time for the kind, or a time that runs into
 * the kind's shift or sleep, the task has no time and the day says why. It
 * never guesses a time, and it does nothing on a date with no kind.
 *
 * A top-level list, one sync entity per routine, for the reason every list the
 * person writes is one: CONVENTIONS 7.
 */
export interface Routine extends Timestamped {
  id: string
  title: string
  category?: CategoryId
  /** Its length in minutes, 1 to `ROUTINE_LIMITS.minutes` - on every kind that has none of its own. */
  minutes: number
  /**
   * Its length on one kind of day, by kind template id, where it is not the
   * same everywhere - an hour's gym on a rest day and half of one after a
   * shift. A kind with none here is `minutes`. Absent: one length.
   */
  kindMinutes?: Record<string, number>
  /**
   * Whether its task counts on a day that is not a full one - the same mark
   * a template block carries (`TemplateBlock.core`), and read the same way
   * by the day's score. Absent or false: it counts on a full day like
   * everything else, and not on a shift, a night or a rest day.
   */
  core?: boolean
  /** The weekdays it is on, 0 = Sunday to 6 = Saturday, at least one, each once. */
  weekdays: number[]
  /** Its time on each kind, by kind template id. A kind with none here needs a time. */
  times: Record<string, string>
}

/** How large a routine may be before a file carrying it is not somebody's routine. */
export const ROUTINE_LIMITS = {
  title: 120,
  /** Twelve hours: a routine longer than half a day is a kind of day, not a routine. */
  minutes: 720,
  letter: 2,
} as const

export interface Task extends Timestamped {
  id: string
  time?: string
  title: string
  done: boolean
  /**
   * When it was ticked: the instant a hand ticked it, or the end of a block
   * the clock marked done. Absent on a task not done, and on one done before
   * this was kept (v2.43) - the archive then says it was done and not when.
   */
  doneAt?: string
  fromTemplate?: boolean
  /**
   * How many times this task has been pushed to the next day. Absent or
   * undefined means never pushed, same as 0 - tasks written before this
   * field existed load without it and are treated as fresh.
   */
  pushCount?: number
  /**
   * Copied from the template block this task was stamped from - see
   * `applyStamps` in `stamping.ts`. A task typed by hand through quick-add
   * is never core; see `docs/DECISIONS.md` for why. Meaningless on a full
   * day, where every task counts regardless.
   *
   * Cleared when a task is pushed to the next day by `rolloverUnfinished`,
   * the same as `fromTemplate` - core is a promise the day's own template
   * made, not a property that travels with the task onto a day it was
   * never planned for.
   */
  core?: boolean
  /**
   * Taken off the day by a replan, and waiting rather than gone.
   *
   * It keeps the time it had, so the offer to bring it back can say what
   * it was; it is out of the timeline, out of the capacity line and out of
   * the score while it waits. See widgets/day-plan/setAside.ts and
   * DECISIONS "Set aside, not deleted".
   */
  setAside?: boolean
  /**
   * A block that ends by itself - see lib/selfEnding.ts - that did not
   * happen: the shift called off, the drive not made. Not done, and never
   * marked done by the clock while this is set. Set from the task's actions
   * ("It did not happen"), or by unticking such a block after its end; a
   * tick clears it. Absent means nothing was said.
   */
  missed?: boolean
  /**
   * The latest clock time this block is worth starting at, when it has one.
   *
   * Optional and rarely set by hand: the rule for its kind covers almost
   * every case - see widgets/day-plan/placement.ts. Gym at eleven is not
   * gym, and a plan that would put it there offers tomorrow instead.
   */
  latest?: string
  /**
   * The note this task was made from, if it was. The note keeps its own
   * words and its own pictures - see `scratchToTaskKeepingNote` - and this
   * is the way back to them from the day.
   */
  fromNote?: string
  /**
   * Estimated size in minutes. Absent means unsized, not zero - a task
   * typed through quick-add never gets one automatically, since guessing a
   * duration is worse than admitting it is not known. Usually arrives
   * copied from the template block this task was stamped from, or set by
   * hand afterward through the task's own size control. See `capacity.ts`
   * for how anchors, floats and this field combine into the capacity line,
   * and docs/TIMELINE.md section 4 for why a default is never invented.
   */
  minutes?: number
  /**
   * How long it actually took, in minutes, when somebody measured it.
   *
   * The other half of `minutes`, which is how long it was *meant* to take.
   * Every block in this app has had a planned length since v1.0 and not one
   * has ever had a real one, so "where the plan and the week disagreed" has
   * had to be read off when things happened rather than off how long they
   * took.
   *
   * **Only ever written by a person**, from a stopwatch they started on this
   * task and chose to record - see `StopwatchState.of`. Nothing measures
   * anything on its own here: a day full of numbers nobody meant to collect
   * is a day of numbers nobody can read, and the app does not grade anybody.
   *
   * Absent on every task written before this existed, and on every task
   * nobody timed, which is almost all of them. Recording a second time on
   * the same day replaces it rather than adding to it - two measurements of
   * one thing are two measurements, and summing them would be the app
   * guessing at something nobody asked it to guess.
   */
  actualMinutes?: number
  /**
   * Marks this task as exempt from the push bound - `MAX_PUSHES` never
   * applies to it, on this day or any day it is pushed to after. Absent
   * means false, the same pattern every other optional field on `Task`
   * already uses, so a task written to disk before this field existed
   * loads and behaves exactly as it did before.
   *
   * Set two ways: by hand, from the third choice offered once a task
   * reaches the push bound (see `TaskRow.tsx`'s maxed-note and
   * `actions.setTaskUnbounded` in `store.ts`), or copied from
   * `TemplateBlock.unbounded` at stamp time for a task foreseeably
   * standing from day one.
   *
   * Unlike `core` and `fromTemplate`, this is deliberately not cleared
   * when a task is pushed forward - see `pushedForward` in `store.ts`. It
   * is a fact about the kind of task this is, not a promise a template
   * made about one specific day, so it has to survive the exact move it
   * exists to allow. It is reversible at any time through the same
   * action that sets it, with no confirmation step - nothing is lost by
   * flipping it either way.
   */
  unbounded?: boolean
  /**
   * Which of `AppData.categories` this task belongs to - what colours its
   * block on the timeline and the edge of its card in the list. Arrives
   * copied from the template block this task was stamped from, or chosen in
   * quick-add at the moment of typing it.
   *
   * Absent is a real state, not a missing value: a task written before this
   * field existed, or restored from an older backup, has no category and is
   * drawn exactly as it always was, in the day's own template colour. Nothing
   * is recoloured retroactively on load.
   *
   * Deliberately kept when a task is pushed to the next day, unlike `core`
   * and `fromTemplate` - what kind of thing a task is does not stop being
   * true because it did not happen today.
   */
  category?: CategoryId
  /**
   * Which library item this task is a session of - see `LibraryItem`.
   * Ticking the task off advances that item by one unit, and un-ticking it
   * steps back, so progress through a book is a side effect of living the
   * day rather than a second thing to remember to update.
   *
   * Stored as a pair of ids rather than a resolved title so the item stays
   * the single source of truth for its own name and progress. Every reader
   * treats a ref that resolves to nothing - the list or the item was deleted
   * - exactly like no ref at all, so a dangling pair degrades to an ordinary
   * task rather than crashing, the same contract `DayPlan.templateId`
   * already keeps.
   */
  libraryRef?: LibraryRef
  /** The recipe this meal is, when its category is meals - see `TemplateBlock.recipeId`. */
  recipeId?: string
  /** The kind of meal it is, to choose a recipe for on the day - see `TemplateBlock.mealType`. */
  mealType?: MealType
  /**
   * The routine this task is the day's instance of - rotating shifts, since
   * v2.29. Its identity is `routine:<id>` (see `identityOf`), so a day never
   * holds two of one routine. Deliberately a field of its own and not a task
   * origin: an origin of `routine` would fail an older device's validation and
   * open it empty (docs/RESEARCH-SHIFTS.md section 1.4). A routine that no
   * longer exists leaves an ordinary task.
   */
  routineId?: string
  /**
   * What the routine's rule gave this task when it was placed: its title, its
   * time (absent when it placed the task with none), its length and its
   * category. The echo that tells a task still as the rule left it from one
   * somebody moved or renamed - the same job `fromBlock` does for a template's
   * blocks. A field the echo does not hold is never followed: there is nothing
   * to tell a change from. A routine's task that arrived on its date by hand -
   * moved or pushed there - carries none, so it is left where it was put.
   */
  fromRoutine?: { title?: string; time?: string; minutes: number; category?: CategoryId; core?: boolean }
  /**
   * The night this task belongs to: the date whose template put it here, the
   * day before this one - docs/RESEARCH-SHIFTS.md section 10 and
   * `TemplateBlock.afterMidnight`. It is this date's task in every other way:
   * drawn, ticked and counted here. What the mark changes is whose it is to
   * take away. A stamp of this date keeps it, the way it keeps what was written
   * by hand, and a change of the night's own template takes it off with the
   * rest of that template's tasks.
   *
   * Absent is the date's own task. A task of the night pushed, moved or carried
   * on to another date loses the mark there: it is that date's own from then on.
   */
  nightOf?: string
  /**
   * Free text the owner attached to this task - see the task detail sheet -
   * or, on a task a template stamped, what the block had to say. Absent and
   * empty are the same thing; the card shows a small mark when there is
   * something here, and one press opens it.
   */
  note?: string
  /**
   * The note this task arrived with, where a template block gave it one.
   *
   * It exists to answer one question a re-stamp has to ask and could not:
   * is the note on this day the owner's words or the block's? After the
   * first stamp `note` holds the block's text either way, so keeping the
   * day's note unconditionally would freeze every day against a later
   * template edit, and overwriting it unconditionally would throw away what
   * somebody wrote. Comparing the two says which happened.
   *
   * Absent on every task written by hand, on every task stamped before this
   * existed, and on any block with no note - in all of which the comparison
   * comes out as 'the day's own', which is the safe answer.
   */
  templateNote?: string
  /**
   * What the block last gave this task, for the other fields the block owns.
   *
   * `templateNote` above answers one question for one field, and the same
   * question is owed by every field a block hands over. The owner hit it
   * twice in one morning: a list bound to a block, then a note written on a
   * block, neither reaching days that were already on the calendar. The next
   * one along is a block renamed or moved, which lands the same way.
   *
   * Why a stored echo rather than a comparison with the block: after a stamp
   * the day's title *is* the block's title, so the two are equal whether the
   * day was touched or not, and equality alone cannot say which. What the
   * block gave last time can. A task still carrying it has not been edited,
   * so the block is free to change its mind; a task carrying anything else
   * was changed by somebody, and a template edit is not permission to undo
   * that.
   *
   * Only the fields somebody actually edits on a day - what it is called,
   * when it is, how long it takes, which category it belongs to. `core` and
   * `unbounded` are template shape rather than day state and are not edited
   * on a day at all.
   *
   * Absent on every task written by hand and on every task stamped before
   * this existed, where the answer is "cannot tell" and nothing is touched -
   * the same safe degradation `templateNote` has.
   */
  fromBlock?: {
    title?: string
    time?: string
    minutes?: number
    category?: string
    /** The meal's recipe the block gave - Kitchen, since v2.27. */
    recipeId?: string
    /** The kind of meal the block gave, with no recipe. */
    mealType?: MealType
  }
  /**
   * Whether the note shows without being asked for.
   *
   * Off by default, which is every note ever written: a mark on the card,
   * and the words behind it. On, the intro is simply there - for the block
   * whose note is the reason you look at the card at all.
   *
   * It governs the intro only. A note's sections are choices, and their
   * headings are on the card whatever this says - see views/NoteSections.tsx.
   */
  noteExpanded?: boolean
  /**
   * One address this task is a door to - see `lib/link.ts`.
   *
   * A task bound to a library item shows that item's link when it has none
   * of its own, so a reading block does not have to repeat the address the
   * book already carries; its own always wins. Optional, and nothing in the
   * app ever asks whether it answers.
   */
  link?: string
  /**
   * Marks this task as one of the day's few that genuinely matter. Capped at
   * `MAX_HIGHLIGHTS` per day by `actions.toggleTaskHighlight` - a day where
   * everything is important is a day with no highlights at all, which is the
   * failure mode this exists to prevent.
   */
  highlight?: boolean
  /**
   * How this task repeats itself onto later days - see `Repeat`. Absent
   * means it happens once, which is what every task written before this
   * field existed does.
   *
   * A task with this set is the *source* of a series. Every day it applies to
   * gets its own real task, generated by `materialiseRepeats` the first time
   * that day is opened, carrying `repeatOf` back to this one.
   */
  repeat?: Repeat
  /**
   * Where this task came from - see `TaskOrigin`. The one thing a task never
   * had and needed: without it a pushed copy of "Commute" and the template's
   * own "Commute" are two unrelated rows, which is exactly how a day ends up
   * holding both.
   *
   * Absent means a task written before origins existed. Every reader treats
   * that as `manual`, which is what it almost always was.
   */
  origin?: TaskOrigin
  /**
   * Made by the tour. "Start clean" at the end of it removes exactly the
   * entities carrying this, and "Keep what I built" strips it, so it is only
   * ever present while the question is still open. See lib/tour.ts.
   */
  tourCreated?: boolean
  /**
   * The id of the task this one was generated from - see `Task.repeat`.
   *
   * Instances are ordinary tasks in every other way: they are ticked off,
   * moved, resized, given notes and deleted exactly like anything else, and
   * nothing reads back through this except the two decisions that genuinely
   * need to know a series exists - editing or deleting "every day it repeats"
   * rather than just this one.
   *
   * A source id that no longer resolves is treated as no id at all, the same
   * contract `templateId` and `libraryRef` already keep: the task stays, it
   * simply stops being part of anything.
   */
  repeatOf?: string
}

/**
 * Where a task came from, and what it is the same thing as.
 *
 * The pair `(sourceId, blockId)` is a task's identity across days. A template
 * block stamped onto Tuesday and the same block's task pushed from Monday are
 * the same intention, and this is what lets the app know it - so a day can
 * refuse to hold two of them, a push can decline to move something tomorrow
 * is getting anyway, and a re-stamp can merge instead of duplicating.
 *
 * `manual` carries neither id, because a task somebody typed is not the same
 * thing as anything: two tasks both called "Call the bank" on one day are two
 * calls, and the app has no business deciding otherwise.
 */
export interface TaskOrigin {
  type: 'template' | 'repeat' | 'manual'
  /** The template's or the repeat source's id. Absent for manual. */
  sourceId?: string
  /** The block within that template. Absent for a repeat and for manual. */
  blockId?: string
}

/**
 * How a task comes back. Three shapes, deliberately, and no calendar-grade
 * recurrence rule: "every second Tuesday" is a thing a calendar does, and a
 * planner that tries to be one ends up with a dialog nobody finishes. Daily,
 * weekdays and weekly cover what an actual routine looks like.
 */
export type Repeat = 'daily' | 'weekdays' | 'weekly'

/** A pointer into the library: which list, and which item in it. */
export interface LibraryRef {
  listId: string
  itemId: string
}

/**
 * One thing being worked through over time - a book, a series, a course.
 *
 * `total` is optional on purpose. Plenty of things worth tracking have no
 * known length (a podcast someone is caught up on, a game with no chapters),
 * and inventing one would be worse than admitting it is not known - the same
 * reasoning `Task.minutes` already follows. With a total, progress reads
 * "ch 4/12" and draws a bar; without one it reads "ch 4" and draws nothing.
 */
/**
 * How progress through one item is counted, when the list's own unit is not
 * the right answer for it.
 *
 * The list still owns the unit - that is what makes this one feature rather
 * than three - but a list is a shelf, and shelves hold things of different
 * shapes. A Books list holds one book whose sections are short and unnumbered
 * beside another with twenty named chapters; a Watching list holds films,
 * which have no parts at all, beside a series that has three seasons of them.
 * Forcing all of those through one counter is what makes an app feel like a
 * database with a nice font.
 *
 * Absent is the ordinary case and means the list's own unit, which is what
 * every item written before this existed is.
 *
 * - `pages` - counted in pages, because the sections are short or unnamed and
 *   "what page am I on" is the question actually being asked. Never stepped
 *   one at a time: nobody presses + fifty-four times.
 * - `movie` - one sitting, no parts, no numbers. Watched or not.
 * - `series` - seasons and episodes. `season` and `total` are about the season
 *   currently being watched, not about the whole thing.
 */
export type LibraryTrack = 'pages' | 'movie' | 'series'

export interface LibraryItem extends Timestamped {
  id: string
  title: string
  /**
   * Who wrote it, where somebody said so - a shelf pasted at once writes it
   * from the line's "A title - An author", and the item's own field changes
   * it. Absent: nothing was said, and the row is the title alone.
   */
  author?: string
  /** Units in the whole thing. Absent means open-ended, not zero. */
  total?: number
  /** Units finished. Absent means none. Never exceeds `total` when there is one. */
  progress?: number
  /** The date key it was finished on. Absent means it is still going. */
  finished?: string
  /** How this one is counted. Absent is the list's own unit - see `LibraryTrack`. */
  track?: LibraryTrack
  /**
   * How you mean to work through it, in your own words: "one section a day",
   * "evening only, optional", "skim Book Three".
   *
   * A note, never a rule. Nothing measures it, nothing reminds you of it, and
   * falling behind it is not a state this app can be in - it is here because
   * "one chapter a day" is the thing you actually decided and the thing you
   * have forgotten by Thursday. It rides along to whatever the item is bound
   * to, so the block on the day says it too.
   */
  pace?: string
  /**
   * Series only: which season `progress` and `total` are about. Absent means
   * the thing has no seasons worth naming - a ten-episode run is just ep 5/10.
   */
  season?: number
  /** Series only: how many seasons there are. Absent is unknown, not one. */
  seasons?: number
  /**
   * Where the thing itself is - see `lib/link.ts`. The course's own page,
   * the machine at home that serves it, the edition online.
   *
   * It rides along to whatever the item is bound to, the way `pace` does, so
   * the block on the day is one press from the thing. It goes when the item
   * goes: a finished book's link is not something to keep a list of.
   */
  link?: string
}

/**
 * A list of things of one kind, and the word for one unit of progress
 * through them.
 *
 * The unit is the whole reason this is one feature rather than three. A book
 * has chapters, a series has episodes, a course has lessons; an app that
 * calls all of those "items completed" is an app that reads like a database.
 * The owner names the unit once, per list, and every number in the interface
 * is spoken in it.
 */
export interface LibraryList extends Timestamped {
  id: string
  name: string
  /** Singular unit name, lowercase: "chapter", "episode", "lesson". */
  unit: string
  /** Plural, when it is not just unit + "s". Absent means it is. */
  unitPlural?: string
  /** Two or three letters for a card: "ch", "ep". Absent falls back to the unit. */
  unitShort?: string
  /**
   * A dot beside the name, from the same muted palette the categories use.
   * Absent means no dot. Its only job is letting a row of eight list chips be
   * read at a glance rather than word by word - nothing anywhere sorts,
   * groups or filters by it.
   */
  color?: string
  items: LibraryItem[]
  /**
   * Made by the tour. "Start clean" at the end of it removes exactly the
   * entities carrying this, and "Keep what I built" strips it, so it is only
   * ever present while the question is still open. See lib/tour.ts.
   */
  tourCreated?: boolean
}

/** How many tasks on one day may be marked as highlights. See `Task.highlight`. */
export const MAX_HIGHLIGHTS = 3

export interface DayPlan extends Timestamped {
  date: string
  /**
   * Which template this day was stamped from, if any. Deliberately left in
   * place if that template is later deleted - a stamped day genuinely
   * happened, and deleting the template that described it does not undo
   * it. Every reader of this field (DayView, CalendarView) treats a
   * templateId with no matching template the same as no templateId at all,
   * so a dangling reference degrades gracefully rather than crashing.
   * See `docs/DECISIONS.md` for the reasoning.
   */
  templateId?: string
  /**
   * Which sleep schedule this day is measured against, when it is not the
   * default - see `SleepProfile`. A day inherits its template's choice at
   * stamp time and can override it afterwards, because the day you actually
   * had is the one that knows whether you slept normally.
   */
  sleepProfileId?: string
  /**
   * Copied from the template's type at the moment of stamping, not looked
   * up live - so editing or deleting the template afterward does not
   * silently change how an already-stamped day is scored. Absent means
   * 'full', same as an unstamped or hand-built day always scored.
   */
  dayType?: DayType
  /**
   * The clock time the person went away, while they are - see replan.ts.
   * Present means the day is paused: no task nudges fire, and the header
   * offers "Back" instead of "Replan". Absent is the ordinary state, and
   * every plan written before this field existed is in it.
   */
  away?: string
    /**
   * Series this day has been told not to generate - the ids of repeat
   * sources whose instance here was deleted "just this day".
   *
   * A tombstone rather than a silence, because generation is idempotent and
   * re-runs every time the day is opened: without a record, a deleted
   * Tuesday instance would come straight back on Wednesday's visit. Absent
   * means nothing was skipped, which is nearly every day.
   */
  repeatSkips?: string[]
  /**
   * Routines this day has been told not to carry - the ids of routines whose
   * task here was deleted by hand. The same tombstone `repeatSkips` is, for
   * the same reason: placing routines is idempotent and runs again whenever
   * the roster is applied, and without a record a deleted gym session would
   * come straight back. Absent means nothing was skipped.
   */
  routineSkips?: string[]
  /**
   * True once this day has been through `ensureDay` - the one pass that
   * applies the weekday template map and generates repeats.
   *
   * It has to be recorded rather than inferred, because both of those things
   * are things a person can then undo: a day whose auto-stamped template was
   * deleted, or whose every repeat instance was removed, is empty again, and
   * without this flag opening it a second time would put it all back. Auto
   * is a starting point, not a rule the day is held to.
   */
  autoApplied?: boolean
  /**
   * The date key a replan was accepted on for this day - see
   * widgets/day-plan/replan.ts. Present means somebody moved this day's
   * plan around on purpose, which the week view says in one quiet word so
   * a Thursday that looks unlike its template is not read as a mistake. It
   * is a fact about the day and travels with it, never a count of what
   * moved, and nothing measures it. Absent is the ordinary state, and every
   * plan written before this field existed is in it.
   */
  replannedOn?: string
  /**
   * Whatever was written on this day, as one piece of free text.
   *
   * It was three named lines until v2.5 - a morning intent and two answers
   * on the evening close card - and the owner's verdict on all of it was
   * that it was too much. A form that appears every evening with three
   * empty boxes is a form somebody starts skipping, and then starts
   * avoiding the card that carries it. See lib/journal.ts and DECISIONS
   * "A journal, not a form"; `mergeOldJournal` folds an old one into this
   * on load, so nothing anybody wrote is lost.
   *
   * On the day so it travels with it: sync, the backup and the snapshots
   * carry it the way they carry the tasks. Absent means nothing was
   * written, which is most days and is not a state this app remarks on.
   */
  journal?: string
  /**
   * The day was declared a low day - see widgets/day-plan/lowDay.ts. Its key
   * tasks were cut to 40% of their length and the rest sent to tomorrow,
   * and the score counts the key tasks alone. A fact about the day that
   * travels with it, like `away`; absent is the ordinary state, and every
   * plan written before this field existed is in it.
   */
  lowDay?: boolean
  tasks: Task[]
}

/**
 * A sparse patch of theme tokens, keyed by CSS custom property name without
 * its leading `--` (so `{ accent: '#e0553b' }` overrides just the accent).
 * Values are always the literal string that will end up as a CSS custom
 * property, never a resolved color chosen for a person - resolution reads
 * this on top of a preset, not the other way around.
 */
export interface ThemeOverrides {
  [token: string]: string
}

/**
 * What Settings actually stores about theme. `presetId` and `mode` pick a
 * room and whether its light is on; `overrides` is never applied directly -
 * only `overrides[presetId]` is, so a person's hand-picked accent on
 * Sketchbook survives switching to Slate and back, per preset, rather than
 * bleeding across rooms or getting lost the moment they try something else.
 * See `resolveTheme` in `theme.ts` for how these three combine with a
 * preset's own token set into the values that actually paint the page.
 */
export interface ThemeState {
  presetId: string
  overrides: Record<string, ThemeOverrides>
  mode: 'light' | 'dark' | 'system'
}

/**
 * A stretch of clock time spent asleep, stored the way a person actually
 * thinks of it: when it starts (bedtime) and when it ends (wake time), each
 * a canonical "HH:MM" - the same shape `TemplateBlock.time` already uses.
 * `start` is almost always later in the day than `end` (23:00 to 07:00 is
 * the ordinary case, sleep crossing midnight), but nothing here requires
 * that - see `wakingWindow` in `src/widgets/day-plan/capacity.ts`, which is
 * the one place this pair is turned into the day's actual waking hours and
 * has to handle every combination, including an odd same-day one, without
 * assuming the wrap.
 */
export interface SleepWindow {
  start: string
  end: string
}

/**
 * One named sleep schedule. There is always at least one; the first in the
 * list is the default and the only one most people will ever have.
 *
 * This replaces the pair of fixed windows the app used to carry - an ordinary
 * one and a hardcoded "night shift" one. That pairing was wrong in both
 * directions: it assumed everybody who works nights works the same nights,
 * and it gave everybody who does not a setting they could never use. A list
 * of named schedules says the true thing instead, which is that some people
 * have one and some have several, and nobody but the owner knows which.
 *
 * Until there are two, nothing anywhere in the app mentions profiles at all -
 * the day header and the template editor only offer a choice once there is
 * genuinely a choice to make.
 */
export interface SleepProfile {
  id: string
  name: string
  window: SleepWindow
}

export interface Settings {
  theme: ThemeState
  /**
   * When the owner is normally asleep, on a full, shift or rest day - see
   * `docs/DECISIONS.md`. Set once in Settings, never asked per day: the
   * waking hours the capacity line, the timeline grid's greyed band and
   * every gap in this app are measured against come from this, through
   * `windowFor` in `capacity.ts`. Defaults to 23:00-07:00, the exact
   * inverse of the fixed 07:00-23:00 window this setting replaces, so an
   * existing person who never opens Settings sees no change at all.
   */
  /**
   * Every sleep schedule, in order. Never empty: `normalizeLoaded` guarantees
   * a first entry, so every reader can treat `sleepProfiles[0]` as the
   * default without checking.
   */
  sleepProfiles: SleepProfile[]

  /**
   * Whether the day view's timeline grid is currently shown, rather than
   * collapsed behind its own disclosure under the capacity line - see
   * docs/TIMELINE.md section 5. A single app-wide choice, not a per-day
   * one: whether to look at the picture of the day is not a decision the
   * owner should have to re-make every morning before the day can start,
   * so opening it once keeps it open on every day after, until closed
   * again. Defaults to false - collapsed - so the grid never claims the
   * screen's first fold on its own; the capacity line above it already
   * carries the same shape of the day in one sentence.
   */
  timelineExpanded: boolean
  /**
   * Which pane the wide day view (docs/LAYOUT-WIDE.md section 5) gives the
   * width to - 'both' shows the day pane and task pane side by side,
   * 'calendar' gives the day pane (capacity line, if-then rule, grid) the
   * full remaining width and unmounts the task pane, 'tasks' does the
   * reverse. A single app-wide choice, not a per-day one, following the
   * exact pattern timelineExpanded already established: this is a
   * width-redistribution preference, not a daily question, so it persists
   * until changed rather than resetting. Defaults to 'both' - the state
   * that shows the most by default - and only has a visible effect once
   * useIsWide() says there is more than one pane to redistribute between;
   * below that breakpoint the control that changes it is not rendered at
   * all, and this field sits in storage with no effect on what's on
   * screen.
   */
  dayLayoutFocus: 'both' | 'calendar' | 'tasks'
  /**
   * How much air the interface spends - see the spacing scale in styles.css.
   * Comfortable is the scale as designed; Compact multiplies it down, which
   * is what a fourteen-inch laptop and a nine-task day actually want. Not a
   * theme token: a preset owns colour and type family, and how far apart two
   * things sit is a decision about this device, not about which room you are
   * in, so it must survive switching themes.
   */
  density: 'comfortable' | 'compact'
  /**
   * A multiplier on the whole type scale, not a font-size for one element.
   * Every size in the app comes from four tokens, so scaling those four is
   * the entire feature - nothing has to be re-laid-out, and the hierarchy
   * between them is preserved exactly at every setting.
   */
  textScale: 's' | 'm' | 'l'
  /**
   * Which template a new day starts from, by weekday - see `WeekdayMap`.
   *
   * The whole point of a template is not retyping a day; stamping one by hand
   * every morning is most of that typing back. A person whose Tuesdays are
   * all the same shape says so once here and stops thinking about it.
   *
   * Empty by default, and a weekday with no entry behaves exactly as this app
   * always has - an empty day waiting to be stamped. A stamp by hand always
   * wins: see `ensureDay`.
   */
  weekdayTemplates: WeekdayMap
  /** When a goal is allowed to come forward on its own - see `NorthSettings`. */
  north: NorthSettings
  /**
   * How the day is allowed to end - see `EveningCloseSettings`. Absent in
   * every payload written before it existed, backfilled to the defaults by
   * `normalizeLoaded` like every other field added since v1.0.
   */
  eveningClose?: EveningCloseSettings
  /**
   * The date key the goal card was last dismissed on, or absent. The card went
   * with goals in v2.28 and nothing reads this; it is kept, and still synced,
   * for the older devices and the files that carry it.
   */
  northDismissedOn?: string
  /**
   * What the timer sounds like, how loud, and whether it rings at the start
   * too - see `lib/chime.ts` for the four shapes and why there are four.
   *
   * A setting rather than part of the running timer, and the line between
   * them is what a backup should carry: a timer with ninety seconds left is
   * not a plan and lives under its own key, while "I always want the quiet
   * bell" is a fact about the person and belongs in the file they would
   * restore from.
   *
   * Absent in every payload written before it existed, backfilled by
   * `normalizeLoaded` - and, unlike most settings, sanitised there rather
   * than refused by `validate`. See the note beside `SETTINGS`.
   */
  chime?: ChimeSettings
  /**
   * Calendars somebody else owns - see `CalendarSubscription`.
   *
   * The subscriptions sync, because a calendar added on the PC should appear
   * on the phone. What they contain does not: the events are refetched on each
   * device and cached under their own local key, since a week of somebody's
   * work meetings is not a plan worth carrying in a backup, and is stale the
   * moment it is written.
   */
  calendars?: CalendarSubscription[]
  /**
   * The words a recipe's name can start with to say which meals it is for -
   * "Lunch: a bean bowl" is lunch - Kitchen, v2.32, lib/mealWords.ts. Each
   * word, and the meals it says; a word may say none, and a name that starts
   * with it still sorts by it. Absent until somebody changes the list in
   * Settings, and read as the six meals' own names until then. Read through
   * `mealWordsOf`, which passes over anything malformed rather than
   * refusing the file - see the note beside `SETTINGS` in validate.ts.
   */
  mealWords?: MealWord[]
}

/**
 * The three answers about the timer's sound.
 *
 * `volume` is 0 to 1 and multiplies whatever the profile already asks for,
 * so it is a trim on a chosen sound rather than the thing that picks it -
 * see `playChime`. `atStart` rings once when the timer is started as well
 * as when it finishes, which exists for the one case that cannot check the
 * screen: ten minutes of meditation with the eyes shut.
 */
export interface ChimeSettings {
  profile: ChimeProfile
  volume: number
  atStart: boolean
}

/**
 * One external calendar, laid over the plan rather than mixed into it.
 *
 * These are not tasks and are never allowed to become them. A meeting is
 * something that happens to you: there is nothing to tick off, nothing to
 * push to tomorrow, and no version of it that counts towards a day's score.
 * It is the shape of the day you plan around, which is exactly why it has to
 * be visible and exactly why it has to look different.
 */
export interface CalendarSubscription {
  id: string
  name: string
  /**
   * The feed's address, for a subscription. Absent for a calendar imported
   * from a file, which has no source to refresh from and therefore lives only
   * on the device it was imported on.
   */
  url?: string
  color: string
  enabled: boolean
}

/**
 * Template ids keyed by weekday, 0 = Sunday through 6 = Saturday - the same
 * numbering `Date.getDay()` uses, so nothing has to translate between them.
 * A missing key means that weekday starts empty.
 */
export type WeekdayMap = Partial<Record<number, string>>

/**
 * A rule under a goal - what pulls me off it: a trigger decided on in
 * advance, and the one thing to do when it happens.
 *
 * Retired with goals in v2.28 - see DECISIONS "North is one text, goals
 * retired". Nothing in the app reads or writes one any more. The type, its
 * table in `validate.ts` and its sync entity stay, so a backup or an older
 * device that still holds rules keeps every one of them: they load, merge
 * and export as they always did, and nothing shows them.
 *
 * A payload from before v2.0 also carries `dayTypes`, `when` and
 * `lastSurfaced`, and one from before v2.20 a `color`; they ride along
 * untouched - the tables in `validate.ts` name what the app reads, not
 * everything a stored object is allowed to hold.
 */
export interface IfThenEntry extends Timestamped {
  id: string
  trigger: string
  action: string
  /**
   * The goal the rule was written under - a `Goal.id` - or absent for one
   * that was never filed. A dangling id is not an error, like every other id
   * in this app.
   */
  goalId?: string
}

/**
 * One line in the scratch stream - see lib/scratch.ts.
 *
 * Text, and when it was written. Nothing else is asked for at the time,
 * because the time is the whole point: a number somebody just said out loud
 * has to be down before they finish the sentence. The date is kept as its
 * own key rather than derived from the instant, so a note written at 00:30
 * stays on the day it felt like, on whichever device reads it.
 */
export interface ScratchNote extends Timestamped {
  id: string
  text: string
  /** ISO instant. The stream's only order. */
  createdAt: string
  /** The date key it was written on. */
  date: string
  /** Kept at the top of the stream. Absent is not pinned. */
  pinned?: boolean
  /**
   * The task this note was made into, and the day it landed on.
   *
   * The note is kept rather than consumed - see `scratchToTaskKeepingNote`.
   * The words somebody wrote are not the same thing as the title of the
   * task they turned into, and a note with a screenshot in it is where the
   * screenshot has to stay.
   */
  taskId?: string
  taskDate?: string
  /**
   * Photographs, as ids into IndexedDB plus the shape to lay out before the
   * blob loads - never the picture itself. This is the whole reason a note
   * can carry one without breaking sync or the backup: what travels is a
   * few dozen bytes, and the picture stays on the device it was taken on.
   * See lib/photos.ts and DECISIONS "A photograph stays on the device it
   * was taken on".
   */
  photos?: NotePhoto[]
}

/** An id into the photo store, and the two numbers a thumbnail needs. */
export interface NotePhoto {
  id: string
  width: number
  height: number
}

/**
 * One line caught before v2.7, when the inbox was a shelf of its own.
 *
 * Nothing writes one any more. The shape is kept so a payload from an older
 * device or an older backup still validates, and `foldInbox` in later.ts
 * turns every one it meets into a `LaterItem` on the way in.
 */
export interface InboxItem extends Timestamped {
  id: string
  text: string
  /** When it was caught, as an ISO instant - the only order the inbox had. */
  captured: string
}

/**
 * Something to do, that is not for any particular day.
 *
 * Later is where a line goes when the moment of writing it is not the moment
 * to decide when. Until v2.7 there were two such shelves - an inbox for a
 * line nobody had decided about, and a backlog for one somebody had - and
 * the only thing "decided" ever tracked was which button had been pressed:
 * the rows looked the same and had the same two ways out. So there is one
 * list now, with the backlog's mechanics and the inbox's cheap way in. See
 * docs/HISTORY.md, the v2.7 wave.
 *
 * **There is no `createdAt`, and that is the design.** A list that shows
 * how long something has been sitting there is a list that accuses you every
 * time you open it, which is exactly the pressure this app exists to take
 * away - see docs/RESEARCH-ADHD.md and CONVENTIONS.md section 11 for the same
 * rule applied to scratch. The surest way to guarantee nothing can ever show
 * an age is to not record one. `updatedAt` is stamped by `commit()` for sync
 * and is a fact about a device, never shown to anybody.
 *
 * Order is priority, and it is the array's own order: dragging a row up is
 * the only ranking this list has. No stars, no urgency, no due dates.
 *
 * On the wire the list is still called `backlog` and its sync kind is still
 * `'backlog'`. Renaming the field would have made every older device's
 * tombstones - `backlog:<id>` - miss, so a delete on one device would come
 * back from the other. The name a person reads is Later, everywhere; the
 * name the file uses is the one it has always used.
 */
export interface LaterItem extends Timestamped {
  id: string
  title: string
  /** One of `AppData.categories`, the same as a task's. Absent means uncategorised. */
  category?: CategoryId
  /** How long it is expected to take. Absent is unsized, not zero. */
  minutes?: number
}

/**
 * A goal, as North held one until v2.28: a title, why it matters, who it
 * makes you, what you do to deserve it and what you do not.
 *
 * Retired - see DECISIONS "North is one text, goals retired". North is one
 * text, and nothing shows a goal. The type, its table in `validate.ts` and
 * its sync entity stay, so every goal in a backup or on an older device is
 * kept: `retireGoals` in north.ts moves the active ones' titles and whys
 * into North's picture where the text has none, and archives them, once.
 * Nothing is deleted, and every field here is still read from a file.
 */
export interface Goal extends Timestamped {
  id: string
  title: string
  why?: string
  identity?: string
  /** What you do to deserve it, a line each. */
  deserve?: string[]
  /** The other half: what the person it makes you does not do. */
  avoid?: string[]
  /** The date key it was written on. */
  createdAt: string
  /**
   * The date key it was archived on: by hand until v2.28, and by
   * `retireGoals` for every goal still active then.
   */
  archivedAt?: string
  /** Made by the tour, while the tour still asked for a goal. */
  tourCreated?: boolean
}

/**
 * North: one text, in the person's own words, read every morning.
 *
 * Since v2.22 it is the whole of the North page - see DECISIONS "North is a
 * text". A dozen or so short lines in blocks, a blank line between blocks;
 * no headings, no fields, no structure the app adds, because a person is
 * not a form. The blank lines are the person's own and are kept exactly;
 * only the ends of the whole text are trimmed. The app never suggests a
 * word of it: it starts empty, and the placeholder only says where to
 * write.
 *
 * One entity of its own rather than a settings field, because it is
 * content the person authored - CONVENTIONS section 7, in its singleton
 * case: there is exactly one, so one entity is exactly its grain. It syncs
 * under `PICTURE_KEY`, and erasing it is a deletion with a tombstone, so an
 * erase sticks rather than being handed back by a device that still has the
 * old text. A blank string in a settings field would have been a body, not
 * a deletion, and would have come back. The name `picture` is from v2.18,
 * when it was a few lines over the goals; it stays for the sake of every
 * backup and every repo already holding it.
 */
export interface Picture extends Timestamped {
  text: string
}

/**
 * North's switches. The two under Nudges are carried only when they are
 * off, because a reminder somebody did not want is a reminder they learn to
 * dismiss without reading.
 */
export interface NorthSettings {
  /**
   * The switch for the card that brought a goal forward on a Monday and
   * after a day that got away. The card and its row went with goals in
   * v2.28 and nothing reads this. Still written and still required, because
   * an older device's check refuses a plan without it.
   */
  afterASlowDay: boolean
  /**
   * North's signature and headings on the day, each heading opening what is
   * under it - see NorthDay. The name is from v2.23, when it was a row of
   * headings under the day's title, and stays for every backup holding it.
   * Absent means on: only the switch turned off is ever carried, so every
   * payload from before the row existed reads as on without a migration and
   * without a field on every plan.
   */
  stripOnDay?: boolean
  /**
   * North's picture and signature in a window over the day, the first
   * time the app is in view after five hours out of view - see northRead.ts.
   * Absent means on, the same way and for the same reason as `stripOnDay`.
   */
  windowAfterSleep?: boolean
}

/**
 * When and whether the day is allowed to end.
 *
 * A day needs an ending, and midnight is not one - it is a rollover, and a
 * planner whose only closing gesture is the clock going round leaves the
 * evening open for ever. See `eveningClose.ts` for what the card says and
 * CONVENTIONS.md section 15 for the tone it has to hold.
 */
export interface EveningCloseSettings {
  /** Off means the day simply never closes itself, and nothing is missing. */
  enabled: boolean
  /** "HH:MM". The other way in is finishing the last task, which needs no clock. */
  at: string
}

/**
 * One kind of thing a day is made of - "Deep work", "Health", or whatever the
 * person who uses this decided instead.
 *
 * The app ships six and owns none of them. See `categories.ts` for why the
 * number is about six and why that is advice rather than a cap.
 */
export interface Category extends Timestamped {
  id: string
  /** Shown next to the swatch wherever one is offered - colour is never the only signal. */
  label: string
  /**
   * Absent means the built-in pair in styles.css for this id - `--cat-core`
   * and the rest, which carry one value for dark and one for light. Present
   * means a literal hex the owner chose, used in both.
   *
   * Absent is the whole trick and it is worth keeping. A category means the
   * same thing in Dark and Light because the stylesheet carries two values per
   * id and the cascade picks; a hand-picked colour cannot do that, because one
   * hex is one hex. So an untouched default keeps the pair and only an edited
   * or new one carries a literal. Somebody who never opens this loses nothing.
   *
   * A category the owner made has no pair behind it, so its colour is
   * required - see `CategorySettings`, which does not offer "no colour" there.
   */
  color?: string
  /**
   * Whether this category's blocks end by themselves - done once their end
   * has passed, the way an ongoing block is (lib/selfEnding.ts). Absent is
   * Commute's yes and everybody else's no, so a plan written before this
   * field needs nothing done to it.
   */
  endsItself?: boolean
}

/**
 * The meals a recipe can be for, in the order Kitchen offers them. A recipe
 * may be for several - overnight oats are breakfast and a snack - and for
 * none. The ids are what a file holds; the words on the screen are
 * `MEAL_TYPE_LABELS` in lib/kitchen.ts.
 */
export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'pre-gym', 'post-gym', 'snack'] as const

export type MealType = (typeof MEAL_TYPES)[number]

/** A word a recipe's name can start with, and the meals it says - see `Settings.mealWords`. */
export interface MealWord {
  word: string
  meals: MealType[]
}

/**
 * How large a number on a recipe may be before a file carrying it is not
 * somebody's recipe. Generous: they exist so a hand-edited backup cannot put
 * a number in a line that no layout can hold, not to judge a meal.
 */
export const RECIPE_LIMITS = {
  kcal: 100_000,
  /** Protein, carbs and fat, in grams. */
  grams: 10_000,
  servings: 1_000,
  minutes: 100_000,
  cooked: 100_000,
} as const

/**
 * A recipe, in Kitchen - since v2.27. docs/RESEARCH-KITCHEN.md has why it is
 * shaped this way.
 *
 * An entity of its own in a top-level list, and not a `LibraryList`: a
 * library list is built on units a person counts through, and a recipe has
 * nothing to count through. It is a name and one free text, read by North's
 * rule - a line in capitals is a heading, and INGREDIENTS and STEPS are drawn
 * as a list and as numbered steps - and everything else is information a
 * person adds when they have it. Absent is "not given", never nought.
 *
 * Nothing is added up. The numbers are per serving and belong to the recipe;
 * no day, week or goal ever sums them, and nothing compares them with a
 * target.
 */
export interface Recipe extends Timestamped {
  id: string
  /** The name, trimmed, never empty. */
  title: string
  /**
   * Everything else about it, as typed: the two ends trimmed, nothing inside.
   * Empty for a recipe kept as a name and its facts, since v2.30 - the guard has
   * always taken any string, so an older device reads one too.
   */
  text: string
  /** Which meals it is for, in `MEAL_TYPES` order, each once. Absent rather than empty. */
  mealTypes?: MealType[]
  /** Per serving. A whole number. */
  kcal?: number
  /** Grams per serving, to one decimal. */
  protein?: number
  /** Grams per serving, to one decimal. */
  carbs?: number
  /** Grams per serving, to one decimal. */
  fat?: number
  /** How many servings the text makes. A whole number from one. */
  servings?: number
  /** How long it takes, start to plate. A whole number from one. */
  minutes?: number
  /**
   * How many times Done was pressed in Cook, until v2.30 took Cook away. Kept
   * for the backups and the older devices that carry it; nothing shows it or
   * writes it any more - docs/RESEARCH-KITCHEN.md section 6.1.
   */
  cooked?: number
}

export interface AppData {
  templates: Template[]
  days: Record<string, DayPlan>
  settings: Settings
  ifThens: IfThenEntry[]
  /**
   * Empty since v2.7. Whatever an older payload carries here is folded into
   * the top of Later by `foldInbox` - on load, and after every sync merge -
   * so this is `[]` the moment anything reads it. Still declared, and still
   * required, for as long as an older device's payload can turn up: its
   * `inbox` list has to validate and its `inbox:<id>` tombstones have to
   * keep matching, and both need the field to exist.
   */
  inbox: InboxItem[]
  /**
   * Later: undated things to do, in priority order. The field keeps the name
   * it was written under - see `LaterItem` for why. Backfilled to empty like
   * the rest; absent in every payload written before it existed.
   */
  backlog: LaterItem[]
  /**
   * The scratch stream. Backfilled to empty like the rest; absent in every
   * payload written before it existed.
   */
  scratch: ScratchNote[]
  /**
   * Every library list. Backfilled to empty exactly like `inbox`, and empty
   * is the shipped state: the Library tab offers two starter lists the way
   * Templates offers three starter templates, and creates neither until
   * somebody taps one.
   */
  library: LibraryList[]
  /**
   * Goals, retired in v2.28 - see `Goal`. Backfilled to empty like
   * `library`; nothing adds to it any more, and a plan that holds goals
   * keeps them.
   */
  goals: Goal[]
  /**
   * The picture - see `Picture`. Absent until written, which is every
   * payload from before North v2 and every person who has not written one
   * yet; absent is not blank, it is the invitation still showing.
   */
  picture?: Picture
  /**
   * What kinds of thing a day is made of, and the colour each one is drawn in.
   *
   * A top-level list beside `library` and `goals` rather than a settings
   * field, and that placement is the decision. It is content the person
   * authors, the same shape a library list is; a settings field is one sync
   * entity, so two devices editing two different categories would fight over
   * one key and one of the two edits would simply vanish. Per-entity merge
   * and tombstones come free at this grain.
   *
   * Backfilled to the six defaults when absent, which is every backup written
   * before this existed. Nothing on disk is recoloured or renamed by that.
   */
  categories: Category[]
  /**
   * Kitchen's recipes, since v2.27 - see `Recipe`. A top-level list like
   * `library` and `goals`, for the same reason: content the person authors,
   * one sync entity per recipe. Backfilled to empty, which is every backup
   * written before Kitchen existed and the shipped state.
   */
  recipes: Recipe[]
  /**
   * Rotating shifts' routines, since v2.29 - see `Routine`. Backfilled to
   * empty, which is every backup written before them and the shipped state.
   */
  routines: Routine[]
  /**
   * When each synced settings field last changed - see `SYNCED_SETTINGS`. A
   * map rather than a field on `Settings`, because a boolean has nowhere to
   * carry a timestamp.
   */
  settingsUpdatedAt?: Record<string, string>
  /**
   * Deletions, as `entityKey -> ISO instant`. Without these, deleting a task
   * on one device and syncing means the other - which still has it - looks
   * like the one with the newer information and hands it straight back. See
   * `syncEntities.ts`.
   */
  tombstones?: Record<string, string>
}
