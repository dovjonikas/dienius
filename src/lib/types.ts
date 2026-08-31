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

export interface Settings {
  theme: ThemeState
  enabledWidgets: string[]
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
}

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
}

export interface AppData {
  templates: Template[]
  days: Record<string, DayPlan>
  settings: Settings
  ifThens: IfThenEntry[]
}
