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
}

export interface Template {
  id: string
  name: string
  color: string
  blocks: TemplateBlock[]
  /**
   * Absent means 'full' - a template saved before this field existed
   * loads and scores exactly as it always did.
   */
  type?: DayType
}

export interface Task {
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
}

export interface DayPlan {
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
   * Copied from the template's type at the moment of stamping, not looked
   * up live - so editing or deleting the template afterward does not
   * silently change how an already-stamped day is scored. Absent means
   * 'full', same as an unstamped or hand-built day always scored.
   */
  dayType?: DayType
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
  sleepWindow: SleepWindow
  /**
   * The same idea, for a day whose type is `'night'` - see `windowFor`.
   * Kept as its own independent setting rather than a fixed shift applied
   * on top of `sleepWindow`, because a night shift's actual sleep hours are
   * not a predictable offset from a day shift's - they are a different
   * schedule entirely, one the owner is the only person who can state.
   * Defaults to 00:00-13:00, the inverse of the fixed 13:00-24:00 window
   * this setting replaces, so behaviour for a night day is also unchanged
   * for anyone who has not set one.
   */
  nightSleepWindow: SleepWindow
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
export interface IfThenEntry {
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

export interface AppData {
  templates: Template[]
  days: Record<string, DayPlan>
  settings: Settings
  ifThens: IfThenEntry[]
}
