import type { LibraryItem, LibraryList } from './types'

/**
 * The library: lists of things worked through a unit at a time.
 *
 * Everything here is pure. The store owns the writes, the view owns the
 * pixels, and this file owns the two questions both of them keep asking -
 * what is one unit of this list called, and how far through an item are we.
 */

/** The two lists offered on an empty Library, the way Templates offers three. */
export const STARTER_LISTS: { name: string; unit: string; unitShort: string }[] = [
  { name: 'Books', unit: 'chapter', unitShort: 'ch' },
  { name: 'Watching', unit: 'episode', unitShort: 'ep' },
]

/** "chapter" -> "chapters", unless the list names its own plural. */
export function unitPlural(list: Pick<LibraryList, 'unit' | 'unitPlural'>): string {
  if (list.unitPlural?.trim()) return list.unitPlural.trim()
  const unit = list.unit.trim()
  if (unit === '') return 'units'
  // Deliberately the two rules that cover almost every real unit word and
  // nothing more. English pluralisation is bottomless; a list whose unit
  // pluralises oddly says so itself in unitPlural rather than being guessed at.
  if (/(s|x|z|ch|sh)$/i.test(unit)) return unit + 'es'
  if (/[^aeiou]y$/i.test(unit)) return unit.slice(0, -1) + 'ies'
  return unit + 's'
}

/** "ch", falling back to the full unit when the list never named a short form. */
export function unitShort(list: Pick<LibraryList, 'unit' | 'unitShort'>): string {
  return list.unitShort?.trim() || list.unit.trim() || 'unit'
}

export function itemProgress(item: LibraryItem): number {
  const raw = item.progress ?? 0
  if (!Number.isFinite(raw) || raw < 0) return 0
  return item.total !== undefined ? Math.min(Math.floor(raw), item.total) : Math.floor(raw)
}

export function isItemFinished(item: LibraryItem): boolean {
  if (item.finished !== undefined) return true
  return item.total !== undefined && item.total > 0 && itemProgress(item) >= item.total
}

/**
 * "ch 4/12", or "ch 4" with no total. Short by design: this string sits on a
 * task card beside a title and a duration, where a sentence would not fit and
 * a bare fraction would not say what it counted.
 */
export function progressLabel(list: Pick<LibraryList, 'unit' | 'unitShort'>, item: LibraryItem): string {
  const done = itemProgress(item)
  return item.total !== undefined ? `${unitShort(list)} ${done}/${item.total}` : `${unitShort(list)} ${done}`
}

/** 0-100, or undefined for an item with no total to be a fraction of. */
export function progressPercent(item: LibraryItem): number | undefined {
  if (item.total === undefined || item.total <= 0) return undefined
  return Math.round((itemProgress(item) / item.total) * 100)
}

/**
 * The item a session on this list should go into: the first unfinished one.
 *
 * First rather than "most recently touched" because the list is hand-ordered
 * and drag-reorderable - the owner has already said which is next by putting
 * it there, and second-guessing that with a timestamp would make the order
 * they arranged mean nothing.
 */
export function currentItem(list: LibraryList): LibraryItem | undefined {
  return list.items.find(item => !isItemFinished(item))
}

export interface ParsedLibraryItem {
  title: string
  total?: number
}

/** Anything that is plausibly a unit word, so "12 chapters" parses on any list. */
const TRAILING_COUNT = /[,\u2013-]?\s*(\d{1,4})\s*([a-z]+)?\s*$/i

/**
 * Turns one typed line into an item.
 *
 * "Daring Greatly, 12 chapters" -> { title: 'Daring Greatly', total: 12 }
 * "Andor s2, 12"                -> { title: 'Andor s2', total: 12 }
 * "The Odyssey"                 -> { title: 'The Odyssey' }
 *
 * The trailing number is only taken as a total when something is left in
 * front of it - "12 chapters" on its own is a title, however odd, because
 * silently producing an item with no name is worse than taking a strange one
 * at its word. A number in the middle of a line is left alone entirely, so
 * "Catch-22" and "Andor s2" survive being typed.
 */
export function parseLibraryItemInput(input: string): ParsedLibraryItem | undefined {
  const text = input.trim()
  if (text === '') return undefined
  const match = TRAILING_COUNT.exec(text)
  if (!match) return { title: text }
  const title = text.slice(0, match.index).trim().replace(/[,\u2013-]$/, '').trim()
  if (title === '') return { title: text }
  const total = Number(match[1])
  if (!Number.isFinite(total) || total <= 0) return { title: text }
  return { title, total }
}
