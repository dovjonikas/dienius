import type { AppData, LibraryItem, LibraryList } from './types'

/**
 * The owner's actual reading plan, put in once so it does not have to be
 * typed in.
 *
 * This is the one place in this app where something is created without being
 * asked for, and it is worth being honest about the tension: everywhere else
 * the rule is "offer, never install" - the starter templates, the starter
 * lists, the demo week. The exception is narrow and conditional. It only ever
 * fires when there is no Books list at all or one with nothing in it, so it
 * cannot overwrite, reorder or duplicate anything anybody has; a single item
 * added by hand stops it forever.
 *
 * Read `seedLibrary` for the exact guard. Removing this feature is deleting
 * this file and one call in App.tsx.
 */

interface SeedItem {
  title: string
  total?: number
  track?: LibraryItem['track']
  pace: string
}

/**
 * The queue, in the order it is meant to be read. Totals that are not known -
 * a book whose sections are short and unnumbered - are left absent rather
 * than guessed, which is the same refusal `capacity.ts` makes about an
 * unsized task: an invented number is worse than a missing one, because it
 * looks like a fact.
 */
const BOOKS: SeedItem[] = [
  {
    title: 'The War of Art',
    track: 'pages',
    pace: 'one section a day - finish Book Two, skim Book Three',
  },
  { title: 'The Psychology of Money', total: 20, pace: 'short chapters, finish it' },
  { title: 'Turning Pro', track: 'pages', pace: 'short, about a week' },
  { title: 'The Courage to Be Disliked', total: 5, pace: 'one night per sitting' },
  { title: 'Daring Greatly', total: 7, pace: 'one chapter a day' },
  { title: 'The Status Game', pace: 'one chapter a day' },
  { title: 'Sapiens', total: 20, pace: 'one chapter a day' },
  { title: 'Atomic Habits', total: 20, pace: 'one chapter a day' },
  // Last, and deliberately apart from the queue above: it is not part of the
  // main reading block, it is the thing for an evening with nothing left in
  // it. The pace note is what says so, because nothing else in this app
  // ranks or tags an item.
  {
    title: 'You Are Not So Smart',
    total: 48,
    pace: 'LIGHT slot - evening, optional, one mechanism per chapter',
  },
]

const BOOKS_LIST = { name: 'Books', unit: 'chapter', unitShort: 'ch' }

function itemFor(seed: SeedItem): LibraryItem {
  const item: LibraryItem = { id: crypto.randomUUID(), title: seed.title, pace: seed.pace }
  if (seed.total !== undefined) item.total = seed.total
  if (seed.track) item.track = seed.track
  return item
}

/**
 * Returns the state with the reading plan in it, or the same object back when
 * there is nothing to do.
 *
 * **Idempotent, and by the only test that matters: a list with anything in
 * it is left completely alone.** Not "an item with this title is skipped" -
 * that would fight somebody who deleted one on purpose, and would put it back
 * every morning. One item in Books, from any source, and this never runs
 * again.
 *
 * Returning the identical object when nothing changed is what lets the caller
 * skip the commit entirely, so an ordinary open does not write, stamp and
 * sync a state that is the same as the one it started from.
 */
export function seedLibrary(data: AppData): AppData {
  const existing = data.library.find(list => list.name.trim().toLowerCase() === 'books')
  if (existing && existing.items.length > 0) return data

  const items = BOOKS.map(itemFor)
  if (existing) {
    return { ...data, library: data.library.map(list => (list === existing ? { ...list, items } : list)) }
  }
  const list: LibraryList = { id: crypto.randomUUID(), ...BOOKS_LIST, items }
  return { ...data, library: [...data.library, list] }
}
