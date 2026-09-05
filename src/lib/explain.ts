/**
 * Every word this app uses that somebody arriving would not already know.
 *
 * The report that started this was one sentence: *"arriving for the first
 * time I would not even know what Ongoing means."* It is right, and the
 * problem is bigger than one word. This app has invented, or bent, about
 * twenty terms - Ongoing, Key, Push, Stamp, Focus, day type and its four
 * values, the difference between the inbox and the backlog, what a unit is
 * in the library, what North is for, what a sleep schedule does, and how
 * sync differs from a backup. Every one of them means something precise
 * here and something else, or nothing, everywhere else.
 *
 * ## Why the copy is in one file
 *
 * Because it is copy, and copy is read as copy or it is not read at all.
 * Scattered across twenty components as string literals, nobody ever sees
 * the whole vocabulary at once, nobody notices that two entries contradict
 * each other, and nobody can tell whether the app's voice is consistent.
 * Here it is one page you can read top to bottom in a minute, and the test
 * beside it is the list itself, so a term added without its sentence fails
 * rather than shipping empty.
 *
 * ## The rules the copy follows
 *
 * - **One or two sentences.** Anything longer is documentation, and this is
 *   not the place a person reads documentation.
 * - **Say what it does, not what it is.** "Never gets pushed to tomorrow and
 *   never asks to be finished" beats "an unbounded task".
 * - **The second person, plainly.** These are read at the moment somebody is
 *   confused, which is the worst possible moment for a definition written
 *   the way a manual writes one.
 * - **Never a promise the app does not keep.** If a sentence here and the
 *   behaviour disagree, the sentence is the bug.
 */

/** Every term that carries an explanation. The order is the reading order. */
export const EXPLAIN_IDS = [
  'north',
  'key-task',
  'push',
  'ongoing',
  'focus',
  'inbox',
  'backlog',
  'stamp',
  'day-type',
  'day-type-full',
  'day-type-shift',
  'day-type-night',
  'day-type-rest',
  'replan-interrupt',
  'replan-shift',
  'replan-away',
  'library-unit',
  'sleep-schedule',
  'sync',
  'backup',
  'template-day',
  'template-week',
  'add-to',
  'copy-to',
] as const

export type ExplainId = (typeof EXPLAIN_IDS)[number]

export interface Explanation {
  /** The word as the interface spells it. Used in the control's own label. */
  term: string
  /** One or two sentences. See the rules above. */
  text: string
}

export const EXPLANATIONS: Record<ExplainId, Explanation> = {
  north: {
    term: 'North',
    text: 'The few things your days are actually for, written down in your own words. Nothing here is scored, ticked or counted - it is here to be read, not worked through.',
  },
  'key-task': {
    term: 'Key task',
    text: 'The one or two things that would make today count even if nothing else happened. On a day that is not a full one, only these are scored.',
  },
  push: {
    term: 'Push',
    text: 'Moves a task to tomorrow instead of leaving it sitting on a day that has ended. A task can be pushed twice; the third time the app asks you to decide about it rather than move it again.',
  },
  ongoing: {
    term: 'Ongoing',
    text: 'A block that is simply running - work, a shift, being at a place - rather than a job to finish. It is never pushed to tomorrow and never asks to be ticked off.',
  },
  focus: {
    term: 'Focus',
    text: 'Puts one task on the screen with a clock on it and everything else out of the way. It is offered on the task that is running right now, and you can leave it whenever you like.',
  },
  inbox: {
    term: 'Inbox',
    text: 'A line you wrote down without deciding anything about it. It has no day, no time and no size, because being asked to decide is what stops people writing things down at all.',
  },
  backlog: {
    term: 'Backlog',
    text: 'Something you have decided to do, but not on any particular day. It never comes looking for you and nothing records how long it has been there.',
  },
  stamp: {
    term: 'Stamp',
    text: 'Copies a template onto a date, so a day arrives already planned. What lands is yours from then on - editing the template afterwards leaves the stamped day alone.',
  },
  'day-type': {
    term: 'Day type',
    text: 'What kind of day this is, which is the app deciding what counts as a good one. A day you were never going to spend planning should not be scored as though you were.',
  },
  'day-type-full': {
    term: 'Full day',
    text: 'A day that is yours, where everything on the list counts toward how it went.',
  },
  'day-type-shift': {
    term: 'Shift',
    text: 'A day mostly spent at work, where only the blocks you marked core are scored.',
  },
  'day-type-night': {
    term: 'Overnight',
    text: 'A night shift, scored on its core blocks, with sleep landing in the day rather than around it.',
  },
  'day-type-rest': {
    term: 'Rest',
    text: 'A day off, scored on its core blocks only. Doing nothing else on it is the point, not a shortfall.',
  },
  'replan-interrupt': {
    term: 'Something came up',
    text: 'Fits one new thing into the day and shows you what it lands on before anything moves. Whatever it hits is moved later or offered to tomorrow, never quietly dropped.',
  },
  'replan-shift': {
    term: 'Shift the rest',
    text: 'Moves everything still to come later by the same amount, in one press. For an afternoon that started forty minutes late.',
  },
  'replan-away': {
    term: 'Away',
    text: 'Pauses the day while you are not there: nothing nudges and nothing counts against you. Coming back offers one rescue of what still fits.',
  },
  'library-unit': {
    term: 'Unit',
    text: 'What one sitting of this moves along - a chapter, an episode, twenty pages. Ticking a session off the day advances the count by one unit.',
  },
  'sleep-schedule': {
    term: 'Sleep schedule',
    text: 'When you are asleep, so the app never offers a slot at four in the morning. A day can use a different one from the rest of the week, which is what makes night shifts work.',
  },
  sync: {
    term: 'Sync',
    text: 'Keeps two devices carrying the same plan, through a small server you run yourself. It is about having the same day on the phone and the laptop, not about keeping the day safe.',
  },
  backup: {
    term: 'Backup',
    text: 'A copy of everything, written somewhere else, that you can bring back later. That is the one that keeps the day safe, and it is worth having whether or not you sync.',
  },
  'template-day': {
    term: 'A day',
    text: 'One shape of day you can stamp onto any date - a workday, a rest day, a night shift. Most templates are this.',
  },
  'template-week': {
    term: 'A week',
    text: 'Seven days in one template, each with its own blocks, so a gym rotation or a shift pattern lives in one place. Stamping a date takes that weekday’s column.',
  },
  'add-to': {
    term: 'Add to',
    text: 'Which days one press puts this block on: the day you have picked, the weekdays, the weekend, or all seven. Blocks added together are treated as one thing when you next edit them.',
  },
  'copy-to': {
    term: 'Copy to',
    text: 'Takes a day you have already built and puts it on the others, as it stands. What it copies is not linked back to the original except through the group it joins.',
  },
}

/** The copy for a term. */
export function explain(id: ExplainId): Explanation {
  return EXPLANATIONS[id]
}
