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
   * Which of `CATEGORIES` (`src/lib/categories.ts`) this block belongs to.
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
}

export interface Template extends Timestamped {
  id: string
  name: string
  color: string
  blocks: TemplateBlock[]
  /** Which sleep schedule days stamped from this template use - see `SleepProfile`. */
  sleepProfileId?: string
  /**
   * Absent means 'full' - a template saved before this field existed
   * loads and scores exactly as it always did.
   */
  type?: DayType
}

export interface Task extends Timestamped {
  id: string
  time?: string
  title: string
  done: boolean
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
   * Which of `CATEGORIES` (`src/lib/categories.ts`) this task belongs to -
   * what colours its block on the timeline and the edge of its card in the
   * list. Arrives copied from the template block this task was stamped from,
   * or chosen in quick-add at the moment of typing it.
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
  /**
   * Free text the owner attached to this task - see the task detail sheet.
   * Absent and empty are the same thing; the card shows a small mark when
   * there is something here, never the text itself.
   */
  note?: string
  /**
   * Marks this task as one of the day's few that genuinely matter. Capped at
   * `MAX_HIGHLIGHTS` per day by `actions.toggleTaskHighlight` - a day where
   * everything is important is a day with no highlights at all, which is the
   * failure mode this exists to prevent.
   */
  highlight?: boolean
  /**
   * The steps this task breaks into. Absent means it does not break into
   * any, which is most tasks. Sub-steps are deliberately not tasks: they
   * have no time, no size, no category and never appear on the timeline,
   * because the moment they can be scheduled independently they stop being
   * a way of starting one thing and become three more things to plan.
   */
  subtasks?: Subtask[]
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

/** One step inside a task. Nothing more than a line of text and a tick. */
export interface Subtask {
  id: string
  title: string
  done: boolean
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
export interface LibraryItem extends Timestamped {
  id: string
  title: string
  /** Units in the whole thing. Absent means open-ended, not zero. */
  total?: number
  /** Units finished. Absent means none. Never exceeds `total` when there is one. */
  progress?: number
  /** The date key it was finished on. Absent means it is still going. */
  finished?: string
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
  items: LibraryItem[]
}

/** How many tasks on one day may be marked as highlights. See `Task.highlight`. */
export const MAX_HIGHLIGHTS = 3

export interface DayPlan extends Timestamped {
  date: string
  /**
   * Which template this day was stamped from, if any. Deliberately left in
   * place if that template is later deleted - a stamped day genuinely
   * happened, and deleting the template that described it does not undo
   * it. Every reader of this field (DayView, CalendarView, yearGrid) treats
   * a templateId with no matching template the same as no templateId at
   * all, so a dangling reference degrades gracefully rather than crashing.
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

export interface ReminderSettings {
  enabled: boolean
  /** How often, in minutes. Kept as a plain number so the control can offer a few sensible ones. */
  everyMinutes: number
  /** What it says. Editable, because the useful reminder is a different sentence for everybody. */
  text: string
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
  enabledWidgets: string[]
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
  /**
   * The nudge that fires while a Focus task is running - see
   * `IntervalReminder`. Off by default and off for everybody who never turns
   * it on: an app that interrupts you unasked is an app people mute, and this
   * one only ever speaks during work somebody already told it was work.
   */
  reminder: ReminderSettings
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
  /**
   * The nudge that fires shortly before a task with a time - see
   * `TaskReminderSettings`. Off by default, like every other thing in this
   * app that is allowed to interrupt.
   */
  taskReminder: TaskReminderSettings
  /** When a goal is allowed to come forward on its own - see `NorthSettings`. */
  north: NorthSettings
  /**
   * The date key the North card was last dismissed on, or absent.
   *
   * In settings rather than under its own local key, because "I have read this
   * today" is a fact about the person rather than about the device - the phone
   * should not ask again about a morning already answered on the PC. The
   * yesterday banner's own dismissal stays local: that one is about a list you
   * are looking at, not about a thing you were told.
   */
  northDismissedOn?: string
}

/**
 * Template ids keyed by weekday, 0 = Sunday through 6 = Saturday - the same
 * numbering `Date.getDay()` uses, so nothing has to translate between them.
 * A missing key means that weekday starts empty.
 */
export type WeekdayMap = Partial<Record<number, string>>

export interface TaskReminderSettings {
  enabled: boolean
  /** How many minutes before a task's own time the nudge fires. */
  minutesBefore: number
}

/**
 * Which stretch of the day a rule's trigger belongs to - see
 * `IfThenEntry.when` and `timeBandFor` in
 * `src/widgets/if-then/select.ts`. `'any'` and absent mean the same thing
 * (every band); both exist because a payload can carry either, but a rule
 * saved or edited through the app always writes absent for "any", the same
 * way an untagged entry always writes an absent `color` rather than a
 * literal "none" value.
 */
export type IfThenWhen = 'morning' | 'day' | 'evening' | 'any'

/**
 * An implementation intention: a trigger decided on in advance, paired with
 * the one concrete thing to do when it happens. Deliberately just those two
 * strings plus an optional tag - nothing here is measured. No done flag, no
 * count of how often it fired: turning one of these into a task would
 * undo the reason it works, which is that the decision already happened
 * and there is nothing left to track.
 */
export interface IfThenEntry extends Timestamped {
  id: string
  trigger: string
  action: string
  /**
   * A hex value from the shared palette in `src/lib/colors.ts`, same as
   * `Template.color`. Optional - a tag is a way to group related entries,
   * not a required field.
   */
  color?: string
  /**
   * Which day types this rule surfaces on - see docs/TIMELINE.md section 6.
   * Absent means every day, same as an entry written before this field
   * existed: a night-shift rule only makes sense to show on a night day,
   * but most rules have nothing to do with what kind of day it is, and
   * those should keep surfacing regardless without their owner having to
   * tick every box by hand.
   */
  dayTypes?: DayType[]
  /**
   * Which part of the day this rule's trigger belongs to. Absent (or
   * `'any'`) means every part of the day - an evening wind-down rule has
   * no business surfacing at 8am, but most rules are not tied to a
   * particular hour and should not have to name one to keep working the
   * way they always did.
   */
  when?: IfThenWhen
  /**
   * The date key (`YYYY-MM-DD`) this rule was last chosen to surface on
   * the day view - scheduling metadata for `pickIfThenRule` in
   * `src/widgets/if-then/select.ts`, never rendered and never a count.
   * This is deliberately not a use counter: it exists only so rotation can
   * favor whichever eligible rule has gone longest without a turn, the
   * same "least-recently-shown" idea a round-robin queue already uses.
   * Absent means never surfaced - see docs/RESEARCH-ADHD.md section 12,
   * "any measurement of if-then rules" is explicitly ruled out, and this
   * is not one: it records when the app last chose to show the rule, not
   * whether the person read it, acted on it, or did anything at all.
   */
  lastSurfaced?: string
}

/**
 * One line of text caught before it had anywhere to go.
 *
 * The inbox exists because the moment a thought arrives is almost never the
 * moment to decide what day it belongs on, and being asked to decide is
 * exactly what makes people stop writing things down. An item has no date, no
 * time, no size and no category - deliberately nothing to fill in. It becomes
 * a real task, on a real day, when someone chooses to make it one.
 */
export interface InboxItem extends Timestamped {
  id: string
  text: string
  /** When it was caught, as an ISO instant - the only order an inbox has. */
  captured: string
}

/**
 * A direction, not a task.
 *
 * This is the one type in this app with no `done`, no progress, no due date
 * and no count, and every one of those absences is deliberate. See
 * docs/DECISIONS.md and `north.ts` for the whole argument; the short version
 * is that showing progress toward a goal reliably licenses stopping, while
 * restating *why* it matters does not. So a goal is asked to carry a reason
 * and never asked to carry a number.
 *
 * The three text fields are three different questions, and the second two are
 * optional because a person who only has the first still has a goal:
 *
 * - `title` is what you are doing, short and in the imperative.
 * - `why` is what it is for, in a sentence or two, in your own words.
 * - `identity` is who it makes you - "I am someone who ...". The most
 *   powerful of the three when it is true and the most embarrassing when it
 *   is invented, which is why nothing ever asks for it twice.
 */
export interface Goal extends Timestamped {
  id: string
  title: string
  why?: string
  identity?: string
  /** The date key it was written on. Its age is read from this - see `goalAge`. */
  createdAt: string
  /**
   * The date key it was archived on. Present means it is no longer one of the
   * active few - reached, outgrown, or simply not this year's.
   *
   * Archiving is not a soft delete and carries no verdict: nothing records
   * *why* one was archived, because "achieved" and "abandoned" is exactly the
   * scoring this whole feature refuses to do.
   */
  archivedAt?: string
}

/** How many goals can be active at once. See `north.ts` for why it is four. */
export const MAX_ACTIVE_GOALS = 4

/**
 * When the app is allowed to bring a goal forward on its own - see
 * `shouldSurfaceNorth` in `north.ts`. Both default on, both switchable off,
 * because a reminder somebody did not want is a reminder they learn to
 * dismiss without reading.
 */
export interface NorthSettings {
  /** A quiet card after a day that got away - never a scolding, never a number. */
  afterASlowDay: boolean
  /** The same card, softer, on the first open of a Monday. */
  onMonday: boolean
}

export interface AppData {
  templates: Template[]
  days: Record<string, DayPlan>
  settings: Settings
  ifThens: IfThenEntry[]
  /**
   * Absent in every payload written before the inbox existed, which
   * `normalizeLoaded` backfills to an empty list - the same treatment
   * `ifThens` already gets.
   */
  inbox: InboxItem[]
  /**
   * Every library list. Backfilled to empty exactly like `inbox`, and empty
   * is the shipped state: the Library tab offers two starter lists the way
   * Templates offers three starter templates, and creates neither until
   * somebody taps one.
   */
  library: LibraryList[]
  /**
   * The big ones. Backfilled to empty exactly like `library` and `inbox`, and
   * empty is the shipped state - this app has never assumed it knows what
   * somebody is for.
   */
  goals: Goal[]
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
