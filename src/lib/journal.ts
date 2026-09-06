import type { DayPlan } from './types'
import { formatDayTitle } from './dates'

/**
 * A journal, not a form.
 *
 * v2.3 asked three questions on a schedule: a line under the North line in
 * the morning about what the day was for, and two on the evening close card
 * about what was real and what to tell yourself tomorrow. It was a good
 * idea and it was wrong, and the owner said so plainly: too much. A form
 * that appears every evening with three empty boxes in it is a form
 * somebody starts skipping, and then starts avoiding the card that carries
 * it.
 *
 * So: a day, and whatever anybody wanted to say on it. One free text field
 * per day, written when there is something to write. No questions, no
 * fields, no length, no streak, and above all no count of the days with
 * nothing on them - a day with nothing in it is most days and is not a
 * state this app remarks on anywhere.
 *
 * It lives on the day (`DayPlan.journal`), so sync, the backup and the
 * snapshots carry it the way they carry everything else on a day, and the
 * only way out is a copy: a day, a week or a month as markdown, to paste
 * into whatever is reading it next. See DECISIONS "A journal, not a form".
 */

/** Whether anything was actually written on this day. Whitespace is not writing. */
export function hasJournal(day: DayPlan | undefined): boolean {
  return !!day?.journal?.trim()
}

/** The dates, in order, that have anything written on them. */
export function daysWithJournal(days: Record<string, DayPlan>, dates: string[]): string[] {
  return dates.filter(date => hasJournal(days[date]))
}

/**
 * A stretch of days as markdown, for pasting somewhere else.
 *
 * A heading, then one section per day that has something written, with the
 * words as they were typed. Days with nothing are not listed: a pasted
 * month is the month's words, not a record of which days had none.
 *
 * The month is the one this exists for. The owner's use is a month of
 * writing pasted into a conversation in one press.
 */
export function journalMarkdown(days: Record<string, DayPlan>, dates: string[], title: string): string {
  const out: string[] = [`# Journal, ${title}`]
  for (const date of daysWithJournal(days, dates)) {
    out.push('', `## ${formatDayTitle(date)}`, '', days[date].journal!.trim())
  }
  return out.join('\n') + '\n'
}

/**
 * The dates whose writing contains this, newest first.
 *
 * Plain substring, case-insensitive: a journal is prose somebody wrote for
 * themselves, and the thing they are looking for is a word they remember
 * using. An empty search finds nothing rather than everything, so an empty
 * box is not a list of every day ever written.
 */
export function searchJournal(days: Record<string, DayPlan>, query: string): string[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return []
  return Object.keys(days)
    .filter(date => days[date].journal?.toLowerCase().includes(needle))
    .sort((a, b) => b.localeCompare(a))
}

/**
 * What v2.3 wrote, read as what v2.5 keeps.
 *
 * The three fields become one entry, in the order the day said them, each
 * on its own line - so a day that answered all three reads as a short
 * paragraph and a day that answered one reads as that line. No labels and
 * no questions: the words are what was kept, and the questions they were
 * answers to are the thing being removed.
 *
 * Called from `normalizeLoaded`, so it runs once on load and the state that
 * reaches the app has only ever had the new shape. Nothing anybody wrote is
 * lost, and nothing has to be explained to them.
 */
export function mergeOldJournal(journal: unknown, bestMoment?: unknown): string | undefined {
  const written = typeof journal === 'string' ? [journal] : readOldFields(journal)
  // The best moment was the third question, on its own switch and with its
  // own place in the month. It goes with the other two, and what anybody
  // wrote into it belongs to the day the same way the rest does.
  if (typeof bestMoment === 'string') written.push(bestMoment)
  const lines = written.map(line => line.trim()).filter(Boolean)
  return lines.length > 0 ? lines.join('\n') : undefined
}

function readOldFields(journal: unknown): string[] {
  if (!journal || typeof journal !== 'object') return []
  const old = journal as { intent?: unknown; real?: unknown; tomorrow?: unknown }
  return [old.intent, old.real, old.tomorrow].map(line => (typeof line === 'string' ? line : ''))
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
