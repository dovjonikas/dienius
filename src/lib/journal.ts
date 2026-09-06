import type { DayJournal, DayPlan } from './types'
import { formatDayTitle } from './dates'

/**
 * The journal: three lines a day, none of them required.
 *
 * One in the morning, under the North line - "Today: ..." - and two on the
 * evening close card: "What was real today?" and "What do I want to tell
 * myself tomorrow?". Plain text, no length limit, no streak, no count of
 * days written or days not. A day with nothing in it is most days and is
 * not a state the app remarks on anywhere - the same rule the scratch count
 * and the backlog keep, applied to the one place that could most easily
 * turn into a diary that scolds.
 *
 * The lines live on the day (`DayPlan.journal`), so sync, backup and the
 * snapshots carry them the way they carry everything else on a day, and
 * the only way out is a copy: the week or the month as markdown, to paste
 * into whatever is reading it next.
 */

export type JournalField = keyof DayJournal

/** The three, in the order a day says them. */
export const JOURNAL_FIELDS: JournalField[] = ['intent', 'real', 'tomorrow']

/** The question each field asks, as the card and the header word it. */
export const JOURNAL_QUESTIONS: Record<JournalField, string> = {
  intent: 'Today',
  real: 'What was real today?',
  tomorrow: 'What do I want to tell myself tomorrow?',
}

/** The label each line carries when it is read back - in the agenda, in the copy. */
export const JOURNAL_LABELS: Record<JournalField, string> = {
  intent: 'Today',
  real: 'What was real today',
  tomorrow: 'To myself, tomorrow',
}

/**
 * The journal with a change applied, or nothing when nothing is left.
 *
 * Every field is trimmed and a blank one is dropped rather than kept as an
 * empty string, and a journal with no fields is not an empty object but
 * absent - so a day nobody wrote on carries no key, takes no bytes, and
 * changes no sync entity. `undefined` in the patch leaves that field alone;
 * an empty string clears it.
 */
export function mergeJournal(current: DayJournal | undefined, patch: Partial<Record<JournalField, string | undefined>>): DayJournal | undefined {
  const next: DayJournal = { ...current }
  for (const field of JOURNAL_FIELDS) {
    const value = patch[field]
    if (value === undefined) continue
    const trimmed = value.trim()
    if (trimmed === '') delete next[field]
    else next[field] = trimmed
  }
  return JOURNAL_FIELDS.some(field => next[field]) ? next : undefined
}

export function hasJournal(day: DayPlan | undefined): boolean {
  const journal = day?.journal
  return !!journal && JOURNAL_FIELDS.some(field => !!journal[field])
}

/** The dates, in order, that have anything written on them. */
export function daysWithJournal(days: Record<string, DayPlan>, dates: string[]): string[] {
  return dates.filter(date => hasJournal(days[date]))
}

/**
 * A stretch of days as markdown, for pasting somewhere else.
 *
 * A heading, then one section per day that has something written, with the
 * lines it has as a list and nothing for the ones it does not. Days with
 * nothing are not listed: a pasted week is the week's words, not a record
 * of which days had none - the same rule as everywhere else the journal
 * appears.
 */
export function journalMarkdown(days: Record<string, DayPlan>, dates: string[], title: string): string {
  const out: string[] = [`# Journal, ${title}`]
  for (const date of daysWithJournal(days, dates)) {
    const journal = days[date].journal!
    out.push('', `## ${formatDayTitle(date)}`, '')
    for (const field of JOURNAL_FIELDS) {
      if (journal[field]) out.push(`- **${JOURNAL_LABELS[field]}:** ${journal[field]}`)
    }
  }
  return out.join('\n') + '\n'
}

/**
 * Puts text on the clipboard, and says whether it got there.
 *
 * The clipboard API needs a secure context and a user gesture, which a
 * button press on the deployed site is; the fallback is the old way, for a
 * browser that has the newer API switched off. Neither throws out of here:
 * a copy that did not happen is reported by the button, not by a crash.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Fall through to the old way.
  }
  try {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    area.remove()
    return ok
  } catch {
    return false
  }
}
