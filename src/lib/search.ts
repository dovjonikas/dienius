import { formatDayTitle } from './dates'
import { progressLabel } from './library'
import { scratchTitle } from './scratch'
import type { AppData } from './types'

/**
 * Finding things, without an index.
 *
 * There is no search index here and there will not be one. The whole store is
 * a few hundred kilobytes of JSON already in memory, and a linear scan over
 * it costs less than the keystroke that triggered it - an index would be a
 * second copy of the truth to keep in step, which is a category of bug this
 * app has spent a lot of effort not having.
 *
 * Scoring is deliberately crude and entirely explainable: a match at the
 * start of a title beats one in the middle, a title beats a note, and today
 * beats last March. Anything cleverer would need tuning nobody can do without
 * a corpus, and would make the results harder to predict - which is the one
 * thing a search box cannot afford.
 */

export type ResultKind = 'task' | 'note' | 'library' | 'scratch'

export interface SearchResult {
  kind: ResultKind
  /** Stable enough for a React key across a single query. */
  id: string
  title: string
  /** The line under the title - a date, a list name, the note itself. */
  detail: string
  /** Where Enter goes: a day to open, or a library item to reveal. */
  target: { type: 'day'; date: string } | { type: 'library'; listId: string; itemId: string } | { type: 'scratch'; id: string }
  score: number
}

const MAX_RESULTS = 12

/** Case- and accent-insensitive, so "cafe" finds "café" and vice versa. */
function fold(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/**
 * How well a haystack matches, or 0 for not at all.
 *
 * Three tiers, and no partial credit below them: the whole thing, a word
 * boundary, anywhere. A substring match is enough - fuzzy matching would find
 * "Deep work" for "dw", and also find it for half the other things somebody
 * might have typed.
 */
function matchScore(haystack: string, needle: string): number {
  const text = fold(haystack)
  const index = text.indexOf(needle)
  if (index === -1) return 0
  if (index === 0) return 3
  return /\s|[-_/]/.test(text[index - 1]) ? 2 : 1
}

export function searchEverything(data: AppData, query: string, today: string): SearchResult[] {
  const needle = fold(query.trim())
  if (needle.length < 2) return []

  const results: SearchResult[] = []

  for (const [date, day] of Object.entries(data.days)) {
    // Recency as a small thumb on the scale rather than a sort key: a task
    // called exactly what you typed, last month, should still beat a partial
    // match from this morning.
    const recency = date >= today ? 0.6 : date >= addMonths(today, -1) ? 0.4 : 0
    for (const task of day.tasks) {
      const title = matchScore(task.title, needle)
      if (title > 0) {
        results.push({
          kind: 'task',
          id: `task:${task.id}`,
          title: task.title,
          detail: `${formatDayTitle(date)}${task.done ? ' - done' : ''}`,
          target: { type: 'day', date },
          score: title * 2 + recency,
        })
        continue
      }
      // A note only matches on its own text, and only when the title did not
      // - one task should never be two results.
      const note = task.note ? matchScore(task.note, needle) : 0
      if (note > 0) {
        results.push({
          kind: 'note',
          id: `note:${task.id}`,
          title: task.title,
          detail: task.note!,
          target: { type: 'day', date },
          score: note + recency,
        })
      }
    }
  }

  for (const list of data.library) {
    for (const item of list.items) {
      const score = matchScore(item.title, needle)
      if (score === 0) continue
      results.push({
        kind: 'library',
        id: `lib:${item.id}`,
        title: item.title,
        detail: `${list.name} - ${progressLabel(list, item)}`,
        target: { type: 'library', listId: list.id, itemId: item.id },
        score: score * 2,
      })
    }
  }

  // The scratch stream is searchable for the same reason it exists: a number
  // written down in a hurry is only worth writing down if it can be found.
  for (const note of data.scratch) {
    const score = matchScore(note.text, needle)
    if (score === 0) continue
    results.push({
      kind: 'scratch',
      id: `scratch:${note.id}`,
      title: scratchTitle(note.text),
      detail: `Scratch - ${formatDayTitle(note.date)}`,
      target: { type: 'scratch', id: note.id },
      score: score + (note.date >= today ? 0.6 : 0.4),
    })
  }

  return results
    .sort((a, b) => (b.score === a.score ? a.title.localeCompare(b.title) : b.score - a.score))
    .slice(0, MAX_RESULTS)
}

/** Month arithmetic on a date key, clamped to the target month's real length. */
export function addMonths(dateKey: string, months: number): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const target = new Date(y, m - 1 + months, 1)
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  const day = Math.min(d, lastDay)
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/**
 * A date typed into the palette, or nothing.
 *
 * Four shapes, all of them things somebody actually types: a full date key,
 * a bare day number meaning this month, "today"/"tomorrow"/"yesterday", and a
 * weekday name meaning the next one. Anything else is a search, not a date -
 * this returns undefined rather than guessing, because a palette that jumps
 * to a random day when you meant to search is worse than one that does not
 * understand dates at all.
 */
export function parseDateQuery(query: string, today: string): string | undefined {
  const text = fold(query.trim())
  if (text === '') return undefined
  if (text === 'today') return today
  if (text === 'tomorrow') return shiftDay(today, 1)
  if (text === 'yesterday') return shiftDay(today, -1)

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text

  const dayOnly = /^(\d{1,2})$/.exec(text)
  if (dayOnly) {
    const day = Number(dayOnly[1])
    const [y, m] = today.split('-').map(Number)
    const last = new Date(y, m, 0).getDate()
    if (day >= 1 && day <= last) return `${today.slice(0, 7)}-${String(day).padStart(2, '0')}`
    return undefined
  }

  const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const index = weekdays.findIndex(name => name.startsWith(text) && text.length >= 3)
  if (index === -1) return undefined
  const [y, m, d] = today.split('-').map(Number)
  const current = new Date(y, m - 1, d).getDay()
  // The next one, never today: somebody typing "monday" on a Monday means the
  // Monday coming, or they would have typed "today".
  const ahead = ((index - current + 7) % 7) || 7
  return shiftDay(today, ahead)
}

function shiftDay(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const next = new Date(y, m - 1, d + days)
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`
}
