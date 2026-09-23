import type { LibraryItem, LibraryList } from './types'

/**
 * A whole shelf pasted at once - the owner's brief of 2026-09-22, part 4.
 *
 * One line a book: "A title - An author". A line in capitals is a list -
 * MAIN, SIDE, BOOKS - and every line under it goes into that list, so a
 * shelf written somewhere else arrives in the shape it was written in. The
 * lines before the first capitals line go into the list the screen is
 * pointed at.
 *
 * Everything here is pure: what the text says, against the lists that exist.
 * What it does about it - making a list, writing the items - is the store's
 * (`actions.importLibrary`), and the screen says what will happen before
 * anything does, the way Kitchen's paste does.
 */

/** How a title and its author are written apart: a dash with a space either side. */
const DASH = /\s+[-–—]\s+/

/** Titles compare the way a paste finds the one it is writing over: trimmed, one space, no case. */
export function sameTitle(a: string, b: string): boolean {
  const flat = (s: string) => s.trim().replace(/\s+/g, ' ').toLocaleLowerCase()
  return flat(a) === flat(b)
}

/**
 * Whether a line names a list rather than a book: every letter in it is a
 * capital, and there are at least two of them. "MAIN" is a list; "A Room"
 * is not, and neither is "1984".
 */
export function isListLine(line: string): boolean {
  const letters = line.replace(/[^\p{L}]/gu, '')
  return letters.length >= 2 && letters === letters.toLocaleUpperCase()
}

export interface PastedRow {
  /** The list it goes into, by name as the text or the screen gave it. */
  list: string
  title: string
  author?: string
  /** Whether that list already has an item of this title. */
  state: 'new' | 'update'
}

export interface PastedLibrary {
  rows: PastedRow[]
  /** The lists the text names that do not exist yet, in the order they first appear. */
  newLists: string[]
}

/**
 * The text read against the lists that exist.
 *
 * @param into The list the lines before the first capitals line go into, by
 * name. The screen offers the lists there, so this is always a name a person
 * chose or typed.
 */
export function readPastedLibrary(text: string, lists: readonly LibraryList[], into: string): PastedLibrary {
  const rows: PastedRow[] = []
  const newLists: string[] = []
  let current = into.trim()

  const listNamed = (name: string): LibraryList | undefined => lists.find(l => sameTitle(l.name, name))
  const itemsOf = (name: string): Pick<LibraryItem, 'title'>[] => listNamed(name)?.items ?? []

  for (const raw of text.split(/\r\n|\r|\n/)) {
    const line = raw.trim()
    if (line === '') continue
    if (isListLine(line)) {
      current = tidyListName(line)
      if (current && !listNamed(current) && !newLists.some(name => sameTitle(name, current))) newLists.push(current)
      continue
    }
    if (!current) continue

    const at = lastDash(line)
    const title = (at < 0 ? line : line.slice(0, at)).trim()
    const author = at < 0 ? undefined : line.slice(at).replace(DASH, '').trim()
    if (!title) continue

    // A title said twice in one paste: the later line is the one read, the
    // way a pasted recipe of a name said twice is.
    const before = rows.findIndex(row => sameTitle(row.list, current) && sameTitle(row.title, title))
    const state: PastedRow['state'] = itemsOf(current).some(item => sameTitle(item.title, title)) ? 'update' : 'new'
    const row: PastedRow = { list: current, title, ...(author ? { author } : {}), state }
    if (before >= 0) rows[before] = { ...row, state: rows[before].state }
    else rows.push(row)
  }

  return { rows, newLists }
}

/** Where the last dash with spaces around it starts, or -1 for a line with none. */
function lastDash(line: string): number {
  let at = -1
  const search = new RegExp(DASH, 'g')
  for (let found = search.exec(line); found; found = search.exec(line)) at = found.index
  return at
}

/**
 * A capitals line as a list is named: MAIN becomes Main, so a list made by a
 * paste reads like every other list. A name that is already somebody's - a
 * list of that name exists - is matched without case anyway.
 */
function tidyListName(line: string): string {
  const name = line.trim().replace(/\s+/g, ' ')
  return name.charAt(0) + name.slice(1).toLocaleLowerCase()
}
